# SeekDesk 项目进度

## 当前功能

- 功能：`dual-runtime`
- 分支：`codex/dual-runtime`
- 任务范围：`T001-T124`
- 当前批次：`T055-T061` 已完成，`T062` 等待 Docker；准备进入 `T063-T081`
- 基线 HEAD：`855c888606ca933acf4879dc933d3b2b3852f13b`

## 2026-07-15 基线检查

- Node.js：`v25.5.0`
- npm：`11.8.0`
- 磁盘：总计 `460 GiB`，可用 `329 GiB`
- `npm run lint`：通过
- `npm run test --workspaces --if-present`：通过；API `96` 项通过、`3` 项按环境跳过，其余 workspace 测试通过
- `npm run typecheck`：通过
- `npm run build`：通过
- `npm run test:browser-smoke`：未通过；端口 `3000` 被失联的 Docker Desktop 后端占用，smoke 未自动切换端口

## 环境状态

- Docker Desktop 后端进程存在，但 `/Users/jimhuang/.docker/run/docker.sock` 无响应。
- Docker CLI 原路径位于当前不可见的 `/Volumes/SSD/Docker.app`，因此 cloud runtime 真实容器验证暂不可执行。
- 端口 `3000` 由 `com.docker.backend` 占用。
- 端口 `4100` 当前有旧 Node 进程监听。
- 在 Docker 环境恢复前，可继续完成 shared contract、runtime-core、数据模型和 mock adapter 工作。

## 批次状态

- `T001`：已创建并切换功能分支，spec workflow 文档已暂存。
- `T002`：已记录远程版本、进程、端口、磁盘和工具链状态。
- `T003`：已执行并记录现有自动化基线。
- `T004`：等待 Docker Engine 恢复后完成。
- `T005-T015`：已完成。新增统一 Runtime/workspace/session/grant/tool/chat contract，并保留旧 runtime 名称和旧记录兼容。
- `T016-T028`：已完成。新增共享 `runtime-core`，daemon 与 server-local adapter 使用同一执行实现，并完成真实 daemon 审批执行验收。
- `T029-T041`：已完成。新增双 Runtime 数据模型、显式历史回填迁移、owner-scoped repository、加密凭据和 OIDC/JWT actor 边界。
- `T042-T054`：已完成。新增 RuntimeResolver、cloud client、公开 workspace lifecycle API、稳定错误映射、会话绑定和 workspace-scoped trace。
- `T055-T061`：已完成。新增 runtime-worker workspace、JSON/NDJSON transport、完整 runtime-core tool 执行、超时/取消/上限处理及 Node.js 22 non-root image contract。
- `T062`：等待可用 Docker Engine 后构建 `seekdesk-runtime:node22` 并运行真实 container fixture。

## T001-T015 批次验证

- Shared tests：`12` 项通过。
- Workspace tests：全部通过；API `96` 项通过、`3` 项按环境跳过。
- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- `git diff --check`：通过。
- `T004` 仍未完成：Docker socket 无响应，真实 Postgres/Docker 验证将在环境恢复后补跑。

## T016-T028 批次验证

- Runtime Core tests：`7` 项通过，覆盖路径越界、symlink、ignore、二进制、大文件、精确替换、危险命令、timeout 与输出截断。
- Adapter tests：daemon `8` 项通过；API `97` 项通过、`3` 项按环境跳过。
- 真实 daemon：在 `4310` 端口完成注册、heartbeat、文件树、文件读取、搜索、Git status/diff 验证。
- 真实审批链：`coding.run_shell` 未授权保持 pending，创建同会话授权后由 local daemon 执行，stdout 返回 `dual-runtime-approved`。
- `npm run typecheck`、`npm run lint`、`npm run build`、`npm run verify:secrets`、`git diff --check`：全部通过。
- `T004` 仍由 Docker Engine 环境阻塞；本批次不依赖 Docker。

## T029-T041 批次验证

- 新增 Drizzle migration `0003_massive_natasha_romanoff.sql`，旧记录先从 payload/session 关系回填 owner、workspace 和 Runtime，再设置默认值、非空约束和索引。
- Seed/JSON/Postgres repository 已支持 workspace、operation、credential CRUD；同 ID 的跨 owner upsert 会以 `workspace_access_denied` 拒绝。
- JSON fallback 只持久化 workspace 与 operation，HTTPS token 只保存在进程内；Postgres credential 查询默认只返回不含密文的 metadata。
- 凭据采用 owner-bound AES-256-GCM envelope，支持 key version、旧 key 解密轮换和 URL/header/query 日志脱敏。
- 开发身份只接受 `SEEKDESK_DEV_USER_ID`；生产身份通过 OIDC issuer、audience 与 remote JWKS 验证，客户端 `x-user-id` 无法覆盖 owner。
- API 测试：`109` 项通过，`4` 项按环境跳过；其中 `2` 项 Postgres integration 等待 `SEEKDESK_TEST_DATABASE_URL`。
- `npm run lint`、`npm run test --workspaces --if-present`、`npm run typecheck`、`npm run build`、`npm run verify:secrets`、`git diff --check`：全部通过。
- `T004` 与真实 migration apply 仍由 Docker Engine 环境阻塞，将在 `T119-T121` 集中补跑。

## T042-T054 批次验证

- 文件、搜索、Git、chat 和 tool execution 统一通过 `RuntimeResolver`；未知 workspace、离线 daemon、未就绪 cloud 和跨 Runtime 绑定返回稳定错误。
- local daemon 离线后保留持久化 workspace summary，重新连接后可由 resolver 合并 live 状态。
- cloud workspace create/start/stop/retry/delete 返回 `202` operation；idempotent replay 返回原 operation，冲突 key 返回 `workspace_operation_conflict`。
- session trace 返回 workspace、runtimeMode、operation、tool call、grant、activity 和 model usage，并保持 owner/session 关联。
- API 测试：`118` 项通过，`4` 项按环境跳过。
- `npm run lint`、`npm run test --workspaces --if-present`、`npm run typecheck`、`npm run build`、`npm run verify:secrets`、`git diff --check`：全部通过。
- `T004` 与 Docker/Postgres/cloud image 真实验证仍由 Docker Engine 环境阻塞。

## T055-T061 批次验证

- runtime-worker `health`、`execute`、`serve` 和 `idle` CLI 入口已建立；生产根目录固定 `/workspace`。
- Runtime Worker tests：`6` 项通过，完整执行文件、搜索、Git、写入、编辑、Shell 和 test fixture，并验证错误与资源上限。
- Shared tests：`13` 项通过；worker 和 runtime-core 错误码均进入统一 response schema。
- Dockerfile/static contract 验证 Node.js 22、non-root、read-only/tmpfs/volume、network/capability/resource 限制和禁止 Docker socket/privileged。
- `npm run lint`、`npm run test --workspaces --if-present`、`npm run typecheck`、`npm run build`、`npm run verify:secrets`、`git diff --check`：全部通过。
- `T062` 尚未执行：Docker CLI 为断链，真实 image build/container fixture 继续等待环境恢复。

## 进行中

- 功能：Cloud Runtime Service
- 当前阶段：`T063-T081`
- 下一步：创建内部 Fastify service、service-token 身份、容器引擎抽象、workspace 存储/Git bootstrap、lifecycle、execute queue、reconcile 与清理流程。
