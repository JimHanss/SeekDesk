# SeekDesk 双 Runtime 实施任务

## 已确认技术决策

- 云端执行引擎：`jim-mac` Docker Engine，保留 `CloudContainerEngine` 适配层。
- 身份模式：开发环境使用 `SEEKDESK_DEV_USER_ID`，生产使用 OIDC/JWT。
- Git 凭据：支持公开 HTTPS 仓库和加密 HTTPS token，不支持 SSH key。
- Runtime image：首版交付 `node22`，包含 Git、ripgrep、基础 Shell 和 Python 3。
- 网络策略：Git clone/bootstrap 阶段允许网络，普通工具执行默认无外网。
- 默认资源：每 workspace `2 CPU / 4 GB RAM / 10 GB disk`，空闲 30 分钟停止，删除后立即异步清理。

## 执行规则

- 每个任务完成后更新本文件的 checkbox，并在 `PROJECT_PROGRESS.md` 记录当前阶段。
- 每个实现分支提交前至少运行与改动范围对应的 test、typecheck 和 lint。
- 不重写已有 Drizzle migration，只新增 migration。
- `workspaceId`、`runtimeMode`、`sessionId` 和 `ownerId` 的任何不一致都必须 fail closed。
- `server_local` 只用于显式开发或测试，不得成为未知 workspace 的自动 fallback。

## 阶段 0：基线与交付边界

- [x] T001 创建并切换到 `codex/dual-runtime` 功能分支，将 `spec.md`、`plan.md`、`tasks.md` 纳入版本控制。
- [x] T002 记录远程 `main` 的 HEAD、工作区状态、Node/npm/Docker/Postgres 版本和当前服务端口占用。
- [x] T003 运行现有 `lint`、`test`、`typecheck`、`build`、`test:browser-smoke`，把基线结果记录到 `PROJECT_PROGRESS.md`。
- [ ] T004 验证 `jim-mac` Docker Engine 与 Postgres 可用，并确认 Runtime 存储根目录所在磁盘有足够空间。
- [x] T005 更新 `.gitignore`，忽略 cloud workspace 数据目录、Runtime 临时文件、测试 fixture、容器输出、凭据临时文件和本地 env。
- [x] T006 在 `.env.example` 增加 dev user、OIDC/JWT、内部 Runtime service、Docker image、存储路径、资源限制、空闲 TTL、凭据加密配置，所有值使用安全示例。

## 阶段 1：统一 Shared Contract

- [x] T007 新增 `packages/shared/src/runtime.ts`，定义 `runtimeModeSchema`、Runtime 状态、能力、安全边界、operation、request/response 和错误码 schema。
- [x] T008 重构 `packages/shared/src/workspaces.ts`，定义持久化 workspace、公开 workspace summary/detail、仓库摘要、image profile 和 lifecycle request schema。
- [x] T009 在 workspace mapper 中兼容旧 `cloud_workspace`，新写入统一输出 `cloud_runtime`。
- [x] T010 更新 `packages/shared/src/daemon.ts`，让 daemon workspace 复用统一 Runtime mode/status contract，并增加 protocol version 与 capability version。
- [x] T011 更新 `packages/shared/src/sessions.ts`，让 session summary/detail 固定保存统一 `workspaceRuntimeMode`，并补充 workspace 绑定校验 schema。
- [x] T012 更新 `packages/shared/src/permissions.ts`，让 grant 保存 `ownerId`、`workspaceId`、`runtimeMode`，provider 不再固定为 `local_daemon`。
- [x] T013 更新 `packages/shared/src/tools.ts`，让 tool call 保存 `ownerId`、`workspaceId`、`runtimeMode`、`requestId`、`startedAt`，保持旧记录可解析。
- [x] T014 更新 `packages/shared/src/chat.ts`，要求 `coding_agent` 新会话携带 `context.workspaceId`，并定义 workspace mismatch 与 Runtime error event。
- [x] T015 更新 `packages/shared/src/index.ts` 和 shared 单测，覆盖新 schema、旧值兼容、非法状态、跨 Runtime grant 与缺失 workspace。

## 阶段 2：共享 Runtime Core

