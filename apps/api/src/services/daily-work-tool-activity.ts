import type { DailyActivityEvent, ToolCallRecord } from "@seekdesk/shared";

export function createToolActivityEvent(input: {
  sessionId: string;
  toolName: ToolCallRecord["name"];
  status: "queued" | "completed" | "failed";
  timestamp: string;
  phase: "requested" | "completed";
  inputJson?: unknown;
  outputJson?: unknown;
  error?: string;
  toolCallId?: string;
}): DailyActivityEvent {
  const connectorIds = inferToolConnectorIds(input.toolName);
  const artifactIds = inferToolArtifactIds(input.outputJson);
  const isCompleted = input.phase === "completed";
  const summary = isCompleted
    ? summarizeToolResult(input.toolName, input.outputJson, input.error)
    : summarizeToolRequest(input.toolName, input.inputJson);

  return {
    id:
      `daily-event-agent-tool-${input.sessionId}-${input.toolCallId ?? input.toolName}-${input.phase}`,
    mode: "daily_work",
    eventType: isCompleted ? "workflow.preview.completed" : "workflow.preview.queued",
    status: input.status,
    timestamp: input.timestamp,
    title: isCompleted ? "Agent tool completed" : "Agent tool planned",
    summary,
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: [input.sessionId],
      templateIds: [],
      workflowIds: [],
      actionQueueItemIds: [],
      artifactIds,
      approvalRequestIds: [],
      connectorIds,
      contextItemIds: []
    },
    safetyBoundary: {
      previewOnly: true,
      externalEffects: ["none"],
      prohibitedExternalActions: [
        "send_email",
        "write_document",
        "schedule_calendar_event",
        "create_task"
      ],
      statement:
        "Agent tool execution is recorded in SeekDesk. Daily-work tools may read authorized connector data and produce local previews only."
    },
    nextAction: null,
    metadata: {
      riskLevel: connectorIds.length > 0 ? "medium" : "low",
      permissionState: connectorIds.length > 0 ? "requires_review" : "workspace_shared",
      externalEffects: ["none"]
    }
  };
}

function inferToolConnectorIds(toolName: ToolCallRecord["name"]) {
  if (toolName.startsWith("gmail.")) {
    return ["customer-email"];
  }

  if (toolName.startsWith("calendar.")) {
    return ["team-calendar"];
  }

  return [];
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
  return `Agent planned ${toolName} with ${summarizeJsonShape(inputJson)}. No external write was performed.`;
}

function summarizeToolResult(
  toolName: ToolCallRecord["name"],
  outputJson: unknown,
  error: string | undefined
) {
  if (error) {
    return `Agent tool ${toolName} failed with ${error}. No external write was performed.`;
  }

  if (!outputJson || typeof outputJson !== "object") {
    return `Agent tool ${toolName} completed in preview-only mode. No external write was performed.`;
  }

  const output = outputJson as Record<string, unknown>;

  if (Array.isArray(output.threads)) {
    return `Agent read Gmail thread metadata: ${output.threads.length} thread result(s). No email was sent or modified.`;
  }

  if (Array.isArray(output.messages)) {
    return `Agent read Gmail thread metadata: ${output.messages.length} message metadata record(s). Attachments and sends remained disabled.`;
  }

  if (Array.isArray(output.events)) {
    return `Agent read Google Calendar metadata: ${output.events.length} event result(s). No calendar event was created or changed.`;
  }

  if (output.draftPayloadPreview) {
    return "Agent created a local Gmail draft payload preview. SeekDesk did not call Gmail drafts.create or send.";
  }

  if (output.eventPayloadPreview) {
    return "Agent created a local Calendar event JSON preview. SeekDesk did not call Calendar events.insert.";
  }

  if (typeof output.artifactId === "string") {
    return `Agent persisted local artifact ${output.artifactId} for review. No external provider write occurred.`;
  }

  return `Agent tool ${toolName} completed in preview-only mode. No external write was performed.`;
}

function summarizeJsonShape(value: unknown) {
  if (!value || typeof value !== "object") {
    return "no structured input";
  }

  const keys = Object.keys(value as Record<string, unknown>);

  return keys.length ? `input fields: ${keys.join(", ")}` : "empty input";
}
