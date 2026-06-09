import { z } from "zod";

import { appModeSchema } from "./app-modes.js";
import { artifactTypeSchema, dailyWorkArtifactStatusSchema } from "./daily-work.js";
import { approvalStatusSchema } from "./approvals.js";
import {
  workflowActionQueueItemStatusSchema,
  workflowExternalEffectSchema,
  workflowPermissionStateSchema,
  workflowRiskLevelSchema,
  workflowSafetyBoundarySchema,
  workflowStatusSchema
} from "./workflows.js";

export const dailyActivityEventTypeSchema = z.enum([
  "session.restored",
  "template.applied",
  "approval.changed",
  "workflow.preview.queued",
  "workflow.preview.completed",
  "artifact.updated",
  "artifact.ready"
]);

export const dailyActivityEventStatusSchema = z.enum([
  "info",
  "queued",
  "in_progress",
  "waiting_for_approval",
  "completed",
  "ready",
  "blocked",
  "failed"
]);

export const dailyActivityRelatedRefsSchema = z.object({
  sessionIds: z.array(z.string()).default([]),
  templateIds: z.array(z.string()).default([]),
  workflowIds: z.array(z.string()).default([]),
  actionQueueItemIds: z.array(z.string()).default([]),
  artifactIds: z.array(z.string()).default([]),
  approvalRequestIds: z.array(z.string()).default([]),
  connectorIds: z.array(z.string()).default([]),
  contextItemIds: z.array(z.string()).default([])
});

export const dailyActivityNextActionSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
  targetType: z.enum([
    "session",
    "template",
    "approval",
    "workflow",
    "artifact",
    "connector",
    "context"
  ]),
  targetId: z.string(),
  requiredStatus: dailyActivityEventStatusSchema.optional(),
  dueAt: z.string().datetime().optional()
});

export const dailyActivityEventSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  eventType: dailyActivityEventTypeSchema,
  status: dailyActivityEventStatusSchema,
  timestamp: z.string().datetime(),
  title: z.string(),
  summary: z.string(),
  actor: z.string(),
  relatedRefs: dailyActivityRelatedRefsSchema,
  safetyBoundary: workflowSafetyBoundarySchema,
  nextAction: dailyActivityNextActionSchema.nullable(),
  taskStatus: z
    .object({
      workflowStatus: workflowStatusSchema.optional(),
      actionQueueStatus: workflowActionQueueItemStatusSchema.optional(),
      artifactStatus: dailyWorkArtifactStatusSchema.optional(),
      approvalStatus: approvalStatusSchema.optional()
    })
    .optional(),
  metadata: z
    .object({
      riskLevel: workflowRiskLevelSchema.optional(),
      permissionState: workflowPermissionStateSchema.optional(),
      externalEffects: z.array(workflowExternalEffectSchema).default(["none"]),
      artifactType: artifactTypeSchema.optional(),
      toolName: z.string().optional(),
      toolPhase: z.enum(["requested", "completed"]).optional(),
      provider: z.string().optional(),
      connectorId: z.string().optional(),
      inputFields: z.array(z.string()).optional(),
      externalDataSummary: z.string().optional(),
      resultCount: z.number().int().nonnegative().optional(),
      reference: z.string().optional()
    })
    .default({
      externalEffects: ["none"]
    })
});

export const dailyActivityEventsResponseSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  events: z.array(dailyActivityEventSchema)
});

export const dailyActivityEventResponseSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  event: dailyActivityEventSchema
});

export const dailyActivitySnapshotPayloadSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  events: z.array(dailyActivityEventSchema),
  generatedAt: z.string().datetime()
});

export const dailyActivitySnapshotMessageSchema =
  dailyActivitySnapshotPayloadSchema.extend({
    type: z.literal("daily.activity.snapshot")
  });

export function createDailyActivityEventsResponse(input: {
  mode?: DailyActivityEventsResponse["mode"];
  events: DailyActivityEvent[];
}): DailyActivityEventsResponse {
  return dailyActivityEventsResponseSchema.parse(input);
}

