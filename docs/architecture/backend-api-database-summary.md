# SeekDesk 后端 API 与数据库总结

## 请求身份与统一约束

所有公共 coding API 先通过 `ActorContextResolver` 获取可信 `ownerId`。开发模式使用服务端 `SEEKDESK_DEV_USER_ID`；生产模式验证 OIDC/JWT issuer、audience 和 JWKS。客户端提交的 user/owner 字段不能覆盖 actor。

会话、工作区、工具、授权和审计必须匹配 `ownerId + workspaceId + runtimeMode`。错误统一映射为 `workspace_not_found`、`workspace_access_denied`、`runtime_unavailable`、`runtime_not_ready` 或 `session_workspace_mismatch`。

## 公共 API

### 健康与聊天

- `GET /health`：API、Postgres/JSON data layer、DeepSeek、auth、daemon、cloud runtime、Docker readiness 和 server-local fallback 状态；不返回 secret。
- `POST /api/chat`：流式 coding chat；校验 session/workspace 绑定，保存 messages、tool calls 和 model usage。
- `GET /api/chat/sessions/:sessionId/trace`：聚合 workspace、runtime operation、messages、tools、grants、activity、artifacts 和 model usage。
- `GET /ws`：活动快照兼容 WebSocket。
- `GET /ws/daemon`：daemon register/heartbeat/request/response/cancel 通道，使用 pairing token。

### 工作区与生命周期

- `GET /api/coding/workspaces`：合并 owner 的持久化 cloud workspace 和在线/离线 local daemon workspace。
- `GET /api/coding/workspaces/:workspaceId`：工作区详情及最新 operation；cloud workspace 会同步 internal service 状态。
- `GET /api/coding/repository-credentials`：只返回 credential id/provider/label/时间/撤销状态，不返回密文。
- `POST /api/coding/workspaces/cloud`：创建 cloud workspace，写入 workspace 与 provision operation，返回 `202`。
- `POST /api/coding/workspaces/:workspaceId/start|stop|retry`：提交幂等 cloud lifecycle operation。
- `DELETE /api/coding/workspaces/:workspaceId`：进入 deleting 并异步清理容器与存储。

### Coding 读写

- `GET /api/coding/workspace`：解析指定 workspace/runtime 的状态和安全边界。
- `POST /api/coding/workspace/browse|select|pick`：仅 local daemon；浏览或选择用户电脑目录。
- `POST /api/coding/files/tree`：受限文件树。
- `POST /api/coding/files/read`：文本文件读取，拒绝越界、二进制和大文件。
- `POST /api/coding/search`：query/path/glob 搜索并限制结果量。
- `GET /api/coding/git/status`：只读 Git 状态。
- `POST /api/coding/git/diff`：只读 Git diff，可按 path 过滤。

### 审批与执行

- `GET /api/coding/permission-grants`：按 session/workspace/runtime/action 查询 owner-scoped grant。
- `POST /api/coding/permission-grants`：为同一 session 绑定创建限时 grant。
- `POST /api/coding/permission-grants/:grantId/revoke`：撤销 grant。
- `POST /api/coding/tool-calls/:toolCallId/execute`：原子认领 pending call，重新校验所有绑定和授权后交给 RuntimeResolver。

### 历史兼容 API

`/api/daily/sessions`、`/api/daily/events`、`/api/daily/artifacts`、`/api/daily/model-usage` 和 `/api/daily/persistence` 仍被 coding 页面用于兼容存储与聚合。模板、上下文等旧接口仍保留，但默认 coding 页面不发起邮箱、日历或连接器请求。

## Cloud Runtime 内部 API

所有 `/internal/*` 都要求 service bearer token，并返回/记录 `x-request-id`：

- `GET /internal/health`：Docker readiness 与 active workspace 数。
- `POST /internal/workspaces/:workspaceId/operations`：provision/start/stop/retry/delete。
- `GET /internal/workspaces/:workspaceId?ownerId=...`：workspace 与 operation 状态。
- `POST /internal/workspaces/:workspaceId/execute`：执行已校验 coding tool。
- `POST /internal/workspaces/:workspaceId/requests/:requestId/cancel`：取消排队或运行请求。

API 只通过 `CloudRuntimeClient` 调用这些接口。cloud service 使用 `CloudContainerEngine` 抽象 Docker，runtime worker 在容器内组合 `runtime-core`。

## 数据库设计

### 双 Runtime 核心表

- `workspaces`：主键 `id`；owner、runtime mode、status、root、repository URL/branch/revision、image、credential ref、daemon/container/storage ref、error、lastActive/stopped/deleted 时间。按 owner/runtime、owner/status、lastActive 建索引。
- `workspace_runtime_operations`：provision/start/stop/retry/delete/execute 状态，请求/结果、脱敏错误和时间；`ownerId + idempotencyKey` 唯一。
- `repository_credentials`：owner、provider、label、AES-GCM 密文、key version 和撤销时间；公共 API 永不返回 `encryptedSecret`。

### 会话与执行关联表

- `daily_work_sessions`：payload 兼容表，并有结构化 owner/workspace/runtime 列；保存 coding session 绑定、标题和状态。
- `daily_work_messages`：owner、session、workspace、runtime、role、content、payload 和创建时间。
- `tool_calls`：owner/session/workspace/runtime/requestId、tool name、input/output、status、permission flag、error、started/completed；`ownerId + requestId` 唯一。
- `daily_work_permission_grants`：owner/session/workspace/runtime/provider/action/decision/status、有效期、撤销时间和审计 payload。
- `daily_work_activity_events`：owner/workspace/runtime 的 payload 事件，记录计划、批准、执行、失败和恢复。
- `daily_work_artifacts`：owner/workspace/runtime 的文件写入、Diff 或模型产物，并在 payload 关联 session/tool。
- `model_usage_records`：owner/session/workspace/runtime、provider/model 和 prompt/completion/total token。

### 兼容表

`daily_work_templates`、`daily_work_context_items`、`daily_work_context_documents`、`daily_work_approvals`、`daily_work_workflows` 等仍使用 payload 表。历史 connector 表保留迁移兼容，但不属于当前 coding 产品流程。

## Repository 与事务边界

- `DailyWorkRepository` 是 API 的统一持久化接口。
- `PostgresDailyWorkRepository` 是生产实现；Seed/JSON 只用于开发降级和测试，JSON 不保存真实 repository token。
- owner-scoped repository 方法拒绝跨 owner 覆盖。
- tool execution 使用原子 claim，避免重复执行；状态写回同步关联 tool/activity/operation/artifact。
- Drizzle migration 只追加，不重写历史 migration；新增列先 backfill 再加约束与索引。

## 关键服务文件

- `services/runtime-resolver.ts`：选择 local daemon、cloud 或显式 server-local adapter。
- `services/daemon-registry.ts`：在线连接、heartbeat、pending request 和断线清理。
- `services/cloud-runtime-client.ts`：internal API、service token、timeout 和错误映射。
- `services/coding-tools.ts`：tool plan、grant 校验、原子执行和审计写回。
- `services/actor-context.ts`：开发身份和生产 OIDC/JWT。
- `services/credential-crypto.ts`：owner-bound AES-256-GCM、key version 与日志脱敏。
- `apps/cloud-runtime/src/lifecycle-service.ts`：clone、container lifecycle、execute queue、reconcile、idle stop 和 cleanup。
