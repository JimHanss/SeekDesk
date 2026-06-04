# Security Notes

SeekDesk's current daily-work mode handles private work context. The reserved coding-agent mode must not bypass the same permission model when it is expanded later.

MVP security defaults:

- Restrict connected data access to explicitly approved sources.
- Require explicit approval before reading private documents, calendars, notes, email, or external services.
- Treat destructive external actions, sends, deletes, and automation writes as blocked or escalated actions.
- Log tool calls, connector access, and permission decisions.
- Redact secrets from logs where possible.
- Keep model API keys in environment variables only.

Current implemented safeguards:

- `DEEPSEEK_API_KEY` is read only by the API process. The model-usage endpoint reports whether the key is configured but does not return the secret.
- The browser consumes daily-work snapshots and model-usage summaries through API routes; it does not connect directly to DeepSeek or private data sources.
- `coding_agent` requests are accepted only through compatibility paths and do not enable filesystem, shell, Git, or IDE tools in this milestone.
- Daily activity WebSocket messages are read-only snapshots. They do not execute external actions.
- Browser smoke covers the daily activity stream, model-usage panel, prompt interactions, and code block rendering to catch regressions in exposed surfaces.

High-risk areas for future implementation are external connector permissions, prompt injection from user documents, model-requested credential access, accidental sharing of private context, and automations that send or mutate data.
