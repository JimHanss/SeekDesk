import type {
  DailyActivityEvent,
  ToolCallRecord,
  WorkflowExternalEffect
} from "@seekdesk/shared";

export function createToolActivityEvent(input: {
  sessionId: string;
  toolName: ToolCallRecord["name"];
  status: "queued" | "in_progress" | "completed" | "failed" | "cancelled";
  runtimeMode?: ToolCallRecord["runtimeMode"];
  requestId?: string;
  timestamp: string;
  phase: "requested" | "running" | "completed" | "failed" | "cancelled";
  inputJson?: unknown;
  outputJson?: unknown;
  error?: string;
  toolCallId?: string;
}): DailyActivityEvent {
  const isCodingTool = input.toolName.startsWith("coding.");
  const artifactIds = inferToolArtifactIds(input.outputJson);
  const boundary = inferToolSafetyBoundary(input.outputJson, input.error);
  const isTerminal = input.phase === "completed" || input.phase === "failed" || input.phase === "cancelled";
  const summary = isTerminal
    ? summarizeToolResult(input.toolName, input.outputJson, input.error)
    : summarizeToolRequest(input.toolName, input.inputJson);
  const metadata = createToolActivityMetadata({
    toolName: input.toolName,
    phase: input.phase,
    inputJson: input.inputJson,
    outputJson: input.outputJson,
    ...(input.runtimeMode ? { runtimeMode: input.runtimeMode } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.error ? { error: input.error } : {})
  });

  return {
    id: `agent-tool-${input.sessionId}-${input.toolCallId ?? input.toolName}-${input.phase}-${input.status}`,
    mode: isCodingTool ? "coding_agent" : "daily_work",
    eventType: isCodingTool
      ? `coding.tool.${input.phase}` as DailyActivityEvent["eventType"]
      : isTerminal
        ? "workflow.preview.completed"
        : "workflow.preview.queued",
    status: input.status,
    timestamp: input.timestamp,
    title: createActivityTitle(input.phase),
    summary,
    actor: isCodingTool ? "coding-agent" : "daily-work-agent",
    relatedRefs: {
      sessionIds: [input.sessionId],
      templateIds: [],
      workflowIds: [],
      actionQueueItemIds: [],
      artifactIds,
      approvalRequestIds: [],
      connectorIds: [],
      contextItemIds: []
    },
    safetyBoundary: {
      previewOnly: boundary.previewOnly,
      externalEffects: boundary.externalEffects,
      prohibitedExternalActions: [
        "send_email",
        "write_document",
        "schedule_calendar_event",
        "create_task"
      ],
      statement: isCodingTool
        ? "Coding tool execution is scoped to the workspace root. Writes and commands require same-session authorization and are recorded for audit."
        : "Agent tool execution is recorded in SeekDesk without email, calendar, or external connector actions."
    },
    nextAction: null,
    metadata: {
      riskLevel: boundary.externalEffects.some((effect) => effect !== "none")
        ? "medium"
        : "low",
      permissionState: boundary.externalEffects.some((effect) => effect !== "none")
        ? "authorized_external_write"
        : "workspace_shared",
      externalEffects: boundary.externalEffects,
      ...metadata
    }
  };
}

function inferToolSafetyBoundary(
  outputJson: unknown,
  error: string | undefined
): { previewOnly: boolean; externalEffects: WorkflowExternalEffect[] } {
  if (error || !outputJson || typeof outputJson !== "object") {
    return {
      previewOnly: true,
      externalEffects: ["none"]
    };
  }

  const output = outputJson as Record<string, unknown>;
  const externalEffects = Array.isArray(output.externalEffects)
    ? output.externalEffects.filter(isWorkflowExternalEffect)
    : [];

  return {
    previewOnly: output.previewOnly !== false,
    externalEffects: externalEffects.length > 0 ? externalEffects : ["none"]
  };
}

function isWorkflowExternalEffect(value: unknown): value is WorkflowExternalEffect {
  return (
    value === "none" ||
    value === "send_email" ||
    value === "write_document" ||
    value === "schedule_calendar_event" ||
    value === "create_task" ||
    value === "workspace.file.write" ||
    value === "workspace.command.run"
  );
}