export function createDailyActivityEventResponse(input: {
  mode?: DailyActivityEventResponse["mode"];
  event: DailyActivityEvent;
}): DailyActivityEventResponse {
  return dailyActivityEventResponseSchema.parse(input);
}

export function createDailyActivitySnapshotMessage(input: {
  mode?: DailyActivitySnapshotMessage["mode"];
  events: DailyActivityEvent[];
  generatedAt?: string;
}): DailyActivitySnapshotMessage {
  return dailyActivitySnapshotMessageSchema.parse({
    type: "daily.activity.snapshot",
    ...input,
    generatedAt: input.generatedAt ?? new Date().toISOString()
  });
}

const previewSafetyBoundary: DailyActivityEvent["safetyBoundary"] = {
  previewOnly: true,
  externalEffects: ["none"],
  prohibitedExternalActions: [
    "send_email",
    "write_document",
    "schedule_calendar_event",
    "create_task"
  ],
  statement:
    "Daily activity events are read-only status updates; SeekDesk does not send, write, schedule, or create external records from this stream."
};

export const defaultDailyActivityEvents: DailyActivityEvent[] = [
  {
    id: "daily-event-session-restored",
    mode: "daily_work",
    eventType: "session.restored",
    status: "completed",
    timestamp: "2026-06-02T10:55:00.000Z",
    title: "Session restored",
    summary:
      "Restored the customer follow-up session with protected email context and meeting notes linked.",
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: ["customer-follow-up-session"],
      templateIds: [],
      workflowIds: [],
      actionQueueItemIds: [],
      artifactIds: ["email-draft-artifact"],
      approvalRequestIds: ["read-customer-email-context"],
      connectorIds: ["customer-email"],
      contextItemIds: ["customer-email", "meeting-notes"]
    },
    safetyBoundary: previewSafetyBoundary,
    nextAction: {
      label: "Review restored context",
      description:
        "Confirm the linked customer email context before using it in an external draft.",
      targetType: "approval",
      targetId: "read-customer-email-context",
      requiredStatus: "waiting_for_approval"
    },
    taskStatus: {
      workflowStatus: "waiting_for_approval",
      artifactStatus: "draft",
      approvalStatus: "pending"
    },
    metadata: {
      riskLevel: "high",
      permissionState: "requires_review",
      externalEffects: ["none"],
      artifactType: "email_draft"
    }
  },
  {
    id: "daily-event-template-applied",
    mode: "daily_work",
    eventType: "template.applied",
    status: "completed",
    timestamp: "2026-06-02T11:00:00.000Z",
    title: "Template applied",
    summary:
      "Applied the email draft template and created a local draft artifact for review.",
    actor: "account-owner",
    relatedRefs: {
      sessionIds: ["customer-follow-up-session"],
      templateIds: ["email-draft"],
      workflowIds: ["customer-email-draft-workflow"],
      actionQueueItemIds: ["queue-email-draft"],
      artifactIds: ["email-draft-artifact"],
      approvalRequestIds: ["draft-external-reply"],
      connectorIds: ["customer-email"],
      contextItemIds: ["customer-email", "meeting-notes"]
    },
    safetyBoundary: previewSafetyBoundary,
    nextAction: {
      label: "Open draft preview",
      description: "Inspect the generated email draft before requesting approval.",
      targetType: "artifact",
      targetId: "email-draft-artifact",
      requiredStatus: "ready"
    },
    taskStatus: {
      workflowStatus: "waiting_for_approval",
      actionQueueStatus: "needs_approval",
      artifactStatus: "draft",
      approvalStatus: "pending"
    },
    metadata: {
      riskLevel: "high",
      permissionState: "requires_explicit_approval",
      externalEffects: ["none"],
      artifactType: "email_draft"
    }
  },
  {
    id: "daily-event-approval-changed",
    mode: "daily_work",
    eventType: "approval.changed",
    status: "waiting_for_approval",
    timestamp: "2026-06-02T11:20:00.000Z",
    title: "Approval changed",
    summary:
      "External reply approval remains pending, so the customer email stays in preview-only mode.",
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: ["customer-follow-up-session"],
      templateIds: ["email-draft"],
      workflowIds: ["customer-email-draft-workflow"],
      actionQueueItemIds: ["queue-email-draft"],
      artifactIds: ["email-draft-artifact"],
      approvalRequestIds: [
        "read-customer-email-context",
        "draft-external-reply"
      ],
      connectorIds: ["customer-email"],
      contextItemIds: ["customer-email", "meeting-notes"]
    },
    safetyBoundary: previewSafetyBoundary,
    nextAction: {
      label: "Approve or edit draft",
      description:
        "Approve the draft for manual use or ask for changes before any external sharing.",
      targetType: "approval",
      targetId: "draft-external-reply",
      requiredStatus: "completed"
    },
    taskStatus: {
      workflowStatus: "waiting_for_approval",
      actionQueueStatus: "needs_approval",
      artifactStatus: "draft",
      approvalStatus: "pending"
    },
    metadata: {
      riskLevel: "high",
      permissionState: "requires_explicit_approval",
      externalEffects: ["none"],
      artifactType: "email_draft"
    }
  },
  {
    id: "daily-event-workflow-preview-queued",
    mode: "daily_work",
    eventType: "workflow.preview.queued",
    status: "queued",
    timestamp: "2026-06-02T12:25:00.000Z",
    title: "Workflow preview queued",
    summary:
      "Queued a task plan preview from the weekly report workflow without writing to a task system.",
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: ["planning-refresh-session"],
      templateIds: ["task-plan", "weekly-report"],
      workflowIds: ["weekly-report-task-plan-workflow"],
      actionQueueItemIds: ["queue-task-plan"],
      artifactIds: ["task-list-artifact", "research-note-artifact"],
      approvalRequestIds: [],
      connectorIds: ["workspace-documents"],
      contextItemIds: ["project-brief", "team-notes"]
    },
    safetyBoundary: previewSafetyBoundary,
    nextAction: {
      label: "Wait for preview",
      description: "Keep the queued task plan in the local activity stream.",
      targetType: "workflow",
      targetId: "weekly-report-task-plan-workflow",
      requiredStatus: "ready"
    },
    taskStatus: {
      workflowStatus: "preview",
      actionQueueStatus: "queued",
      artifactStatus: "review"
    },
    metadata: {
      riskLevel: "medium",
      permissionState: "workspace_shared",
      externalEffects: ["none"],
      artifactType: "task_list"
    }
  },
  {
    id: "daily-event-workflow-preview-completed",
    mode: "daily_work",
    eventType: "workflow.preview.completed",
    status: "completed",
    timestamp: "2026-06-02T12:30:00.000Z",
    title: "Workflow preview completed",
    summary:
      "Completed the weekly report preview with reusable research context attached.",
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: ["planning-refresh-session"],
      templateIds: ["weekly-report"],
      workflowIds: ["weekly-report-task-plan-workflow"],
      actionQueueItemIds: ["queue-weekly-report"],
      artifactIds: ["research-note-artifact"],
      approvalRequestIds: [],
      connectorIds: ["workspace-documents"],
      contextItemIds: ["project-brief", "team-notes", "research-links"]
    },
    safetyBoundary: previewSafetyBoundary,
    nextAction: {
      label: "Convert priorities",
      description: "Use the completed report preview as input for task planning.",
      targetType: "workflow",
      targetId: "weekly-report-task-plan-workflow",
      requiredStatus: "queued"
    },
    taskStatus: {
      workflowStatus: "preview",
      actionQueueStatus: "preview_ready",
      artifactStatus: "reusable"
    },
    metadata: {
      riskLevel: "medium",
      permissionState: "workspace_shared",
      externalEffects: ["none"],
      artifactType: "research_note"
    }
  },
  {
    id: "daily-event-artifact-updated",
    mode: "daily_work",
    eventType: "artifact.updated",
    status: "in_progress",
    timestamp: "2026-06-02T12:35:00.000Z",
    title: "Artifact updated",
    summary:
      "Updated the task list artifact with owners, dependencies, and calendar follow-up context.",
    actor: "project-owner",
    relatedRefs: {
      sessionIds: ["planning-refresh-session"],
      templateIds: ["task-plan"],
      workflowIds: ["calendar-follow-up-workflow"],
      actionQueueItemIds: ["queue-calendar-follow-up"],
      artifactIds: ["task-list-artifact"],
      approvalRequestIds: ["schedule-calendar-follow-up"],
      connectorIds: ["team-calendar"],
      contextItemIds: ["meeting-notes", "project-brief"]
    },
    safetyBoundary: previewSafetyBoundary,
    nextAction: {
      label: "Review follow-up timing",
      description:
        "Confirm whether the suggested calendar follow-up should be scheduled manually.",
      targetType: "approval",
      targetId: "schedule-calendar-follow-up",
      requiredStatus: "completed"
    },
    taskStatus: {
      workflowStatus: "waiting_for_approval",
      actionQueueStatus: "needs_approval",
      artifactStatus: "review",
      approvalStatus: "pending"
    },
    metadata: {
      riskLevel: "medium",
      permissionState: "requires_explicit_approval",
      externalEffects: ["none"],
      artifactType: "task_list"
    }
  },
  {
    id: "daily-event-artifact-ready",
    mode: "daily_work",
    eventType: "artifact.ready",
    status: "ready",
    timestamp: "2026-06-02T13:00:00.000Z",
    title: "Artifact ready",
    summary:
      "Meeting summary artifact is ready for workspace reuse with decisions and next actions captured.",
    actor: "team-reviewer",
    relatedRefs: {
      sessionIds: ["meeting-recap-session"],
      templateIds: ["meeting-summary"],
      workflowIds: ["meeting-summary-workflow"],
      actionQueueItemIds: ["queue-meeting-summary"],
      artifactIds: ["meeting-summary-artifact"],
      approvalRequestIds: ["use-internal-meeting-notes"],
      connectorIds: ["workspace-notes"],
      contextItemIds: ["meeting-notes", "team-notes"]
    },
    safetyBoundary: previewSafetyBoundary,
    nextAction: {
      label: "Reuse in report",
      description:
        "Attach the ready meeting summary to a handoff note or weekly report.",
      targetType: "artifact",
      targetId: "meeting-summary-artifact",
      requiredStatus: "ready"
    },
    taskStatus: {
      workflowStatus: "ready",
      actionQueueStatus: "preview_ready",
      artifactStatus: "ready",
      approvalStatus: "pending"
    },
    metadata: {
      riskLevel: "low",
      permissionState: "workspace_shared",
      externalEffects: ["none"],
      artifactType: "meeting_summary"
    }
  }
] as const as DailyActivityEvent[];

export type DailyActivityEventType = z.infer<
  typeof dailyActivityEventTypeSchema
>;
export type DailyActivityEventStatus = z.infer<
  typeof dailyActivityEventStatusSchema
>;
export type DailyActivityRelatedRefs = z.infer<
  typeof dailyActivityRelatedRefsSchema
>;
export type DailyActivityNextAction = z.infer<
  typeof dailyActivityNextActionSchema
>;
export type DailyActivityEvent = z.infer<typeof dailyActivityEventSchema>;
export type DailyActivityEventsResponse = z.infer<
  typeof dailyActivityEventsResponseSchema
>;
export type DailyActivityEventResponse = z.infer<
  typeof dailyActivityEventResponseSchema
>;
export type DailyActivitySnapshotPayload = z.infer<
  typeof dailyActivitySnapshotPayloadSchema
>;
export type DailyActivitySnapshotMessage = z.infer<
  typeof dailyActivitySnapshotMessageSchema
>;
