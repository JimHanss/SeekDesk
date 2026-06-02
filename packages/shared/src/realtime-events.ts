import { z } from "zod";

const baseEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  createdAt: z.string()
});

export const realtimeEventSchema = z.discriminatedUnion("type", [
  baseEventSchema.extend({
    type: z.literal("session.created"),
    workspaceId: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("message.user"),
    messageId: z.string(),
    content: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("message.assistant.delta"),
    messageId: z.string(),
    delta: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("message.assistant.done"),
    messageId: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("tool.requested"),
    toolCallId: z.string(),
    toolName: z.string(),
    summary: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("tool.permission_required"),
    toolCallId: z.string(),
    risk: z.enum(["low", "medium", "high"])
  }),
  baseEventSchema.extend({
    type: z.literal("tool.permission_granted"),
    toolCallId: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("tool.permission_denied"),
    toolCallId: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("tool.started"),
    toolCallId: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("tool.output.delta"),
    toolCallId: z.string(),
    delta: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("tool.completed"),
    toolCallId: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("tool.failed"),
    toolCallId: z.string(),
    error: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("file.changed"),
    path: z.string(),
    changeId: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("diff.updated"),
    changeId: z.string()
  }),
  baseEventSchema.extend({
    type: z.literal("agent.cancelled"),
    reason: z.string().optional()
  }),
  baseEventSchema.extend({
    type: z.literal("agent.completed")
  })
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
