import type { ModelChatRequest, ModelProvider, ModelStreamChunk } from "./provider.js";
import { resolveModelMode } from "./provider.js";

const toolTraceSmokeInput = {
  title: "Browser smoke agent trace",
  artifactType: "brief",
  content:
    "A deterministic local artifact created by the browser smoke test to verify agent trace rendering.",
  tags: ["browser-smoke", "agent-trace"]
};

export class MockModelProvider implements ModelProvider {
  async *streamChat(request: ModelChatRequest): AsyncIterable<ModelStreamChunk> {
    const lastMessage = request.messages.at(-1);
    const lastMessageContent = lastMessage?.content ?? "";
    const lastUserPrompt = findLastUserPrompt(request);
    const mode = resolveModelMode(request.mode);

    if (
      mode === "daily_work" &&
      isToolTraceSmokePrompt(lastUserPrompt) &&
      request.tools?.some((tool) => tool.function.name === "daily_persist_artifact")
    ) {
      if (lastMessage?.role === "tool") {
        yield* streamText(
          `Mock daily-work AI response for: ${lastUserPrompt}\n\nTool trace artifact saved for review. The plan, execution result, reference, usage, and preview-only boundary are available in the agent trace panel.`
        );
        yield {
          type: "usage",
          usage: {
            promptTokens: 42,
            completionTokens: 18,
            totalTokens: 60
          }
        };
        yield { type: "done" };
        return;
      }

      const toolCallId = `mock-call-daily-persist-artifact-${createToolCallSuffix(lastUserPrompt)}`;
      yield* streamText("Planning a local preview artifact for the trace smoke. ");
      yield {
        type: "tool-call",
        id: toolCallId,
        name: "daily_persist_artifact",
        inputJson: toolTraceSmokeInput,
        rawArguments: JSON.stringify(toolTraceSmokeInput)
      };
      yield { type: "done" };
      return;
    }

    const text =
      mode === "coding_agent"
        ? `Mock coding-agent compatibility response for: ${lastMessageContent}`
        : createDailyWorkMockResponse(lastMessageContent);

    yield* streamText(text);
    yield { type: "done" };
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

async function* streamText(text: string): AsyncIterable<ModelStreamChunk> {
  for (const token of text.split(" ")) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    yield {
      type: "text-delta",
      delta: `${token} `
    };
  }
}

function findLastUserPrompt(request: ModelChatRequest) {
  return (
    [...request.messages].reverse().find((message) => message.role === "user")
      ?.content ?? ""
  );
}

function isToolTraceSmokePrompt(prompt: string) {
  return /\bagent tool trace\b/i.test(prompt);
}

function createToolCallSuffix(prompt: string) {
  const suffix = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-40);

  return suffix || "default";
}

function isCodePrompt(prompt: string) {
  return /\b(code|json|typescript|tsx)\b|代码/i.test(prompt);
}
