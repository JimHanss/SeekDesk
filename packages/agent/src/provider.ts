export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ModelChatRequest {
  messages: ModelMessage[];
  maxTurns: number;
}

export type ModelStreamChunk =
  | {
      type: "text-delta";
      delta: string;
    }
  | {
      type: "tool-call";
      name: string;
      inputJson: unknown;
    }
  | {
      type: "done";
    };

export interface DeepSeekModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  thinkingMode?: "disabled" | "enabled";
}

export interface ModelProvider {
  streamChat(request: ModelChatRequest): AsyncIterable<ModelStreamChunk>;
}
