import { z } from "zod";

import { codingToolNameSchema } from "./tools.js";

export const daemonRuntimeModeSchema = z.enum(["local_daemon", "server_local"]);

export const daemonWorkspaceSchema = z.object({
  workspaceId: z.string().trim().min(1),
  daemonId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  rootPath: z.string().trim().min(1),
  runtimeMode: daemonRuntimeModeSchema,
  connected: z.boolean(),
  platform: z.string().trim().min(1).optional(),
  machineName: z.string().trim().min(1).optional(),
  updatedAt: z.string()
});

export const daemonStatusSchema = z.object({
  daemonId: z.string().trim().min(1),
  machineName: z.string().trim().min(1),
  platform: z.string().trim().min(1),
  workspaceRoot: z.string().trim().min(1),
  supportedCapabilities: z.array(codingToolNameSchema),
  pid: z.number().int().positive().optional()
});

export const daemonRegisterMessageSchema = z.object({
  type: z.literal("daemon.register"),
  token: z.string().trim().min(1),
  status: daemonStatusSchema
});

export const daemonHeartbeatMessageSchema = z.object({
  type: z.literal("daemon.heartbeat"),
  status: daemonStatusSchema.optional()
});

export const daemonResponseMessageSchema = z.object({
  type: z.literal("daemon.response"),
  requestId: z.string().trim().min(1),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.string().trim().min(1),
      message: z.string().trim().min(1),
      details: z.record(z.string(), z.unknown()).optional()
    })
    .optional()
});

export const daemonClientMessageSchema = z.discriminatedUnion("type", [
  daemonRegisterMessageSchema,
  daemonHeartbeatMessageSchema,
  daemonResponseMessageSchema
]);

export const daemonRequestCommandSchema = z.enum([
  "workspace.browse",
  "workspace.select",
  "workspace.pick",
  "tool.execute"
]);

export const daemonRequestMessageSchema = z.object({
  type: z.literal("daemon.request"),
  requestId: z.string().trim().min(1),
  command: daemonRequestCommandSchema,
  payload: z.unknown().optional()
});

export const daemonRegisteredMessageSchema = z.object({
  type: z.literal("daemon.registered"),
  workspace: daemonWorkspaceSchema
});

export type DaemonRuntimeMode = z.infer<typeof daemonRuntimeModeSchema>;
export type DaemonWorkspace = z.infer<typeof daemonWorkspaceSchema>;
export type DaemonStatus = z.infer<typeof daemonStatusSchema>;
export type DaemonClientMessage = z.infer<typeof daemonClientMessageSchema>;
export type DaemonRequestCommand = z.infer<typeof daemonRequestCommandSchema>;
export type DaemonRequestMessage = z.infer<typeof daemonRequestMessageSchema>;
export type DaemonRegisteredMessage = z.infer<typeof daemonRegisteredMessageSchema>;
