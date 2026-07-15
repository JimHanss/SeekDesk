# SeekDesk Runtime 安全边界

## 信任模型

浏览器是不可信输入端。API 从服务端开发配置或已验证 OIDC/JWT 建立 `ActorContext`，不接受客户端覆盖 owner。所有执行必须同时匹配：

```text
ownerId + sessionId + workspaceId + runtimeMode + toolCallId/requestId
```

任一不一致都 fail closed。未知 workspace 不会回退到 `server_local`。

## Local Daemon 边界

- daemon 主动连接 API，服务器不能直接浏览用户电脑。
- pairing token 只用于 v1 配对；生产需要升级为用户登录、短期 token、轮换和设备撤销。
- daemon 注册稳定 workspaceId、绝对 root、平台和能力；所有相对路径在本机再次解析。
- root 外路径、`..` traversal、越界 symlink、ignore 目录、二进制和超限文件被拒绝。
- 系统目录选择器在用户电脑执行，浏览器不获取任意绝对路径访问权。
- 断线后 pending request 失败为 `daemon_offline/runtime_unavailable`，不会转发到其他 daemon。

## Cloud Runtime 边界

- 每个 workspace 使用 owner-scoped 存储目录和独立容器引用。
- 容器 rootfs 只读，`/tmp` 使用 tmpfs，代码卷只挂载到 `/workspace`。
- 进程使用 non-root UID/GID；禁止 privileged、Docker socket 和新增 Linux capabilities。
- 配置 CPU、内存、PID、磁盘和执行输出上限；普通工具执行默认 `network=none`。
- Git clone/bootstrap 可临时使用受控网络；完成后切回无外网执行 profile。
- cloud runtime internal API 只在私有网络提供，并要求恒定时间比较的 service bearer token。
- `CloudContainerEngine` 隔离 Docker 细节；API 不直接挂载 Docker socket。

## 凭据边界

- 仅支持公开 HTTPS Git 和加密 HTTPS token，不支持 SSH key。
- token 使用 owner-bound AES-256-GCM；密文记录 key version，支持 previous key 解密。
- 明文只在 clone bootstrap 的短生命周期内存在，通过临时 askpass 文件注入。
- token 不进入仓库 URL、命令参数、process list、Git config、状态 payload、日志或错误响应。
- 临时凭据文件必须限制权限，并在成功、失败、超时和取消路径都清理。
- 浏览器只读取 credential metadata，不读取密文或明文。

## 工具权限

### 自动只读

- `coding.list_files`
- `coding.read_file`
- `coding.grep`
- `coding.git_status`
- `coding.git_diff`

这些工具仍经过输入 Zod 校验、workspace root 校验、资源限制和结果截断。

### 必须审批

- `coding.write_file`
- `coding.edit_file`
- `coding.run_shell`
- `coding.run_tests`

grant 必须绑定同一 owner/session/workspace/runtime/action，且状态 active、未过期、未撤销。执行前 API 重新读取全部持久化记录；request body 只能用于一致性检查，不能选择新的执行端。

## Shell 与测试

- cwd 锁定在 workspace root 内。
- 明显破坏性命令在批准后仍会被 Runtime 拒绝。
- 设置 timeout、最大 stdout/stderr 和截断标记。
- 环境变量与错误文本经过 secret redaction。
- Windows 后台子进程使用隐藏窗口；cloud worker 接收结构化参数，不拼接 shell 管理命令。
- Git v1 只开放 status/diff，不开放 commit/push/reset 等写操作。

## 并发与审计

- 同一 cloud workspace 允许并发读，写入和命令串行。
- repository 原子 claim pending tool call，重复点击不会执行两次。
- requestId 贯穿 API、daemon/cloud service、worker 和审计记录。
- tool call、activity、operation、artifact 和 trace 必须记录完成、失败或取消，禁止无审计的外部执行。
- 删除 workspace 后拒绝新请求，取消队列，再停止容器和清理 owner-scoped 目录。

## 已知限制

- v1 pairing token 不是完整设备身份方案。
- v1 cloud runtime 依赖单机 Docker Engine，不具备跨节点调度和高可用。
- `daily_work` 历史 payload 表仍在兼容层，新的 coding 记录必须使用结构化 scope 列。
- 网络隔离与资源限制必须在实际 Docker Engine 上做最终验收，单元测试不能替代容器级验证。
