# SeekDesk 后端 API 与数据库总结

## 核心 API
- `GET /health`：返回 API 状态、数据层状态、Postgres 是否配置和可用、JSON fallback 状态。
- `POST /api/chat`：流式聊天入口；`mode: "coding_agent"` 时构建编程上下文、调用 DeepSeek、记录消息、工具计划和 token 用量。
- `GET /api/chat/sessions/:sessionId/trace`：返回会话 trace，包括 messages、toolCalls、activityEvents、artifacts、modelUsage、permissionGrants、permissionBoundary。

## Coding API
- `GET /api/coding/workspace`：返回 LocalCodingRuntime 状态、workspace root、支持能力和安全边界。
- `POST /api/coding/files/tree`：列出 workspace 内文件树；过滤 ignore 目录并限制深度和条数。
- `POST /api/coding/files/read`：读取文本文件；限制 workspace root、文件大小和二进制内容。
- `POST /api/coding/search`：在 workspace 内搜索文本；支持路径、glob、最大结果限制。
- `GET /api/coding/git/status`：读取 git status，只读操作。
- `POST /api/coding/git/diff`：读取 git diff，只读操作，可按路径过滤。
- `GET /api/coding/permission-grants`：查询会话内授权。
- `POST /api/coding/permission-grants`：创建会话内授权，用于写文件、编辑文件、shell、测试等动作。
- `POST /api/coding/permission-grants/:grantId/revoke`：撤销授权。
- `POST /api/coding/tool-calls/:toolCallId/execute`：执行已保存的 pending tool call，执行前再次校验 session、grant、工具输入和 runtime 安全策略。

## Daily 兼容 API
- `/api/daily/templates`：模板 CRUD、复制、软删除；聊天页读取 active 模板。
- `/api/daily/context/*`：上下文列表、使用预览、文件上传和解析后的文本上下文。
- `/api/daily/artifacts*`：产物列表、详情和 AI 生成产物保存。
- `/api/daily/events`：活动审计流。
- `/api/daily/model-usage`：从真实 model usage records 聚合 token 用量。
- `/api/daily/persistence`：持久化状态和数据层快照。

## Runtime 与服务层
- `services/coding-runtime.ts`：本地 runtime；负责路径解析、root 限制、文件读写、搜索、git、shell/test 执行和安全错误。
- `services/coding-tools.ts`：把 agent tool call 映射到 runtime；负责 pending、授权校验、执行结果和 activity 写回。
- `services/daily-work-agent-context.ts`：构建模型上下文；当前输出 workspace、安全边界、最近工具轨迹和用量摘要。
- `packages/agent/src/tools.ts`：注册工具定义；读操作可自动执行，写/shell/test 默认 permission_required。
- `packages/agent/src/loop.ts`：模型循环；解析 DeepSeek tool calls，最多多轮，把工具结果回填给模型。

## Postgres 表设计
- `daily_work_sessions`：会话详情、标题、状态、模式、关联上下文和产物。
- `daily_work_messages`：用户/助手消息、sessionId、role、content、时间戳。
- `tool_calls`：工具计划、输入、输出、状态、错误、previewOnly、permissionRequired、关联 session。
- `daily_work_permission_grants`：会话内授权，包含 provider、action、status、expiresAt、revokedAt。
- `daily_work_activity_events`：活动审计事件，记录工具计划、授权、执行、失败和产物生成。
- `daily_work_artifacts`：AI 生成产物、补丁摘要、执行结果和关联引用。
- `model_usage_records`：provider、model、promptTokens、completionTokens、totalTokens 和 sessionId。
- `daily_work_templates`：Agent 模板、system prompt、prompt template、工具白名单、上下文策略、状态和版本。
- `daily_work_context_items` / `daily_work_context_documents`：上下文条目、上传文件解析文本、hash、大小、token 估算和摘要。
- `daily_work_approvals`：兼容审批请求，当前新写入审批优先使用 permission grant。

## 数据层策略
- 生产优先 Postgres/Drizzle。
- 未配置 Postgres 时保留 JSON/seed fallback，便于本地启动和测试。
- schema 错误或非法 JSON 不静默覆盖，返回明确错误。
- 历史 migration 不重写；新的结构变更通过新增 migration 维护链路。