- [ ] T016 创建 `packages/runtime-core` workspace、TypeScript 配置、package scripts 和公共导出。
- [ ] T017 在 `runtime-core` 定义统一 `WorkspaceRuntime`、`RuntimeExecutionContext`、`RuntimeError` 和结构化执行结果。
- [ ] T018 提取 workspace root 解析、路径穿越拦截、ignore 目录、symlink 边界和相对路径规范化逻辑。
- [ ] T019 提取文件树、文本读取、文件大小限制、二进制检测、写文件和精确替换实现。
- [ ] T020 提取文本搜索、glob 过滤、最大结果数、单行截断和大目录遍历限制。
- [ ] T021 提取只读 `git status`、`git diff` 和 Git 仓库错误映射。
- [ ] T022 提取 Shell/test 调用、危险命令拒绝、cwd 锁定、timeout、输出截断、环境变量脱敏和 Windows 隐藏窗口逻辑。
- [ ] T023 为 `runtime-core` 增加路径越界、symlink、ignore、二进制、大文件、替换数量、危险命令、超时和截断单测。
- [ ] T024 将 `apps/daemon/src/local-runtime.ts` 改为组合 `runtime-core`，只保留 daemon 状态和系统文件夹选择器。
- [ ] T025 更新 `apps/daemon/src/client.ts`，增加协议版本、request id、取消/超时处理和结构化 Runtime error 映射。
- [ ] T026 将 `apps/api/src/services/coding-runtime.ts` 的 `server_local` 实现改为组合 `runtime-core`，删除重复工具逻辑。
- [ ] T027 更新 daemon 与 server-local 测试，证明两种 adapter 对相同 fixture 返回一致结果。
- [ ] T028 启动真实 local daemon，验证注册、心跳、文件、搜索、Git 和审批执行链路保持通过。

## 阶段 3：数据模型、凭据与身份

- [ ] T029 扩展 `apps/api/src/db/schema.ts` 的 `workspaces` 表，加入 owner、Runtime、状态、仓库、image、容器、存储、错误和生命周期字段。
- [ ] T030 新增 `workspace_runtime_operations` 表及 owner/idempotency、workspace/time、status/time 索引。
- [ ] T031 新增 `repository_credentials` 表，仅保存 owner、provider、标签、加密密文、创建/更新时间和撤销状态，不返回密文。
- [ ] T032 为 session、message、tool call、permission grant、activity、artifact、model usage 增加结构化 owner/workspace/runtime 关联列和索引。
- [ ] T033 生成新的 Drizzle migration，先 backfill legacy owner/workspace/runtime，再应用非空与索引约束。
- [ ] T034 扩展 `DailyWorkRepository` 或拆出 `CodingWorkspaceRepository`，定义 owner-scoped workspace、operation、credential CRUD。
- [ ] T035 更新 seed/JSON repository，使开发 fallback 支持 workspace/operation 且不持久化真实凭据。
- [ ] T036 实现 Postgres workspace、operation、credential CRUD 和 owner-scoped session/tool/grant/activity 查询。
- [ ] T037 实现 HTTPS token 的对称加密、解密、轮换标识和日志脱敏，密钥只读取 `SEEKDESK_CREDENTIAL_ENCRYPTION_KEY`。
- [ ] T038 新增 `ActorContext`，开发环境从 `SEEKDESK_DEV_USER_ID` 提供身份，禁止客户端覆盖 `userId`。
- [ ] T039 实现生产 OIDC/JWT adapter，通过 issuer、audience、JWKS 验证 token，并在未配置时禁用生产 `cloud_runtime`。
- [ ] T040 为 API route 增加统一 actor/owner authorization hook，所有 workspace 和 coding trace 查询默认 owner-scoped。
- [ ] T041 增加 migration、repository、凭据加密、JWT 验证、跨 owner 拒绝和历史数据 backfill 测试。

## 阶段 4：Runtime Resolver 与公开 API

