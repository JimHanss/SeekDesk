# Architecture Overview

SeekDesk is organized as a web-first AI workspace with two compatible app modes:

- `daily_work`: active mode for everyday productivity workflows.
- `coding_agent`: reserved mode for future development workflows.

The current implementation develops `daily_work` first and keeps `coding_agent` at the shared-contract and provider-context level.

The daily-work runtime has three layers:

1. Browser web UI for AI chat, work templates, connected context, permissions, and task status.
2. Backend API for sessions, mode-aware model routing, model-usage snapshots, realtime daily activity events, workflow orchestration, and future connectors.
3. Local or hosted runtime services for approved access to documents, calendars, notes, and automation endpoints.

The browser should never directly access private user data sources. All document, calendar, email, or local runtime operations must flow through explicit connectors and permission rules.

## Current Implementation

- The web app exposes the `daily_work` dashboard with streaming chat, task templates, session context, approvals, artifacts, connectors, workflow previews, activity events, and a DeepSeek model-usage panel.
- The API exposes `/api/chat`, `/api/daily/model-usage`, `/api/daily/events`, daily-work template/context/session/artifact/approval/connector/workflow routes, and `/ws` for `daily.activity.snapshot`.
- `POST /api/daily/context/:contextItemId/use-preview` returns a preview-only daily-work context-use contract from stored context metadata only, including prompt draft, source/permission metadata, approval gates, steps, and a no-external-effects safety boundary. It does not read real files, emails, notes, or private external data.
- `POST /api/daily/templates/:templateId/apply-preview` returns a preview-only daily-work template application contract with a prompt draft, suggested artifact type, requested context ids, required approval ids, steps, and a no-external-effects safety boundary.
- `POST /api/daily/sessions/:sessionId/restore-preview` returns a preview-only daily-work restore prompt from in-memory session metadata, linked artifacts/context/approvals, optional recent-message snippets, and a no-external-effects safety boundary.
- `POST /api/daily/workflows/:workflowId/preview` returns a preview-only workflow contract for `daily_work`, including selected action, connector/context/artifact/approval links, steps, and a no-external-effects safety boundary.
- The agent package includes a DeepSeek OpenAI-compatible SSE provider, a mock fallback for local development without `DEEPSEEK_API_KEY`, and tests for split SSE chunks, `reasoning_content`, usage-only chunks, and provider errors.
- Browser smoke verifies production rendering, activity REST/WS binding, model-usage API binding, prompt controls, workflow prompts, and highlighted chat code blocks.

## Reserved Surfaces

The daemon CLI, external connector writes, real document/calendar/email reads,
shell execution, Git operations, and coding-agent autonomy remain reserved for
later milestones. Current UI copy should keep these surfaces preview-only unless
a later implementation adds explicit permission and runtime support.
