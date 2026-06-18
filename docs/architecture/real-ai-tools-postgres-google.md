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
- Microsoft OAuth status/start/callback routes.
- Outlook Mail and Outlook Calendar read/previews through server-side tools.

Coding-agent filesystem, shell, git, and file-write tools remain reserved and disabled.

## Official Sources

- DeepSeek chat completion: https://api-docs.deepseek.com/api/create-chat-completion
- DeepSeek tool calls: https://api-docs.deepseek.com/guides/tool_calls
- Gmail draft guide: https://developers.google.com/workspace/gmail/api/guides/drafts
- Google Calendar event guide: https://developers.google.com/workspace/calendar/api/guides/create-events
- Microsoft Graph delegated auth and Outlook Mail/Calendar APIs: verified with
  Context7 for `/websites/learn_microsoft_en-us_graph`.
- Drizzle PostgreSQL setup and migrations: verified with Context7 for `/drizzle-team/drizzle-orm-docs`.

## Persistence

The repository factory prefers Postgres when `DATABASE_URL` is set:

1. `PostgresDailyWorkRepository`
2. `JsonDailyWorkRepository` when `SEEKDESK_DATA_DIR` is set
3. `SeedDailyWorkRepository`

Postgres tables are defined in `apps/api/src/db/schema.ts` and migrated from
`apps/api/drizzle/0000_real_ai_foundation.sql`.

The Drizzle CLI config loads local env files in this order without printing
values:

1. `.env`
2. `.env.local`
3. `.env.postgres`

Explicit process environment variables still take priority. This lets a remote
checkout run `npm run db:migrate` directly when its ignored `.env.postgres`
contains `DATABASE_URL`.

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
- `outlook.search_messages`
- `outlook.read_message`
- `outlook.create_draft_preview`
- `outlook.calendar.list_events`
- `outlook.calendar.propose_event_preview`
- `daily.persist_artifact`

Allowed:

- Read authorized Gmail/Calendar metadata.
- Read authorized Outlook Mail/Calendar metadata.
- Generate local Gmail draft payload previews.
- Generate local Calendar event JSON previews.
- Generate local Outlook draft payload previews.
- Generate local Outlook Calendar event JSON previews.
- Persist local SeekDesk artifacts and activity events.

Forbidden in v1:

- Sending Gmail messages.
- Calling `drafts.send`.
- Creating Gmail drafts in the external account.
- Calling Calendar `events.insert`.
- Calling Microsoft Graph `sendMail`.
- Creating Microsoft Graph Outlook message drafts in the external account.
- Creating Microsoft Graph Calendar events in the external account.
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

Frontend email authorization uses the same routes as a user-facing popup flow:

1. The connector panel calls `/api/connectors/google/oauth/start`.
2. The browser opens the returned Google consent URL in a separate authorization
   window.
3. The user signs in with the mailbox account they want SeekDesk to read and
   approves the requested Gmail/Calendar scopes.
4. Google redirects to `/api/connectors/google/oauth/callback`.
5. The callback exchanges the authorization code server-side, stores encrypted
   tokens through the repository, posts a non-secret completion message back to
   the opener window, and auto-closes when the browser allows it.
6. The main window refreshes `/api/connectors/google/status`. It also polls as a
   fallback in case popup messaging is blocked.

The frontend never asks for a mailbox password and never receives access tokens
or refresh tokens. It only sees connection status, account email, granted scope
names, and setup errors.

`/api/connectors/google/status` also reports authorization completeness:

- `requiredScopes`: Gmail readonly, Gmail compose, and Calendar readonly scopes.
- `missingScopes`: required scopes absent from the stored Google account token.
- `scopesComplete`: true only when the connected account can run the v1 real
  read tools.

If an account is connected but `missingScopes` is non-empty, reopen the OAuth
consent URL to refresh scopes. The frontend keeps the OAuth button enabled in
that state and labels it as a scope refresh instead of treating the connector as
fully ready.

To safely write local Google OAuth configuration without committing secrets, add
the client id/secret to the ignored `.env.local` file and run:

```bash
npm run configure:google-oauth
```

The script reads `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from `.env.local`
or the current process environment, updates `.env.local`, generates missing
encryption/state secrets, and does not print secret values. `.env.local` remains
git-ignored.

Use `--target-env <path>` when writing a different ignored env file, for example
on a remote checkout.

When the Google OAuth client id/secret are available in local `.env.local` and
the remote checkout is reachable over SSH, sync them to the remote ignored env
file without printing secret values:

```bash
npm run sync:remote-google-oauth -- --host jim-mac
```

The remote sync command sends secrets over SSH stdin, invokes
`scripts/configure-google-oauth-env.mjs` inside the remote checkout, and writes
only to `.env.local` unless `--target-env` is provided. Use `--source-env` when
reading from a local env file other than `.env.local`.

For the usual SSH browser-auth setup, prefer the one-shot preparation command:

```bash
npm run prepare:remote-google-oauth
```

It validates local `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, syncs them to the
remote ignored `.env.local`, starts the remote API with `--keep-running`, prints
the Google authorization URL, and prints the SSH tunnel command for the browser
callback. It still does not print Google client secret values. If the
OAuth-ready session fails before the ready message, the helper attempts to clean
up the temporary remote API process and port.

To check a running API without exposing local secrets, run:

```bash
npm run verify:google-oauth
```

To check ignored env-file readiness without starting the API or printing secret
values, and to see the required Google OAuth redirect URI/scopes, run:

