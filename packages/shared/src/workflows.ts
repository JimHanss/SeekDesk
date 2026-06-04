import { z } from "zod";

import { appModeSchema } from "./app-modes.js";
import { artifactTypeSchema, dailyWorkArtifactStatusSchema } from "./daily-work.js";
import { permissionModeSchema } from "./permissions.js";

export const workflowStatusSchema = z.enum([
  "preview",
  "waiting_for_approval",
  "ready",
  "blocked"
]);

export const workflowActionQueueItemStatusSchema = z.enum([
  "queued",
  "preview_ready",
  "needs_approval",
  "blocked"
]);

export const workflowActionTypeSchema = z.enum([
  "draft_email",
  "summarize_meeting",
  "prepare_calendar_follow_up",
  "compile_weekly_report",
  "create_task_plan"
]);

export const workflowRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical"
]);

export const workflowPermissionStateSchema = z.enum([
  "public",
  "workspace_shared",
  "requires_review",
  "requires_explicit_approval",
  "restricted"
]);

export const workflowExternalEffectSchema = z.enum([
  "none",
  "send_email",
  "write_document",
  "schedule_calendar_event",
  "create_task"
]);

export const workflowLinkedConnectorSchema = z.object({
  connectorId: z.string(),
  displayName: z.string(),
  action: z.string(),
  permissionState: workflowPermissionStateSchema,
  riskLevel: workflowRiskLevelSchema
});

export const workflowLinkedContextSchema = z.object({
  contextItemId: z.string(),
  title: z.string(),
  permissionState: workflowPermissionStateSchema,
  usage: z.enum(["input", "reference", "output_basis"])
});

export const workflowLinkedArtifactSchema = z.object({
  artifactId: z.string(),
  artifactType: artifactTypeSchema,
  title: z.string(),
  status: dailyWorkArtifactStatusSchema,
  previewSummary: z.string()
});

export const workflowLinkedApprovalSchema = z.object({
  approvalRequestId: z.string(),
  title: z.string(),
  requiredPermissionMode: permissionModeSchema,
  status: z.enum(["pending", "approved", "denied"])
});

export const workflowSafetyBoundarySchema = z.object({
  previewOnly: z.literal(true).default(true),
  externalEffects: z.array(workflowExternalEffectSchema).default(["none"]),
  prohibitedExternalActions: z
    .array(workflowExternalEffectSchema)
    .default([
      "send_email",
      "write_document",
      "schedule_calendar_event",
      "create_task"
    ]),
  statement: z.string()
});

export const workflowActionQueueItemSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  actionType: workflowActionTypeSchema,
  title: z.string(),
  description: z.string(),
  status: workflowActionQueueItemStatusSchema,
  riskLevel: workflowRiskLevelSchema,
  permissionState: workflowPermissionStateSchema,
  requiredPermissionMode: permissionModeSchema,
  previewOnly: z.literal(true).default(true),
  externalEffects: z.array(workflowExternalEffectSchema).default(["none"]),
  connectorLinks: z.array(workflowLinkedConnectorSchema).default([]),
  contextLinks: z.array(workflowLinkedContextSchema).default([]),
  artifactLinks: z.array(workflowLinkedArtifactSchema).default([]),
  approvalLinks: z.array(workflowLinkedApprovalSchema).default([]),
  preview: z.object({
    summary: z.string(),
    suggestedNextStep: z.string(),
    userVisibleDraft: z.string()
  }),
  queuedAt: z.string().datetime()
});

export const dailyWorkWorkflowSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  title: z.string(),
  description: z.string(),
  status: workflowStatusSchema,
  previewOnly: z.literal(true).default(true),
  safetyBoundary: workflowSafetyBoundarySchema,
  actionQueue: z.array(workflowActionQueueItemSchema).default([]),
  connectorLinks: z.array(workflowLinkedConnectorSchema).default([]),
  contextLinks: z.array(workflowLinkedContextSchema).default([]),
  artifactLinks: z.array(workflowLinkedArtifactSchema).default([]),
  approvalLinks: z.array(workflowLinkedApprovalSchema).default([]),
  updatedAt: z.string().datetime(),
  tags: z.array(z.string()).default([])
});

