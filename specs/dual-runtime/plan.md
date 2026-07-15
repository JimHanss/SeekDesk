# SeekDesk 双 Runtime 技术计划

## 计划目标

在现有 `coding_agent + local_daemon` 链路上增加可持久化、可隔离、可审计的 `cloud_runtime`，并让两种 Runtime 通过统一的工作区解析、工具协议和审批模型接入 `/api/chat` 与 `/api/coding/*`。

本计划不直接实现 Git 写操作、IDE 插件或多人实时编辑。`server_local` 仅保留给开发和自动化测试，不出现在普通用户的工作区选择中。

## 当前基线与关键缺口

当前代码已具备以下基础：

- `CodingRuntime` 定义了文件、搜索、Git、Shell 和测试执行接口。
- `DaemonRegistry` 能通过 `/ws/daemon` 注册本机 daemon，并按 `workspaceId` 转发工具请求。
- 会话协议已经保存 `workspaceId`，部分 schema 预留了 `cloud_workspace`。
- 写文件、编辑文件、Shell 和测试使用 session grant 审批。
- Postgres 已保存 session、message、tool call、permission grant、activity event 和 model usage。

需要优先修复的缺口：

- `/api/chat` 无法解析 daemon workspace 时会默认使用 `LocalCodingRuntime`，存在静默操作服务器目录的风险。
- `codingPermissionGrantProviderSchema` 固定为 `local_daemon`，无法表达云端授权。
- `tool_calls` 和 permission grant 没有结构化保存 `workspaceId` 与 `runtimeMode`，执行时无法强校验工作区一致性。
- `apps/api/src/services/coding-runtime.ts` 与 `apps/daemon/src/local-runtime.ts` 重复实现文件和命令安全逻辑，长期会产生行为差异。
- `workspaces` 表只有名称和时间字段，不能保存 Runtime 生命周期、仓库、容器和所有者信息。
- 当前没有生产用户身份边界；真正多用户云端 Runtime 不能只依赖浏览器传入的 `workspaceId`。

## 技术决策

### 统一命名

- `runtimeMode` 使用 `local_daemon | cloud_runtime | server_local`。
- `cloud_workspace` 作为旧值只在 migration mapper 中兼容，写入新数据时统一为 `cloud_runtime`。
- 工作区是持久化领域对象，Runtime instance 是工作区当前的执行实例，两者不混为一体。

### 服务边界

- `apps/api`：公开 API、身份与所有权校验、会话、审批、审计、模型循环和 Runtime 路由。
- `apps/cloud-runtime`：内部服务，唯一持有 Docker Engine 权限，负责容器生命周期、持久化目录、Git 初始化和工具请求转发。
- `apps/runtime-worker`：运行在工作区容器内，接收结构化工具请求，调用共享 `runtime-core`，返回结构化结果。
- `apps/daemon`：继续主动连接 API，使用同一个 `runtime-core` 操作用户本机目录。
- `packages/runtime-core`：Node.js Runtime 的文件、搜索、Git、Shell、测试实现，以及路径、二进制、大文件、危险命令、超时、输出截断和环境变量脱敏策略。
- `packages/shared`：Runtime、workspace、operation、tool call、grant、API request/response 的 Zod schema。

### Cloud Runtime v1

- v1 使用服务器本机 Docker Engine；通过 `CloudContainerEngine` 接口隔离具体实现，后续可替换为 Kubernetes、Nomad 或 VM provider。
- 每个云端工作区使用独立持久化目录和独立容器；容器停止不删除文件，删除工作区才清理持久化数据。
- 容器以非 root 用户运行，root filesystem 只读，仅 `/workspace` 和必要的临时目录可写。
- 禁止 privileged、禁止挂载 Docker socket、删除 Linux capabilities，并配置 CPU、内存、PID、磁盘、执行时间和输出限制。
- Git clone/bootstrap 阶段允许受控网络；正常工具执行默认无外网。网络扩展能力不在本功能中实现。
- 首个 image profile 为 `node22`，包含 Node.js 22、npm、Git、ripgrep、基础 Shell 和 Python 3；数据模型预留后续 image profile。
- API 不直接持有 Docker socket；`apps/cloud-runtime` 仅监听 loopback 或私有网络，并使用服务间 token 验证请求。

