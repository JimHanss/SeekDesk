# Realtime Events

The shared package defines the initial realtime event vocabulary:

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

The API WebSocket route is currently a placeholder and will be replaced by the agent event stream in the first implementation sprint.
