import { z } from "zod";

import { appModeSchema } from "./app-modes.js";
import { permissionModeSchema, permissionDecisionSchema } from "./permissions.js";

export const approvalRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical"
]);

export const approvalActionTypeSchema = z.enum([
  "read_customer_email_context",
  "use_internal_meeting_notes",
  "draft_external_reply",
  "schedule_calendar_follow_up"
]);

export const approvalDecisionSchema = permissionDecisionSchema;

export const approvalStatusSchema = z.enum([
  "pending",
  "approved",
  "denied"
]);

export const dailyApprovalRequestSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  actionType: approvalActionTypeSchema,
  title: z.string(),
  description: z.string(),
  riskLevel: approvalRiskLevelSchema,
  requiredPermissionMode: permissionModeSchema,
  permissionAware: z.literal(true).default(true),
  contextItemIds: z.array(z.string()).default([]),
  decision: approvalDecisionSchema.optional(),
  status: approvalStatusSchema.default("pending"),
  tags: z.array(z.string()).default([])
});

export const dailyApprovalRequestsResponseSchema = z.object({
  mode: appModeSchema,
  requests: z.array(dailyApprovalRequestSchema)
});

export const defaultDailyWorkApprovalRequests: DailyApprovalRequest[] = [
  {
    id: "read-customer-email-context",
    mode: "daily_work",
    actionType: "read_customer_email_context",
    title: "Read customer email context",
    description:
      "Review the customer email thread before drafting any external reply.",
    riskLevel: "high",
    requiredPermissionMode: "confirm_private_context_and_actions",
    permissionAware: true,
    contextItemIds: ["customer-email"],
    status: "pending",
    tags: ["email", "customer", "approval"]
  },
  {
    id: "use-internal-meeting-notes",
    mode: "daily_work",
    actionType: "use_internal_meeting_notes",
    title: "Use internal meeting notes",
    description:
      "Pull in workspace meeting notes to ground the daily-work response.",
    riskLevel: "low",
    requiredPermissionMode: "auto_approve_safe_actions",
    permissionAware: true,
    contextItemIds: ["meeting-notes"],
    status: "pending",
    tags: ["meeting", "notes", "approval"]
  },
  {
    id: "draft-external-reply",
    mode: "daily_work",
    actionType: "draft_external_reply",
    title: "Draft external reply",
    description:
      "Compose a reply that can be sent to a customer or partner after review.",
    riskLevel: "high",
    requiredPermissionMode: "confirm_writes_and_commands",
    permissionAware: true,
    contextItemIds: ["customer-email", "meeting-notes"],
    status: "pending",
    tags: ["email", "writing", "external"]
  },
  {
    id: "schedule-calendar-follow-up",
    mode: "daily_work",
    actionType: "schedule_calendar_follow_up",
    title: "Schedule calendar follow-up",
    description:
      "Create a follow-up reminder or calendar hold after the reply plan is approved.",
    riskLevel: "medium",
    requiredPermissionMode: "confirm_writes_and_commands",
    permissionAware: true,
    contextItemIds: ["meeting-notes"],
    status: "pending",
    tags: ["calendar", "follow-up", "approval"]
  }
] as const as DailyApprovalRequest[];

export type ApprovalRiskLevel = z.infer<typeof approvalRiskLevelSchema>;
export type ApprovalActionType = z.infer<typeof approvalActionTypeSchema>;
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type DailyApprovalRequest = z.infer<typeof dailyApprovalRequestSchema>;
export type DailyApprovalRequestsResponse = z.infer<
  typeof dailyApprovalRequestsResponseSchema
>;
