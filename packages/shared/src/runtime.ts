import { z } from "zod";

export const runtimeCapabilityNameSchema = z.string().trim().min(1);

export const runtimeModeSchema = z.enum([
  "local_daemon",
  "cloud_runtime",
  "server_local"
]);

export const runtimeModeInputSchema = z.preprocess((value) => {
  if (value === "cloud_workspace") {
    return "cloud_runtime";
  }
  if (value === "local_runtime") {
    return "server_local";
  }
  return value;
}, runtimeModeSchema);

export const userSelectableRuntimeModeSchema = runtimeModeSchema.extract([
  "local_daemon",
  "cloud_runtime"
]);

export const runtimeLifecycleStatusSchema = z.enum([
  "provisioning",
  "cloning",
  "ready",
  "busy",
  "stopping",
  "stopped",
  "starting",
  "retrying",
  "deleting",
  "deleted",
  "offline",
  "error"
]);

export const runtimeOperationTypeSchema = z.enum([
  "provision",
  "start",
  "stop",
  "retry",
  "delete",
  "execute"
]);

export const runtimeOperationStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export const runtimeErrorCodeSchema = z.enum([
  "workspace_not_found",
  "workspace_access_denied",
  "runtime_unavailable",
  "runtime_not_ready",
  "runtime_request_timeout",
  "runtime_request_cancelled",
  "runtime_protocol_mismatch",
  "runtime_execution_failed",
  "session_workspace_mismatch",
  "workspace_operation_conflict",
  "workspace_limit_exceeded",
  "repository_clone_failed",
  "repository_credentials_invalid"
]);

export const runtimeSafetyBoundarySchema = z.object({
  readsUserFiles: z.boolean(),
  writesUserFiles: z.boolean(),
  executesShell: z.boolean(),
  workspaceRootLocked: z.literal(true),
  requiresApprovalForWritesAndCommands: z.literal(true),
  networkAccess: z.enum(["none", "bootstrap_only", "restricted"])
});

export const runtimeStatusSchema = z.object({
  status: runtimeLifecycleStatusSchema,
  service: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  workspaceName: z.string().trim().min(1),
  workspaceRoot: z.string().trim().min(1),
  runtimeMode: runtimeModeInputSchema,
  supportedCapabilities: z.array(runtimeCapabilityNameSchema),
  safetyBoundary: runtimeSafetyBoundarySchema,
  protocolVersion: z.number().int().positive().default(1),
  capabilityVersion: z.string().trim().min(1).default("1"),
  updatedAt: z.string().datetime()
});

export const runtimeOperationSchema = z.object({
  id: z.string().trim().min(1),
  ownerId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  type: runtimeOperationTypeSchema,
  status: runtimeOperationStatusSchema,
  idempotencyKey: z.string().trim().min(1),
  requestPayload: z.unknown(),
  resultPayload: z.unknown().optional(),
  errorCode: runtimeErrorCodeSchema.optional(),
  errorMessage: z.string().trim().min(1).optional(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional()
});

export const runtimeErrorSchema = z.object({
  code: runtimeErrorCodeSchema,
  message: z.string().trim().min(1),
  details: z.record(z.string(), z.unknown()).optional()
});

export const runtimeExecuteRequestSchema = z.object({
  requestId: z.string().trim().min(1),
  ownerId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  toolName: runtimeCapabilityNameSchema,
  inputJson: z.unknown()
});

export const runtimeExecuteResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    requestId: z.string().trim().min(1),
    result: z.unknown()
  }),
  z.object({
    ok: z.literal(false),
    requestId: z.string().trim().min(1),
    error: runtimeErrorSchema
  })
]);

export function normalizeRuntimeMode(value: unknown) {
  return runtimeModeInputSchema.parse(value);
}

export type RuntimeMode = z.infer<typeof runtimeModeSchema>;
export type UserSelectableRuntimeMode = z.infer<
  typeof userSelectableRuntimeModeSchema
>;
export type RuntimeLifecycleStatus = z.infer<
  typeof runtimeLifecycleStatusSchema
>;
export type RuntimeOperation = z.infer<typeof runtimeOperationSchema>;
export type RuntimeErrorCode = z.infer<typeof runtimeErrorCodeSchema>;
export type RuntimeStatus = z.infer<typeof runtimeStatusSchema>;
export type RuntimeExecuteRequest = z.infer<typeof runtimeExecuteRequestSchema>;
export type RuntimeExecuteResponse = z.infer<
  typeof runtimeExecuteResponseSchema
>;