- [ ] T042 新增 `RuntimeAdapter` 与 `RuntimeResolver`，按 owner、workspace、runtimeMode 和状态解析执行端。
- [ ] T043 将 `DaemonRegistry` 包装为 `LocalDaemonRuntimeAdapter`，离线时保留持久化 workspace 元数据并返回 `daemon_offline`。
- [ ] T044 新增 `CloudRuntimeClient` interface 和未配置实现，为后续 internal service 保持可测试边界。
- [ ] T045 修改 `apps/api/src/routes/coding-routes.ts`，所有文件、搜索和 Git route 都通过 resolver，删除未知 workspace fallback。
- [ ] T046 修改 `/api/chat`，新会话校验 workspace owner/status，已有会话校验持久化 workspace 绑定。
- [ ] T047 修改 coding tool execution，执行 workspace 只能来自 session/tool call 持久化记录，request body 只做一致性校验。
- [ ] T048 将 Runtime error 映射为稳定的 `404 workspace_not_found`、`409 runtime_unavailable`、`409 runtime_not_ready` 和 `409 session_workspace_mismatch`。
- [ ] T049 新增 `GET /api/coding/workspaces` 与 `GET /api/coding/workspaces/:workspaceId`，合并持久化 cloud workspace 和 daemon 状态。
- [ ] T050 新增 cloud workspace create/start/stop/retry/delete public route，使用 operation 与 idempotency key 返回 `202`。
- [ ] T051 限制 `/api/coding/workspace/browse|select|pick` 仅用于 `local_daemon`，cloud workspace 根目录固定为 `/workspace`。
- [ ] T052 扩展 `/health`，展示 cloud runtime 配置、内部服务连接、Docker readiness、身份模式和 server-local fallback 状态，不泄露 secret。
- [ ] T053 扩展 session trace，返回 workspace summary、runtimeMode、operation、workspace-scoped tool/grant/activity/model usage。
- [ ] T054 增加 resolver、chat 绑定、未知 workspace、daemon offline、跨 owner、跨 session、跨 Runtime 和 public workspace API 测试。

## 阶段 5：Runtime Worker 与 Node22 Image

- [ ] T055 创建 `apps/runtime-worker` workspace、构建配置、CLI 入口和 health 命令。
- [ ] T056 实现 JSON request/response transport，校验 requestId、workspaceId、toolName 和 input schema。
- [ ] T057 将 worker 工具执行接入 `runtime-core`，固定 root 为 `/workspace`，拒绝 workspace 选择和服务器路径浏览。
- [ ] T058 增加 worker 超时、进程信号、取消、非法 JSON、未知工具和输出上限处理。
- [ ] T059 为 worker 添加协议、schema、错误映射和完整 coding tool fixture 测试。
- [ ] T060 新增 `docker/runtime-worker.Dockerfile`，安装 Node.js 22、npm、Git、ripgrep、基础 Shell、Python 3 和非 root runtime 用户。
- [ ] T061 配置 image 默认只读 rootfs、`/tmp` tmpfs 约定、`/workspace` volume、无 Docker socket、无 privileged 和最小 capabilities。
- [ ] T062 构建 `seekdesk-runtime:node22`，运行 container fixture 验证文件、搜索、Git、写入、Shell 和测试结果与 local daemon 一致。

## 阶段 6：Cloud Runtime Service

