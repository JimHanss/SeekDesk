import { z } from "zod";

import { appModeSchema } from "./app-modes.js";
import {
  runtimeLifecycleStatusSchema,
  runtimeModeInputSchema,
  runtimeOperationSchema,
  runtimeSafetyBoundarySchema,
  userSelectableRuntimeModeSchema
} from "./runtime.js";
import { codingToolNameSchema } from "./tools.js";

export const workspaceImageProfileSchema = z.enum(["node22"]);

export const workspaceRepositorySummarySchema = z.object({
  url: z.string().trim().url(),
  branch: z.string().trim().min(1),
  revision: z.string().trim().min(1).optional()
});

export const codingWorkspaceSummarySchema = z.object({
  workspaceId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  runtimeMode: runtimeModeInputSchema,
  status: runtimeLifecycleStatusSchema,
  rootPath: z.string().trim().min(1),
  connected: z.boolean(),
  repository: workspaceRepositorySummarySchema.optional(),
  imageProfile: workspaceImageProfileSchema.optional(),
  daemonId: z.string().trim().min(1).optional(),
  machineName: z.string().trim().min(1).optional(),
  platform: z.string().trim().min(1).optional(),
  supportedCapabilities: z.array(codingToolNameSchema).default([]),
  safetyBoundary: runtimeSafetyBoundarySchema.optional(),
  lastActiveAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const codingWorkspaceRecordSchema = codingWorkspaceSummarySchema.extend({
  ownerId: z.string().trim().min(1),
  credentialRef: z.string().trim().min(1).optional(),
  containerRef: z.string().trim().min(1).optional(),
  storageRef: z.string().trim().min(1).optional(),
  errorCode: z.string().trim().min(1).optional(),
  errorMessage: z.string().trim().min(1).optional(),
  stoppedAt: z.string().datetime().optional(),
  deletedAt: z.string().datetime().optional()
});

export const codingWorkspaceDetailSchema = codingWorkspaceSummarySchema.extend({
  latestOperation: runtimeOperationSchema.omit({ ownerId: true }).optional(),
  error: z
    .object({
      code: z.string().trim().min(1),
      message: z.string().trim().min(1)
    })
    .optional()
});

export const cloudWorkspaceCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  repositoryUrl: z.string().trim().url(),
  branch: z.string().trim().min(1).max(255).default("main"),
  imageProfile: workspaceImageProfileSchema.default("node22"),
  credentialId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).max(200)
});

export const workspaceLifecycleRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(200)
});

export const codingWorkspaceListResponseSchema = z.object({
  mode: appModeSchema.default("coding_agent"),
  workspaces: z.array(codingWorkspaceSummarySchema)
});

export const codingWorkspaceOperationResponseSchema = z.object({
  mode: appModeSchema.default("coding_agent"),
  workspace: codingWorkspaceSummarySchema,
  operation: runtimeOperationSchema.omit({ ownerId: true })
});

export const cloudRuntimeLifecycleSubmissionSchema = z.object({
  ownerId: z.string().trim().min(1),
  workspace: codingWorkspaceRecordSchema,
  operation: runtimeOperationSchema,
  repositoryToken: z.string().min(1).max(20_000).optional()
});

export const cloudRuntimeWorkspaceStatusSchema = z.object({
  workspace: codingWorkspaceRecordSchema,
  operations: z.array(runtimeOperationSchema),
  updatedAt: z.string().datetime()
});

export const workspaceRuntimeSelectionSchema = z.object({
  workspaceId: z.string().trim().min(1),
  runtimeMode: userSelectableRuntimeModeSchema
});

export const repositoryCredentialMetadataSchema = z.object({
  id: z.string().trim().min(1),
  provider: z.literal("https_token"),
  label: z.string().trim().min(1),
  keyVersion: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional()
});

export const repositoryCredentialListResponseSchema = z.object({
  mode: appModeSchema.default("coding_agent"),
  credentials: z.array(repositoryCredentialMetadataSchema)
});

export const workspaceRefSchema = codingWorkspaceSummarySchema;

export type WorkspaceImageProfile = z.infer<
  typeof workspaceImageProfileSchema
>;
export type WorkspaceRepositorySummary = z.infer<
  typeof workspaceRepositorySummarySchema
>;
export type CodingWorkspaceSummary = z.infer<
  typeof codingWorkspaceSummarySchema
>;
export type CodingWorkspaceRecord = z.infer<
  typeof codingWorkspaceRecordSchema
>;
export type CodingWorkspaceDetail = z.infer<
  typeof codingWorkspaceDetailSchema
>;
export type CloudWorkspaceCreateRequest = z.infer<
  typeof cloudWorkspaceCreateRequestSchema
>;
export type CloudRuntimeLifecycleSubmission = z.infer<
  typeof cloudRuntimeLifecycleSubmissionSchema
>;
export type CloudRuntimeWorkspaceStatus = z.infer<
  typeof cloudRuntimeWorkspaceStatusSchema
>;
export type WorkspaceRuntimeSelection = z.infer<
  typeof workspaceRuntimeSelectionSchema
>;
export type RepositoryCredentialMetadata = z.infer<
  typeof repositoryCredentialMetadataSchema
>;
export type WorkspaceRef = z.infer<typeof workspaceRefSchema>;