```bash
npm run verify:real-agent-env
npm run verify:real-agent-env -- --host jim-mac
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

This gate requires both a connected Google account and complete required scopes.
If scopes are missing, it fails before any Gmail or Calendar read attempt and
instructs you to reopen OAuth consent.

## Microsoft OAuth / Outlook

Routes:

- `GET /api/connectors/microsoft/status`
- `GET /api/connectors/microsoft/oauth/start`
- `GET /api/connectors/microsoft/oauth/callback`

Required env:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_REDIRECT_URI`
- `MICROSOFT_TOKEN_ENCRYPTION_KEY`
- `MICROSOFT_OAUTH_STATE_SECRET`

Required delegated scopes:

- `offline_access`
- `User.Read`
- `Mail.Read`
- `Calendars.Read`

To safely write local Microsoft OAuth configuration without committing secrets,
add the client id/secret to the ignored `.env.local` file and run:

```bash
npm run configure:microsoft-oauth
```

The script reads `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` from
`.env.local` or the current process environment, updates `.env.local`,
generates missing encryption/state secrets, and does not print secret values.

When the Microsoft OAuth client id/secret are available locally and the remote
checkout is reachable over SSH, sync them to the remote ignored env file without
printing secret values:

```bash
npm run sync:remote-microsoft-oauth -- --host jim-mac
```

For the usual SSH browser-auth setup, prefer the one-shot preparation command:

```bash
npm run prepare:remote-microsoft-oauth
```

It validates local `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`, syncs them
to the remote ignored `.env.local`, starts the remote API with
`--keep-running`, prints the Microsoft authorization URL, and prints the SSH
tunnel command for the browser callback.

To check a running API without exposing local secrets, run:

```bash
npm run verify:microsoft-oauth
npm run verify:microsoft-oauth -- --require-configured --show-authorization-url
npm run verify:microsoft-oauth -- --require-connected
```

The frontend opens Microsoft authorization in a separate window just like Google
authorization. The callback exchanges the authorization code server-side, stores
encrypted tokens through the repository, posts a non-secret completion message to
the opener, and closes when the browser allows it.

Outlook tools use Microsoft Graph only for read operations:

- `outlook.search_messages` calls `/me/messages` and returns selected metadata.
- `outlook.read_message` calls `/me/messages/{messageId}` and returns one
  message.
- `outlook.calendar.list_events` calls `/me/calendarView` or a selected
  calendar view and returns selected event metadata.

Preview tools do not call Microsoft Graph write endpoints:

- `outlook.create_draft_preview` builds a local Graph message payload preview.
- `outlook.calendar.propose_event_preview` builds a local Graph event payload
  preview.

SeekDesk does not call `sendMail`, create Outlook drafts, or insert Outlook
calendar events in daily_work v1.

For the SSH remote checkout, the full Postgres + API + DeepSeek verification can
be run as one remote session:

```bash
npm run verify:remote-real-agent
```

That command runs the remote secret hygiene check, runs the remote migration,
starts a temporary API using the remote `.env.postgres` and `.env.local`, runs
Google and Microsoft readiness checks, runs the real-agent verifier, and then
cleans up the temporary API. To keep the remote API running while completing
browser OAuth, use:

```bash
npm run verify:remote-real-agent -- --keep-running --show-authorization-url
```

That command starts the temporary remote API on port `45100` by default. For a
browser-based OAuth callback, make the redirect URI match that port before
syncing remote provider env:

```bash
npm run sync:remote-google-oauth -- --host jim-mac --redirect-uri http://127.0.0.1:45100/api/connectors/google/oauth/callback
npm run sync:remote-microsoft-oauth -- --host jim-mac --redirect-uri http://127.0.0.1:45100/api/connectors/microsoft/oauth/callback
```

Then forward the web and API ports from the local machine to `jim-mac` before
opening the OAuth URL:

```bash
ssh -L 3000:127.0.0.1:3000 -L 45100:127.0.0.1:45100 jim-mac
```

When Google is connected, the final strict gate is:

```bash
npm run verify:remote-real-agent -- --require-google
```

When Microsoft is connected, use the Outlook strict gate:

```bash
npm run verify:remote-real-agent -- --require-microsoft
```

The strict remote gates fail fast if the connected account lacks required
Gmail/Calendar or Outlook Mail/Calendar scopes.

## Real-Agent Verification

`npm run verify:real-agent` verifies a running API without reading secrets. It
checks:

- `/health` is backed by a ready Postgres repository.
- `/api/chat` uses DeepSeek, streams a response, and records model usage.
- DeepSeek plans and completes `daily.persist_artifact`.
- The session trace exposes tool plan/result records for the frontend.
- Google status is reported clearly.

When Google is connected with complete scopes, the same script asks DeepSeek to autonomously plan
`gmail.search_threads` and `calendar.list_events`. If Gmail returns a thread id,
the verifier also expects DeepSeek to continue with `gmail.read_thread` for that
thread. The script checks that each real read tool stays preview-only, records
the provider-specific result payload, and persists plan/result activity records:

```bash
npm run verify:real-agent -- --require-google
```

When Microsoft is connected with complete scopes, the script asks DeepSeek to
autonomously plan `outlook.search_messages` and
`outlook.calendar.list_events`. If Outlook message search returns a message id,
the verifier also expects DeepSeek to continue with `outlook.read_message` for
that first message. The strict command is:

```bash
npm run verify:real-agent -- --require-microsoft
```

If Google or Microsoft is not connected and the matching `--require-*` flag is
omitted, the script passes the DeepSeek/Postgres/artifact checks and reports the
provider read verification as skipped with the missing setup fields.

## DeepSeek Streaming

The DeepSeek provider parses:

- text delta
- reasoning delta
- usage chunks
- streamed tool call argument chunks

`/api/chat` still returns `text/plain` for frontend compatibility. Structured chunks
are handled server-side for persistence and tool orchestration.
