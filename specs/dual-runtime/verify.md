# SeekDesk 双 Runtime 验证记录

## 当前状态

- T001-T123 已实现并完成验证。
- T123 Git、migration、secret、文档与 checkbox 审计已通过。
- T124 待提交、push、合并 `main` 并在 `main` 回归。
- 先前 Docker/Postgres 环境阻塞已经解除，没有未解决的强制验收阻塞。

## 基础环境

- 主机：`jim-mac`，远程目录 `/Users/jimhuang/project/SeekDesk`。
- Docker：Colima `default` profile，QEMU `aarch64`，4 CPU、8 GiB 内存、100 GiB VM 磁盘。
- Docker client/server：29.x；Compose：5.3.1。
- Runtime 存储所在主机磁盘验证时可用空间约 329 GiB。
- Postgres：`postgres:16-alpine`，容器 `seekdesk-postgres`，开发端口 `25432`，health 为 healthy。
- Runtime image：`seekdesk-runtime:node22`，基于 Node.js 22；Docker 构建固定 npm `11.6.2`，与 lockfile 生成版本一致。

## 自动化结果

### 静态与构建

- `git diff --check`：通过。
- `npm run lint`：shared、agent、config、runtime-core、web、api、daemon、runtime-worker、cloud-runtime 全部通过。
- `npm run typecheck`：全部 workspace 通过。
- `npm run build`：全部 workspace 通过；Next.js 生成 `/`、`/_not-found`、`/templates`。
- `npm run verify:secrets`：通过，扫描 217 个 tracked files，没有命中 API key、OAuth secret 或 private key。

### 单元与 API 测试

- `npm run test --workspaces --if-present`：217 项通过，2 项 legacy `daily_work` 测试显式跳过。
- shared：13 项通过。
- agent：26 项通过。
- runtime-core：7 项通过。
- web：18 项通过。
- api：128 项通过，2 项跳过；真实 Postgres repository integration 2/2 通过。
- daemon：8 项通过。
- runtime-worker：6 项通过。
- cloud-runtime：11 项通过。
- cloud lifecycle 的终态现在先写入 storage，再替换内存状态；服务看到 `completed` 时磁盘状态已经可恢复。

### Postgres

- `npm run db:migrate`：真实 Postgres migration 成功。
- `SEEKDESK_TEST_DATABASE_URL` 指向真实 Postgres 时，workspace、operation、credential、session、tool、grant、activity、artifact、usage repository 测试通过。
- smoke 数据清理扩展到 coding/browser session 与 browser cloud workspace；实际清理 7 个 session、16 条 message、4 条 tool call、3 条 grant、15 条 activity、6 条 usage、4 条 runtime operation 和 2 个测试 cloud workspace。

## Runtime Worker 与安全边界

`npm run test:runtime-container` 使用真实 `seekdesk-runtime:node22` 通过：

- 9 个 coding tools 全部执行成功：list/read/grep、Git status/diff、write/edit、Shell、tests。
- rootfs 为 read-only。
- execution network 为 `none`，容器内公网请求确认失败。
- user 为非 root `10001:10001`。
- CPU 2、内存 4 GiB、PID 256。
- `cap-drop ALL` 与 `no-new-privileges=true` 生效。
- 没有 Docker socket mount，也没有 privileged。
- fixture 容器与 workspace tmpfs 在脚本结束后自动删除。

## Cloud Runtime 真实生命周期

`npm run test:cloud-runtime` 使用真实 Docker、公开 HTTPS Git fixture 和真实 worker image 通过：

- clone `https://github.com/octocat/Hello-World.git` 的 `master` 分支。
- provision -> execute -> stop -> service restart -> start -> delete 全部成功。
- 文件读取、文件写入、精确编辑、Git status/diff、Shell 和无公网验证通过。
- workspace 在 cloud service 重启后保持，重新 start 后仍能读取变更。
- delete 后 managed container 数量为 0，workspace directory 已删除。
- Git/bootstrap 使用宿主网络；普通 coding tool 只在 `network none` execution container 中运行。

## API、Local Daemon 与浏览器

带 `SEEKDESK_BROWSER_SMOKE_CLOUD=1` 的 `npm run test:browser-smoke` 已通过：

- 同时启动 cloud-runtime、Postgres API、Next.js Web 和 local daemon。
- local daemon workspace 与 cloud workspace 同时在线。
- cloud workspace 通过 public API 创建、读取 Git 仓库、创建 chat session，并保持 `workspaceId + runtimeMode` trace 绑定。
- local workspace 完成 tree/read/search、Git status/diff、chat、pending Shell、same-session grant 和批准执行。
- cloud workspace 在 smoke 结束后通过 public API 删除。

真实 UI 由 Windows 本机 Chrome 通过 SSH port forwarding 访问远程服务：

- 新建对话弹窗可识别 ready cloud workspace，也可切回 local daemon 创建会话。
- 默认对话区没有空白右侧栏；文件、搜索、Diff、终端、运行详情按需打开。
- coding prompt、pending write、批准执行、trace 和 terminal 通过。
- console、page error、HTTP response 与 API request 扫描无 fatal error、乱码、连续问号、邮箱/日历/连接器请求。
- 最终结果：`[browser-ui-smoke] UI smoke passed`。

## 清理结果

- 失败 Docker build 容器已按精确 ID 删除。
- browser cloud 临时 storage、runtime fixture、smoke artifact、临时日志和浏览器 symlink 已删除。
- 误创建且从未使用的 Colima `true` profile 已删除，只保留运行中的 `default` profile。
- 没有残留 `seekdesk.managed=true` 容器或 smoke volume。
- 保留 `seekdesk-postgres` 与 `seekdesk_seekdesk_postgres_data`，因为它们是项目开发数据库，不是临时测试资源。
- 无关 Docker 容器、volume 和用户目录未被删除。

## 已知限制

- v1 cloud runtime 是单机 Docker 服务，不含多节点调度、计费和租户配额控制面。
- v1 local daemon pairing token 仍需在生产阶段升级为设备身份、短期 token 和轮换机制。
- 真实 UI 在 Windows Chrome 完成；`jim-mac` 当前没有可由 Playwright 启动的兼容 Chrome binary。
- cloud integration fixture 依赖 GitHub HTTPS egress；离线环境应替换为企业内部 HTTPS Git fixture。

## 最终待办

1. 提交并 push `codex/dual-runtime`。
2. 合并到 `main` 后重新执行 build、migration、runtime/cloud smoke 与 browser smoke。