### 身份与多租户边界

- 所有公开 workspace、session、tool call、grant、activity 和 artifact 查询都从服务端 `ActorContext.userId` 获取所有者，不能信任请求 body 中的 owner 信息。
- 开发环境允许通过 `SEEKDESK_DEV_USER_ID` 使用单用户身份；生产环境必须配置 OIDC/JWT 身份适配器后才能启用 `cloud_runtime`。
- Runtime resolver 必须校验 workspace 所有权、状态、session 绑定和工具权限，任何一项不匹配都返回明确错误。

## 架构与数据流

```text
Browser
  -> SeekDesk API
       -> ActorContext / WorkspaceRepository / SessionRepository
       -> RuntimeResolver
            -> LocalDaemonRuntimeAdapter -> /ws/daemon -> seekdesk-daemon -> runtime-core
            -> CloudRuntimeAdapter -> cloud-runtime internal API -> Docker container -> runtime-worker -> runtime-core
       -> ToolOrchestrator
       -> Postgres audit and trace
```

### 新建云端工作区

1. Browser 调用 `POST /api/coding/workspaces/cloud`。
2. API 校验用户、仓库 URL、分支、image profile 和凭据引用，创建 `workspaces` 与 `workspace_runtime_operations` 记录。
3. API 调用 `apps/cloud-runtime` 创建持久化目录和隔离容器。
4. `apps/cloud-runtime` 在初始化阶段克隆仓库，凭据只作为短期进程输入使用，不写入日志、命令行或仓库配置。
5. 初始化状态依次写为 `provisioning -> cloning -> ready`；失败时写 `errorCode` 和经过脱敏的 `errorMessage`。
6. Browser 轮询 workspace detail，状态为 `ready` 后才能创建会话。

### 新建本机工作区

1. daemon 通过 `/ws/daemon` 注册和心跳，API 生成稳定 `workspaceId`。
2. Browser 从统一 workspace list 中选择 `local_daemon` workspace。
3. 创建会话时保存 `workspaceId + runtimeMode`。
4. daemon 离线后 workspace 状态为 `offline`，历史会话仍可读取，但 Runtime 请求失败且不 fallback。

### Chat 与工具执行

1. `POST /api/chat` 必须携带 coding session 绑定的 `workspaceId`。
2. API 从 repository 读取 session 和 workspace，校验 owner、Runtime 类型和绑定一致性。
3. `RuntimeResolver.resolve()` 返回 `LocalDaemonRuntimeAdapter` 或 `CloudRuntimeAdapter`；找不到时返回 `runtime_unavailable`。
4. 只读工具通过统一 Runtime 接口执行，并保存 workspace 关联的 tool call、activity 和 trace。
5. 高风险工具保存为 pending tool call；批准时 grant 同时绑定 `userId + sessionId + workspaceId + runtimeMode + action`。
6. 执行入口再次读取 session、workspace、tool call 和 grant，全部一致后才调用 Runtime。
7. Runtime 结果通过同一 mapper 返回；文件变更后刷新 Git diff，命令结果进入 terminal，所有状态写入审计记录。

### Cloud Runtime 生命周期

```text
provisioning -> cloning -> ready -> busy -> ready
                              |       |
                              v       v
                           stopping -> stopped -> starting -> ready
                              |
                              v
                           deleting -> deleted

任意可恢复阶段 -> error -> retrying -> 对应目标阶段
```

