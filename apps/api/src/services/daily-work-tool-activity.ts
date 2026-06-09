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
  const metadata = createToolActivityMetadata({
    toolName: input.toolName,
    phase: input.phase,
    inputJson: input.inputJson,
    outputJson: input.outputJson,
    connectorIds,
    ...(input.error ? { error: input.error } : {})
  });

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
      externalEffects: ["none"],
      ...metadata
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

  if (toolName.startsWith("outlook.calendar.")) {
    return ["team-calendar"];
  }

  if (toolName.startsWith("outlook.")) {
    return ["customer-email"];
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
    const provider = typeof output.provider === "string" ? output.provider : "";

    return provider === "outlook"
      ? `Agent read Outlook message metadata: ${output.messages.length} message result(s). Attachments and sends remained disabled.`
      : `Agent read Gmail thread metadata: ${output.messages.length} message metadata record(s). Attachments and sends remained disabled.`;
  }

  if (Array.isArray(output.events)) {
    const provider = typeof output.provider === "string" ? output.provider : "";

    return provider === "outlook_calendar"
      ? `Agent read Outlook Calendar metadata: ${output.events.length} event result(s). No calendar event was created or changed.`
      : `Agent read Google Calendar metadata: ${output.events.length} event result(s). No calendar event was created or changed.`;
  }

  if (output.draftPayloadPreview) {
    const provider = typeof output.provider === "string" ? output.provider : "";

    return provider === "outlook"
      ? "Agent created a local Outlook draft payload preview. SeekDesk did not call Microsoft Graph message create or send."
      : "Agent created a local Gmail draft payload preview. SeekDesk did not call Gmail drafts.create or send.";
  }

  if (output.eventPayloadPreview) {
    const provider = typeof output.provider === "string" ? output.provider : "";

    return provider === "outlook_calendar"
      ? "Agent created a local Outlook Calendar event JSON preview. SeekDesk did not call Microsoft Graph event create."
      : "Agent created a local Calendar event JSON preview. SeekDesk did not call Calendar events.insert.";
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

function createToolActivityMetadata(input: {
  toolName: ToolCallRecord["name"];
  phase: "requested" | "completed";
  inputJson?: unknown;
  outputJson?: unknown;
  connectorIds: string[];
  error?: string;
}) {
  const outputSummary = summarizeOutputForMetadata(input.outputJson, input.error);

  return {
    toolName: input.toolName,
    toolPhase: input.phase,
    inputFields: listJsonKeys(input.inputJson),
    ...(outputSummary.provider ? { provider: outputSummary.provider } : {}),
    externalDataSummary: outputSummary.externalDataSummary,
    ...(outputSummary.resultCount !== undefined
      ? { resultCount: outputSummary.resultCount }
      : {}),
    ...(outputSummary.reference ? { reference: outputSummary.reference } : {}),
    ...(input.connectorIds.length > 0
      ? { connectorId: input.connectorIds[0] }
      : {})
  };
}

function summarizeOutputForMetadata(outputJson: unknown, error: string | undefined) {
  if (error) {
    return {
      externalDataSummary: `Tool failed with ${error}; no external write was performed.`
    };
  }

  if (!outputJson || typeof outputJson !== "object") {
    return {
      externalDataSummary:
        outputJson === undefined
          ? "Tool result is pending."
          : "Tool completed with a structured preview result."
    };
  }

  const output = outputJson as Record<string, unknown>;
  const provider = typeof output.provider === "string" ? output.provider : undefined;

  if (Array.isArray(output.threads)) {
    return {
      provider,
      externalDataSummary: `${output.threads.length} Gmail thread metadata result(s).`,
      resultCount: output.threads.length,
      reference: firstReference(output.threads, "gmail-thread")
    };
  }

  if (Array.isArray(output.messages)) {
    if (provider === "outlook") {
      return {
        provider,
        externalDataSummary: `${output.messages.length} Outlook message metadata result(s).`,
        resultCount: output.messages.length,
        reference: firstReference(output.messages, "outlook-message")
      };
    }

    return {
      provider,
      externalDataSummary: `${output.messages.length} Gmail message metadata record(s).`,
      resultCount: output.messages.length,
      reference:
        typeof output.threadId === "string" && output.threadId.trim()
          ? `gmail-thread:${output.threadId}`
          : undefined
    };
  }

  if (Array.isArray(output.events)) {
    if (provider === "outlook_calendar") {
      return {
        provider,
        externalDataSummary: `${output.events.length} Outlook Calendar event metadata result(s).`,
        resultCount: output.events.length,
        reference: firstReference(output.events, "outlook-calendar-event")
      };
    }

    return {
      provider,
      externalDataSummary: `${output.events.length} Google Calendar event metadata result(s).`,
      resultCount: output.events.length,
      reference: firstReference(output.events, "calendar-event")
    };
  }

  if (output.draftPayloadPreview) {
    if (provider === "outlook") {
      return {
        provider,
        externalDataSummary:
          "Local Outlook draft payload preview; no Microsoft Graph message create or send call.",
        reference:
          typeof output.conversationId === "string" && output.conversationId.trim()
            ? `outlook-conversation:${output.conversationId}`
            : undefined
      };
    }

    return {
      provider,
      externalDataSummary:
        "Local Gmail draft payload preview; no Gmail drafts.create or send call.",
      reference:
        typeof output.threadId === "string" && output.threadId.trim()
          ? `gmail-thread:${output.threadId}`
          : undefined
    };
  }

  if (output.eventPayloadPreview) {
    if (provider === "outlook_calendar") {
      return {
        provider,
        externalDataSummary:
          "Local Outlook Calendar event JSON preview; no Microsoft Graph event create call.",
        reference:
          typeof output.calendarId === "string" && output.calendarId.trim()
            ? `outlook-calendar:${output.calendarId}`
            : undefined
      };
    }

    return {
      provider,
      externalDataSummary:
        "Local Calendar event JSON preview; no Calendar events.insert call.",
      reference:
        typeof output.calendarId === "string" && output.calendarId.trim()
          ? `calendar:${output.calendarId}`
          : undefined
    };
  }

  if (typeof output.artifactId === "string" && output.artifactId.trim()) {
    return {
      provider,
      externalDataSummary:
        "Local SeekDesk artifact persisted for review; no external provider write.",
      resultCount: 1,
      reference: `artifact:${output.artifactId}`
    };
  }

  return {
    provider,
    externalDataSummary: `Structured tool result fields: ${listJsonKeys(output).join(", ") || "none"}.`
  };
}

function listJsonKeys(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value as Record<string, unknown>);
}

function firstReference(values: unknown[], prefix: string) {
  const first = values
    .map((value) =>
      value && typeof value === "object"
        ? (value as { id?: unknown }).id
        : undefined
    )
    .find((id): id is string => typeof id === "string" && Boolean(id.trim()));

  return first ? `${prefix}:${first}` : undefined;
}