function inferToolArtifactIds(outputJson: unknown) {
  if (!outputJson || typeof outputJson !== "object") {
    return [];
  }

  const artifactId = (outputJson as { artifactId?: unknown }).artifactId;

  return typeof artifactId === "string" && artifactId.trim() ? [artifactId] : [];
}

function summarizeToolRequest(
  toolName: ToolCallRecord["name"],
  inputJson: unknown
) {
  return `Agent planned ${toolName} with ${summarizeJsonShape(inputJson)}.`;
}

function summarizeToolResult(
  toolName: ToolCallRecord["name"],
  outputJson: unknown,
  error: string | undefined
) {
  if (error) {
    return `Agent tool ${toolName} failed with ${error}.`;
  }

  if (!outputJson || typeof outputJson !== "object") {
    return `Agent tool ${toolName} completed.`;
  }

  const output = outputJson as Record<string, unknown>;
  if (typeof output.path === "string") {
    return `Agent tool ${toolName} completed for ${output.path}.`;
  }
  if (Array.isArray(output.entries)) {
    return `Agent tool ${toolName} listed ${output.entries.length} workspace entr${output.entries.length === 1 ? "y" : "ies"}.`;
  }
  if (Array.isArray(output.matches)) {
    return `Agent tool ${toolName} returned ${output.matches.length} search match${output.matches.length === 1 ? "" : "es"}.`;
  }
  if (typeof output.command === "string") {
    return `Agent tool ${toolName} ran command: ${output.command}.`;
  }
  if (typeof output.artifactId === "string") {
    return `Agent persisted local artifact ${output.artifactId}.`;
  }

  return `Agent tool ${toolName} completed.`;
}

function createToolActivityMetadata(input: {
  toolName: ToolCallRecord["name"];
  phase: "requested" | "running" | "completed" | "failed" | "cancelled";
  inputJson?: unknown;
  outputJson?: unknown;
  error?: string;
  runtimeMode?: ToolCallRecord["runtimeMode"];
  requestId?: string;
}) {
  const reference = inferReference(input.outputJson);

  return {
    toolName: input.toolName,
    toolPhase: input.phase,
    externalDataSummary: summarizeJsonShape(input.outputJson ?? input.inputJson),
    ...(reference ? { reference } : {}),
    provider: input.toolName.startsWith("coding.")
      ? input.runtimeMode ?? "server_local"
      : "local",
    ...(input.runtimeMode ? { runtimeMode: input.runtimeMode } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    previewOnly: inferPreviewOnly(input.outputJson, input.error),
    ...(input.error ? { error: input.error } : {})
  };
}

function createActivityTitle(phase: "requested" | "running" | "completed" | "failed" | "cancelled") {
  if (phase === "requested") {
    return "Agent tool planned";
  }
  if (phase === "running") {
    return "Agent tool running";
  }
  if (phase === "failed") {
    return "Agent tool failed";
  }
  if (phase === "cancelled") {
    return "Agent tool cancelled";
  }
  return "Agent tool completed";
}

function summarizeJsonShape(value: unknown) {
  if (!value || typeof value !== "object") {
    return "empty payload";
  }

  const keys = Object.keys(value as Record<string, unknown>).slice(0, 8);
  return keys.length ? `fields: ${keys.join(", ")}` : "empty object";
}

function inferReference(outputJson: unknown) {
  if (!outputJson || typeof outputJson !== "object") {
    return null;
  }

  const output = outputJson as Record<string, unknown>;
  if (typeof output.path === "string") {
    return output.path;
  }
  if (typeof output.command === "string") {
    return output.command;
  }
  if (typeof output.artifactId === "string") {
    return output.artifactId;
  }

  return null;
}

function inferPreviewOnly(outputJson: unknown, error: string | undefined) {
  if (error || !outputJson || typeof outputJson !== "object") {
    return true;
  }

  return (outputJson as { previewOnly?: unknown }).previewOnly !== false;
}
