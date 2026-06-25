# SeekDesk

SeekDesk is an AI coding workbench backed by DeepSeek, Postgres, and a local daemon runtime. The current product path is `coding_agent`: chat stays in the browser, while file reads, search, Git inspection, shell commands, and test execution are routed through a daemon connected to the user's selected workspace.

The older `daily_work` contracts remain in the repository for compatibility, but the active UI and API flow focus on coding-agent workflows.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn-style components, Lucide icons
- API: Fastify, WebSocket, TypeScript
- Runtime: local Node.js daemon that connects to the API over WebSocket
- Shared contracts: Zod schemas, app modes, realtime events, permissions, and tool types
- Agent core: DeepSeek streaming provider, mode context, mock fallback, and provider tests

## Workspace Layout

```text
apps/
  web/       Next.js coding-agent workbench UI
  api/       Fastify API, WebSocket daemon routing, AI orchestration shell
  daemon/    Local runtime for workspace file, search, Git, shell, and test tools
packages/
  shared/    Shared schemas, app modes, realtime events, permissions, tool types
  agent/     DeepSeek provider, mock fallback, and mode-aware agent loop
  config/    Shared configuration assets
docs/
  requirements/
  architecture/
scripts/
```

## Getting Started

```bash
npm install
npm run dev
```

Useful scripts:

```bash
npm run dev:web
npm run dev:api
npm run dev:daemon
npm run typecheck
npm run lint
npm run test
npm run test:browser-smoke
npm run build
```

Local daemon:

```bash
npm run build
npm --workspace @seekdesk/daemon run start -- start --api http://127.0.0.1:4000 --token seekdesk-local-dev --workspace /path/to/project
```

On Windows, run the same command from the SeekDesk checkout and pass a Windows workspace path, for example `--workspace "E:\\Project\\MyApp"`. The daemon registers with `/ws/daemon`; the web app then shows that workspace in the new-conversation dialog.

Browser smoke:

```bash
npm run build
npm run test:browser-smoke
```

`test:browser-smoke` uses Node.js plus Chrome DevTools Protocol to verify the coding workbench without Playwright or Puppeteer. It starts the API and web app when needed, chooses an available web port if `3000` is occupied, and checks the workspace picker, file/search/Git panels, chat trace, approval flow, terminal output, model usage, and removed email-connector text. Set `SEEKDESK_WEB_URL` to reuse an already-running web service and `BROWSER_PATH` to override Chrome or Edge discovery.

Default local endpoints:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Daily activity events: `http://localhost:4000/api/daily/events`
- Daily model usage: `http://localhost:4000/api/daily/model-usage`
- API WebSocket activity snapshot: `ws://localhost:4000/ws`
- Local daemon WebSocket: `ws://localhost:4000/ws/daemon`

## Environment

Copy `.env.example` to `.env` when wiring real services. Do not commit real API keys.

When `DEEPSEEK_API_KEY` is absent, the API uses the mock model provider and the
model-usage endpoint reports tracking-only sample usage. When the key is
present, chat requests use the DeepSeek-compatible streaming provider; API keys
stay server-side and are not returned to the browser.

## Current Boundaries

This milestone implements the coding-agent workspace with a local daemon. Read-only tools can inspect files, search, and Git state inside the selected workspace. File writes, shell commands, and test execution require same-session approval and are recorded through tool calls and activity events. Production-grade user accounts, one-time pairing tokens, and multi-tenant isolation are future hardening work.
