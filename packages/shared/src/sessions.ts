import { z } from "zod";

import { appModeSchema } from "./app-modes.js";

export const sessionRefSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string().optional(),
  workspaceRoot: z.string().optional(),
  workspaceRuntimeMode: z.enum(["local_daemon", "server_local", "cloud_workspace"]).optional(),
  appMode: appModeSchema.default("daily_work"),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const sessionWorkflowStatusSchema = z.enum([
  "active",
  "waiting_for_approval",
  "completed",
  "archived"
]);

export const dailyWorkSessionLastActionSchema = z.object({
  at: z.string().datetime(),
  actor: z.string(),
  label: z.string(),
  artifactId: z.string().optional(),
  approvalRequestId: z.string().optional()
});

export const dailyWorkSessionMessageRoleSchema = z.enum([
  "system",
  "user",
  "assistant"
]);

export const dailyWorkSessionMessageSchema = z.object({
  id: z.string(),
  role: dailyWorkSessionMessageRoleSchema,
  content: z.string(),
  createdAt: z.string().datetime(),
  artifactIds: z.array(z.string()).default([]),
  contextItemIds: z.array(z.string()).default([]),
  approvalRequestIds: z.array(z.string()).default([])
});

export const dailyWorkSessionSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string().optional(),
  workspaceRoot: z.string().optional(),
  workspaceRuntimeMode: z.enum(["local_daemon", "server_local", "cloud_workspace"]).optional(),
  appMode: appModeSchema.default("daily_work"),
  title: z.string(),
  status: sessionWorkflowStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  summary: z.string(),
  lastAction: dailyWorkSessionLastActionSchema.nullable(),
  artifactIds: z.array(z.string()).default([]),
  contextItemIds: z.array(z.string()).default([]),
  approvalRequestIds: z.array(z.string()).default([]),
  messageCount: z.number().int().nonnegative(),
  tags: z.array(z.string()).default([])
});

export const dailyWorkSessionDetailSchema = dailyWorkSessionSummarySchema.extend(
  {
    recentMessages: z.array(dailyWorkSessionMessageSchema).default([])
  }
);

export const dailyWorkSessionsResponseSchema = z.object({
  mode: appModeSchema,
  sessions: z.array(dailyWorkSessionSummarySchema)
});

export const dailyWorkSessionResponseSchema = z.object({
  mode: appModeSchema,
  session: dailyWorkSessionDetailSchema
});

export const dailyWorkSessionRestorePreviewRequestSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  includeRecentMessages: z.boolean().default(false),
  prompt: z.string().trim().min(1).max(2000).optional()
});

export const dailyWorkSessionRestoreSafetyBoundarySchema = z.object({
  previewOnly: z.literal(true).default(true),
  externalEffects: z.array(z.literal("none")).default(["none"]),
  prohibitedExternalActions: z
    .array(
      z.enum([
        "send_email",
        "write_document",
        "schedule_calendar_event",
        "create_task",
        "read_private_external_data",
        "resume_real_execution"
      ])
    )
    .default([
      "send_email",
      "write_document",
      "schedule_calendar_event",
      "create_task",
      "read_private_external_data",
      "resume_real_execution"
    ]),
  statement: z.string()
});

export const dailyWorkSessionRestorePreviewSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  sessionId: z.string(),
  sessionTitle: z.string(),
  status: sessionWorkflowStatusSchema,
  summary: z.string(),
  lastAction: dailyWorkSessionLastActionSchema.nullable(),
  restorePrompt: z.string(),
  artifactIds: z.array(z.string()).default([]),
  contextItemIds: z.array(z.string()).default([]),
  approvalRequestIds: z.array(z.string()).default([]),
  recentMessagesPreview: z.array(dailyWorkSessionMessageSchema).optional(),
  previewOnly: z.literal(true).default(true),
  externalEffects: z.array(z.literal("none")).default(["none"]),
  safetyBoundary: dailyWorkSessionRestoreSafetyBoundarySchema,
  generatedAt: z.string().datetime()
});

export const dailyWorkSessionRestorePreviewResponseSchema = z.object({
  mode: appModeSchema,
  preview: dailyWorkSessionRestorePreviewSchema
});