- [ ] T063 创建 `apps/cloud-runtime` workspace、内部 Fastify 服务、健康检查、配置解析和 graceful shutdown。
- [ ] T064 为所有 `/internal/*` route 增加 service token 验证、requestId 日志和 secret redaction。
- [ ] T065 定义 `CloudContainerEngine` interface，覆盖 provision、inspect、start、stop、delete、execute 和 list managed containers。
- [ ] T066 实现 Docker Engine adapter，使用非交互命令/API 参数，禁止字符串拼接 Shell。
- [ ] T067 实现 workspace 存储目录创建、owner/workspace 安全路径、10 GB quota 检查和删除保护。
- [ ] T068 实现公开 HTTPS Git clone、目标分支 checkout、revision 记录和 clone 超时。
- [ ] T069 实现加密 HTTPS token 的短期注入，确保 token 不进入 URL 日志、process list、Git config 或错误响应。
- [ ] T070 实现 provision 状态机：`provisioning -> cloning -> ready`，失败写入可重试的脱敏错误。
- [ ] T071 实现 start/stop/retry/delete operation，并保证 owner + idempotency key 的重复请求只执行一次。
- [ ] T072 实现 container `execute` transport，通过 runtime-worker 执行统一 tool schema 并返回结构化结果。
- [ ] T073 为同一 workspace 实现读并发、写/命令串行队列和 request cancellation。
- [ ] T074 应用 `2 CPU / 4 GB RAM / PID limit / no-new-privileges / cap-drop / read-only rootfs` 等容器限制。
- [ ] T075 实现 Git/bootstrap 网络与普通工具无外网的网络 profile 切换，并验证执行容器无法访问公网。
- [ ] T076 实现 Docker 实际状态 reconcile，API/runtime service 重启后恢复 workspace 状态。
- [ ] T077 实现 `lastActiveAt` 更新和 30 分钟空闲自动停止。
- [ ] T078 实现删除时拒绝新请求、取消队列、停止容器、清理数据目录和失败重试。
- [ ] T079 为 cloud service 添加 lifecycle、幂等、资源限制、token 脱敏、reconcile、idle stop、cleanup 和 container crash 测试。
- [ ] T080 新增 `docker-compose.runtime.yml`，仅 cloud-runtime service 挂载 Docker socket，API 通过私有网络访问内部服务。
- [ ] T081 使用真实 Docker 和临时 Git fixture 完成 provision/start/execute/stop/restart/delete 集成测试，并确认无残留容器和目录。

## 阶段 7：审批、审计与关联闭环

- [ ] T082 修改 grant 创建与查询，强制匹配 `ownerId + sessionId + workspaceId + runtimeMode + action` 和有效期。
- [ ] T083 修改 tool plan 持久化，使每条 coding tool call 在创建时保存 workspace、Runtime 和 requestId。
- [ ] T084 在批准执行前重新读取 session、workspace、tool call、grant 和 Runtime 状态，任一不一致立即拒绝。
- [ ] T085 将 running/completed/failed/cancelled 状态同步写入 tool call、activity event 和 workspace operation reference。
- [ ] T086 将文件写入结果关联 artifact/tool call/workspace，并在完成后刷新对应 workspace 的 Git diff。
- [ ] T087 将 Shell/test 的 command、cwd、stdout、stderr、exitCode、timeout、truncated 和 Runtime 信息写入 trace 与 terminal payload。
- [ ] T088 将 model usage、message 和 assistant stream 记录补齐 owner/workspace 关联。
- [ ] T089 增加授权撤销、授权过期、跨 workspace、跨 Runtime、重复执行、执行中断和审计完整性测试。

## 阶段 8：前端双 Runtime 工作台

- [ ] T090 将 web 中重复的 workspace/runtime DTO 替换为 `@seekdesk/shared` 类型和 mapper。
- [ ] T091 从 `apps/web/src/app/page.tsx` 提取 `NewConversationWorkspaceDialog` 独立组件，保持现有对话与 smoke selector 稳定。
- [ ] T092 在新建对话弹窗加入“本机 / 云端” segmented control，默认记住最近成功使用的 Runtime 类型。
- [ ] T093 本机 tab 展示 daemon 在线/离线状态、系统文件夹选择器、最近目录和明确启动命令。
- [ ] T094 云端 tab 展示 workspace 列表、仓库、分支、状态、最近使用时间和 Runtime image。
- [ ] T095 实现云端 workspace 创建表单，支持公开 HTTPS URL、分支、`node22` 和可选 credential 选择，不在前端回显 token。
- [ ] T096 实现 cloud workspace provisioning/cloning/starting/stopping/error 状态轮询和取消清理。
- [ ] T097 实现 cloud workspace 启动、停止、重试和带确认的删除操作，按钮 busy/disabled 状态尺寸固定。
- [ ] T098 创建 coding session 时固定保存选中 workspaceId/runtimeMode，未选择或未 ready 时禁止创建。
- [ ] T099 历史会话按 workspace 分组，组上显示 Runtime badge 和状态；组内置顶优先且按 createdAt 倒序稳定。
- [ ] T100 文件、搜索、Diff、终端和运行详情显示当前 workspace 与 Runtime，所有请求使用当前 session 绑定。
- [ ] T101 daemon offline、cloud stopped、runtime busy、clone error 和 permission error 显示单一明确提示，不重复请求刷屏。
- [ ] T102 保持默认对话区简洁，右侧面板仅按需打开，关闭后不保留空白占位。
- [ ] T103 增加 workspace dialog、状态 mapper、排序、创建表单、session 绑定和 Runtime error 的前端单测。

