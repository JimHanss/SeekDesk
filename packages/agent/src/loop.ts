import type { AppMode, ChatContext } from "@seekdesk/shared";
import type {
  ModelAssistantToolCall,
  ModelMessage,
  ModelProvider,
  ModelStreamChunk,
  ModelToolDefinition
} from "./provider.js";
import type {
  ToolCallRequest,
  ToolCallResult,
  ToolOrchestrator
} from "./tools.js";

export type AgentLoopStatus = "idle" | "running" | "cancelled" | "completed";

export interface AgentLoopInput {
  provider: ModelProvider;
  mode?: AppMode;
  prompt?: string;
  messages?: ModelMessage[];
  sessionId?: string;
  context?: ChatContext;
  contextSummaryLines?: string[];
  maxTurns?: number;
  toolPlan?: ToolCallRequest[];
  tools?: ModelToolDefinition[];
  orchestrator?: ToolOrchestrator;
}

export interface AgentLoopResult {
  status: AgentLoopStatus;
  chunks: ModelStreamChunk[];
  toolPlan?: ToolCallRequest[];
}

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const chunks: ModelStreamChunk[] = [];

  for await (const chunk of streamAgentLoop(input)) {
    chunks.push(chunk);
  }

  const result: AgentLoopResult = {
    status: "completed",
    chunks
  };

  if (input.toolPlan?.length) {
    result.toolPlan = [...input.toolPlan];
  }

  return result;
}

export async function* streamAgentLoop(
  input: AgentLoopInput
): AsyncIterable<ModelStreamChunk> {
  const messages = createAgentLoopMessages(input);

  if (!messages.length) {
    throw new Error("Agent loop requires a prompt or at least one message.");
  }

  const maxTurns = input.maxTurns ?? 1;
  let currentMessages = messages;

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const toolCalls: Extract<ModelStreamChunk, { type: "tool-call" }>[] = [];
    let assistantText = "";
    const request = {
      mode: input.mode ?? "coding_agent",
      messages: currentMessages,
      maxTurns,
      ...(input.toolPlan?.length ? { toolPlan: [...input.toolPlan] } : {}),
      ...(input.tools?.length
        ? {
            tools: input.tools,
            toolChoice: "auto" as const
          }
        : {
            toolChoice: "none" as const
          })
    };

    for await (const chunk of input.provider.streamChat(request)) {
      if (chunk.type === "done") {
        continue;
      }

      if (chunk.type === "text-delta") {
        assistantText += chunk.delta;
      }

      if (chunk.type === "tool-call") {
        toolCalls.push(chunk);
      }

      yield chunk;
    }

    if (!toolCalls.length || !input.orchestrator || turn === maxTurns - 1) {
      break;
    }

    const toolTurn = await orchestrateToolCalls({
      toolCalls,
      orchestrator: input.orchestrator
    });

    for (const result of toolTurn.results) {
      yield {
        type: "tool-result",
        ...(result.id ? { id: result.id } : {}),
        name: result.name,
        result
      };
    }

    currentMessages = [
      ...currentMessages,
      {
        role: "assistant",
        content: assistantText.trim(),
        toolCalls: toolTurn.assistantToolCalls
      },
      ...toolTurn.messages
    ];
  }

  yield { type: "done" };
}

export function createAgentLoopMessages(input: AgentLoopInput): ModelMessage[] {
  const promptMessages = createPromptMessages(input.prompt);
  const messages = input.messages?.length
    ? [...input.messages, ...promptMessages]
    : promptMessages;
  const orchestrationMessage = createOrchestrationMessage(input);
  const toolPlanMessage = createToolPlanMessage(input.toolPlan);
  const prefixMessages = [orchestrationMessage, toolPlanMessage].filter(
    (message): message is ModelMessage => Boolean(message)
  );

  if (!prefixMessages.length) {
    return messages;
  }

  return [...prefixMessages, ...messages];
}

function createPromptMessages(prompt?: string): ModelMessage[] {
  const content = prompt?.trim();
  if (!content) {
    return [];
  }

  return [
    {
      role: "user",
      content
    }
  ];
}

