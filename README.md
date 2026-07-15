# SeekDesk

SeekDesk 是一个以 DeepSeek 为模型入口的 AI 编程工作台。浏览器负责对话、工作区选择、审批和结果展示；代码执行由两种隔离的 Runtime 承担：

- `local_daemon`：连接用户电脑上的真实项目目录，适合即时本地开发。
- `cloud_runtime`：在服务端为 Git 仓库创建隔离容器，适合线上用户和多人环境。

会话创建后固定绑定 `ownerId + workspaceId + runtimeMode`。文件读取、搜索和 Git 只读操作可以自动执行；写文件、编辑、Shell 和测试必须在同一会话内批准后执行，并写入 trace、activity、artifact 和 model usage。

## 技术栈

- Web：Next.js、React、TypeScript、Tailwind CSS、Lucide
- API：Fastify、WebSocket、Zod、Drizzle ORM、Postgres
- Agent：DeepSeek streaming/tool calls，缺少 key 时使用 mock provider
- 本机 Runtime：Node.js daemon 主动连接 `/ws/daemon`
- 云端 Runtime：Fastify internal service、Docker Engine、Node.js 22 runtime worker
- 共享执行核心：`@seekdesk/runtime-core`

## 目录

```text
apps/
  web/              双 Runtime 编程工作台
  api/              公共 API、会话/审批/审计、RuntimeResolver
  daemon/           用户电脑上的 local daemon
  cloud-runtime/    服务端容器生命周期和内部 API
  runtime-worker/   容器内固定 /workspace 的工具进程
packages/
  shared/           Runtime、workspace、session、tool、grant 协议
  runtime-core/     文件、搜索、Git、Shell、测试的共享安全实现
  agent/            DeepSeek provider、工具注册和 agent loop
  config/           共享配置
docker/
  runtime-worker.Dockerfile
  cloud-runtime.Dockerfile
docs/architecture/  流程、安全、API/数据库和运维说明
specs/dual-runtime/  需求、计划、任务和验证记录
```

## 本地开发

要求 Node.js 22.12+、npm 10.9+。Postgres 与 cloud runtime 需要 Docker Engine。

```bash
npm install
cp .env.example .env
npm run dev
```

常用命令：

```bash
npm run dev:web
npm run dev:api
npm run dev:daemon
npm run dev:cloud-runtime
npm run dev:runtime-worker
npm run db:migrate
npm run lint
npm run test
npm run typecheck
npm run build
npm run test:runtime-container
npm run test:cloud-runtime
npm run test:browser-smoke
npm run verify:secrets
```

默认地址：Web `http://127.0.0.1:3000`，API `http://127.0.0.1:4000`，cloud runtime internal service `http://127.0.0.1:4100`。

跨机器访问 Next.js dev server 时，配置允许的来源，例如：

```bash
SEEKDESK_ALLOWED_DEV_ORIGINS=192.168.1.173 npm run dev:web
```

推荐让浏览器继续使用同源 `/api`，由 Next.js 代理到 `SEEKDESK_API_PROXY_URL`，避免在浏览器中暴露内部地址或触发跨端口 CORS。

启用真实 cloud runtime 的完整 smoke：

```bash
SEEKDESK_BROWSER_SMOKE_CLOUD=1 npm run test:browser-smoke
```

该命令需要 Docker、`seekdesk-runtime:node22` 和可用 Postgres；测试 cloud workspace、session 与活动记录可用 `npm run cleanup:smoke-data` 精确清理。

## 使用 Local Daemon

在需要操作项目文件的用户电脑上执行：

```bash
npm run build
npm --workspace @seekdesk/daemon run start -- start \
  --api http://API_HOST:4000 \
  --token seekdesk-local-dev \
  --workspace /path/to/project
```

Windows 示例：

```powershell
npm --workspace @seekdesk/daemon run start -- start --api http://API_HOST:4000 --token seekdesk-local-dev --workspace "E:\Project\MyApp"
```

daemon 会主动注册、发送心跳并在断线后重连。新建对话时选择“本机”，再选择该 daemon 暴露的工作区。路径解析、symlink、ignore 目录、二进制和大文件限制都在 daemon 内再次执行。

## 使用 Cloud Runtime

1. 构建 `seekdesk-runtime:node22`。
2. 配置 `SEEKDESK_CLOUD_RUNTIME_*`、`SEEKDESK_CREDENTIAL_ENCRYPTION_KEY` 和 Postgres。
3. 启动 Postgres、cloud runtime 和 API。
4. 在新建对话中选择“云端”，输入公开 HTTPS Git URL 或选择已保存的 HTTPS token 凭据。

```bash
docker build -f docker/runtime-worker.Dockerfile -t seekdesk-runtime:node22 .
docker compose -f docker-compose.postgres.yml up -d
docker compose -f docker-compose.runtime.yml up -d
npm run db:migrate
```

云端生命周期为 `provisioning -> cloning -> ready`。停止、启动、重试和删除均使用 idempotency key；容器普通工具执行默认无外网，rootfs 只读，工作区挂载到 `/workspace`。

## 生产身份与 Git 凭据

- 开发模式使用服务端 `SEEKDESK_DEV_USER_ID`，客户端不能覆盖 owner。
- 生产模式使用 OIDC/JWT，必须配置 issuer、audience 和 JWKS URL。
- 生产环境未完成 OIDC 配置时禁用 `cloud_runtime`。
- Git v1 只支持公开 HTTPS 仓库和加密 HTTPS token，不支持 SSH key。
- token 使用 owner-bound AES-256-GCM 加密；浏览器、日志、URL、Git config 和错误响应都不能看到明文。

## 故障排查

- `daemon_offline`：确认 daemon 进程、API 地址和 pairing token，等待心跳恢复。
- `runtime_unavailable`：检查 API 到 cloud runtime internal service 的网络和 service token。
- `runtime_not_ready`：等待 cloning/starting 完成，或在工作区列表执行重试。
- `repository_clone_failed`：检查 HTTPS URL、分支、凭据状态和 clone 超时。
- Postgres degraded：检查 `DATABASE_URL`，启动数据库后执行 `npm run db:migrate`。
- 浏览器 HMR/CORS：优先使用同源 API 代理，并配置 `SEEKDESK_ALLOWED_DEV_ORIGINS`。

## 安全边界

- 任意工具执行都必须匹配同一个 owner、session、workspace 和 Runtime。
- 读操作仍受工作区根目录、ignore、大小和二进制限制。
- 写入、Shell、测试必须先生成 pending tool call，再由同会话 grant 批准。
- 明显破坏性命令默认拒绝；Shell 有 cwd 锁定、timeout、输出截断和环境变量脱敏。
- `server_local` 仅用于显式开发/测试，未知工作区不会自动回退。

完整设计见 `docs/architecture/complete-flow-summary.md`、`runtime-security-boundary.md` 和 `cloud-runtime-operations.md`。
