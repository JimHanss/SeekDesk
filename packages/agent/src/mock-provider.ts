import type { ModelChatRequest, ModelProvider, ModelStreamChunk } from "./provider.js";
import { resolveModelMode } from "./provider.js";

export class MockModelProvider implements ModelProvider {
  async *streamChat(request: ModelChatRequest): AsyncIterable<ModelStreamChunk> {
    const lastMessage = request.messages.at(-1)?.content ?? "";
    const mode = resolveModelMode(request.mode);
    const text =
      mode === "coding_agent"
        ? `Mock coding-agent compatibility response for: ${lastMessage}`
        : createDailyWorkMockResponse(lastMessage);

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

function createDailyWorkMockResponse(prompt: string) {
  if (!isCodePrompt(prompt)) {
    return `Mock daily-work AI response for: ${prompt}`;
  }

  if (/\bjson\b/i.test(prompt)) {
    return `Mock daily-work AI response for: ${prompt}

Here is a small JSON example:

\`\`\`json
{
  "mode": "daily_work",
  "status": "ready",
  "signals": ["fenced_code_block", "syntax_highlight"]
}
\`\`\`

You can adapt the fields to your artifact.`;
  }

  return `Mock daily-work AI response for: ${prompt}

Here is a small TypeScript example:

\`\`\`ts
type DailyWorkSignal = {
  mode: "daily_work";
  ready: boolean;
};

const signal: DailyWorkSignal = {
  mode: "daily_work",
  ready: true
};
\`\`\`

You can adapt the shape to your workflow.`;
}

function isCodePrompt(prompt: string) {
  return /\b(code|json|typescript|tsx)\b|代码/i.test(prompt);
}
