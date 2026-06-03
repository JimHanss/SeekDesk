# Architecture Overview

SeekDesk is organized as a web-first AI workspace with two compatible app modes:

- `daily_work`: active mode for everyday productivity workflows.
- `coding_agent`: reserved mode for future development workflows.

The current implementation develops `daily_work` first and keeps `coding_agent` at the shared-contract and provider-context level.

The daily-work runtime has three layers:

1. Browser web UI for AI chat, work templates, connected context, permissions, and task status.
2. Backend API for sessions, mode-aware model routing, realtime events, workflow orchestration, and future connectors.
3. Local or hosted runtime services for approved access to documents, calendars, notes, and automation endpoints.

The browser should never directly access private user data sources. All document, calendar, email, or local runtime operations must flow through explicit connectors and permission rules.