- workspace 状态是持久化事实，容器状态通过定期 reconcile 校正。
- 同一 workspace 的生命周期操作串行化；重复请求使用 idempotency key。
- Runtime 工具请求更新 `lastActiveAt`；超过空闲 TTL 的 ready workspace 自动停止。
- 删除请求先拒绝新工具调用并取消排队操作，再停止容器和删除工作区数据。

## 受影响的文件和模块

### 根目录与部署

- `package.json`：增加 `apps/cloud-runtime`、`apps/runtime-worker`、`packages/runtime-core` workspace 脚本。
- `package-lock.json`：记录新增 workspace 和必要依赖。
- `.env.example`：增加身份、内部服务、容器 image、资源限制、存储根目录、空闲 TTL 和凭据加密配置。
- `docker-compose.postgres.yml`：保持数据库职责不变。
- 新增 `docker-compose.runtime.yml`：API、cloud-runtime、Postgres 和内部网络的开发编排。
- 新增 `docker/runtime-worker.Dockerfile`：构建受限的 `node22` Runtime image。

### Shared contracts

- `packages/shared/src/workspaces.ts`：替换现有简化 workspace schema，新增 Runtime 类型、状态、仓库、image profile、所有权安全响应和生命周期请求。
- `packages/shared/src/daemon.ts`：Runtime mode 与统一 workspace response 对齐，保留 daemon message 协议。
- `packages/shared/src/sessions.ts`：session 的 `workspaceRuntimeMode` 改用统一 schema。
- `packages/shared/src/permissions.ts`：grant 增加 `workspaceId`、`runtimeMode`，provider 不再固定为 `local_daemon`。
- `packages/shared/src/tools.ts`：tool call record 增加 workspace、Runtime、request/operation 时间字段。
- `packages/shared/src/chat.ts`：coding request 对 `workspaceId` 的约束和错误定义。
- `packages/shared/src/index.ts`：导出新增 contract。
- 新增 `packages/shared/src/runtime.ts`：Runtime status、operation、internal request/response 和错误 schema。

### Runtime core 与执行服务

- 新增 `packages/runtime-core/**`：共享工具执行和安全策略。
- `apps/daemon/src/local-runtime.ts`：改为组合 `runtime-core`，只保留系统目录选择器和 daemon 身份信息。
- `apps/daemon/src/client.ts`：保持 WebSocket transport，补充统一 request id、取消和版本能力字段。
- 新增 `apps/runtime-worker/**`：容器内 JSON request/response worker。
- 新增 `apps/cloud-runtime/**`：内部 HTTP 服务、Docker engine adapter、workspace lifecycle、Git bootstrap、reconcile 和 health。

### API

- `apps/api/src/server.ts`：创建统一 `RuntimeResolver`，chat 强校验 workspace，不再默认创建 `LocalCodingRuntime`。
- `apps/api/src/routes/coding-routes.ts`：现有文件/search/Git/审批/执行路由改为通过 resolver。
- 新增 `apps/api/src/routes/coding-workspace-routes.ts`：workspace list/detail/create/start/stop/delete/retry。
- `apps/api/src/services/daemon-registry.ts`：实现统一 `RuntimeAdapter`，离线 workspace 返回明确状态。
- 新增 `apps/api/src/services/runtime-resolver.ts`：按 owner、workspace 和 Runtime 类型解析 adapter。
- 新增 `apps/api/src/services/cloud-runtime-client.ts`：调用内部 cloud-runtime service。
- `apps/api/src/services/coding-tools.ts`：grant 与 tool call 执行时校验 workspace 和 Runtime。
- `apps/api/src/repositories/daily-work-repository.ts`：增加 workspace/operation CRUD 和 owner-scoped query。
- `apps/api/src/repositories/postgres-daily-work-repository.ts`：实现新增 repository contract。
- `apps/api/src/db/schema.ts`：扩展 workspace、session、tool、grant、activity、artifact 和 usage 关联字段。
- 新增 Drizzle migration，不重写已有 migration。

