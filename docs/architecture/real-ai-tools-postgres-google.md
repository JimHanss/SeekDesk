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

To safely write local Google OAuth configuration without committing secrets, set
the client id/secret in the current process environment and run:

```bash
GOOGLE_CLIENT_ID="..." \
GOOGLE_CLIENT_SECRET="..." \
npm run configure:google-oauth
```

The script updates `.env.local`, generates missing encryption/state secrets, and
does not print secret values. `.env.local` remains git-ignored.

Use `--target-env <path>` when writing a different ignored env file, for example
on a remote checkout.

When the Google OAuth client id/secret are available in the local process
environment and the remote checkout is reachable over SSH, sync them to the
remote ignored env file without printing secret values:

```bash
GOOGLE_CLIENT_ID="..." \
GOOGLE_CLIENT_SECRET="..." \
npm run sync:remote-google-oauth -- --host jim-mac
```

The remote sync command sends secrets over SSH stdin, invokes
`scripts/configure-google-oauth-env.mjs` inside the remote checkout, and writes
only to `.env.local` unless `--target-env` is provided.

To check a running API without exposing local secrets, run:

```bash
npm run verify:google-oauth
```

The readiness check calls `/health`, `/api/connectors/google/status`, and, when
configuration is complete but no account is connected yet,
`/api/connectors/google/oauth/start`. By default it redacts `client_id` and
`state` from the reported authorization URL. Use
`--show-authorization-url` only when you are ready to open the Google consent URL
in a browser:

```bash
npm run verify:google-oauth -- --require-configured --show-authorization-url
```

After the browser OAuth flow succeeds, use the stricter connected gate:

```bash
npm run verify:google-oauth -- --require-connected
```

For the SSH remote checkout, the full Postgres + API + DeepSeek verification can
be run as one remote session:

```bash
npm run verify:remote-real-agent
```

That command runs the remote secret hygiene check, runs the remote migration,
starts a temporary API using the remote `.env.postgres` and `.env.local`, runs
Google readiness, runs the real-agent verifier, and then cleans up the temporary
API. To keep the remote API running while completing browser OAuth, use:

```bash
npm run verify:remote-real-agent -- --keep-running --show-authorization-url
```

When Google is connected, the final strict gate is:

```bash
npm run verify:remote-real-agent -- --require-google
```

For SSH-based remote development, use a loopback redirect URI that matches the
forwarded API port, for example:

```text
GOOGLE_REDIRECT_URI=http://127.0.0.1:4000/api/connectors/google/oauth/callback
```

Then forward the API and web ports from the local machine to `jim-mac` before
opening the OAuth start URL in the local browser:

```bash
ssh -L 3000:127.0.0.1:3000 -L 4000:127.0.0.1:4000 jim-mac
```

## Real-Agent Verification

`npm run verify:real-agent` verifies a running API without reading secrets. It
checks:

- `/health` is backed by a ready Postgres repository.
- `/api/chat` uses DeepSeek, streams a response, and records model usage.
- DeepSeek plans and completes `daily.persist_artifact`.
- The session trace exposes tool plan/result records for the frontend.
- Google status is reported clearly.

When Google is connected, the same script asks DeepSeek to autonomously plan
`gmail.search_threads` and `calendar.list_events`. If Gmail returns a thread id,
the verifier also expects DeepSeek to continue with `gmail.read_thread` for that
thread. The script checks that each real read tool stays preview-only, records
the provider-specific result payload, and persists plan/result activity records:

```bash
npm run verify:real-agent -- --require-google
```

If Google is not connected and `--require-google` is omitted, the script passes
the DeepSeek/Postgres/artifact checks and reports the Google read verification as
skipped with the missing setup fields.

## DeepSeek Streaming

The DeepSeek provider parses:

- text delta
- reasoning delta
- usage chunks
- streamed tool call argument chunks

`/api/chat` still returns `text/plain` for frontend compatibility. Structured chunks
are handled server-side for persistence and tool orchestration.
