# SeekDesk 代码地图

## 应用入口

### Web 工作台

路径：
- `apps/web/src/app/page.tsx`
- `apps/web/src/features/daily-work/DailyWorkDashboard.tsx`

用途：
- 渲染 coding agent 对话工作台、会话列表和按需打开的文件、搜索、Diff、终端与运行详情面板。

### API 服务

路径：
- `apps/api/src/server.ts`

用途：
- 创建 Fastify 服务，注册统一 actor hook、聊天流、session trace、daemon WebSocket、健康检查及业务路由。

关键函数：
- `buildServer`：组合 repository、身份解析、daemon registry 和公开 API。
- `modelStreamToReadableStream`：把模型流写回消息、工具调用、用量和活动记录。

### 本机 Daemon

路径：
- `apps/daemon/src/cli.ts`
- `apps/daemon/src/client.ts`
- `apps/daemon/src/local-runtime.ts`

用途：
- 从用户机器主动连接远程 API，注册 workspace、维持心跳并执行统一 coding tool request。

关键函数：
- `runDaemonCli`：解析 `health` 与 `start` 命令。
- `DaemonClient`：管理注册、heartbeat、request、cancel 和 response 协议。
- `LocalWorkspaceRuntime`：组合共享 runtime-core，并保留本机目录选择能力。

### Cloud Runtime Worker

路径：
- `apps/runtime-worker/src/cli.ts`
- `apps/runtime-worker/src/worker.ts`
- `docker/runtime-worker.Dockerfile`
- `docker/runtime-worker-security.md`

用途：
- 在 cloud workspace 容器内通过单请求 JSON 或 NDJSON 执行共享 coding tools，生产根目录固定为 `/workspace`。
- 提供 health、idle、execute 与 serve 命令，并处理 timeout、cancel、协议错误及输入/输出上限。
- 记录 Node.js 22 non-root image 和 read-only/tmpfs/network/capability/resource 安全运行约定。

关键导出：
- `RuntimeWorker`：管理固定 workspace 的工具执行、active request、timeout 与 cancellation。
- `handleRuntimeWorkerLine`：校验 transport envelope、coding tool 和 tool input，并输出共享 response schema。
- `serveRuntimeWorker`：并发处理 requestId 关联的 NDJSON 请求与 cancel 消息。
- `runRuntimeWorkerCli`：提供容器 health、idle、execute 和 serve 入口。

## 共享协议与执行核心

### Shared Runtime Contract

路径：
- `packages/shared/src/runtime.ts`
- `packages/shared/src/workspaces.ts`
- `packages/shared/src/daemon.ts`
- `packages/shared/src/sessions.ts`
- `packages/shared/src/permissions.ts`
- `packages/shared/src/tools.ts`
- `packages/shared/src/chat.ts`

用途：
- 定义 Runtime mode/status/error、workspace lifecycle、daemon protocol、session binding、grant、tool call 和 chat request 的 Zod schema 与类型。

关键函数：
- `normalizeRuntimeMode`：兼容旧 Runtime 名称并统一输出当前枚举。
- `assertSessionWorkspaceBinding`：验证会话和请求的 workspace/Runtime 绑定一致。

### Runtime Core

路径：
- `packages/runtime-core/src/index.ts`

用途：
- 提供 local daemon、server-local 和后续 cloud worker 共享的文件、搜索、Git、Shell 与测试实现。

关键导出：
- `NodeWorkspaceRuntime`：在锁定 workspace root 的前提下执行 coding tools。
- `RuntimeError`：输出稳定、可映射的 Runtime 错误。
- `resolveWorkspacePath`：拦截 traversal、symlink escape、ignore 目录与越界路径。

## API 路由与服务

### Coding Routes

路径：
- `apps/api/src/routes/coding-routes.ts`

用途：
- 提供 workspace、文件、搜索、Git、审批和 tool execution API，并从 `request.actor` 获取可信 owner。

### Coding Runtime Adapter

路径：
- `apps/api/src/services/coding-runtime.ts`
- `apps/api/src/services/coding-tools.ts`
- `apps/api/src/services/daemon-registry.ts`

用途：
- 组合 server-local runtime、只读工具自动执行、高风险工具审批，以及在线 daemon workspace/request 路由。

### Runtime Resolver

