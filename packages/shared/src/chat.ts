import { z } from "zod";

import { appModeSchema } from "./app-modes.js";
import {
  runtimeErrorCodeSchema,
  runtimeModeInputSchema
} from "./runtime.js";

export const chatMessageRoleSchema = z.enum(["system", "user", "assistant"]);

export const chatMessageSchema = z.object({
  role: chatMessageRoleSchema,
  content: z.string().trim().min(1)
});

export const chatContextSchema = z
  .object({
    workspaceId: z.string().trim().min(1).optional(),
    runtimeMode: runtimeModeInputSchema.optional(),
    contextItemIds: z.array(z.string().trim().min(1)).default([]),
    artifactIds: z.array(z.string().trim().min(1)).default([]),
    approvalRequestIds: z.array(z.string().trim().min(1)).default([]),
    connectorIds: z.array(z.string().trim().min(1)).default([]),
    workflowIds: z.array(z.string().trim().min(1)).default([]),
    locale: z.string().trim().min(1).optional(),
    timezone: z.string().trim().min(1).optional()
  })
  .catchall(z.unknown());

export const chatRequestSchema = z
  .object({
    mode: appModeSchema.default("coding_agent"),
    sessionId: z.string().trim().min(1).optional(),
    templateId: z.string().trim().min(1).optional(),
    prompt: z.string().trim().min(1).optional(),
    messages: z.array(chatMessageSchema).optional(),
    context: chatContextSchema.optional()
  })
  .superRefine((request, context) => {
    if (request.prompt || (request.messages?.length ?? 0) > 0) {
      return;
    }

    context.addIssue({
      code: "custom",
      message: "A prompt or at least one chat message is required.",
      path: ["messages"]
    });
  });

export const chatProviderSchema = z.enum(["mock", "deepseek"]);

export const codingChatRequestSchema = chatRequestSchema.superRefine(
  (request, context) => {
    if (request.mode === "coding_agent" && !request.context?.workspaceId) {
      context.addIssue({
        code: "custom",
        message: "coding_agent requests require context.workspaceId.",
        path: ["context", "workspaceId"]
      });
    }
  }
);

export const chatEventTypeSchema = z.enum([
  "chat.started",
  "chat.text_delta",
  "chat.tool_call_preview",
  "chat.completed",
  "chat.error"
]);

export const chatEventSchema = z.object({
  type: chatEventTypeSchema,
  mode: appModeSchema.default("coding_agent"),
  sessionId: z.string().trim().min(1).optional(),
  provider: chatProviderSchema.optional(),
  workspaceId: z.string().trim().min(1).optional(),
  runtimeMode: runtimeModeInputSchema.optional(),
  runtimeErrorCode: runtimeErrorCodeSchema.optional(),
  delta: z.string().optional(),
  toolName: z.string().optional(),
  inputJson: z.unknown().optional(),
  error: z.string().optional()
});

export const chatResponseSchema = z.object({
  mode: appModeSchema.default("coding_agent"),
  sessionId: z.string().trim().min(1).optional(),
  provider: chatProviderSchema,
  content: z.string(),
  events: z.array(chatEventSchema).default([])
});

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatContext = z.infer<typeof chatContextSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type CodingChatRequest = z.infer<typeof codingChatRequestSchema>;
export type ChatProvider = z.infer<typeof chatProviderSchema>;
export type ChatEventType = z.infer<typeof chatEventTypeSchema>;
export type ChatEvent = z.infer<typeof chatEventSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
