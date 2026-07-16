# SeekDesk 代码地图

## Shared Contracts

路径：`packages/shared/src/`

- `runtime.ts`：Runtime mode/status/capability/error、execute request/response。
- `workspaces.ts`：workspace record/summary/detail、cloud create、lifecycle operation、credential metadata。
- `daemon.ts`：daemon register、heartbeat、request/response/cancel 协议。
- `daemon-pairing.ts`：一次性配对码、设备摘要、领取响应和设备 token payload。
- `sessions.ts`：session workspace/runtime 绑定与历史摘要。
- `permissions.ts`：owner/session/workspace/runtime/action grant。
- `tools.ts`：coding tool name、输入、tool call 状态和执行关联。
- `chat.ts`：coding chat context、stream event 和 workspace mismatch 错误。
- `index.ts`：公共导出。

测试：`runtime.test.ts`、`tools.test.ts`、`realtime-events.test.ts`。

## Runtime Core

路径：`packages/runtime-core/src/index.ts`

`NodeWorkspaceRuntime` 提供 local daemon、server-local 和 cloud worker 共用实现：

- 安全 root/path/symlink/ignore 解析。
- 文件树、文本读取、二进制/大小限制。
- 写文件和精确替换。
- grep/glob/结果截断。
- Git status/diff。
- Shell/test timeout、危险命令拒绝、输出截断、环境变量脱敏。

测试：`packages/runtime-core/src/index.test.ts`。

## Local Daemon

路径：`apps/daemon/src/`

- `cli.ts`：`health` 与 `start --api --token --workspace`。
- `client.ts`：WebSocket 注册、heartbeat、状态回调、取消、自动重连和 request/response。
- `local-runtime.ts`：组合 runtime-core，并提供本机目录 browse/select/pick。
- `src/desktop/main.ts`：Electron 单实例、深链、safeStorage、目录选择器、托盘和开机启动。
- `src/desktop/preload.ts`：context-isolated IPC bridge，不向 renderer 暴露设备 token。
- `src/desktop/renderer.ts`：安装后配对、工作区和在线状态三步向导。
- `src/desktop/config-store.ts`：加密设备凭据的原子配置存储。
- `forge.config.cjs`：Squirrel、DMG/ZIP、Vite、asar、协议、签名和安全 fuses。

测试：`cli.test.ts`、`client.test.ts`、`local-runtime.test.ts` 与 `src/desktop/*.test.ts`。

## Runtime Worker

路径：`apps/runtime-worker/src/`

- `worker.ts`：固定 `/workspace` 的 JSON/NDJSON 工具执行、timeout 和 cancel。
- `cli.ts`：health、idle、execute、serve。
- `docker/runtime-worker.Dockerfile`：Node 22、Git、ripgrep、Shell、Python 3、non-root image。
- `docker/runtime-worker-security.md`：容器运行约束。

测试：`worker.test.ts`、`docker-contract.test.ts`。

## Cloud Runtime

路径：`apps/cloud-runtime/src/`

- `server.ts`：带 service token 的 `/internal/*` Fastify 服务。
- `config.ts`：image、storage、资源、网络、timeout、maintenance 配置。
- `lifecycle-service.ts`：provision/start/stop/retry/delete、execute、reconcile、idle stop、cleanup，并保证 operation 终态持久化后才对外可见。
- `engine.ts`：`CloudContainerEngine` 和 `DockerCliContainerEngine`。
- `storage.ts`：owner/workspace 安全目录、marker、quota 和删除保护。
- `git-bootstrap.ts`：HTTPS clone、branch/revision 和临时 askpass。
- `execution-queue.ts`：并发读、串行写/命令和 cancellation。
- `errors.ts`：稳定错误与 secret redaction。
- `docker-compose.runtime.yml`：cloud service、API 与私有网络部署约定。

测试：`engine.test.ts`、`storage.test.ts`、`execution-queue.test.ts`、`lifecycle-service.test.ts`。

## API

### 入口

- `apps/api/src/server.ts`：Fastify、actor hook、health、chat stream、trace、WebSocket 与 route 注册。
- `apps/api/src/routes/runtime-http.ts`：Runtime 错误到 HTTP 的统一映射。

### Public Coding Routes

- `routes/coding-workspace-routes.ts`：workspace list/detail、cloud create/start/stop/retry/delete、credential metadata。
- `routes/daemon-pairing-routes.ts`：创建/查询一次性配对会话和公开单次领取。
- `routes/coding-routes.ts`：workspace browse/select/pick、files/search/Git、grant 和 tool execution。
- `routes/daily-work-routes.ts`：session/activity/artifact/model usage 等历史兼容聚合。

### Runtime 与安全服务