export const defaultDailyWorkSessionDetails: DailyWorkSessionDetail[] = [
  {
    id: "customer-follow-up-session",
    workspaceId: "workspace-seekdesk",
    appMode: "daily_work",
    title: "Customer follow-up draft",
    status: "waiting_for_approval",
    createdAt: "2026-06-02T10:55:00.000Z",
    updatedAt: "2026-06-02T11:25:00.000Z",
    summary:
      "Drafted a customer-facing reply grounded in meeting notes and protected email context.",
    lastAction: {
      at: "2026-06-02T11:25:00.000Z",
      actor: "daily-work-agent",
      label: "Requested review for the external reply draft.",
      artifactId: "email-draft-artifact",
      approvalRequestId: "draft-external-reply"
    },
    artifactIds: ["email-draft-artifact"],
    contextItemIds: ["customer-email", "meeting-notes"],
    approvalRequestIds: [
      "read-customer-email-context",
      "draft-external-reply"
    ],
    messageCount: 8,
    tags: ["email", "customer", "approval"],
    recentMessages: [
      {
        id: "customer-follow-up-message-1",
        role: "user",
        content:
          "Use the latest customer email and team meeting notes to draft a concise follow-up.",
        createdAt: "2026-06-02T10:55:00.000Z",
        artifactIds: [],
        contextItemIds: ["customer-email", "meeting-notes"],
        approvalRequestIds: ["read-customer-email-context"]
      },
      {
        id: "customer-follow-up-message-2",
        role: "assistant",
        content:
          "I prepared the email draft and marked it for review before external sharing.",
        createdAt: "2026-06-02T11:25:00.000Z",
        artifactIds: ["email-draft-artifact"],
        contextItemIds: [],
        approvalRequestIds: ["draft-external-reply"]
      }
    ]
  },
  {
    id: "meeting-recap-session",
    workspaceId: "workspace-seekdesk",
    appMode: "daily_work",
    title: "Meeting recap and action review",
    status: "completed",
    createdAt: "2026-06-01T08:25:00.000Z",
    updatedAt: "2026-06-02T09:20:00.000Z",
    summary:
      "Captured internal meeting decisions, linked team notes, and promoted the recap for reuse.",
    lastAction: {
      at: "2026-06-02T09:20:00.000Z",
      actor: "team-reviewer",
      label: "Marked the meeting summary ready for workspace reuse.",
      artifactId: "meeting-summary-artifact",
      approvalRequestId: "use-internal-meeting-notes"
    },
    artifactIds: ["meeting-summary-artifact"],
    contextItemIds: ["meeting-notes", "team-notes"],
    approvalRequestIds: ["use-internal-meeting-notes"],
    messageCount: 6,
    tags: ["meeting", "summary", "actions"],
    recentMessages: [
      {
        id: "meeting-recap-message-1",
        role: "user",
        content:
          "Turn the team meeting notes into a reusable recap with decisions and next actions.",
        createdAt: "2026-06-01T08:25:00.000Z",
        artifactIds: [],
        contextItemIds: ["meeting-notes", "team-notes"],
        approvalRequestIds: ["use-internal-meeting-notes"]
      },
      {
        id: "meeting-recap-message-2",
        role: "assistant",
        content:
          "The meeting summary is ready and includes decisions, risks, owners, and follow-ups.",
        createdAt: "2026-06-02T09:20:00.000Z",
        artifactIds: ["meeting-summary-artifact"],
        contextItemIds: ["meeting-notes", "team-notes"],
        approvalRequestIds: []
      }
    ]
  },
  {
    id: "planning-refresh-session",
    workspaceId: "workspace-seekdesk",
    appMode: "daily_work",
    title: "Planning refresh from project context",
    status: "active",
    createdAt: "2026-06-02T10:20:00.000Z",
    updatedAt: "2026-06-02T12:10:00.000Z",
    summary:
      "Combines the project brief and research notes into a task plan that is still being refined.",
    lastAction: {
      at: "2026-06-02T12:10:00.000Z",
      actor: "project-owner",
      label: "Added reusable research notes to the active planning thread.",
      artifactId: "research-note-artifact"
    },
    artifactIds: ["task-list-artifact", "research-note-artifact"],
    contextItemIds: ["project-brief", "research-links", "meeting-notes"],
    approvalRequestIds: ["schedule-calendar-follow-up"],
    messageCount: 10,
    tags: ["planning", "research", "follow-up"],
    recentMessages: [
      {
        id: "planning-refresh-message-1",
        role: "user",
        content:
          "Refresh the task plan from the current brief, meeting notes, and research links.",
        createdAt: "2026-06-02T10:20:00.000Z",
        artifactIds: [],
        contextItemIds: ["project-brief", "meeting-notes", "research-links"],
        approvalRequestIds: []
      },
      {
        id: "planning-refresh-message-2",
        role: "assistant",
        content:
          "I linked the task list and reusable research note, with calendar follow-up still awaiting approval.",
        createdAt: "2026-06-02T12:10:00.000Z",
        artifactIds: ["task-list-artifact", "research-note-artifact"],
        contextItemIds: [],
        approvalRequestIds: ["schedule-calendar-follow-up"]
      }
    ]
  }
];

export const defaultDailyWorkSessionSummaries: DailyWorkSessionSummary[] =
  defaultDailyWorkSessionDetails.map(toDailyWorkSessionSummary);

function toDailyWorkSessionSummary(
  session: DailyWorkSessionDetail
): DailyWorkSessionSummary {
  const { recentMessages, ...summary } = session;
  void recentMessages;

  return summary;
}

export type SessionRef = z.infer<typeof sessionRefSchema>;
export type SessionWorkflowStatus = z.infer<
  typeof sessionWorkflowStatusSchema
>;
export type DailyWorkSessionLastAction = z.infer<
  typeof dailyWorkSessionLastActionSchema
>;
export type DailyWorkSessionMessageRole = z.infer<
  typeof dailyWorkSessionMessageRoleSchema
>;
export type DailyWorkSessionMessage = z.infer<
  typeof dailyWorkSessionMessageSchema
>;
export type DailyWorkSessionSummary = z.infer<
  typeof dailyWorkSessionSummarySchema
>;
export type DailyWorkSessionDetail = z.infer<
  typeof dailyWorkSessionDetailSchema
>;
export type DailyWorkSessionsResponse = z.infer<
  typeof dailyWorkSessionsResponseSchema
>;
export type DailyWorkSessionResponse = z.infer<
  typeof dailyWorkSessionResponseSchema
>;
export type DailyWorkSessionRestorePreviewRequest = z.infer<
  typeof dailyWorkSessionRestorePreviewRequestSchema
>;
export type DailyWorkSessionRestoreSafetyBoundary = z.infer<
  typeof dailyWorkSessionRestoreSafetyBoundarySchema
>;
export type DailyWorkSessionRestorePreview = z.infer<
  typeof dailyWorkSessionRestorePreviewSchema
>;
export type DailyWorkSessionRestorePreviewResponse = z.infer<
  typeof dailyWorkSessionRestorePreviewResponseSchema
>;
