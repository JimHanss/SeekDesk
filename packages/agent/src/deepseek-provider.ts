import { getModeSystemMessage } from "./provider.js";
import type {
  DeepSeekModelConfig,
  ModelChatRequest,
  ModelProvider,
  ModelStreamChunk
} from "./provider.js";

interface DeepSeekStreamDelta {
  content?: string;
  reasoning_content?: string;
  tool_calls?: DeepSeekToolCallDelta[];
}

interface DeepSeekStreamChunk {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  choices?: Array<{
    delta?: DeepSeekStreamDelta;
    finish_reason?: string | null;
  }>;
}

interface DeepSeekToolCallDelta {
  index?: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface PendingToolCall {
  id?: string;
  name?: string;
  argumentsText: string;
}

export class DeepSeekModelProvider implements ModelProvider {
  private readonly config: DeepSeekModelConfig;

  constructor(config: DeepSeekModelConfig) {
    this.config = config;
  }

  async *streamChat(request: ModelChatRequest): AsyncIterable<ModelStreamChunk> {
    const response = await fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [getModeSystemMessage(request.mode), ...request.messages],
          stream: true,
          ...(request.tools?.length
            ? {
                tools: request.tools,
                tool_choice: request.toolChoice ?? "auto"
              }
            : {}),
          stream_options: this.config.includeUsage
            ? {
                include_usage: true
              }
            : undefined,
          thinking: this.config.thinkingMode
            ? {
                type: this.config.thinkingMode
              }
            : undefined
        })
      }
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `DeepSeek request failed with ${response.status}${errorText ? `: ${errorText}` : ""}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const toolCalls = new ToolCallAccumulator();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        yield* processSseLine(line, toolCalls);
      }
    }

    buffer += decoder.decode();
    for (const line of buffer.split(/\r?\n/)) {
      yield* processSseLine(line, toolCalls);
    }

    yield* toolCalls.flush();
    yield { type: "done" };
  }
}

function processSseLine(
  line: string,
  toolCalls: ToolCallAccumulator
): ModelStreamChunk[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) {
    return [];
  }

  const data = trimmed.slice("data:".length).trim();
  if (!data || data === "[DONE]") {
    return [];
  }

  let parsed: DeepSeekStreamChunk;
  try {
    parsed = JSON.parse(data) as DeepSeekStreamChunk;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON error";
    throw new Error(
      `DeepSeek stream parse failed: ${message}; data=${data.slice(0, 160)}`
    );
  }
  const chunks: ModelStreamChunk[] = [];

  if (parsed.usage) {
    chunks.push({
      type: "usage",
      usage: {
        promptTokens: parsed.usage.prompt_tokens ?? 0,
        completionTokens: parsed.usage.completion_tokens ?? 0,
        totalTokens:
          parsed.usage.total_tokens ??
          (parsed.usage.prompt_tokens ?? 0) +
            (parsed.usage.completion_tokens ?? 0)
      }
    });
  }

  for (const choice of parsed.choices ?? []) {
    const delta = choice.delta;

    if (delta?.content) {
      chunks.push({
        type: "text-delta",
        delta: delta.content
      });
    }

    if (delta?.reasoning_content) {
      chunks.push({
        type: "reasoning-delta",
        delta: delta.reasoning_content
      });
    }

    if (delta?.tool_calls?.length) {
      toolCalls.consume(delta.tool_calls);
    }

    if (choice.finish_reason === "tool_calls") {
      chunks.push(...toolCalls.flush());
    }
  }

  return chunks;
}

class ToolCallAccumulator {
  private readonly calls = new Map<number, PendingToolCall>();

  consume(deltas: DeepSeekToolCallDelta[]) {
    for (const delta of deltas) {
      const index = delta.index ?? 0;
      const current = this.calls.get(index) ?? {
        argumentsText: ""
      };

      if (delta.id) {
        current.id = delta.id;
      }

      if (delta.function?.name) {
        current.name = delta.function.name;
      }

      if (delta.function?.arguments) {
        current.argumentsText += delta.function.arguments;
      }

      this.calls.set(index, current);
    }
  }

  flush(): ModelStreamChunk[] {
    const chunks: ModelStreamChunk[] = [];

    for (const call of [...this.calls.values()]) {
      if (!call.name) {
        continue;
      }

      chunks.push({
        type: "tool-call",
        ...(call.id ? { id: call.id } : {}),
        name: call.name,
        inputJson: parseToolArguments(call.argumentsText),
        rawArguments: call.argumentsText
      });
    }

    this.calls.clear();
    return chunks;
  }
}

function parseToolArguments(rawArguments: string): unknown {
  const trimmed = rawArguments.trim();
  if (!trimmed) {
    return {};
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return {
      rawArguments: trimmed
    };
  }
}
