# Real AI, Tool Orchestration, and Connectors

Status: daily_work v1 implementation baseline.

## Scope

SeekDesk now has a real daily_work foundation for:

- DeepSeek streaming chat through `/chat/completions`.
- Preview-only tool orchestration with schema validation before execution.
- Postgres persistence through Drizzle when `DATABASE_URL` is configured.
- JSON/seed fallback when Postgres is not configured.
- Google OAuth status/start/callback routes.
- Gmail and Google Calendar read/previews through server-side tools.

Coding-agent filesystem, shell, git, and file-write tools remain reserved and disabled.

## Official Sources

- DeepSeek chat completion: https://api-docs.deepseek.com/api/create-chat-completion
- DeepSeek tool calls: https://api-docs.deepseek.com/guides/tool_calls
- Gmail draft guide: https://developers.google.com/workspace/gmail/api/guides/drafts
- Google Calendar event guide: https://developers.google.com/workspace/calendar/api/guides/create-events
- Drizzle PostgreSQL setup and migrations: verified with Context7 for `/drizzle-team/drizzle-orm-docs`.

## Persistence

The repository factory prefers Postgres when `DATABASE_URL` is set:

1. `PostgresDailyWorkRepository`
2. `JsonDailyWorkRepository` when `SEEKDESK_DATA_DIR` is set
3. `SeedDailyWorkRepository`

Postgres tables are defined in `apps/api/src/db/schema.ts` and migrated from
`apps/api/drizzle/0000_real_ai_foundation.sql`.

Health exposes:

- `currentLayer`
- `dataDirConfigured`
- `jsonLocalReady`
- `postgresConfigured`
- `postgresReady`
- `futureDatabaseReady: false`

`SEEKDESK_TEST_DATABASE_URL` enables the gated Postgres integration test.

## Tool Boundary

Daily-work tools are preview-only:

- `gmail.search_threads`
- `gmail.read_thread`
- `gmail.create_draft_preview`
- `calendar.list_events`
- `calendar.propose_event_preview`
- `daily.persist_artifact`

Allowed:

- Read authorized Gmail/Calendar metadata.
- Generate local Gmail draft payload previews.
- Generate local Calendar event JSON previews.
- Persist local SeekDesk artifacts and activity events.

Forbidden in v1:

- Sending Gmail messages.
- Calling `drafts.send`.
- Creating Gmail drafts in the external account.
- Calling Calendar `events.insert`.
- Writing Google Docs or Drive files.
- Running shell/file/git coding tools.

All tool inputs are validated with shared Zod schemas before execution. Tool plans,
results, model usage chunks, session messages, artifacts, and activity records are
written through the daily-work repository.

## Google OAuth

Routes:

- `GET /api/connectors/google/status`
- `GET /api/connectors/google/oauth/start`
- `GET /api/connectors/google/oauth/callback`

Required env:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_OAUTH_STATE_SECRET`

Refresh tokens never reach the frontend. Tokens are encrypted with AES-256-GCM before
repository storage.

## DeepSeek Streaming

The DeepSeek provider parses:

- text delta
- reasoning delta
- usage chunks
- streamed tool call argument chunks

`/api/chat` still returns `text/plain` for frontend compatibility. Structured chunks
are handled server-side for persistence and tool orchestration.