export const dailyWorkflowsResponseSchema = z.object({
  mode: appModeSchema,
  workflows: z.array(dailyWorkWorkflowSchema)
});

export const dailyWorkWorkflowResponseSchema = z.object({
  mode: appModeSchema,
  workflow: dailyWorkWorkflowSchema
});

export const dailyWorkWorkflowPreviewRequestSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  actionId: z.string().trim().min(1).optional(),
  prompt: z.string().trim().min(1).max(2000).optional(),
  contextItemIds: z.array(z.string().trim().min(1)).default([])
});

export const workflowPreviewStepSchema = z.object({
  id: z.string(),
  actionId: z.string(),
  actionType: workflowActionTypeSchema,
  title: z.string(),
  description: z.string(),
  status: workflowActionQueueItemStatusSchema,
  riskLevel: workflowRiskLevelSchema,
  permissionState: workflowPermissionStateSchema,
  requiredPermissionMode: permissionModeSchema,
  previewOnly: z.literal(true).default(true),
  externalEffect: z.literal("none").default("none"),
  summary: z.string(),
  suggestedNextStep: z.string(),
  userVisibleDraft: z.string(),
  connectorLinks: z.array(workflowLinkedConnectorSchema).default([]),
  contextLinks: z.array(workflowLinkedContextSchema).default([]),
  artifactLinks: z.array(workflowLinkedArtifactSchema).default([]),
  approvalLinks: z.array(workflowLinkedApprovalSchema).default([])
});

export const dailyWorkWorkflowPreviewSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  workflowId: z.string(),
  workflowTitle: z.string(),
  selectedActionId: z.string(),
  selectedActionType: workflowActionTypeSchema,
  selectedActionStatus: workflowActionQueueItemStatusSchema,
  previewOnly: z.literal(true).default(true),
  externalEffects: z.array(z.literal("none")).default(["none"]),
  prompt: z.string().optional(),
  requestedContextItemIds: z.array(z.string()).default([]),
  summary: z.string(),
  steps: z.array(workflowPreviewStepSchema).default([]),
  connectorLinks: z.array(workflowLinkedConnectorSchema).default([]),
  contextLinks: z.array(workflowLinkedContextSchema).default([]),
  artifactLinks: z.array(workflowLinkedArtifactSchema).default([]),
  approvalLinks: z.array(workflowLinkedApprovalSchema).default([]),
  safetyBoundary: workflowSafetyBoundarySchema
});

export const dailyWorkWorkflowPreviewResponseSchema = z.object({
  mode: appModeSchema,
  preview: dailyWorkWorkflowPreviewSchema
});

const previewSafetyBoundary: z.infer<typeof workflowSafetyBoundarySchema> = {
  previewOnly: true,
  externalEffects: ["none"],
  prohibitedExternalActions: [
    "send_email",
    "write_document",
    "schedule_calendar_event",
    "create_task"
  ],
  statement:
    "Preview contract only: SeekDesk returns drafts and queued suggestions but never sends, writes, schedules, or creates external records."
};

