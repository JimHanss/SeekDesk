import type { AppMode } from "@seekdesk/shared";
import type { ToolCallRequest } from "./tools.js";

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ModelAssistantToolCall[];
}

export interface ModelAssistantToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ModelToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelChatRequest {
  mode?: AppMode;
  messages: ModelMessage[];
  maxTurns: number;
  toolPlan?: ToolCallRequest[];
  tools?: ModelToolDefinition[];
  toolChoice?: "auto" | "none";
}

export type ModelStreamChunk =
  | {
      type: "text-delta";
      delta: string;
    }
  | {
      type: "reasoning-delta";
      delta: string;
    }
  | {
      type: "tool-call";
      id?: string;
      name: string;
      inputJson: unknown;
      rawArguments?: string;
    }
  | {
      type: "tool-result";
      id?: string;
      name: string;
      result: unknown;
    }
  | {
      type: "usage";
      usage: ModelUsage;
    }
  | {
      type: "done";
    };

export interface DeepSeekModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  thinkingMode?: "disabled" | "enabled";
  includeUsage?: boolean;
}

export interface ModelProvider {
  streamChat(request: ModelChatRequest): AsyncIterable<ModelStreamChunk>;
}

export function resolveModelMode(mode?: AppMode): AppMode {
  return mode ?? "daily_work";
}

export function getModeSystemMessage(mode?: AppMode): ModelMessage {
  const resolvedMode = resolveModelMode(mode);

  if (resolvedMode === "coding_agent") {
    return {
      role: "system",
      content:
        "SeekDesk coding-agent compatibility mode is reserved in this build. Help with planning and explanation, but do not claim filesystem, shell, git, or IDE tools are active."
    };
  }

  return {
    role: "system",
    content:
      "SeekDesk is running daily-work mode. Help with writing, research, meeting summaries, knowledge organization, and safe workflow planning. Do not claim private connectors are active unless the user explicitly authorizes them."
  };
}
