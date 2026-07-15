# SeekDesk 项目进度

## 当前功能

- 功能：`dual-runtime`
- 分支：`codex/dual-runtime`
- 任务范围：`T001-T124`
- 已完成：`T001-T003`、`T005-T061`、`T063-T074`、`T076-T080`、`T082-T089`
- 环境阻塞：`T004`、`T062`、`T075`、`T081`
- 当前批次：`T090-T103` 双 Runtime 前端工作台

## 已完成能力

### Shared Contract 与 Runtime Core

- 建立统一 Runtime、workspace、session、grant、tool call、operation 和错误协议。
- `runtime-core` 提供文件、搜索、Git、写入、编辑、Shell 和测试的安全实现。
- local daemon、server-local 和 cloud worker 共用同一执行核心。
- 路径越界、symlink、ignore、大文件、二进制、危险命令、超时和输出截断均有稳定错误码。

### 数据、身份与凭据

- Seed、JSON 和 Postgres repository 支持 owner-scoped workspace、operation、tool、grant、message、usage 与 artifact。
- Drizzle migration 已包含 owner/workspace/Runtime 回填、非空约束和索引。
- repository credential 使用 owner-bound AES-256-GCM，支持 key version 与轮换。
- 开发身份来自受信任环境变量；生产身份通过 OIDC/JWT 验证，客户端 header 不能覆盖 owner。

### 双 Runtime 后端

- `RuntimeResolver` 根据可信 owner、workspace、Runtime 类型和 lifecycle 状态选择执行端。
- local daemon 支持主动注册、heartbeat、重连、文件、搜索、Git 和审批后命令执行。
- cloud runtime 支持 provision、start、stop、retry、delete、execute、cancel、reconcile 和 idle stop。
- cloud worker 容器契约包括 read-only rootfs、tmpfs、network none、cap-drop、no-new-privileges、资源限制和 non-root 用户。
- Git bootstrap 仅接受 HTTPS URL，凭据通过临时 askpass 文件注入，不进入 URL、参数、状态或日志。

### 审批与执行一致性

- grant 严格绑定 `ownerId + sessionId + workspaceId + runtimeMode + action`，并校验撤销与有效期。
- coding tool call 在创建时保存 owner、session、workspace、Runtime 和稳定 requestId。
- requestId 原样贯穿 API、local daemon 和 cloud runtime。
- repository 原子认领 pending tool call，重复点击不会重复执行。
- 执行前重新读取并校验 session、workspace、tool call、grant 和 Runtime 状态。
- running、completed、failed、cancelled 同步写入 tool call、activity event 和 runtime operation。
- 文件写入生成关联 artifact、回写 session，并刷新当前 workspace/path 的 Git diff。
- Shell/test trace 包含 command、cwd、stdout、stderr、exitCode、timeout、truncated、workspace、Runtime 和 requestId。

## 自动验证

- Shared tests：`13` 项通过。
- Agent tests：`26` 项通过。
- Runtime Core tests：`7` 项通过。
- Web tests：`12` 项通过。
- API tests：`124` 项通过，`4` 项按环境跳过。
- Daemon tests：`8` 项通过。
- Runtime Worker tests：`6` 项通过。
- Cloud Runtime tests：`10` 项通过。
- `git diff --check`：通过。
- `npm run lint`：通过。
- `npm run test --workspaces --if-present`：通过。
- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npm run verify:secrets`：通过。

## 环境阻塞

- `jim-mac` 当前没有可用 Docker CLI；旧链接指向不存在的 `/Volumes/SSD/Docker.app`。
- 因此真实 Postgres migration、runtime image、container fixture 和无公网验证暂未执行。
- Postgres integration 的 `2` 项测试等待 `SEEKDESK_TEST_DATABASE_URL`。
- Browser smoke 默认端口 `3000` 被失联 Docker backend 占用，最终验收将使用可配置端口。

## 下一步

1. 完成 `T090-T103`：新建会话 Runtime 选择、local/cloud 表单、cloud lifecycle、历史分组和工作台状态联动。
2. 完成 `T104-T117`：双 Runtime smoke、故障恢复、文案/网络扫描、README 与架构文档。
3. Docker 恢复后补跑 `T004`、`T062`、`T075`、`T081`、`T119-T122`。
4. 完成 `T118-T124` 全量验收、清理、提交、合并和 main 回归。
