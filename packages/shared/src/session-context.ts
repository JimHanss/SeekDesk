import { z } from "zod";

import { appModeSchema } from "./app-modes.js";

export const contextSourceTypeSchema = z.enum([
  "meeting_notes",
  "project_brief",
  "customer_email",
  "research_links",
  "team_notes"
]);

export const contextPermissionStateSchema = z.enum([
  "public",
  "workspace_shared",
  "requires_review",
  "restricted"
]);

export const dailyContextItemSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  sourceType: contextSourceTypeSchema,
  title: z.string(),
  summary: z.string(),
  permissionState: contextPermissionStateSchema,
  tags: z.array(z.string()).default([])
});

export const dailyContextResponseSchema = z.object({
  mode: appModeSchema,
  items: z.array(dailyContextItemSchema)
});

export const dailyContextUsePreviewRequestSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  prompt: z.string().trim().min(1).max(2000).optional(),
  templateId: z.string().trim().min(1).max(160).optional()
});

export const dailyContextUsePreviewStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  previewOnly: z.literal(true).default(true),
  externalEffect: z.literal("none").default("none")
});

export const dailyContextUsePreviewSafetyBoundarySchema = z.object({
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
        "read_real_file_content",
        "read_real_email_content",
        "read_real_notes_content"
      ])
    )
    .default([
      "send_email",
      "write_document",
      "schedule_calendar_event",
      "create_task",
      "read_private_external_data",
      "read_real_file_content",
      "read_real_email_content",
      "read_real_notes_content"
    ]),
  statement: z.string()
});

export const dailyContextUsePreviewSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  contextItemId: z.string(),
  title: z.string(),
  sourceType: contextSourceTypeSchema,
  permissionState: contextPermissionStateSchema,
  tags: z.array(z.string()).default([]),
  promptDraft: z.string(),
  templateId: z.string().optional(),
  requiredApprovalRequestIds: z.array(z.string()).default([]),
  steps: z.array(dailyContextUsePreviewStepSchema).default([]),
  previewOnly: z.literal(true).default(true),
  externalEffects: z.array(z.literal("none")).default(["none"]),
  safetyBoundary: dailyContextUsePreviewSafetyBoundarySchema,
  generatedAt: z.string().datetime()
});

export const dailyContextUsePreviewResponseSchema = z.object({
  mode: appModeSchema,
  preview: dailyContextUsePreviewSchema
});

export const defaultDailyWorkContextItems: DailyContextItem[] = [
  {
    id: "meeting-notes",
    mode: "daily_work",
    sourceType: "meeting_notes",
    title: "Meeting Notes",
    summary: "Recent notes, decisions, and action items from team meetings.",
    permissionState: "workspace_shared",
    tags: ["meeting", "notes", "actions"]
  },
  {
    id: "project-brief",
    mode: "daily_work",
    sourceType: "project_brief",
    title: "Project Brief",
    summary: "Current scope, goals, milestones, and open questions.",
    permissionState: "workspace_shared",
    tags: ["project", "brief", "planning"]
  },
  {
    id: "customer-email",
    mode: "daily_work",
    sourceType: "customer_email",
    title: "Customer Email",
    summary: "Customer feedback, requests, and follow-up context.",
    permissionState: "requires_review",
    tags: ["customer", "email", "private"]
  },
  {
    id: "research-links",
    mode: "daily_work",
    sourceType: "research_links",
    title: "Research Links",
    summary: "Reference links, notes, and supporting research material.",
    permissionState: "public",
    tags: ["research", "links", "references"]
  },
  {
    id: "team-notes",
    mode: "daily_work",
    sourceType: "team_notes",
    title: "Team Notes",
    summary: "Shared notes from standups, reviews, and handoffs.",
    permissionState: "workspace_shared",
    tags: ["team", "notes", "handoff"]
  }
] as const as DailyContextItem[];

export type ContextSourceType = z.infer<typeof contextSourceTypeSchema>;
export type ContextPermissionState = z.infer<
  typeof contextPermissionStateSchema
>;
export type DailyContextItem = z.infer<typeof dailyContextItemSchema>;
export type DailyContextResponse = z.infer<typeof dailyContextResponseSchema>;
export type DailyContextUsePreviewRequest = z.infer<
  typeof dailyContextUsePreviewRequestSchema
>;
export type DailyContextUsePreviewStep = z.infer<
  typeof dailyContextUsePreviewStepSchema
>;
export type DailyContextUsePreviewSafetyBoundary = z.infer<
  typeof dailyContextUsePreviewSafetyBoundarySchema
>;
export type DailyContextUsePreview = z.infer<
  typeof dailyContextUsePreviewSchema
>;
export type DailyContextUsePreviewResponse = z.infer<
  typeof dailyContextUsePreviewResponseSchema
>;
