# SeekDesk 项目进度

## 当前功能

- 功能：`dual-runtime`
- 分支：`codex/dual-runtime`
- 任务范围：`T001-T124`
- 当前批次：`T016-T028` 已完成，准备进入 `T029-T041`
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
