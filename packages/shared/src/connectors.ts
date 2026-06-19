import { z } from "zod";

import { appModeSchema } from "./app-modes.js";

export const connectorCategorySchema = z.enum([
  "documents",
  "calendar",
  "email",
  "notes",
  "knowledge"
]);

export const connectorStatusSchema = z.enum([
  "available",
  "preview",
  "requires_setup",
  "disabled"
]);

export const connectorPermissionStateSchema = z.enum([
  "public",
  "workspace_shared",
  "requires_review",
  "restricted"
]);

export const connectorRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const connectorActionSchema = z.enum([
  "search",
  "read_context",
  "summarize",
  "draft_document",
  "prepare_email_draft",
  "prepare_calendar_follow_up",
  "open_reference"
]);

export const dailyWorkConnectorSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  category: connectorCategorySchema,
  provider: z.string(),
  displayName: z.string(),
  description: z.string(),
  status: connectorStatusSchema,
  permissionState: connectorPermissionStateSchema,
  riskLevel: connectorRiskLevelSchema,
  availableActions: z.array(connectorActionSchema).default([]),
  lastSyncAt: z.string().datetime().optional(),
  notes: z.array(z.string()).default([]),
  relatedContextItemIds: z.array(z.string()).default([]),
  requiredApprovalRequestIds: z.array(z.string()).default([])
});

export const dailyWorkConnectorsResponseSchema = z.object({
  mode: appModeSchema,
  connectors: z.array(dailyWorkConnectorSchema)
});

export const dailyWorkConnectorResponseSchema = z.object({
  mode: appModeSchema,
  connector: dailyWorkConnectorSchema
});

export const connectorActionPreviewRequestSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  action: connectorActionSchema,
  prompt: z.string().trim().min(1).max(2000).optional(),
  contextItemIds: z.array(z.string()).default([])
});

export const connectorActionPreviewStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  externalEffect: z.literal("none").default("none")
});

export const connectorActionPreviewSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  connectorId: z.string(),
  connectorDisplayName: z.string(),
  action: connectorActionSchema,
  previewOnly: z.literal(true).default(true),
  permissionState: connectorPermissionStateSchema,
  riskLevel: connectorRiskLevelSchema,
  relatedContextItemIds: z.array(z.string()).default([]),
  requiredApprovalRequestIds: z.array(z.string()).default([]),
  prompt: z.string().optional(),
  summary: z.string(),
  steps: z.array(connectorActionPreviewStepSchema).default([]),
  safetyBoundary: z.object({
    previewOnly: z.literal(true).default(true),
    externalEffects: z.array(z.literal("none")).default(["none"]),
    prohibitedExternalActions: z
      .array(
        z.enum([
          "send_email",
          "write_document",
          "schedule_calendar_event",
          "create_task",
          "read_private_external_data"
        ])
      )
      .default([
        "send_email",
        "write_document",
        "schedule_calendar_event",
        "create_task",
        "read_private_external_data"
      ]),
    statement: z.string()
  })
});

export const connectorActionPreviewResponseSchema = z.object({
  mode: appModeSchema,
  preview: connectorActionPreviewSchema
});

export const defaultDailyWorkConnectors: DailyWorkConnector[] = [
  {
    id: "workspace-documents",
    mode: "daily_work",
    category: "documents",
    provider: "workspace_drive",
    displayName: "Workspace Documents",
    description:
      "Shared project documents and draft-ready writing context for daily work.",
    status: "available",
    permissionState: "workspace_shared",
    riskLevel: "medium",
    availableActions: ["search", "read_context", "draft_document"],
    lastSyncAt: "2026-06-02T08:30:00.000Z",
    notes: ["Mock catalog entry only; no external drive OAuth is connected."],
    relatedContextItemIds: ["project-brief", "meeting-notes"],
    requiredApprovalRequestIds: ["use-internal-meeting-notes"]
  },
  {
    id: "team-calendar",
    mode: "daily_work",
    category: "calendar",
    provider: "local_schedule",
    displayName: "Team Calendar",
    description:
      "Follow-up windows and meeting context for planning next daily-work steps.",
    status: "requires_setup",
    permissionState: "requires_review",
    riskLevel: "medium",
    availableActions: ["read_context", "prepare_calendar_follow_up"],
    notes: ["Mock catalog entry only; no external calendar writes are performed."],
    relatedContextItemIds: ["meeting-notes"],
    requiredApprovalRequestIds: ["schedule-calendar-follow-up"]
  },
  {
    id: "customer-email",
    mode: "daily_work",
    category: "email",
    provider: "local_mail_archive",
    displayName: "Customer Email",
    description:
      "Customer thread context for reviewed summaries and external reply drafts.",
    status: "preview",
    permissionState: "requires_review",
    riskLevel: "high",
    availableActions: ["read_context", "prepare_email_draft"],
    lastSyncAt: "2026-06-02T09:45:00.000Z",
    notes: ["Mock catalog entry only; no live inbox access or sending is enabled."],
    relatedContextItemIds: ["customer-email", "meeting-notes"],
    requiredApprovalRequestIds: [
      "read-customer-email-context",
      "draft-external-reply"
    ]
  },
  {
    id: "workspace-notes",
    mode: "daily_work",
    category: "notes",
    provider: "notion",
    displayName: "Workspace Notes",
    description:
      "Team notes, handoff snippets, and meeting summaries available as context.",
    status: "available",
    permissionState: "workspace_shared",
    riskLevel: "low",
    availableActions: ["search", "read_context", "summarize"],
    lastSyncAt: "2026-06-02T10:10:00.000Z",
    notes: ["Mock catalog entry only; no Notion workspace is connected."],
    relatedContextItemIds: ["team-notes", "meeting-notes"],
    requiredApprovalRequestIds: ["use-internal-meeting-notes"]
  },
  {
    id: "team-knowledge-base",
    mode: "daily_work",
    category: "knowledge",
    provider: "confluence",
    displayName: "Team Knowledge Base",
    description:
      "Reference material and reusable research context for grounded answers.",
    status: "preview",
    permissionState: "public",
    riskLevel: "low",
    availableActions: ["search", "read_context", "open_reference"],
    lastSyncAt: "2026-06-01T16:00:00.000Z",
    notes: ["Mock catalog entry only; no knowledge-base API calls are made."],
    relatedContextItemIds: ["research-links", "project-brief", "team-notes"],
    requiredApprovalRequestIds: []
  }
] as const as DailyWorkConnector[];

export type ConnectorCategory = z.infer<typeof connectorCategorySchema>;
export type ConnectorStatus = z.infer<typeof connectorStatusSchema>;
export type ConnectorPermissionState = z.infer<
  typeof connectorPermissionStateSchema
>;
export type ConnectorRiskLevel = z.infer<typeof connectorRiskLevelSchema>;
export type ConnectorAction = z.infer<typeof connectorActionSchema>;
export type DailyWorkConnector = z.infer<typeof dailyWorkConnectorSchema>;
export type DailyWorkConnectorsResponse = z.infer<
  typeof dailyWorkConnectorsResponseSchema
>;
export type DailyWorkConnectorResponse = z.infer<
  typeof dailyWorkConnectorResponseSchema
>;
export type ConnectorActionPreviewRequest = z.infer<
  typeof connectorActionPreviewRequestSchema
>;
export type ConnectorActionPreviewStep = z.infer<
  typeof connectorActionPreviewStepSchema
>;
export type ConnectorActionPreview = z.infer<
  typeof connectorActionPreviewSchema
>;
export type ConnectorActionPreviewResponse = z.infer<
  typeof connectorActionPreviewResponseSchema
>;
