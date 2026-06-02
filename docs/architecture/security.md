# Security Notes

MVP security defaults:

- Restrict daemon operations to an approved workspace root.
- Require explicit approval for writes and shell commands by default.
- Treat destructive command patterns as blocked or escalated actions.
- Log tool calls and permission decisions.
- Redact secrets from logs where possible.
- Keep model API keys in environment variables only.

High-risk areas for future implementation are shell execution, MCP tools, symlink escape, path traversal, prompt injection from repository files, and model-requested credential access.
