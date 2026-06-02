import { z } from "zod";

export const permissionModeSchema = z.enum([
  "read_only",
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