export const defaultDailyWorkflows: DailyWorkWorkflow[] = [
  {
    id: "customer-email-draft-workflow",
    mode: "daily_work",
    title: "Customer Email Draft",
    description:
      "Prepare a reviewed customer reply from email context and meeting notes.",
    status: "waiting_for_approval",
    previewOnly: true,
    safetyBoundary: previewSafetyBoundary,
    actionQueue: [
      {
        id: "queue-email-draft",
        workflowId: "customer-email-draft-workflow",
        actionType: "draft_email",
        title: "Draft customer reply",
        description:
          "Compose a customer-facing reply for review without sending it.",
        status: "needs_approval",
        riskLevel: "high",
        permissionState: "requires_explicit_approval",
        requiredPermissionMode: "confirm_writes_and_commands",
        previewOnly: true,
        externalEffects: ["none"],
        connectorLinks: [
          {
            connectorId: "customer-email",
            displayName: "Customer Email",
            action: "prepare_email_draft",
            permissionState: "requires_review",
            riskLevel: "high"
          }
        ],
        contextLinks: [
          {
            contextItemId: "customer-email",
            title: "Customer Email",
            permissionState: "requires_review",
            usage: "input"
          },
          {
            contextItemId: "meeting-notes",
            title: "Meeting Notes",
            permissionState: "workspace_shared",
            usage: "reference"
          }
        ],
        artifactLinks: [
          {
            artifactId: "email-draft-artifact",
            artifactType: "email_draft",
            title: "Email Draft",
            status: "draft",
            previewSummary:
              "Draft reply prepared for review; no message is sent."
          }
        ],
        approvalLinks: [
          {
            approvalRequestId: "read-customer-email-context",
            title: "Read customer email context",
            requiredPermissionMode: "confirm_private_context_and_actions",
            status: "pending"
          },
          {
            approvalRequestId: "draft-external-reply",
            title: "Draft external reply",
            requiredPermissionMode: "confirm_writes_and_commands",
            status: "pending"
          }
        ],
        preview: {
          summary:
            "A concise customer reply is ready for review as a local draft.",
          suggestedNextStep:
            "Ask the owner to review wording and approve before copying into email.",
          userVisibleDraft:
            "Thanks for the update. We reviewed the notes and will follow up with the agreed next steps after internal confirmation."
        },
        queuedAt: "2026-06-02T11:25:00.000Z"
      }
    ],
    connectorLinks: [
      {
        connectorId: "customer-email",
        displayName: "Customer Email",
        action: "prepare_email_draft",
        permissionState: "requires_review",
        riskLevel: "high"
      }
    ],
    contextLinks: [
      {
        contextItemId: "customer-email",
        title: "Customer Email",
        permissionState: "requires_review",
        usage: "input"
      },
      {
        contextItemId: "meeting-notes",
        title: "Meeting Notes",
        permissionState: "workspace_shared",
        usage: "reference"
      }
    ],
    artifactLinks: [
      {
        artifactId: "email-draft-artifact",
        artifactType: "email_draft",
        title: "Email Draft",
        status: "draft",
        previewSummary: "Draft reply prepared for review; no message is sent."
      }
    ],
    approvalLinks: [
      {
        approvalRequestId: "read-customer-email-context",
        title: "Read customer email context",
        requiredPermissionMode: "confirm_private_context_and_actions",
        status: "pending"
      },
      {
        approvalRequestId: "draft-external-reply",
        title: "Draft external reply",
        requiredPermissionMode: "confirm_writes_and_commands",
        status: "pending"
      }
    ],
    updatedAt: "2026-06-02T11:25:00.000Z",
    tags: ["email", "customer", "approval"]
  },
  {
    id: "meeting-summary-workflow",
    mode: "daily_work",
    title: "Meeting Summary",
    description:
      "Summarize decisions, risks, and owners from workspace meeting notes.",
    status: "ready",
    previewOnly: true,
    safetyBoundary: previewSafetyBoundary,
    actionQueue: [
      {
        id: "queue-meeting-summary",
        workflowId: "meeting-summary-workflow",
        actionType: "summarize_meeting",
        title: "Summarize meeting notes",
        description:
          "Create a shareable meeting summary preview from workspace notes.",
        status: "preview_ready",
        riskLevel: "low",
        permissionState: "workspace_shared",
        requiredPermissionMode: "auto_approve_safe_actions",
        previewOnly: true,
        externalEffects: ["none"],
        connectorLinks: [
          {
            connectorId: "workspace-notes",
            displayName: "Workspace Notes",
            action: "summarize",
            permissionState: "workspace_shared",
            riskLevel: "low"
          }
        ],
        contextLinks: [
          {
            contextItemId: "meeting-notes",
            title: "Meeting Notes",
            permissionState: "workspace_shared",
            usage: "input"
          }
        ],
        artifactLinks: [
          {
            artifactId: "meeting-summary-artifact",
            artifactType: "meeting_summary",
            title: "Meeting Summary",
            status: "ready",
            previewSummary:
              "Decisions, action items, and open questions are summarized."
          }
        ],
        approvalLinks: [
          {
            approvalRequestId: "use-internal-meeting-notes",
            title: "Use internal meeting notes",
            requiredPermissionMode: "auto_approve_safe_actions",
            status: "pending"
          }
        ],
        preview: {
          summary:
            "Meeting summary preview includes decisions, owners, due dates, and risks.",
          suggestedNextStep:
            "Review for accuracy before sharing with the workspace.",
          userVisibleDraft:
            "Summary: the team aligned on next milestones, owners, and two open risks that need follow-up."
        },
        queuedAt: "2026-06-02T09:20:00.000Z"
      }
    ],
    connectorLinks: [
      {
        connectorId: "workspace-notes",
        displayName: "Workspace Notes",
        action: "summarize",
        permissionState: "workspace_shared",
        riskLevel: "low"
      }
    ],
    contextLinks: [
      {
        contextItemId: "meeting-notes",
        title: "Meeting Notes",
        permissionState: "workspace_shared",
        usage: "input"
      }
    ],
    artifactLinks: [
      {
        artifactId: "meeting-summary-artifact",
        artifactType: "meeting_summary",
        title: "Meeting Summary",
        status: "ready",
        previewSummary:
          "Decisions, action items, and open questions are summarized."
      }
    ],
    approvalLinks: [
      {
        approvalRequestId: "use-internal-meeting-notes",
        title: "Use internal meeting notes",
        requiredPermissionMode: "auto_approve_safe_actions",
        status: "pending"
      }
    ],
    updatedAt: "2026-06-02T09:20:00.000Z",
    tags: ["meeting", "summary", "workspace"]
  },
  {
    id: "calendar-follow-up-workflow",
    mode: "daily_work",
    title: "Calendar Follow-up",
    description:
      "Prepare a calendar follow-up suggestion from meeting outcomes.",
    status: "waiting_for_approval",
    previewOnly: true,
    safetyBoundary: previewSafetyBoundary,
    actionQueue: [
      {
        id: "queue-calendar-follow-up",
        workflowId: "calendar-follow-up-workflow",
        actionType: "prepare_calendar_follow_up",
        title: "Prepare follow-up hold",
        description:
          "Suggest a follow-up meeting window without scheduling it.",
        status: "needs_approval",
        riskLevel: "medium",
        permissionState: "requires_explicit_approval",
        requiredPermissionMode: "confirm_writes_and_commands",
        previewOnly: true,
        externalEffects: ["none"],
        connectorLinks: [
          {
            connectorId: "team-calendar",
            displayName: "Team Calendar",
            action: "prepare_calendar_follow_up",
            permissionState: "requires_review",
            riskLevel: "medium"
          }
        ],
        contextLinks: [
          {
            contextItemId: "meeting-notes",
            title: "Meeting Notes",
            permissionState: "workspace_shared",
            usage: "output_basis"
          }
        ],
        artifactLinks: [
          {
            artifactId: "task-list-artifact",
            artifactType: "task_list",
            title: "Task List",
            status: "review",
            previewSummary:
              "Follow-up agenda and owners are drafted as task context."
          }
        ],
        approvalLinks: [
          {
            approvalRequestId: "schedule-calendar-follow-up",
            title: "Schedule calendar follow-up",
            requiredPermissionMode: "confirm_writes_and_commands",
            status: "pending"
          }
        ],
        preview: {
          summary:
            "Calendar follow-up preview proposes a 30 minute sync and agenda.",
          suggestedNextStep:
            "Confirm attendees and timing before manually scheduling.",
          userVisibleDraft:
            "Proposed follow-up: 30 minutes next week to resolve open decisions and confirm task owners."
        },
        queuedAt: "2026-06-02T10:50:00.000Z"
      }
    ],
    connectorLinks: [
      {
        connectorId: "team-calendar",
        displayName: "Team Calendar",
        action: "prepare_calendar_follow_up",
        permissionState: "requires_review",
        riskLevel: "medium"
      }
    ],
    contextLinks: [
      {
        contextItemId: "meeting-notes",
        title: "Meeting Notes",
        permissionState: "workspace_shared",
        usage: "output_basis"
      }
    ],
    artifactLinks: [
      {
        artifactId: "task-list-artifact",
        artifactType: "task_list",
        title: "Task List",
        status: "review",
        previewSummary: "Follow-up agenda and owners are drafted as task context."
      }
    ],
    approvalLinks: [
      {
        approvalRequestId: "schedule-calendar-follow-up",
        title: "Schedule calendar follow-up",
        requiredPermissionMode: "confirm_writes_and_commands",
        status: "pending"
      }
    ],
    updatedAt: "2026-06-02T10:50:00.000Z",
    tags: ["calendar", "follow-up", "approval"]
  },
  {
    id: "weekly-report-task-plan-workflow",
    mode: "daily_work",
    title: "Weekly Report and Task Plan",
    description:
      "Compile a weekly report preview and turn it into a task planning draft.",
    status: "preview",
    previewOnly: true,
    safetyBoundary: previewSafetyBoundary,
    actionQueue: [
      {
        id: "queue-weekly-report",
        workflowId: "weekly-report-task-plan-workflow",
        actionType: "compile_weekly_report",
        title: "Compile weekly report",
        description:
          "Summarize progress, outcomes, risks, and next priorities.",
        status: "preview_ready",
        riskLevel: "medium",
        permissionState: "workspace_shared",
        requiredPermissionMode: "auto_approve_safe_actions",
        previewOnly: true,
        externalEffects: ["none"],
        connectorLinks: [
          {
            connectorId: "workspace-documents",
            displayName: "Workspace Documents",
            action: "draft_document",
            permissionState: "workspace_shared",
            riskLevel: "medium"
          }
        ],
        contextLinks: [
          {
            contextItemId: "project-brief",
            title: "Project Brief",
            permissionState: "workspace_shared",
            usage: "input"
          },
          {
            contextItemId: "team-notes",
            title: "Team Notes",
            permissionState: "workspace_shared",
            usage: "reference"
          }
        ],
        artifactLinks: [
          {
            artifactId: "research-note-artifact",
            artifactType: "research_note",
            title: "Research Note",
            status: "reusable",
            previewSummary:
              "Reusable research context is included in the report preview."
          }
        ],
        approvalLinks: [],
        preview: {
          summary:
            "Weekly report preview captures progress, risks, and next-week focus.",
          suggestedNextStep:
            "Review the report, then convert priorities into a task plan.",
          userVisibleDraft:
            "This week: shipped planning updates, resolved key unknowns, and identified follow-up risks for next week."
        },
        queuedAt: "2026-06-02T12:20:00.000Z"
      },
      {
        id: "queue-task-plan",
        workflowId: "weekly-report-task-plan-workflow",
        actionType: "create_task_plan",
        title: "Create task plan preview",
        description:
          "Convert weekly report priorities into task planning suggestions.",
        status: "queued",
        riskLevel: "medium",
        permissionState: "workspace_shared",
        requiredPermissionMode: "auto_approve_safe_actions",
        previewOnly: true,
        externalEffects: ["none"],
        connectorLinks: [
          {
            connectorId: "workspace-documents",
            displayName: "Workspace Documents",
            action: "draft_document",
            permissionState: "workspace_shared",
            riskLevel: "medium"
          }
        ],
        contextLinks: [
          {
            contextItemId: "project-brief",
            title: "Project Brief",
            permissionState: "workspace_shared",
            usage: "output_basis"
          }
        ],
        artifactLinks: [
          {
            artifactId: "task-list-artifact",
            artifactType: "task_list",
            title: "Task List",
            status: "review",
            previewSummary:
              "Task plan remains a preview and is not written to any task system."
          }
        ],
        approvalLinks: [],
        preview: {
          summary:
            "Task plan preview groups next-week priorities by owner and dependency.",
          suggestedNextStep:
            "Review owners and dates before creating tasks elsewhere.",
          userVisibleDraft:
            "Next plan: confirm scope, assign owners, sequence dependencies, and review risks by Friday."
        },
        queuedAt: "2026-06-02T12:25:00.000Z"
      }
    ],
    connectorLinks: [
      {
        connectorId: "workspace-documents",
        displayName: "Workspace Documents",
        action: "draft_document",
        permissionState: "workspace_shared",
        riskLevel: "medium"
      }
    ],
    contextLinks: [
      {
        contextItemId: "project-brief",
        title: "Project Brief",
        permissionState: "workspace_shared",
        usage: "input"
      },
      {
        contextItemId: "team-notes",
        title: "Team Notes",
        permissionState: "workspace_shared",
        usage: "reference"
      }
    ],
    artifactLinks: [
      {
        artifactId: "research-note-artifact",
        artifactType: "research_note",
        title: "Research Note",
        status: "reusable",
        previewSummary:
          "Reusable research context is included in the report preview."
      },
      {
        artifactId: "task-list-artifact",
        artifactType: "task_list",
        title: "Task List",
        status: "review",
        previewSummary:
          "Task plan remains a preview and is not written to any task system."
      }
    ],
    approvalLinks: [],
    updatedAt: "2026-06-02T12:25:00.000Z",
    tags: ["weekly", "report", "tasks"]
  }
] as const as DailyWorkWorkflow[];

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type WorkflowActionQueueItemStatus = z.infer<
  typeof workflowActionQueueItemStatusSchema