### Web

- `apps/web/src/app/page.tsx`：新建对话使用新的 workspace picker 组件，创建会话时保存 Runtime 绑定。
- 新增 `apps/web/src/features/daily-work/components/NewConversationWorkspaceDialog.tsx`：本机/云端 segmented control、workspace list、云端创建表单和生命周期状态。
- `apps/web/src/features/daily-work/hooks/useCodingWorkbench.ts`：统一 workspace state、云端 lifecycle action、状态轮询和 Runtime-aware 错误。
- `apps/web/src/features/daily-work/components/panels/CodingWorkbenchPanels.tsx`：显示 workspace 名称、Runtime badge、离线/停止/启动状态。
- `apps/web/src/features/daily-work/types.ts` 与 `domain/runtime.ts`：复用 shared contract，减少前端重复 DTO。
- 会话侧栏模块：工作区分组显示 Runtime 类型和状态，保持组内置顶优先、创建时间倒序。

### Tests 与文档

- `packages/shared/src/*.test.ts`：schema、兼容 mapper 和跨 workspace 拒绝。
- `packages/runtime-core/src/*.test.ts`：两种 Runtime 共用安全策略测试。
- `apps/daemon/src/*.test.ts`：daemon adapter、断线重连和 workspace identity。
- `apps/cloud-runtime/src/*.test.ts`：Docker adapter、生命周期、幂等、reconcile、清理与错误脱敏。
- `apps/api/src/server.test.ts`：workspace CRUD、resolver、chat 绑定、授权与审计关联。
- `apps/api/src/repositories/postgres-daily-work-repository.test.ts`：新表和 owner/workspace scoped CRUD。
- `scripts/browser-smoke.cjs`：本机 daemon 与 cloud runtime 两条 UI 流程。
- 三份 architecture summary 与 `README.md`：更新双 Runtime 运行和部署说明。

## 数据模型变更

### `workspaces`

扩展现有表：

