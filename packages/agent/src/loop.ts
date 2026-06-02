import type { ModelProvider, ModelStreamChunk } from "./provider.js";

export type AgentLoopStatus = "idle" | "running" | "cancelled" | "completed";

export interface AgentLoopInput {
  provider: ModelProvider;
  prompt: string;
  maxTurns?: number;
}

export interface AgentLoopResult {
  status: AgentLoopStatus;
  chunks: ModelStreamChunk[];
}

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const chunks: ModelStreamChunk[] = [];

  for await (const chunk of input.provider.streamChat({
    messages: [{ role: "user", content: input.prompt }],
    maxTurns: input.maxTurns ?? 1
  })) {
    chunks.push(chunk);
  }

  return {
    status: "completed",
    chunks
  };
}
