# SeekDesk

SeekDesk is an AI ecosystem workspace for everyday work. It helps people draft, research, summarize meetings, organize knowledge, plan tasks, and connect practical AI workflows around daily productivity.

The product keeps a dual-mode architecture: `daily_work` and `coding_agent`. The current build only develops and exposes `daily_work`; coding-agent capabilities remain compatible at the contract level for later milestones.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn-style components, Lucide icons
- API: Fastify, WebSocket, TypeScript
- Workflow runtime: Node.js services for future connectors and automations
- Shared contracts: Zod schemas, app modes, realtime events, permissions, and tool types
- Agent core: DeepSeek provider interface, mode context, and mock provider skeleton

## Workspace Layout

```text
apps/
  web/       Next.js everyday AI workspace UI
  api/       Fastify API, WebSocket, AI orchestration shell
  daemon/    Local runtime shell reserved for future connectors
packages/
  shared/    Shared schemas, app modes, realtime events, permissions, tool types
  agent/     Model provider and mode-aware agent loop skeleton
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
npm run build
```

Default local endpoints:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- API WebSocket placeholder: `ws://localhost:4000/ws`

## Environment

Copy `.env.example` to `.env` when wiring real services. Do not commit real API keys.
