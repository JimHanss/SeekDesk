# SeekDesk

SeekDesk is a DeepSeek-native web coding agent platform for developers. The MVP follows the DeepSeek DevDesk requirements: a browser workspace, streaming AI chat, local daemon mode, explicit permission controls, file inspection, command execution, diffs, and session persistence.

This first scaffold only initializes the monorepo and the runnable app shells. DeepSeek streaming, local workspace tools, permission flows, and diff review will be implemented in later milestones.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn-style components, Lucide icons
- API: Fastify, WebSocket, TypeScript
- Local daemon: Node.js CLI, TypeScript
- Shared contracts: Zod schemas and TypeScript types
- Agent core: DeepSeek provider interface and mock provider skeleton

## Workspace Layout

```text
apps/
  web/       Next.js developer workspace UI
  api/       Fastify API, WebSocket, agent orchestration shell
  daemon/    Local workspace daemon CLI shell
packages/
  shared/    Shared schemas, realtime events, permissions, tool types
  agent/     Model provider and agent loop skeleton
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
