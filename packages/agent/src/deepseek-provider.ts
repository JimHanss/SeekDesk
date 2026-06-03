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
}

interface DeepSeekStreamChunk {
  choices?: Array<{
    delta?: DeepSeekStreamDelta;
  }>;
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
          stream: true
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
        const chunk = parseSseLine(line);
        if (chunk) {
          yield chunk;
        }
      }
    }

    buffer += decoder.decode();
    for (const line of buffer.split(/\r?\n/)) {
      const chunk = parseSseLine(line);
      if (chunk) {
        yield chunk;
      }
    }

    yield { type: "done" };
  }
}

function parseSseLine(line: string): ModelStreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) {
    return null;
  }

  const data = trimmed.slice("data:".length).trim();
  if (!data || data === "[DONE]") {
    return null;
  }

  const parsed = JSON.parse(data) as DeepSeekStreamChunk;
  const delta = parsed.choices?.[0]?.delta;
  const text = delta?.content ?? delta?.reasoning_content ?? "";

  if (!text) {
    return null;
  }

  return {
    type: "text-delta",
    delta: text
  };
}