- `services/runtime-resolver.ts`：按可信 owner/workspace/runtime 选择唯一 adapter。
- `services/daemon-registry.ts`：在线 daemon、heartbeat、workspace/request 路由和断线清理。
- `services/daemon-pairing-service.ts`：10 分钟配对会话、哈希 code、过期与原子单次领取。
- `services/daemon-device-token.ts`：owner/daemonId 绑定的 HMAC 设备 token 签发与验证。
- `services/cloud-runtime-client.ts`：internal service token、status/lifecycle/execute/cancel。
- `services/coding-runtime.ts`：显式 server-local adapter 和稳定 Runtime error。
- `services/coding-tools.ts`：tool plan、grant、原子 claim、执行和审计关联。
- `services/actor-context.ts`：开发 actor 与生产 OIDC/JWT。
- `services/credential-crypto.ts`：AES-256-GCM、key version、previous key 和 redaction。
- `services/daily-work-agent-context.ts`：DeepSeek coding context。

### 数据层

- `db/schema.ts`：Drizzle tables 与索引。
- `repositories/daily-work-repository.ts`：统一 repository interface 和 seed/JSON 实现。
- `repositories/postgres-daily-work-repository.ts`：生产 Postgres 实现。
- `repositories/repository-errors.ts`：owner scope 和数据访问错误。
- `apps/api/drizzle/0003_massive_natasha_romanoff.sql`：dual-runtime backfill 与新表/索引迁移。

核心测试：`dual-runtime-api.test.ts`、`authorization-integration.test.ts`、`services/runtime-resolver.test.ts`、`services/coding-tools.test.ts`、`repositories/coding-workspace-repository.test.ts`。

## Web

### 入口与外壳

- `apps/web/src/app/page.tsx`：工作台组合入口。
- `features/daily-work/components/DailyWorkDashboardShell.tsx`：全屏三段布局和按需侧栏。
- `components/DailyWorkAssistantView.tsx`：聊天窗口。
- `components/NewConversationWorkspaceDialog.tsx`：local/cloud 选择、cloud lifecycle 和 session 创建。
- `hooks/useDaemonPairing.ts`：创建配对码、倒计时、状态轮询、过期恢复和成功回调。

### 状态 Hooks

- `chat/hooks/useChatController.ts`：chat stream、trace、grant 和 tool execution。
- `hooks/useCodingWorkbench.ts`：workspace、files、search、Git 和 lifecycle API。
- `hooks/useSessionHistory.ts`：历史 CRUD、置顶、工作区分组和倒序。
- `hooks/useDailyWorkPanels.ts`：按需右侧面板。
- `hooks/useActivityFeed.ts`、`useArtifacts.ts`、`useModelUsagePanel.ts`：关联数据刷新。

### Domain 与面板

- `domain/workspace-runtime.ts`：共享 workspace 到 UI 的 mapper 和状态判断。
- `domain/sessions.ts`：稳定排序和 Runtime 分组。
- `domain/agent-trace.ts`：tool/grant/activity/terminal/artifact 映射。
- `components/panels/CodingWorkbenchPanels.tsx`：文件、搜索、Diff、终端、运行详情。

前端测试：`domain/workspace-runtime.test.ts`、`domain.test.ts`、`chat/mappers/message-content.test.ts`。

## Agent

路径：`packages/agent/src/`

- provider：DeepSeek-compatible streaming、tool calls、usage 和 mock fallback。
- tools：coding tool registry 与权限默认值。
- loop：最多多轮模型/工具回填，不绕过 API/Runtime 审批边界。

## 自动化与规格

- `scripts/browser-smoke.cjs`：启动 API/web/daemon，验证 local workspace、文件、搜索、Git、chat 和审批执行；启用 `SEEKDESK_BROWSER_SMOKE_CLOUD=1` 时同时验证 public cloud lifecycle、双 Runtime 在线和 session 绑定。
- `scripts/browser-ui-smoke.cjs`：真实 Chrome UI、console/network、ready cloud/local dialog 和写入审批检查。
- `scripts/runtime-container-smoke.mjs`：真实 worker image 的 9 工具、只读 rootfs、资源限制、无网络和无 Docker socket 验证。
- `scripts/cloud-runtime-integration.mjs`：真实 HTTPS Git、provision/execute/stop/service restart/start/delete 与残留资源验证。
- `scripts/daemon-installer-smoke.mjs`：安装器配置、产物、asar、签名、协议和 Electron fuses 验证。
- `.github/workflows/daemon-installers.yml`：Windows Squirrel 与 macOS DMG/ZIP 双平台构建。
- `scripts/cleanup-smoke-data.mjs`：精确清理 browser/coding smoke session、activity、usage、operation 和 cloud workspace。
- `scripts/verify-secret-hygiene.mjs`：secret 与已删除连接器痕迹检查。
- `specs/dual-runtime/spec.md`：需求。
- `specs/dual-runtime/plan.md`：技术计划。
- `specs/dual-runtime/tasks.md`：T001-T124 状态。
- `specs/dual-runtime/verify.md`：验证证据和环境阻塞。
- `docs/architecture/runtime-security-boundary.md`：安全边界。
- `docs/architecture/cloud-runtime-operations.md`：运维与事故处理。