function createOrchestrationMessage(input: AgentLoopInput): ModelMessage | null {
  const mode = input.mode ?? "coding_agent";
  const lines =
    mode === "coding_agent"
      ? [
          "Coding-agent orchestration context is scoped to the configured workspace root.",
          input.orchestrator
            ? [
                "Use coding tools when they materially improve the answer.",
                "Read-only tools may run directly.",
                "File writes, exact edits, shell commands, and test commands should still be emitted as tool calls when requested; the orchestrator records them as permission_required pending plans and does not execute them until the user grants same-session authorization."
              ].join(" ")
            : "Do not claim filesystem, shell, git, or test commands ran unless a tool result is present.",
          "Never access paths outside the workspace root. Never claim email, calendar, or external connector actions are available."
        ]
      : [
          "Legacy daily-work mode is disabled for connector actions.",
          "Do not send email, read mailboxes, create calendar events, or claim connector actions were performed."
        ];

  if (input.sessionId) {
    lines.push(`Session id: ${input.sessionId}`);
  }

  for (const line of summarizeContext(input.context)) {
    lines.push(line);
  }

  for (const line of input.contextSummaryLines ?? []) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (normalized) {
      lines.push(normalized);
    }
  }

  return {
    role: "system",
    content: lines.join("\n")
  };
}

async function orchestrateToolCalls(input: {
  toolCalls: Extract<ModelStreamChunk, { type: "tool-call" }>[];
  orchestrator: ToolOrchestrator;
}): Promise<{
  messages: ModelMessage[];
  results: ToolCallResult[];
  assistantToolCalls: ModelAssistantToolCall[];
}> {
  const messages: ModelMessage[] = [];
  const results: ToolCallResult[] = [];
  const assistantToolCalls: ModelAssistantToolCall[] = [];

  for (const [index, toolCall] of input.toolCalls.entries()) {
    const toolCallId = toolCall.id ?? `tool-call-${index + 1}`;
    const rawArguments =
      toolCall.rawArguments ?? JSON.stringify(toolCall.inputJson ?? {});
    const result = await input.orchestrator.orchestrate({
      id: toolCallId,
      name: toolCall.name,
      inputJson: toolCall.inputJson
    });

    results.push(result);
    assistantToolCalls.push({
      id: toolCallId,
      type: "function",
      function: {
        name: toolCall.name,
        arguments: rawArguments
      }
    });
    messages.push({
      role: "tool",
      toolCallId,
      name: toolCall.name,
      content: JSON.stringify({
        status: result.status,
        previewOnly: result.previewOnly,
        permissionRequired: result.permissionRequired,
        outputJson: result.outputJson,
        error: result.error
      })
    });
  }

  return {
    messages,
    results,
    assistantToolCalls
  };
}

function createToolPlanMessage(toolPlan?: ToolCallRequest[]): ModelMessage | null {
  if (!toolPlan?.length) {
    return null;
  }

  const lines = [
    "Tool plan is advisory only.",
    "Do not execute tools from this plan or claim side effects were performed."
  ];

  toolPlan.forEach((request, index) => {
    const disposition = request.planOnly ? "planned" : "preview";
    lines.push(`Tool plan ${index + 1}: ${request.name} (${disposition})`);
  });

  return {
    role: "system",
    content: lines.join("\n")
  };
}

function summarizeContext(context?: ChatContext) {
  if (!context) {
    return [];
  }

  const lines: string[] = [];

  if (context.workspaceId) {
    lines.push(`Workspace id: ${context.workspaceId}`);
  }

  pushIds(lines, "Context item ids", context.contextItemIds);
  pushIds(lines, "Artifact ids", context.artifactIds);
  pushIds(lines, "Approval request ids", context.approvalRequestIds);
  pushIds(lines, "Connector ids", context.connectorIds);
  pushIds(lines, "Workflow ids", context.workflowIds);

  if (context.locale) {
    lines.push(`Locale: ${context.locale}`);
  }

  if (context.timezone) {
    lines.push(`Timezone: ${context.timezone}`);
  }

  return lines;
}

function pushIds(lines: string[], label: string, ids?: string[]) {
  if (!ids?.length) {
    return;
  }

  lines.push(`${label}: ${ids.join(", ")}`);
}
