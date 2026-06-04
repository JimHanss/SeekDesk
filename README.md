# SeekDesk

SeekDesk is an AI ecosystem workspace for everyday work. It helps people draft, research, summarize meetings, organize knowledge, plan tasks, and connect practical AI workflows around daily productivity.

The product keeps a dual-mode architecture: `daily_work` and `coding_agent`. The current build only develops and exposes `daily_work`; coding-agent capabilities remain compatible at the contract level for later milestones.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn-style components, Lucide icons
- API: Fastify, WebSocket, TypeScript
- Workflow runtime: Node.js services for future connectors and automations
- Shared contracts: Zod schemas, app modes, realtime events, permissions, and tool types
- Agent core: DeepSeek streaming provider, mode context, mock fallback, and provider tests

## Workspace Layout

```text
apps/
  web/       Next.js everyday AI workspace UI
  api/       Fastify API, WebSocket activity snapshots, AI orchestration shell
  daemon/    Local runtime shell reserved for future connectors
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

Browser smoke:

```bash
npm run build
npm run test:browser-smoke
```

`test:browser-smoke` uses Node.js plus Chrome DevTools Protocol to run a
production-page smoke without Playwright or Puppeteer. It starts the API and web
services, then verifies page render, daily activity API/WebSocket snapshots,
the DeepSeek model-usage panel, prompt interactions, workflow prompt filling,
and highlighted chat code blocks. By default it starts `apps/web` with
`next start` on `http://127.0.0.1:3000`; set `SEEKDESK_SMOKE_URL` to reuse an
already-running service and `BROWSER_PATH` to override Chrome or Edge discovery.

Default local endpoints:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Daily activity events: `http://localhost:4000/api/daily/events`
- Daily model usage: `http://localhost:4000/api/daily/model-usage`
- API WebSocket activity snapshot: `ws://localhost:4000/ws`

## Environment

Copy `.env.example` to `.env` when wiring real services. Do not commit real API keys.

When `DEEPSEEK_API_KEY` is absent, the API uses the mock model provider and the
model-usage endpoint reports tracking-only sample usage. When the key is
present, chat requests use the DeepSeek-compatible streaming provider; API keys
stay server-side and are not returned to the browser.

## Current Boundaries

This milestone implements the `daily_work` workspace. External connectors,
document/calendar/email reads, sends, writes, shell commands, Git operations,
and coding-agent tool execution remain preview-only or reserved surfaces.
