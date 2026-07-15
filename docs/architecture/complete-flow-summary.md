# SeekDesk 双 Runtime 完整流程

## 产品入口

SeekDesk 当前默认模式是 `coding_agent`。页面采用简洁的编程对话工作台：左侧按工作区分组显示会话，中间是聊天，文件、搜索、Diff、终端和运行详情只在用户打开时出现在右侧。

新建对话必须先选择 Runtime 和工作区：

- `local_daemon`：用户电脑上的 daemon 主动连接 API，工作区是真实本地目录。
- `cloud_runtime`：服务端从 HTTPS Git 仓库创建隔离容器，工作区固定为 `/workspace`。

## 工作区创建与选择

### Local Daemon

1. 用户在本机启动 daemon，并提供 API URL、pairing token 和初始目录。
2. daemon 连接 `/ws/daemon`，注册机器、平台、协议版本、能力和工作区，并持续 heartbeat。
3. API 的 `DaemonRegistry` 保存在线连接，并把 owner/workspace 映射同步到 repository。
4. 新建对话弹窗列出在线本机工作区；目录选择和浏览请求只会发送给指定 daemon。
5. daemon 离线时工作区元数据仍保留，执行返回 `daemon_offline`，不会回退到服务器目录。

### Cloud Runtime

1. 用户输入仓库名称、公开 HTTPS URL、分支、`node22` image profile，可选已保存凭据。
2. API 验证 actor、owner 和请求 schema，写入 `workspaces` 与幂等 `workspace_runtime_operations`。
3. API 通过带 service token 的 internal client 提交 provision。
4. cloud runtime 创建 owner-scoped 存储目录，临时注入 Git token，执行 clone/checkout 并记录 revision。
5. Docker adapter 创建受限容器，runtime worker 固定使用 `/workspace`。
6. 状态依次变为 `provisioning -> cloning -> ready`；失败保存脱敏错误并可 retry。

## 会话与模型流程

1. 用户确认工作区后创建空会话，session 固定保存 `ownerId + workspaceId + workspaceRuntimeMode`。
2. 左侧历史按工作区分组；组内置顶会话优先，其余按 `createdAt` 倒序且排序稳定。
3. 第一条消息调用 `POST /api/chat`，必须携带 `mode: coding_agent` 和 `context.workspaceId`。
4. API 从可信 actor 获取 owner，重新读取 session/workspace 并校验绑定，客户端不能更换 Runtime。
5. Agent context 组合消息历史、工作区摘要、安全策略、近期 tool trace 和 token 用量。
6. DeepSeek provider 以流式文本和 tool-call delta 返回结果；无 key 时使用 mock provider。
7. 第一条消息完成后生成简短标题，并把 user/assistant message 与 model usage 写入同一 workspace。

## RuntimeResolver

`RuntimeResolver` 是所有 coding 路由和工具执行的唯一入口：

1. 根据可信 `ownerId` 读取持久化 workspace。
2. 校验请求 workspaceId、session 绑定和 runtimeMode 一致。
3. `local_daemon` 解析为指定在线 daemon adapter。
4. `cloud_runtime` 只在状态 ready 且 internal service 可用时解析为 cloud client adapter。
5. `server_local` 仅在显式开发配置开启时可用。
6. 未知、离线、未就绪或绑定不一致返回稳定错误，不做隐式 fallback。

文件树、读文件、搜索、Git status/diff 都通过同一 resolver，因此两个 Runtime 可以同时在线而不会串工作区。

## 工具与审批流程

### 自动只读工具

`coding.list_files`、`coding.read_file`、`coding.grep`、`coding.git_status`、`coding.git_diff` 可以自动执行，但仍受 root、symlink、ignore、大小、二进制和输出限制。结果写入 tool call 和 activity，随后返回模型或 UI。

### 需要审批的工具

`coding.write_file`、`coding.edit_file`、`coding.run_shell`、`coding.run_tests` 先保存为 pending tool call：

1. tool call 创建时保存 owner、session、workspace、runtimeMode、requestId 和已校验 input。
2. 运行详情展示目标文件或命令、工作区、Runtime 和风险。
3. 用户批准后创建 grant，绑定 `ownerId + sessionId + workspaceId + runtimeMode + action`，带有效期且可撤销。
4. 执行入口重新读取 session、workspace、tool call、grant 和 Runtime 状态；任一字段变化都拒绝。
5. repository 原子认领 pending call，防止重复点击产生重复执行。
6. Runtime 执行后同步写入 running/completed/failed/cancelled 状态。
7. 文件写入生成 artifact 并刷新对应路径的 Git diff；Shell/test 保存 command、cwd、stdout、stderr、exitCode、timeout 和 truncated。

## 数据与审计关联

同一次执行通过以下键关联：

- `ownerId`：租户/用户隔离边界。
- `workspaceId + runtimeMode`：唯一执行端和代码边界。
- `sessionId`：对话、授权和工具上下文。
- `toolCallId + requestId`：计划、传输、执行和重试追踪。
- `operationId`：cloud 生命周期或工具运行的异步状态。

`GET /api/chat/sessions/:sessionId/trace` 聚合 workspace、messages、tool calls、permission grants、activity events、artifacts、model usage 和 runtime operations。前端以此刷新运行详情、终端、Diff、活动和 token 面板。

## 故障与恢复

- daemon 断线：registry 清理在线连接，工作区显示离线；重连并注册同一稳定 workspaceId 后恢复。
- cloud stopped：执行返回 `runtime_not_ready`，用户启动后继续使用原 session 绑定。
- clone failure：operation 和 workspace 保存脱敏错误；retry 使用新幂等键重新进入 lifecycle。
- container crash：reconcile 比对 Docker 实际状态并更新 workspace；restart 后从持久化状态恢复。
- API restart：Postgres 保存 workspace/session/tool/grant/audit；daemon 自动重连，cloud service 重新 reconcile。
- 执行中断：tool call 与 activity 进入 failed/cancelled，不伪造成功，也不跨 Runtime 重试。

## 兼容边界

仓库仍保留部分 `daily_work` 表和 API 作为历史兼容层，但当前产品入口不显示邮箱、日历或连接器，也不会发起相关网络请求。新 coding 数据必须写入结构化 owner/workspace/runtime 列。
