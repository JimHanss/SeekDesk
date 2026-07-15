# SeekDesk 双 Runtime 验证记录

## 当前验收状态

- 已完成并验证：`T001-T003`、`T005-T054`。
- 环境阻塞：`T004` 的 Docker Engine/Postgres 真实可用性检查。
- 下一批：`T055-T062` Runtime Worker 与 Node.js 22 image。

## 已通过检查

### Shared Contract 与 Runtime Core

- Shared tests：`12` 项通过。
- Runtime Core tests：`7` 项通过。
- Daemon tests：`8` 项通过。
- 真实 local daemon 已完成注册、heartbeat、文件、搜索、Git 和审批后 Shell 执行验证。

### 数据、凭据与身份

- API tests：`109` 项通过，`4` 项按环境跳过。
- Migration test 验证 legacy owner/workspace/runtime 先回填，再设置默认值、非空约束和索引。
- Repository test 验证 workspace/operation owner scope、跨 owner upsert 拒绝及 JSON credential 不落盘。
- Credential test 验证 AES-256-GCM、owner AAD、key version、旧 key 轮换解密和日志脱敏。
- Actor test 验证开发 owner 不可由 header 覆盖、生产 OIDC 缺失时 fail closed、JWT subject 是唯一 owner 来源。

### Runtime Resolver 与公开 API

- API tests：`118` 项通过，`4` 项按环境跳过。
- `RuntimeResolver` 仅按可信 owner、持久化 workspace、Runtime 类型和 lifecycle 状态选择执行端；未知 workspace 不再回退到其他 Runtime。
- local daemon 断线后保留 workspace 元数据并标记 `offline`，工具请求稳定返回 `409 runtime_unavailable`。
- cloud workspace create/start/stop/retry/delete 使用持久化 operation 和 idempotency key；跨 operation 重用 key 返回 `workspace_operation_conflict`。
- coding chat、tool call、grant、trace、activity 和 model usage 均使用持久化 session workspace/Runtime 绑定，request body 仅参与一致性校验。
- `/health` 公开 cloud 配置/readiness、daemon 连接数、身份模式与显式 server-local 状态，不输出 owner ID、service token 或 repository credential。

### 全仓命令

- `npm run lint`：通过。
- `npm run test --workspaces --if-present`：通过。
- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npm run verify:secrets`：通过。
- `git diff --check`：通过。

## 主要变更文件

- `packages/shared/src/runtime.ts`
- `packages/shared/src/workspaces.ts`
- `packages/runtime-core/src/index.ts`
- `apps/daemon/src/client.ts`
- `apps/daemon/src/local-runtime.ts`
- `apps/api/src/db/schema.ts`
- `apps/api/drizzle/0003_massive_natasha_romanoff.sql`
- `apps/api/src/repositories/daily-work-repository.ts`
- `apps/api/src/repositories/postgres-daily-work-repository.ts`
- `apps/api/src/services/actor-context.ts`
- `apps/api/src/services/credential-crypto.ts`
- `apps/api/src/services/runtime-resolver.ts`
- `apps/api/src/services/cloud-runtime-client.ts`
- `apps/api/src/routes/coding-workspace-routes.ts`
- `apps/api/src/routes/runtime-http.ts`
- `apps/api/src/server.ts`

## 已知风险与待补验证

- `jim-mac` Docker Desktop 的现有 backend/socket 无响应，且 CLI 指向不可见的 `/Volumes/SSD/Docker.app`；因此尚未执行真实 migration、runtime image 和 cloud lifecycle 验证。
- Postgres integration 的 `2` 项测试等待 `SEEKDESK_TEST_DATABASE_URL`，将在 `T119` 执行。
- Browser smoke 的默认 `3000` 端口被失联 Docker backend 占用，将在环境修复后使用可配置端口完成 `T121`。

## 后续任务

- 创建 runtime worker 与 Node.js 22 容器镜像。
- 实现 cloud-runtime lifecycle、执行队列、资源/网络限制和 reconcile。
- 完成前端双 Runtime 选择、全链路 smoke、文档与最终合并。