- `id text primary key`
- `owner_id text not null`
- `name text not null`
- `runtime_mode text not null`
- `status text not null`
- `display_root text not null`
- `daemon_id text null`
- `machine_name text null`
- `platform text null`
- `repository_url text null`
- `repository_branch text null`
- `repository_revision text null`
- `credential_ref text null`
- `image_profile text null`
- `container_ref text null`
- `storage_ref text null`
- `error_code text null`
- `error_message text null`
- `last_active_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `stopped_at timestamptz null`
- `deleted_at timestamptz null`

索引：`owner_id`、`owner_id + status`、`runtime_mode + status`、唯一的 `owner_id + daemon_id + display_root`（仅本机 workspace）。

### `workspace_runtime_operations`

新增表：

- `id text primary key`
- `workspace_id text not null`
- `owner_id text not null`
- `type text not null`
- `status text not null`
- `idempotency_key text not null`
- `request_payload jsonb not null`
- `result_payload jsonb null`
- `error_code text null`
- `error_message text null`
- `created_at timestamptz not null`
- `started_at timestamptz null`
- `completed_at timestamptz null`

唯一索引：`owner_id + idempotency_key`。普通索引：`workspace_id + created_at`、`status + created_at`。

### 现有会话与审计表

- `daily_work_sessions`：增加 `owner_id`、`workspace_id`、`runtime_mode` 结构化列，保留 payload 兼容。
- `daily_work_messages`：增加 `owner_id`、`workspace_id`。
- `tool_calls`：增加 `owner_id`、`workspace_id`、`runtime_mode`、`request_id`、`started_at`。
- `daily_work_permission_grants`：增加 `owner_id`、`workspace_id`、`runtime_mode`，授权查询必须同时匹配。
- `daily_work_activity_events`：增加 `owner_id`、`workspace_id`、`runtime_mode`。
- `daily_work_artifacts`：增加 `owner_id`、`workspace_id`、`tool_call_id`。
- `model_usage_records`：增加 `owner_id`、`workspace_id`。

Migration 先为历史数据填充受控的 legacy owner 和已有 workspace 信息，再设置非空约束。新 repository 查询默认必须 owner-scoped。

## API 与接口变更

### Public Workspace API

- `GET /api/coding/workspaces`
  - 返回当前用户的持久化 cloud workspace 和在线/离线 local daemon workspace。
  - 默认不返回 `server_local`；仅在开发配置开启时返回。
- `POST /api/coding/workspaces/cloud`
  - 请求：`name`、`repositoryUrl`、`branch`、`imageProfile`、可选 `credentialId`、`idempotencyKey`。
  - 返回 `202` 和 workspace/operation。
- `GET /api/coding/workspaces/:workspaceId`
  - 返回状态、仓库摘要、Runtime 能力、最近 operation 和安全边界。
- `POST /api/coding/workspaces/:workspaceId/start`
- `POST /api/coding/workspaces/:workspaceId/stop`
- `POST /api/coding/workspaces/:workspaceId/retry`
- `DELETE /api/coding/workspaces/:workspaceId`
  - 生命周期写操作返回 `202` 和 operation。

现有 `/api/coding/workspace*` 文件夹浏览接口仅对 `local_daemon` 可用；cloud workspace 的根目录固定为 `/workspace`，不允许从浏览器切换服务器目录。

### Existing Coding API

- 文件、搜索和 Git route 继续接受 `workspaceId`，但必须通过 `RuntimeResolver`。
- 未知 workspace 返回 `404 workspace_not_found`。
- 离线或 stopped 返回 `409 runtime_unavailable`，附带可执行的 `start_required` 或 `daemon_offline` reason。
- workspace 正在初始化或 busy 时返回 `409 runtime_not_ready` 或排队 operation，而不是回退到 server local。
- `POST /api/coding/permission-grants` 增加 `workspaceId` 和 `runtimeMode`。
- `POST /api/coding/tool-calls/:toolCallId/execute` 不再信任 body 中的 workspace 作为执行依据；以 tool call 和 session 的持久化绑定为准，body 只允许用于一致性校验。

### Chat API

- `coding_agent` 请求必须包含 `context.workspaceId`。
- 新会话：workspace 必须属于当前用户且可创建 session。
- 已有会话：请求 workspace 必须与 session 绑定一致；不一致返回 `409 session_workspace_mismatch`。
- Runtime 状态不影响纯文本历史查看；涉及工具执行时返回结构化 Runtime error event。

### Internal Cloud Runtime API

仅供 API 调用，要求 `Authorization: Bearer <service-token>`：

- `GET /internal/health`
- `POST /internal/workspaces/provision`
- `POST /internal/workspaces/:workspaceId/start`
- `POST /internal/workspaces/:workspaceId/stop`
- `DELETE /internal/workspaces/:workspaceId`
- `POST /internal/workspaces/:workspaceId/execute`
- `GET /internal/workspaces/:workspaceId/status`

所有请求包含 `requestId` 和 `workspaceId`；execute payload 必须通过 shared tool schema 二次校验。

## 实施步骤

### 第 0 步：基线收束

- 将 `spec.md` 与 `plan.md` 提交到独立功能分支。
- 运行现有 lint、test、typecheck、build 和 browser smoke，记录当前基线。
- 确认远程 Docker Engine、Postgres 和磁盘目录可用，不修改现有 migration。

### 第 1 步：统一 contract 与 Runtime core

- 增加统一 runtime/workspace schema 和错误码。
- 扩展 session、tool call 和 grant 的 workspace 关联。
- 提取 `packages/runtime-core`，让 API server-local 与 daemon 先通过同一实现。
- 保持 local daemon 现有端到端 smoke 通过，再继续 cloud work。

### 第 2 步：Postgres workspace 与 ownership

- 扩展 Drizzle schema，生成新 migration。
- 实现 workspace、runtime operation 和 owner-scoped repository。
- 对历史 session/tool/grant/activity 数据执行兼容 backfill。
- 加入 `ActorContext`，开发环境使用显式 dev user，生产未配置身份时禁用 cloud runtime。

### 第 3 步：Runtime resolver 与禁止 fallback

- 实现 `RuntimeResolver` 和 `RuntimeAdapter`。
- 把 `/api/chat`、coding routes 和 tool execution 全部切到 resolver。
- 修复未知/离线 workspace 的 HTTP 和 stream error。
- 增加跨 workspace、跨 owner、跨 Runtime grant 拒绝测试。

### 第 4 步：Cloud runtime worker 与 image

- 创建 `apps/runtime-worker`，通过 JSON protocol 调用 `runtime-core`。
- 构建 `node22` Runtime image，并配置非 root、只读 rootfs、资源和环境限制。
- 使用临时 workspace 验证 list/read/grep/git/diff/write/edit/shell/test 行为与 daemon 一致。

### 第 5 步：Cloud runtime service

- 创建内部 service、Docker engine adapter 和生命周期状态机。
- 实现持久化目录、Git clone/bootstrap、start/stop/delete/reconcile。
- 实现幂等、超时、取消、错误脱敏和空闲回收。
- API 增加 cloud runtime client 与 public workspace lifecycle routes。

### 第 6 步：审批、审计与 trace 完整关联

- grant、tool call、activity、artifact、model usage 全部写入 owner/workspace/runtime 字段。
- 高风险工具执行前按 session + workspace + runtime + action 再校验。
- 工具执行后刷新 diff/terminal/trace，并记录 Runtime operation request id。

### 第 7 步：前端双 Runtime UX

- 把新建对话 workspace UI 从 `page.tsx` 拆到独立组件。
- 增加“本机 / 云端” segmented control。
- 实现云端 workspace 列表、创建表单、初始化进度、启动、停止、重试和删除确认。
- 会话侧栏按 workspace 分组并显示 Runtime 状态。
- 右侧文件、搜索、Diff、终端和运行详情复用当前 session workspace，禁止全局隐式切换。

### 第 8 步：端到端验证和文档

- 使用真实 Docker cloud runtime 运行一条完整只读链路和一条审批写入/测试链路。
- 同时启动 local daemon，验证两个 workspace 的请求不会串线。
- 验证 daemon 离线、cloud stopped、container crash、Git clone failure 和 API restart 恢复。
- 更新 README、架构总结、API/数据库总结和部署说明。

## 风险与缓解措施

- **Docker socket 权限过大**：只授予独立 cloud-runtime service，API 与用户容器均不接触 socket。
- **当前无生产身份系统**：cloud runtime 默认在生产禁用，直到 OIDC/JWT adapter 可提供可信 `userId`。
- **静默 fallback 操作错误目录**：resolver 对未知 workspace fail closed，`server_local` 只能通过显式开发配置选择。
- **本机与云端工具行为漂移**：工具执行和安全策略提取到 `runtime-core`，两种 adapter 只处理 transport 与状态。
- **容器逃逸与资源耗尽**：非 root、cap-drop、no-new-privileges、只读 rootfs、无 Docker socket、CPU/内存/PID/磁盘/timeout 限制。
- **Git 凭据泄露**：使用 credential reference 和短期进程注入，日志/错误/环境变量统一脱敏，clone 后删除临时凭据。
- **API 重启导致状态丢失**：workspace 和 operation 持久化，cloud-runtime 定期 reconcile Docker 实际状态。
- **并发执行覆盖文件**：同一 workspace 的写工具串行化；读工具可并发；tool call 使用 request id 防止重复执行。
- **Runtime 网络能力与安全冲突**：v1 只在 Git/bootstrap 阶段开放网络，普通 tool execution 默认无外网。
- **历史 daily_work payload 兼容**：新增结构化列并保留 payload，migration 做 backfill，不重写已有迁移。
- **磁盘清理失败**：workspace 先标记 deleting，后台重试清理并暴露错误，未清理完成前不复用 workspaceId。

## 验证命令

### 静态与单元测试

```bash
git diff --check
npm run lint
npm run test --workspaces --if-present
npm run typecheck
npm run build
npm run verify:secrets
```

### 数据库

```bash
docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d postgres
npm run db:generate
npm run db:migrate
SEEKDESK_TEST_DATABASE_URL="$DATABASE_URL" npm --workspace @seekdesk/api test
```

### Cloud Runtime

```bash
docker build -f docker/runtime-worker.Dockerfile -t seekdesk-runtime:node22 .
docker compose --env-file .env.postgres -f docker-compose.runtime.yml up -d
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4100/internal/health
```

自动化集成测试必须创建临时 Git fixture workspace，验证 provision/start/execute/stop/restart/delete，并在测试完成后确认容器和持久化目录已清理。

### 双 Runtime Browser Smoke

```bash
npm run dev:daemon -- start --api http://127.0.0.1:4000 --token "$SEEKDESK_DAEMON_PAIRING_TOKEN" --workspace /path/to/local-fixture
npm run test:browser-smoke
```

Smoke 必须覆盖：

- 本机 daemon workspace 创建会话、读文件、搜索和 Git Diff。
- 云端 workspace 从 Git fixture 创建、状态 ready、创建会话和读文件。
- 两个 workspace 同时在线时，请求与历史分组不串线。
- 两种 Runtime 的写文件和测试工具均先 pending，批准后在正确 workspace 执行。
- daemon 离线不切换云端，cloud stopped 不切换 server local。
- 页面无 fatal console error、乱码、问号占位、空白死区或重复失败请求。

## 所需文档更新

- `README.md`：增加双 Runtime 选择、cloud service 启动、本机 daemon 启动和故障排查。
- `docs/architecture/complete-flow-summary.md`：改为统一 RuntimeResolver 的完整流程。
- `docs/architecture/frontend-code-summary.md`：补充 workspace dialog、cloud lifecycle hook 和 Runtime 状态 UI。
- `docs/architecture/backend-api-database-summary.md`：补充 workspace API、internal runtime API、表结构和 ownership。
- 新增 `docs/architecture/runtime-security-boundary.md`：容器隔离、daemon 边界、审批、凭据、网络和资源策略。
- 新增 `docs/architecture/cloud-runtime-operations.md`：部署、监控、空闲回收、备份、清理和事故处理。

## 需要确认的事项

以下决策会直接影响后续任务拆分和上线安全：

1. **云端执行引擎**：建议 v1 使用 `jim-mac` 上的 Docker Engine，并保留 `CloudContainerEngine` 适配层；是否接受？
2. **身份模式**：建议开发环境使用 `SEEKDESK_DEV_USER_ID`，生产 cloud runtime 必须接 OIDC/JWT；本轮是否同时实现生产登录，还是先完成单用户部署链路？
3. **Git 凭据范围**：建议 v1 支持公开 HTTPS 仓库和可选的加密 HTTPS token，不支持 SSH key；是否接受？
4. **Runtime image**：建议 v1 只交付 `node22` 通用 image，预留 Python/Java/Go profile；是否接受？
5. **网络策略**：建议 clone/bootstrap 阶段有网络，普通工具执行默认无外网；是否接受？
6. **资源与回收默认值**：建议每 workspace `2 CPU / 4 GB RAM / 10 GB disk`，空闲 `30 分钟`自动停止，删除后立即异步清理；是否接受？

未确认前，后续 `$spec-tasks` 可以先拆分 contract、runtime-core、resolver 和数据库任务，但 cloud deployment 与身份相关任务应保持待确认状态。
