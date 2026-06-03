import type { ModelChatRequest, ModelProvider, ModelStreamChunk } from "./provider.js";
import { resolveModelMode } from "./provider.js";

export class MockModelProvider implements ModelProvider {
  async *streamChat(request: ModelChatRequest): AsyncIterable<ModelStreamChunk> {
    const lastMessage = request.messages.at(-1)?.content ?? "";
    const mode = resolveModelMode(request.mode);
    const text =
      mode === "coding_agent"
        ? `Mock coding-agent compatibility response for: ${lastMessage}`
        : `Mock daily-work AI response for: ${lastMessage}`;

    for (const token of text.split(" ")) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      yield {
        type: "text-delta",
        delta: `${token} `
      };
    }

    yield {
      type: "done"
    };
  }
}
