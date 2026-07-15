import { z } from "zod";

import {
  runtimeModeInputSchema,
  runtimeModeSchema,
  userSelectableRuntimeModeSchema
} from "./runtime.js";
import { codingToolNameSchema } from "./tools.js";

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

export const codingPermissionGrantActionSchema = codingToolNameSchema.extract([
  "coding.write_file",
  "coding.edit_file",
  "coding.run_shell",
  "coding.run_tests"
]);

export const codingPermissionGrantStatusSchema = z.enum([
  "active",
  "revoked",
  "expired"
]);

export const codingPermissionGrantProviderSchema = runtimeModeSchema;

export const codingPermissionGrantBindingSchema = z.object({
  ownerId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  runtimeMode: userSelectableRuntimeModeSchema,
  action: codingPermissionGrantActionSchema
});

export const codingPermissionGrantSchema = z.object({
  id: z.string(),
  mode: z.literal("coding_agent").default("coding_agent"),
  provider: codingPermissionGrantProviderSchema,
  ownerId: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1).optional(),
  runtimeMode: runtimeModeInputSchema.optional(),
  action: codingPermissionGrantActionSchema,
  decision: z.literal("allow_for_session"),
  status: codingPermissionGrantStatusSchema,
  reason: z.string().trim().max(1000).optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().optional()
});

export const codingPermissionGrantCreateRequestSchema = z.object({
  mode: z.literal("coding_agent").default("coding_agent"),
  provider: codingPermissionGrantProviderSchema.default("local_daemon"),
  ownerId: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1).optional(),
  runtimeMode: runtimeModeInputSchema.optional(),
  action: codingPermissionGrantActionSchema,
  reason: z.string().trim().max(1000).optional()
});

export const codingPermissionGrantRevokeRequestSchema = z.object({
  mode: z.literal("coding_agent").default("coding_agent"),
  reason: z.string().trim().max(1000).optional()
});

export type CodingPermissionGrantAction = z.infer<
  typeof codingPermissionGrantActionSchema
>;
export type CodingPermissionGrantBinding = z.infer<
  typeof codingPermissionGrantBindingSchema
>;
export type CodingPermissionGrantStatus = z.infer<
  typeof codingPermissionGrantStatusSchema
>;
export type CodingPermissionGrant = z.infer<typeof codingPermissionGrantSchema>;
export type CodingPermissionGrantCreateRequest = z.infer<
  typeof codingPermissionGrantCreateRequestSchema
>;
export type CodingPermissionGrantRevokeRequest = z.infer<
  typeof codingPermissionGrantRevokeRequestSchema
>;

export const dailyWorkPermissionGrantActionSchema = codingPermissionGrantActionSchema;
export const dailyWorkPermissionGrantStatusSchema = codingPermissionGrantStatusSchema;
export const dailyWorkPermissionGrantProviderSchema = codingPermissionGrantProviderSchema;
export const dailyWorkPermissionGrantSchema = codingPermissionGrantSchema;
export const dailyWorkPermissionGrantCreateRequestSchema =
  codingPermissionGrantCreateRequestSchema;
export const dailyWorkPermissionGrantRevokeRequestSchema =
  codingPermissionGrantRevokeRequestSchema;

export type DailyWorkPermissionGrantAction = CodingPermissionGrantAction;
export type DailyWorkPermissionGrantStatus = CodingPermissionGrantStatus;
export type DailyWorkPermissionGrant = CodingPermissionGrant;
export type DailyWorkPermissionGrantCreateRequest = CodingPermissionGrantCreateRequest;
export type DailyWorkPermissionGrantRevokeRequest = CodingPermissionGrantRevokeRequest;
