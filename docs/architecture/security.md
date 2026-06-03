# Security Notes

SeekDesk's current daily-work mode handles private work context. The reserved coding-agent mode must not bypass the same permission model when it is expanded later.

MVP security defaults:

- Restrict connected data access to explicitly approved sources.
- Require explicit approval before reading private documents, calendars, notes, email, or external services.
- Treat destructive external actions, sends, deletes, and automation writes as blocked or escalated actions.
- Log tool calls, connector access, and permission decisions.
- Redact secrets from logs where possible.
- Keep model API keys in environment variables only.

High-risk areas for future implementation are external connector permissions, prompt injection from user documents, model-requested credential access, accidental sharing of private context, and automations that send or mutate data.
