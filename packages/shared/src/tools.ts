import { z } from "zod";

import { runtimeModeInputSchema } from "./runtime.js";

export const dailyWorkToolNames = [
  "draft_document",
  "research_topic",
  "summarize_meeting",
  "organize_knowledge",
  "plan_workflow",
  "connect_context",
  "daily.persist_artifact"
] as const;

export const codingToolNames = [
  "coding.read_file",
  "coding.write_file",
  "coding.edit_file",
  "coding.list_files",
  "coding.grep",
  "coding.run_shell",
  "coding.git_diff",
  "coding.git_status",
  "coding.run_tests"
] as const;

const toolNames = [...dailyWorkToolNames, ...codingToolNames] as const;

export const dailyWorkToolNameSchema = z.enum(dailyWorkToolNames);
export const codingToolNameSchema = z.enum(codingToolNames);
export const toolNameSchema = z.enum(toolNames);

export const toolCallStatusSchema = z.enum([
  "requested",
  "permission_required",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

const relativeWorkspacePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) => !value.includes(String.fromCharCode(0)),
    "Path cannot contain null bytes."
  );

export const codingReadFileInputSchema = z.object({
  path: relativeWorkspacePathSchema,
  maxBytes: z.number().int().min(1).max(500_000).default(200_000)
});

export const codingWriteFileInputSchema = z.object({
  path: relativeWorkspacePathSchema,
  content: z.string().max(1_000_000),
  createDirs: z.boolean().default(false)
});

export const codingEditFileInputSchema = z.object({
  path: relativeWorkspacePathSchema,
  search: z.string().min(1).max(50_000),
  replace: z.string().max(50_000),
  expectedReplacements: z.number().int().min(1).max(100).default(1)
});

export const codingListFilesInputSchema = z.object({
  path: relativeWorkspacePathSchema.default("."),
  maxDepth: z.number().int().min(1).max(8).default(3),
  maxEntries: z.number().int().min(1).max(500).default(200)
});

export const codingGrepInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  path: relativeWorkspacePathSchema.default("."),
  includeGlob: z.string().trim().min(1).max(200).optional(),
  maxResults: z.number().int().min(1).max(200).default(50)
});

export const codingRunShellInputSchema = z.object({
  command: z.string().trim().min(1).max(2000),
  timeoutMs: z.number().int().min(1000).max(120_000).default(30_000)
});

export const codingGitDiffInputSchema = z.object({
  path: relativeWorkspacePathSchema.optional(),
  staged: z.boolean().default(false)
});

export const codingGitStatusInputSchema = z.object({});

export const codingWorkspaceBrowseInputSchema = z.object({
  path: z.string().trim().min(1).max(4000).optional()
});

export const codingWorkspaceSelectInputSchema = z.object({
  path: z.string().trim().min(1).max(4000)
});

export const codingRunTestsInputSchema = z.object({
  command: z.string().trim().min(1).max(500).default("npm test"),
  timeoutMs: z.number().int().min(1000).max(300_000).default(120_000)
});

export const dailyPersistArtifactInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  artifactType: z.string().trim().min(1).max(80).default("ai_generated_note"),
  content: z.string().trim().min(1).max(50000),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([])
});

export const dailyWorkToolInputSchemas = {
  "daily.persist_artifact": dailyPersistArtifactInputSchema
} as const;

export const codingToolInputSchemas = {
  "coding.read_file": codingReadFileInputSchema,
  "coding.write_file": codingWriteFileInputSchema,
  "coding.edit_file": codingEditFileInputSchema,
  "coding.list_files": codingListFilesInputSchema,
  "coding.grep": codingGrepInputSchema,
  "coding.run_shell": codingRunShellInputSchema,
  "coding.git_diff": codingGitDiffInputSchema,
  "coding.git_status": codingGitStatusInputSchema,
  "coding.run_tests": codingRunTestsInputSchema
} as const;

export const toolCallRecordSchema = z.object({
  id: z.string(),
  ownerId: z.string().trim().min(1).optional(),
  sessionId: z.string().optional(),
  workspaceId: z.string().trim().min(1).optional(),
  runtimeMode: runtimeModeInputSchema.optional(),
  requestId: z.string().trim().min(1).optional(),
  name: toolNameSchema,
  status: toolCallStatusSchema,
  inputJson: z.unknown(),
  outputJson: z.unknown().optional(),
  outputText: z.string().optional(),
  previewOnly: z.boolean().default(true),
  permissionRequired: z.boolean().default(false),
  error: z.string().optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional()
});

export const toolModelUsageRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  provider: z.string(),
  model: z.string(),
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  createdAt: z.string()
});

export type ToolName = z.infer<typeof toolNameSchema>;
export type DailyWorkToolName = z.infer<typeof dailyWorkToolNameSchema>;
export type CodingToolName = z.infer<typeof codingToolNameSchema>;
export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>;
export type ToolCallRecord = z.infer<typeof toolCallRecordSchema>;
export type CodingReadFileInput = z.infer<typeof codingReadFileInputSchema>;
export type CodingWriteFileInput = z.infer<typeof codingWriteFileInputSchema>;
export type CodingEditFileInput = z.infer<typeof codingEditFileInputSchema>;
export type CodingListFilesInput = z.infer<typeof codingListFilesInputSchema>;
export type CodingGrepInput = z.infer<typeof codingGrepInputSchema>;
export type CodingRunShellInput = z.infer<typeof codingRunShellInputSchema>;
export type CodingGitDiffInput = z.infer<typeof codingGitDiffInputSchema>;
export type CodingGitStatusInput = z.infer<typeof codingGitStatusInputSchema>;
export type CodingWorkspaceBrowseInput = z.infer<
  typeof codingWorkspaceBrowseInputSchema
>;
export type CodingWorkspaceSelectInput = z.infer<
  typeof codingWorkspaceSelectInputSchema
>;
export type CodingRunTestsInput = z.infer<typeof codingRunTestsInputSchema>;
export type DailyPersistArtifactInput = z.infer<
  typeof dailyPersistArtifactInputSchema
>;
export type ToolModelUsageRecord = z.infer<typeof toolModelUsageRecordSchema>;
