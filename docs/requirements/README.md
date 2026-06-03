# Requirements

The original source document is `E:\Claude源码\deepseek-devdesk-task-plan.md`, but the active product direction changed after initialization.

SeekDesk now supports a dual-mode architecture while the current build focuses on an AI ecosystem workspace for everyday work. Treat future requirements through this lens:

- AI chat as the primary interaction surface
- Daily work templates for writing, research, meeting notes, planning, and knowledge work
- Connectors for documents, calendars, email, notes, and team knowledge
- Clear permission boundaries before accessing user data or external services
- DeepSeek-first model routing with provider abstraction for future models
- `daily_work` is the active implementation mode
- `coding_agent` is reserved for compatibility and future development workflows

Coding-agent concepts from the original document should only be reused when they serve general productivity workflows or explicit compatibility work.
