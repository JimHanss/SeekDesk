# SeekDesk 编程 Agent 完整流程总结

## 当前定位
SeekDesk 当前默认模式是 `coding_agent`。产品目标是一个浏览器内的 AI 编程工作台：左侧管理会话，中间进行简洁对话，右侧按需打开文件、diff、终端输出、运行详情和审批记录。

`daily_work` 的历史数据结构仍作为兼容层保留，但当前 UI、API 编排和工具系统都优先走编程 Agent 链路。

## 端到端流程
1. 用户在左侧点击“新对话”或选择历史会话。
2. 用户在中间输入编程请求，前端向 `POST /api/chat` 发送 `mode: "coding_agent"`、`sessionId`、上下文引用和提示词。
3. API 构建会话上下文、工作区边界、最近工具轨迹、模型用量摘要，然后调用 DeepSeek provider 流式生成。
4. DeepSeek 可以生成文本回复，也可以生成工具计划。
5. 只读工具可由后端通过本地 runtime 执行，包括文件树、读文件、搜索、git status、git diff。
6. 写文件、编辑文件、运行 shell、运行测试会先保存为 pending tool call，并在运行详情里提示用户授权。
7. 用户授权后，前端创建会话内 permission grant，再调用 `POST /api/coding/tool-calls/:toolCallId/execute`。
8. API 再次校验 session、grant、工具 schema、workspace root、安全策略，然后调用 LocalCodingRuntime。
9. 执行结果写回 Postgres：tool call、activity event、artifact、session trace、model usage。
10. 前端刷新 trace、activity、artifact、model usage，把执行结果关联回当前会话。

## 功能关联
- 会话：保存用户消息、助手消息、自动标题、置顶、删除、重命名和创建时间倒序排序。
- 聊天：只展示核心对话，工具计划和审批细节通过运行详情打开。
- 文件：右侧按需查看文件树、读取文件内容、搜索结果和相关路径。
- Diff：通过 git diff 或工具输出展示待应用变更，写入动作必须审批。
- 终端：shell/test 输出只在用户授权后产生，并限制 cwd、超时、输出长度和环境变量暴露。
- 审批：grant 绑定 session、provider/action、过期时间和撤销状态，不跨会话复用。
- 产物：AI 生成的摘要、计划、补丁说明和执行结果可以保存为 artifact，并关联 session/tool call。
- 活动审计：每次工具计划、授权、执行成功/失败都会写 activity event，支持后续追踪。
- 模型用量：从真实 model usage 记录聚合当前会话、近期和总 token。
- 设置：模型、持久化、daemon/runtime、安全策略集中到设置入口，不占用默认聊天区。

## 安全边界
- workspace root 是所有文件和命令操作的硬边界。
- 读操作仍受 ignore 目录、文件大小、二进制检测限制。
- 写入、shell、测试、git 写操作必须审批。
- 明显破坏性命令默认拒绝。
- 所有执行结果必须可追踪到 session trace 和 activity event。
