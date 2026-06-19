import { z } from "zod";

export const permissionModeSchema = z.enum([
  "read_only",
  "confirm_private_context_and_actions",
  "confirm_writes_and_commands",
  "auto_approve_safe_actions"
]);

export const permissionDecisionSchema = z.enum([
  "allow_once",
  "allow_for_session",
  "deny"
]);

export const permissionRuleSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  mode: permissionModeSchema,
  pattern: z.string(),
  decision: permissionDecisionSchema,
  createdAt: z.string()
});

export type PermissionMode = z.infer<typeof permissionModeSchema>;
export type PermissionDecision = z.infer<typeof permissionDecisionSchema>;
export type PermissionRule = z.infer<typeof permissionRuleSchema>;


export const dailyWorkPermissionGrantActionSchema = z.enum([
  "outlook.create_draft",
  "outlook.send_mail",
  "outlook.calendar.create_event"
]);

export const dailyWorkPermissionGrantStatusSchema = z.enum([
  "active",
  "revoked",
  "expired"
]);

export const dailyWorkPermissionGrantProviderSchema = z.literal("microsoft");

export const dailyWorkPermissionGrantSchema = z.object({
  id: z.string(),
  mode: z.literal("daily_work").default("daily_work"),
  provider: dailyWorkPermissionGrantProviderSchema,
  sessionId: z.string().trim().min(1),
  action: dailyWorkPermissionGrantActionSchema,
  decision: z.literal("allow_for_session"),
  status: dailyWorkPermissionGrantStatusSchema,
  reason: z.string().trim().max(1000).optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().optional()
});

export const dailyWorkPermissionGrantCreateRequestSchema = z.object({
  mode: z.literal("daily_work").default("daily_work"),
  provider: dailyWorkPermissionGrantProviderSchema.default("microsoft"),
  sessionId: z.string().trim().min(1),
  action: dailyWorkPermissionGrantActionSchema,
  reason: z.string().trim().max(1000).optional()
});

export const dailyWorkPermissionGrantRevokeRequestSchema = z.object({
  mode: z.literal("daily_work").default("daily_work"),
  reason: z.string().trim().max(1000).optional()
});

export type DailyWorkPermissionGrantAction = z.infer<
  typeof dailyWorkPermissionGrantActionSchema
>;
export type DailyWorkPermissionGrantStatus = z.infer<
  typeof dailyWorkPermissionGrantStatusSchema
>;
export type DailyWorkPermissionGrant = z.infer<
  typeof dailyWorkPermissionGrantSchema
>;
export type DailyWorkPermissionGrantCreateRequest = z.infer<
  typeof dailyWorkPermissionGrantCreateRequestSchema
>;
export type DailyWorkPermissionGrantRevokeRequest = z.infer<
  typeof dailyWorkPermissionGrantRevokeRequestSchema
>;
