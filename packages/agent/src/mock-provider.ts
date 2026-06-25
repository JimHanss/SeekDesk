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

    if (mode === "coding_agent" && request.tools?.length) {
      if (lastMessage?.role === "tool") {
        yield* streamText(createCodingToolResultResponse(lastMessage.content));
        yield {
          type: "usage",
          usage: {
            promptTokens: 36,
            completionTokens: 14,
            totalTokens: 50
          }
        };
        yield { type: "done" };
        return;
      }

      const toolCall = createCodingToolCall(lastUserPrompt, request);
      if (toolCall) {
        yield* streamText(toolCall.planText);
        yield toolCall.chunk;
        yield { type: "done" };
        return;
      }
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

function createCodingToolCall(prompt: string, request: ModelChatRequest) {
  if (hasModelTool(request, "coding_read_file") && shouldReadPackageJson(prompt)) {
    const inputJson = {
      path: extractWorkspacePath(prompt) ?? "package.json",
      maxBytes: 12000
    };

    return createMockToolCall({
      name: "coding_read_file",
      inputJson,
      prompt,
      planText: "Reading the requested workspace file. "
    });
  }

  if (hasModelTool(request, "coding_grep") && shouldSearchWorkspace(prompt)) {
    const inputJson = {
      query: extractSearchQuery(prompt),
      path: ".",
      maxResults: 20
    };

    return createMockToolCall({
      name: "coding_grep",
      inputJson,
      prompt,
      planText: "Searching the workspace for matching code. "
    });
  }

  if (
    hasModelTool(request, "coding_write_file") &&
    /\b(coding\.write_file|write file|create .*file)\b/i.test(prompt)
  ) {
    const inputJson = extractWriteFileInput(prompt);

    return createMockToolCall({
      name: "coding_write_file",
      inputJson,
      prompt,
      planText: "Planning a workspace file write that requires approval. "
    });
  }

  if (hasModelTool(request, "coding_git_status") && /\bgit status\b|status|changes/i.test(prompt)) {
    return createMockToolCall({
      name: "coding_git_status",
      inputJson: {},
      prompt,
      planText: "Checking git status. "
    });
  }

  if (hasModelTool(request, "coding_git_diff") && shouldInspectGitDiff(prompt)) {
    return createMockToolCall({
      name: "coding_git_diff",
      inputJson: {
        staged: false
      },
      prompt,
      planText: "Checking git diff. "
    });
  }

  if (hasModelTool(request, "coding_run_tests") && /\b(run|execute)\b.*\btest|\btest\b/i.test(prompt)) {
    return createMockToolCall({
      name: "coding_run_tests",
      inputJson: {
        command: extractCommand(prompt) ?? "npm test",
        timeoutMs: 120000
      },
      prompt,
      planText: "Planning a test command that requires approval. "
    });
  }

  if (hasModelTool(request, "coding_run_shell") && /\b(run|execute)\b.*\b(shell|command)|\bshell command\b/i.test(prompt)) {
    return createMockToolCall({
      name: "coding_run_shell",
      inputJson: {
        command: extractCommand(prompt) ?? "node -e \"console.log('seekdesk')\"",
        timeoutMs: 30000
      },
      prompt,
      planText: "Planning a shell command that requires approval. "
    });
  }

  return null;
}

function createMockToolCall(input: {
  name: string;
  inputJson: unknown;
  prompt: string;
  planText: string;
}) {
  return {
    planText: input.planText,
    chunk: {
      type: "tool-call" as const,
      id: `mock-call-${input.name.replace(/_/g, "-")}-${createToolCallSuffix(input.prompt)}`,
      name: input.name,
      inputJson: input.inputJson,
      rawArguments: JSON.stringify(input.inputJson)
    }
  };
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

function hasModelTool(request: ModelChatRequest, name: string) {
  return request.tools?.some((tool) => tool.function.name === name) ?? false;
}

function shouldReadPackageJson(prompt: string) {
  return /package\.json|npm scripts?|inspect|read file/i.test(prompt);
}

function shouldSearchWorkspace(prompt: string) {
  return /\b(search|grep|find)\b/i.test(prompt);
}

function shouldInspectGitDiff(prompt: string) {
  return (
    /\bgit\s+diff\b/i.test(prompt) ||
    /\b(show|view|check|inspect)\s+(?:the\s+)?diff\b/i.test(prompt) ||
    /\bdiff\s+(?:for|of)\b/i.test(prompt)
  );
}

function extractWorkspacePath(prompt: string) {
  const match = prompt.match(/[\w./-]*package\.json/i);
  return match?.[0] ?? null;
}

function extractSearchQuery(prompt: string) {
  const quoted = prompt.match(/["']([^"']{2,120})["']/);
  if (quoted?.[1]) {
    return quoted[1];
  }

  const afterKeyword = prompt.match(/(?:search|grep|find)\s*:?\s*([^.,\n]{2,120})/i);
  return afterKeyword?.[1]?.trim() || "coding_agent";
}

function extractCommand(prompt: string) {
  const match = prompt.match(/(?:shell command|command|shell)\s*:\s*([\s\S]{1,500})/i);
  return match?.[1]?.trim().replace(/^`+|`+$/g, "") || null;
}

function extractWriteFileInput(prompt: string) {
  const pathMatch =
    prompt.match(/(?:create|write)(?:\s+a)?(?:\s+file)?(?:\s+named)?\s+`?([A-Za-z0-9._/\\-]+)`?/i) ??
    prompt.match(/path\s*:\s*`?([A-Za-z0-9._/\\-]+)`?/i);
  const contentMatch =
    prompt.match(/content\s*[:=]\s*["“]([^"”]{1,1000})["”]/i) ??
    prompt.match(/with content\s*["“]([^"”]{1,1000})["”]/i);

  return {
    path: pathMatch?.[1] ?? ".firecrawl/seekdesk-ui-diff-smoke.txt",
    content: contentMatch?.[1] ?? "seekdesk ui diff approval smoke",
    createDirs: true
  };
}

function createCodingToolResultResponse(toolMessageContent: string) {
  if (/"status"\s*:\s*"permission_required"/.test(toolMessageContent)) {
    return "The tool plan is waiting for same-session authorization. Open Trace to approve and execute it.";
  }

  if (/package\.json/i.test(toolMessageContent)) {
    return "I read package.json. The available scripts and file details are recorded in the run trace.";
  }

  return "The coding tool completed. The result is available in Trace and the linked workbench panel.";
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
