import { z } from "zod";

export const toolNameSchema = z.enum([
  "read_file",
  "write_file",
  "edit_file",
  "list_files",
  "grep",
  "run_shell",
  "git_diff",
  "git_status",
  "run_tests"
]);

export const toolCallStatusSchema = z.enum([
  "requested",
  "permission_required",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export const toolCallRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  name: toolNameSchema,
  status: toolCallStatusSchema,
  inputJson: z.unknown(),
  outputText: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional()
});

export type ToolName = z.infer<typeof toolNameSchema>;
export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>;
export type ToolCallRecord = z.infer<typeof toolCallRecordSchema>;