>;
export type WorkflowActionType = z.infer<typeof workflowActionTypeSchema>;
export type WorkflowRiskLevel = z.infer<typeof workflowRiskLevelSchema>;
export type WorkflowPermissionState = z.infer<
  typeof workflowPermissionStateSchema
>;
export type WorkflowExternalEffect = z.infer<typeof workflowExternalEffectSchema>;
export type WorkflowLinkedConnector = z.infer<
  typeof workflowLinkedConnectorSchema
>;
export type WorkflowLinkedContext = z.infer<typeof workflowLinkedContextSchema>;
export type WorkflowLinkedArtifact = z.infer<
  typeof workflowLinkedArtifactSchema
>;
export type WorkflowLinkedApproval = z.infer<
  typeof workflowLinkedApprovalSchema
>;
export type WorkflowSafetyBoundary = z.infer<typeof workflowSafetyBoundarySchema>;
export type WorkflowActionQueueItem = z.infer<
  typeof workflowActionQueueItemSchema
>;
export type DailyWorkWorkflow = z.infer<typeof dailyWorkWorkflowSchema>;
export type DailyWorkflowsResponse = z.infer<
  typeof dailyWorkflowsResponseSchema
>;
export type DailyWorkWorkflowResponse = z.infer<
  typeof dailyWorkWorkflowResponseSchema
>;
export type DailyWorkWorkflowPreviewRequest = z.infer<
  typeof dailyWorkWorkflowPreviewRequestSchema
>;
export type WorkflowPreviewStep = z.infer<typeof workflowPreviewStepSchema>;
export type DailyWorkWorkflowPreview = z.infer<
  typeof dailyWorkWorkflowPreviewSchema
>;
export type DailyWorkWorkflowPreviewResponse = z.infer<
  typeof dailyWorkWorkflowPreviewResponseSchema
>;
