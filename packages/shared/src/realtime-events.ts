import { z } from "zod";

import { appModeSchema } from "./app-modes.js";

const baseEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  createdAt: z.string()
});

export const realtimeEventSchema = z.discriminatedUnion("type", [
  baseEventSchema.extend({
    type: z.literal("session.created"),
    workspaceId: z.string(),
    appMode: appModeSchema.default("daily_work")
  }),
  baseEventSchema.extend({
    type: z.literal("mode.changed"),
    appMode: appModeSchema
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
    type: z.literal("artifact.created"),
    artifactId: z.string(),
    title: z.string(),
    artifactType: z.enum([
      "document",
      "research_note",
      "meeting_summary",
      "task_list"
    ])
  }),
  baseEventSchema.extend({
    type: z.literal("workflow.status_changed"),
    workflowId: z.string(),
    status: z.enum([
      "draft",
      "waiting_for_approval",
      "running",
      "completed",
      "failed"
    ])
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
