# Realtime Events

The shared package defines the initial realtime event vocabulary for agent and
tool orchestration:

- `session.created`
- `message.user`
- `message.assistant.delta`
- `message.assistant.done`
- `tool.requested`
- `tool.permission_required`
- `tool.permission_granted`
- `tool.permission_denied`
- `tool.started`
- `tool.output.delta`
- `tool.completed`
- `tool.failed`
- `file.changed`
- `diff.updated`
- `agent.cancelled`
- `agent.completed`

The daily-work activity stream now has a concrete API contract in
`packages/shared/src/daily-events.ts`:

- `GET /api/daily/events?mode=daily_work` returns the current daily activity
  list.
- `GET /api/daily/events/:eventId?mode=daily_work` returns one activity event.
- `GET /ws` sends an initial `daily.activity.snapshot` message containing
  `type`, `mode`, `events`, and `generatedAt`.

`coding_agent` remains a compatibility mode and returns empty daily-work
activity lists in this milestone. The WebSocket still avoids tool execution; it
only publishes read-only daily-work status snapshots plus the existing echo
behavior used by tests.

Browser smoke verifies that the page binds to the REST activity list and the
WebSocket snapshot, receives seven daily-work events, and keeps the connection
status live.
