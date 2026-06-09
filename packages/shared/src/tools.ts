import { z } from "zod";

export const dailyWorkToolNames = [
  "draft_document",
  "research_topic",
  "summarize_meeting",
  "organize_knowledge",
  "plan_workflow",
  "connect_context",
  "gmail.search_threads",
  "gmail.read_thread",
  "gmail.create_draft_preview",
  "calendar.list_events",
  "calendar.propose_event_preview",
  "outlook.search_messages",
  "outlook.read_message",
  "outlook.create_draft_preview",
  "outlook.calendar.list_events",
  "outlook.calendar.propose_event_preview",
  "daily.persist_artifact"
] as const;

export const codingToolNames = [
  "read_file",
  "write_file",
  "edit_file",
  "list_files",
  "grep",
  "run_shell",
  "git_diff",
  "git_status",
  "run_tests"
] as const;

const toolNames = [...dailyWorkToolNames, ...codingToolNames] as const;

export const dailyWorkToolNameSchema = z.enum(dailyWorkToolNames);
export const codingToolNameSchema = z.enum(codingToolNames);
export const toolNameSchema = z.enum(toolNames);

export const toolCallStatusSchema = z.enum([
  "requested",
  "permission_required",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export const gmailSearchThreadsInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  maxResults: z.number().int().min(1).max(20).default(10)
});

export const gmailReadThreadInputSchema = z.object({
  threadId: z.string().trim().min(1)
});

export const gmailCreateDraftPreviewInputSchema = z.object({
  to: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).default([]),
  subject: z.string().trim().min(1).max(300),
  bodyText: z.string().trim().min(1).max(10000),
  threadId: z.string().trim().min(1).optional()
});

export const calendarListEventsInputSchema = z.object({
  calendarId: z.string().trim().min(1).default("primary"),
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
  maxResults: z.number().int().min(1).max(50).default(10)
});

export const calendarProposeEventPreviewInputSchema = z.object({
  calendarId: z.string().trim().min(1).default("primary"),
  summary: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime(),
  attendeeEmails: z.array(z.string().email()).max(50).default([])
});

export const outlookSearchMessagesInputSchema = z.object({
  query: z.string().trim().min(1).max(500).optional(),
  maxResults: z.number().int().min(1).max(20).default(10)
});

export const outlookReadMessageInputSchema = z.object({
  messageId: z.string().trim().min(1)
});

export const outlookCreateDraftPreviewInputSchema = z.object({
  to: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).default([]),
  subject: z.string().trim().min(1).max(300),
  bodyText: z.string().trim().min(1).max(10000),
  conversationId: z.string().trim().min(1).optional()
});

export const outlookCalendarListEventsInputSchema = z.object({
  calendarId: z.string().trim().min(1).default("primary"),
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
  maxResults: z.number().int().min(1).max(50).default(10),
  timeZone: z.string().trim().min(1).max(80).optional()
});

export const outlookCalendarProposeEventPreviewInputSchema = z.object({
  calendarId: z.string().trim().min(1).default("primary"),
  summary: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime(),
  attendeeEmails: z.array(z.string().email()).max(50).default([]),
  timeZone: z.string().trim().min(1).max(80).default("UTC"),
  location: z.string().trim().max(300).optional()
});

export const dailyPersistArtifactInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  artifactType: z.string().trim().min(1).max(80).default("ai_generated_note"),
  content: z.string().trim().min(1).max(50000),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([])
});

export const dailyWorkToolInputSchemas = {
  "gmail.search_threads": gmailSearchThreadsInputSchema,
  "gmail.read_thread": gmailReadThreadInputSchema,
  "gmail.create_draft_preview": gmailCreateDraftPreviewInputSchema,
  "calendar.list_events": calendarListEventsInputSchema,
  "calendar.propose_event_preview": calendarProposeEventPreviewInputSchema,
  "outlook.search_messages": outlookSearchMessagesInputSchema,
  "outlook.read_message": outlookReadMessageInputSchema,
  "outlook.create_draft_preview": outlookCreateDraftPreviewInputSchema,
  "outlook.calendar.list_events": outlookCalendarListEventsInputSchema,
  "outlook.calendar.propose_event_preview":
    outlookCalendarProposeEventPreviewInputSchema,
  "daily.persist_artifact": dailyPersistArtifactInputSchema
} as const;

export const toolCallRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  name: toolNameSchema,
  status: toolCallStatusSchema,
  inputJson: z.unknown(),
  outputJson: z.unknown().optional(),
  outputText: z.string().optional(),
  previewOnly: z.boolean().default(true),
  permissionRequired: z.boolean().default(false),
  error: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional()
});

export const toolModelUsageRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  provider: z.string(),
  model: z.string(),
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  createdAt: z.string()
});

export type ToolName = z.infer<typeof toolNameSchema>;
export type DailyWorkToolName = z.infer<typeof dailyWorkToolNameSchema>;
export type CodingToolName = z.infer<typeof codingToolNameSchema>;
export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>;
export type ToolCallRecord = z.infer<typeof toolCallRecordSchema>;
export type GmailSearchThreadsInput = z.infer<typeof gmailSearchThreadsInputSchema>;
export type GmailReadThreadInput = z.infer<typeof gmailReadThreadInputSchema>;
export type GmailCreateDraftPreviewInput = z.infer<
  typeof gmailCreateDraftPreviewInputSchema
>;
export type CalendarListEventsInput = z.infer<typeof calendarListEventsInputSchema>;
export type CalendarProposeEventPreviewInput = z.infer<
  typeof calendarProposeEventPreviewInputSchema
>;
export type OutlookSearchMessagesInput = z.infer<
  typeof outlookSearchMessagesInputSchema
>;
export type OutlookReadMessageInput = z.infer<typeof outlookReadMessageInputSchema>;
export type OutlookCreateDraftPreviewInput = z.infer<
  typeof outlookCreateDraftPreviewInputSchema
>;
export type OutlookCalendarListEventsInput = z.infer<
  typeof outlookCalendarListEventsInputSchema
>;
export type OutlookCalendarProposeEventPreviewInput = z.infer<
  typeof outlookCalendarProposeEventPreviewInputSchema
>;
export type DailyPersistArtifactInput = z.infer<
  typeof dailyPersistArtifactInputSchema
>;
export type ToolModelUsageRecord = z.infer<typeof toolModelUsageRecordSchema>;