路径：
- `apps/api/src/services/runtime-resolver.ts`
- `apps/api/src/services/cloud-runtime-client.ts`

用途：
- 按可信 owner、workspace、Runtime 类型和 lifecycle 状态解析 local daemon、cloud runtime 或显式 server-local 执行端。
- 通过内部 HTTP client 提交 cloud lifecycle operation 和结构化工具请求，并对内部错误做稳定映射与脱敏。

关键导出：
- `RuntimeResolver`：合并持久化 workspace 与 daemon live 状态，解析唯一 Runtime adapter。
- `LocalDaemonRuntimeAdapter`：把 coding 操作转发给指定 owner/workspace 的在线 daemon。
- `CloudRuntimeClient`：定义 API 与 cloud-runtime internal service 的 lifecycle/execute 边界。
- `HttpCloudRuntimeClient`：使用 service token、timeout 和结构化协议调用 internal service。

### Coding Workspace API

路径：
- `apps/api/src/routes/coding-workspace-routes.ts`
- `apps/api/src/routes/runtime-http.ts`

用途：
- 提供 workspace list/detail 与 cloud create/start/stop/retry/delete API，持久化 operation 并保证 idempotency key 不跨操作复用。
- 将 Runtime/repository 错误统一映射为稳定的 `404`、`403`、`409` 或脱敏 `500` 响应。

### Actor Context

路径：
- `apps/api/src/services/actor-context.ts`

用途：
- 开发环境从受信任 env 提供 owner；生产环境通过 OIDC issuer、audience 和 remote JWKS 验证 bearer token。

关键导出：
- `ActorContextResolver`：解析可信 actor，并暴露 auth readiness。
- `createActorContextResolver`：从进程环境创建 resolver。

### Credential Crypto

路径：
- `apps/api/src/services/credential-crypto.ts`

用途：
- 使用 owner-bound AES-256-GCM 加密 HTTPS token，支持 key version、旧 key 解密和日志脱敏。

关键导出：
- `CredentialCipher`：加密和解密版本化 credential envelope。
- `createCredentialCipherFromEnv`：只从 SeekDesk credential env 构建密钥环。
- `redactCredentialText`：移除 URL、Bearer header 和 query 中的 secret。

## 数据与持久化

### Drizzle Schema

路径：
- `apps/api/src/db/schema.ts`
- `apps/api/drizzle/0003_massive_natasha_romanoff.sql`

用途：
- 定义 owner-scoped workspace、runtime operation、repository credential，以及 session/tool/grant/activity/artifact/usage 关联列和索引。

### Daily Work Repository Boundary

路径：
- `apps/api/src/repositories/daily-work-repository.ts`
- `apps/api/src/repositories/postgres-daily-work-repository.ts`
- `apps/api/src/repositories/repository-errors.ts`

用途：
- 统一 seed、JSON 和 Postgres repository；提供 workspace、operation、credential CRUD 和 owner-scoped trace 查询。

关键导出：
- `DailyWorkRepository`：API 使用的持久化接口。
- `SeedDailyWorkRepository`：测试与无配置开发 fallback。
- `JsonDailyWorkRepository`：持久化非敏感开发数据，凭据只保留在进程内。
- `PostgresDailyWorkRepository`：生产 Postgres 实现。
- `DailyWorkRepositoryAccessError`：拒绝跨 owner ID 覆盖。

## 测试与规格

路径：
- `apps/api/src/authorization-integration.test.ts`
- `apps/api/src/dual-runtime-api.test.ts`
- `apps/api/src/services/runtime-resolver.test.ts`
- `apps/api/src/services/cloud-runtime-client.test.ts`
- `apps/runtime-worker/src/worker.test.ts`
- `apps/runtime-worker/src/docker-contract.test.ts`
- `apps/api/src/repositories/coding-workspace-repository.test.ts`
- `apps/api/src/repositories/postgres-daily-work-repository.test.ts`
- `packages/runtime-core/src/index.test.ts`
- `specs/dual-runtime/spec.md`
- `specs/dual-runtime/plan.md`
- `specs/dual-runtime/tasks.md`
- `specs/dual-runtime/verify.md`

用途：
- 覆盖身份隔离、migration backfill、repository/credential 安全、Runtime 边界与双 Runtime 交付进度。