## 阶段 9：端到端验证、文档与交付

- [ ] T104 扩展 `scripts/browser-smoke.cjs`，覆盖 local daemon workspace 选择、会话创建、文件、搜索和 Git Diff。
- [ ] T105 增加 cloud runtime smoke fixture，覆盖 Git clone、ready、会话创建、文件读取和历史分组。
- [ ] T106 增加双 Runtime 同时在线 smoke，验证请求、session、tool call、grant、terminal 和 diff 不串 workspace。
- [ ] T107 增加两种 Runtime 的 pending 写入/test、批准执行、撤销和 trace/activity/artifact 关联 smoke。
- [ ] T108 增加 daemon offline、cloud stopped、container crash、clone failure 和 API restart 恢复 smoke。
- [ ] T109 扫描浏览器 console 与 network，确保无 fatal error、乱码、连续问号占位符、空白死区、重复失败请求和邮箱/连接器请求。
- [ ] T110 更新 `README.md`，说明双 Runtime 选择、cloud service 部署、本机 daemon、生产身份、Git token 和故障排查。
- [ ] T111 更新 `docs/architecture/complete-flow-summary.md`，描述 RuntimeResolver、会话绑定、审批和审计完整流程。
- [ ] T112 更新 `docs/architecture/frontend-code-summary.md`，补充 workspace dialog、cloud lifecycle hook、状态 UI 和文件职责。
- [ ] T113 更新 `docs/architecture/backend-api-database-summary.md`，补充 public/internal API、workspace/operation/credential 表和 owner scope。
- [ ] T114 新增 `docs/architecture/runtime-security-boundary.md`，记录容器、daemon、凭据、网络、资源和审批边界。
- [ ] T115 新增 `docs/architecture/cloud-runtime-operations.md`，记录部署、监控、reconcile、空闲停止、备份、清理和事故处理。
- [ ] T116 更新根目录 `CODE_MAP.md`，列出 shared、runtime-core、daemon、cloud-runtime、runtime-worker、API、web 和测试入口。
- [ ] T117 更新根目录 `PROJECT_PROGRESS.md`，逐项标记本功能完成度、验证结果、已知限制和后续事项。
- [ ] T118 运行 `git diff --check`、`npm run lint`、`npm run test --workspaces --if-present`、`npm run typecheck`、`npm run build`、`npm run verify:secrets`。
- [ ] T119 启动真实 Postgres，运行 `npm run db:migrate` 和 `SEEKDESK_TEST_DATABASE_URL` repository/API integration tests。
- [ ] T120 构建真实 `seekdesk-runtime:node22`，运行 cloud lifecycle integration 并检查资源、网络、凭据和清理边界。
- [ ] T121 同时启动 remote API、cloud-runtime 和 local daemon，运行完整 `npm run test:browser-smoke`。
- [ ] T122 清理测试容器、网络、临时 Git fixture 和 workspace 目录，确认用户数据与无关 Docker 资源未被删除。
- [ ] T123 检查 `git status`、migration、secret hygiene、文档和任务 checkbox，生成最终交付摘要。
- [ ] T124 自动验证全部通过后提交并 push `codex/dual-runtime`，合并到 `main`，在 `main` 再运行 build、migration 和 browser smoke。

## 依赖与并行建议

- `T001-T015` 是所有后续工作的共同基础，应优先串行完成。
- `T016-T028` 与 `T029-T041` 在 shared contract 稳定后可以由不同分支并行开发。
- `T042-T054` 依赖 shared contract 和 repository；其中 cloud client 可先使用 mock。
- `T055-T062` 依赖 `runtime-core`，可与 resolver/API 后半段并行。
- `T063-T081` 依赖 Runtime worker、数据库和 cloud client contract。
- `T082-T089` 依赖 resolver、数据模型和 cloud execute 链路。
- `T090-T103` 可在 public API contract 固定后使用 mock API 并行开发。
- `T104-T124` 必须在所有实现分支合并到验证分支后执行。
