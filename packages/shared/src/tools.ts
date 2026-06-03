import { z } from "zod";

export const dailyWorkToolNames = [
  "draft_document",
  "research_topic",
  "summarize_meeting",
  "organize_knowledge",
  "plan_workflow",
  "connect_context"
] as const;

export const codingToolNames = [
  "read_file",
  "write_file",
  "edit_file",
  "list_files",
  "grep",
  "run_shell",
  "git_diff",
  "git_status",
  "run_tests"
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
export type DailyWorkToolName = z.infer<typeof dailyWorkToolNameSchema>;
export type CodingToolName = z.infer<typeof codingToolNameSchema>;
export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>;
export type ToolCallRecord = z.infer<typeof toolCallRecordSchema>;
