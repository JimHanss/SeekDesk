import type { AppMode, ChatContext } from "@seekdesk/shared";
import type { ModelMessage, ModelProvider, ModelStreamChunk } from "./provider.js";
import type { ToolCallRequest } from "./tools.js";

export type AgentLoopStatus = "idle" | "running" | "cancelled" | "completed";

export interface AgentLoopInput {
  provider: ModelProvider;
  mode?: AppMode;
  prompt?: string;
  messages?: ModelMessage[];
  sessionId?: string;
  context?: ChatContext;
  maxTurns?: number;
  toolPlan?: ToolCallRequest[];
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

  const request = {
    mode: input.mode ?? "daily_work",
    messages,
    maxTurns: input.maxTurns ?? 1
  };

  const chatRequest = input.toolPlan?.length
    ? {
        ...request,
        toolPlan: [...input.toolPlan]
      }
    : request;

  for await (const chunk of input.provider.streamChat(chatRequest)) {
    yield chunk;
  }
}

export function createAgentLoopMessages(input: AgentLoopInput): ModelMessage[] {
  const promptMessages = createPromptMessages(input.prompt);
  const messages = input.messages?.length
    ? [...input.messages, ...promptMessages]
    : promptMessages;
  const orchestrationMessage = createDailyWorkOrchestrationMessage(input);
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

function createDailyWorkOrchestrationMessage(
  input: AgentLoopInput
): ModelMessage | null {
  const mode = input.mode ?? "daily_work";
  if (mode !== "daily_work") {
    return null;
  }

  const lines = [
    "Daily-work orchestration context is read-only.",
    "Do not execute tools, send messages, write documents, schedule events, or claim connector actions were performed."
  ];

  if (input.sessionId) {
    lines.push(`Session id: ${input.sessionId}`);
  }

  for (const line of summarizeContext(input.context)) {
    lines.push(line);
  }

  return {
    role: "system",
    content: lines.join("\n")
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
