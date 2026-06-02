import { z } from "zod";

export const modelUsageRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  provider: z.literal("deepseek"),
  model: z.string(),
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  estimatedCostUsd: z.number().nonnegative().optional(),
  createdAt: z.string()
});

export type ModelUsageRecord = z.infer<typeof modelUsageRecordSchema>;
