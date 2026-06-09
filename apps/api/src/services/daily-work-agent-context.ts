import type {
  ChatContext,
  ChatRequest,
  DailyApprovalRequest,
  DailyContextDocument,
  DailyContextItem,
  DailyWorkArtifact,
  DailyWorkConnector,
  DailyWorkSessionDetail,
  DailyWorkWorkflow,
  ToolCallRecord,
  ToolModelUsageRecord
} from "@seekdesk/shared";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import { getGoogleConnectionStatus } from "./google-connector-service.js";
import { getMicrosoftConnectionStatus } from "./microsoft-connector-service.js";

export interface DailyWorkAgentContext {
  context: ChatContext;
  summaryLines: string[];
}

export async function createDailyWorkAgentContext(input: {
  repository: DailyWorkRepository;
  chatRequest: ChatRequest;
  sessionId: string;
  now?: Date;
}): Promise<DailyWorkAgentContext> {
  const context = normalizeChatContext(input.chatRequest.context);
  const [
    contextItems,
    contextDocuments,
    artifacts,
    approvalRequests,
    connectors,
    workflows,
    sessionDetails,
    googleStatus,
    microsoftStatus,
    sessionToolCalls,
    sessionModelUsageRecords
  ] = await Promise.all([
    input.repository.listContextItems(),
    input.repository.listContextDocuments(),
    input.repository.listArtifacts(),
    input.repository.listApprovalRequests(),
    input.repository.listConnectors(),
    input.repository.listWorkflows(),
    input.repository.listSessionDetails(),
    getGoogleConnectionStatus({ repository: input.repository }),
    getMicrosoftConnectionStatus({ repository: input.repository }),
    input.repository.listToolCalls({ sessionId: input.sessionId, limit: 50 }),
    input.repository.listModelUsageRecords({
      sessionId: input.sessionId,
      limit: 50
    })
  ]);
  const activeSession = sessionDetails.find(
    (session) => session.id === input.sessionId
  );

  return {
    context,
    summaryLines: [
      "Daily-work repository context snapshot:",
      ...summarizeTemporalContext(context, input.now ?? new Date()),
      ...summarizeSession(activeSession),
      ...summarizeToolTrace(sessionToolCalls),
      ...summarizeModelUsage(sessionModelUsageRecords),
      ...summarizeContextItems(contextItems, context.contextItemIds),
      ...summarizeContextDocuments(contextDocuments, context.contextItemIds),
      ...summarizeArtifacts(artifacts, context.artifactIds),
      ...summarizeApprovals(approvalRequests, context.approvalRequestIds),
      ...summarizeConnectors(connectors, context.connectorIds),
      ...summarizeGoogleAuthorization(googleStatus),
      ...summarizeMicrosoftAuthorization(microsoftStatus),
      ...summarizeWorkflows(workflows, context.workflowIds),
      "Tool planning hint: use gmail.search_threads before gmail.read_thread for Google mail; use outlook.search_messages before outlook.read_message for Outlook mail; use calendar.list_events or outlook.calendar.list_events for schedule or time-window questions; use daily.persist_artifact for reviewable local work artifacts.",
      "Tool execution boundary: Gmail, Google Calendar, Outlook Mail, and Outlook Calendar read tools may use authorized connectors. Draft email and calendar event tools only create local payload previews; they must not send email or insert events."
    ]
  };
}

function normalizeChatContext(context: ChatContext | undefined): ChatContext {
  return {
    workspaceId: context?.workspaceId ?? "workspace-seekdesk",
    contextItemIds: uniqueStrings(context?.contextItemIds ?? []),
    artifactIds: uniqueStrings(context?.artifactIds ?? []),
    approvalRequestIds: uniqueStrings(context?.approvalRequestIds ?? []),
    connectorIds: uniqueStrings(context?.connectorIds ?? []),
    workflowIds: uniqueStrings(context?.workflowIds ?? []),
    ...(context?.locale ? { locale: context.locale } : {}),
    ...(context?.timezone ? { timezone: context.timezone } : {})
  };
}

function summarizeSession(session: DailyWorkSessionDetail | undefined) {
  if (!session) {
    return ["Session context: no existing session history found for this id."];
  }

  const lines = [
    `Session context: ${session.title}; status=${session.status}; messages=${session.messageCount}; summary=${truncateText(session.summary, 220)}`
  ];

  for (const message of session.recentMessages.slice(-4)) {
    lines.push(
      `Recent ${message.role} message: ${truncateText(message.content, 220)}`
    );
  }

  return lines;
}

function summarizeToolTrace(toolCalls: ToolCallRecord[]) {
  const recent = [...toolCalls]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-6);

  if (!recent.length) {
    return ["Recent agent tool trace: none for this session."];
  }

  return [
    "Recent agent tool trace:",
    ...recent.map(
      (toolCall) =>
        `Tool ${toolCall.name}: status=${toolCall.status}; previewOnly=${toolCall.previewOnly}; permissionRequired=${toolCall.permissionRequired}; input=${summarizeJsonKeys(toolCall.inputJson)}; result=${summarizeToolOutput(toolCall.outputJson)}${toolCall.error ? `; error=${toolCall.error}` : ""}`
    )
  ];
}

function summarizeModelUsage(records: ToolModelUsageRecord[]) {
  if (!records.length) {
    return ["Model usage in this session: no records yet."];
  }

  const latest = records.at(-1)!;
  const totalTokens = records.reduce((sum, record) => sum + record.totalTokens, 0);

  return [
    `Model usage in this session: records=${records.length}; latest=${latest.provider}/${latest.model}; totalTokens=${totalTokens}.`
  ];
}

function summarizeJsonKeys(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "none";
  }

  const keys = Object.keys(value);
  return keys.length ? keys.join(", ") : "empty";
}

function summarizeToolOutput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value === undefined ? "pending" : "structured output";
  }

  const output = value as Record<string, unknown>;

  if (typeof output.artifactId === "string" && output.artifactId.trim()) {
    return `artifact ${output.artifactId}`;
  }

  if (Array.isArray(output.threads)) {
    return `${output.threads.length} Gmail thread result(s)`;
  }

  if (Array.isArray(output.messages)) {
    return output.provider === "outlook"
      ? `${output.messages.length} Outlook message metadata record(s)`
      : `${output.messages.length} Gmail message metadata record(s)`;
  }

  if (Array.isArray(output.events)) {
    return output.provider === "outlook_calendar"
      ? `${output.events.length} Outlook calendar event result(s)`
      : `${output.events.length} calendar event result(s)`;
  }

  if (output.draftPayloadPreview) {
    return output.provider === "outlook"
      ? "local Outlook draft payload preview"
      : "local Gmail draft payload preview";
  }

  if (output.eventPayloadPreview) {
    return output.provider === "outlook_calendar"
      ? "local Outlook Calendar event payload preview"
      : "local Calendar event payload preview";
  }

  return `fields ${Object.keys(output).join(", ") || "none"}`;
}

function summarizeTemporalContext(context: ChatContext, now: Date) {
  return [
    `Current time: ${now.toISOString()}.`,
    `Requested locale/timezone: locale=${context.locale ?? "not provided"}; timezone=${context.timezone ?? "not provided"}.`,
    "Temporal planning: for requests like today, this morning, this week, or upcoming meetings, derive explicit ISO time windows before calling calendar.list_events."
  ];
}

function summarizeContextItems(
  items: DailyContextItem[],
  requestedIds: string[]
) {
  const selected = selectRequestedOrDefault(
    items,
    requestedIds,
    (item) =>
      item.permissionState === "public" ||
      item.permissionState === "workspace_shared",
    4
  );

  if (!selected.length) {
    return ["Context items: none selected."];
  }

  return [
    "Context items available to the agent:",
    ...selected.map(
      (item) =>
        `Context item ${item.id}: ${item.title}; source=${item.sourceType}; permission=${item.permissionState}; summary=${truncateText(item.summary, 240)}`
    )
  ];
}

function summarizeContextDocuments(
  documents: DailyContextDocument[],
  requestedContextItemIds: string[],
  maxTokens = 12000
) {
  const readyDocuments = documents.filter(
    (document) => document.status === "ready" && document.extractedText.trim()
  );
  if (!readyDocuments.length) {
    return ["Uploaded context documents: none available."];
  }

  const requested = new Set(requestedContextItemIds);
  const selected = [...readyDocuments].sort((a, b) => {
    const aRequested = requested.has(a.contextItemId) ? 0 : 1;
    const bRequested = requested.has(b.contextItemId) ? 0 : 1;
    if (aRequested !== bRequested) {
      return aRequested - bRequested;
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });
  const lines = [
    `Uploaded context documents: ${readyDocuments.length} ready; budget=${maxTokens} estimated tokens.`
  ];
  let usedTokens = 0;

  for (const document of selected) {
    if (usedTokens >= maxTokens) {
      lines.push("Uploaded context budget exhausted; remaining documents omitted.");
      break;
    }

    const remaining = maxTokens - usedTokens;
    const allowedChars = Math.max(0, remaining * 4);
    const text = document.extractedText.slice(0, allowedChars);
    const tokenEstimate = Math.min(document.tokenEstimate, estimateTokens(text));
    const truncated = text.length < document.extractedText.length;
    usedTokens += tokenEstimate;
    lines.push(
      `Document ${document.contextItemId}: title=${document.title}; file=${document.originalFileName}; type=${document.fileType}; tokens=${document.tokenEstimate}; selected=${requested.has(document.contextItemId)}; injectedTokens=${tokenEstimate}; truncated=${truncated}; preview=${truncateText(document.textPreview, 220)}`
    );
    if (text.trim()) {
      lines.push(`Document text excerpt ${document.contextItemId}: ${truncateText(text, 1800)}`);
    }
  }

  lines.push(`Uploaded context injected token estimate: ${usedTokens}/${maxTokens}.`);
  return lines;
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function summarizeArtifacts(
  artifacts: DailyWorkArtifact[],
  requestedIds: string[]
) {
  const selected = selectRequestedOrDefault(
    artifacts,
    requestedIds,
    (artifact) => artifact.status !== "archived",
    3
  );

  if (!selected.length) {
    return ["Artifacts: none selected."];
  }

  return [
    "Reviewable artifacts:",
    ...selected.map(
      (artifact) =>
        `Artifact ${artifact.id}: ${artifact.title}; type=${artifact.artifactType}; status=${artifact.status}; permission=${artifact.permissionState}; summary=${truncateText(artifact.summary, 220)}`
    )
  ];
}

function summarizeApprovals(
  approvals: DailyApprovalRequest[],
  requestedIds: string[]
) {
  const selected = selectRequestedOrDefault(
    approvals,
    requestedIds,
    (approval) => approval.status !== "approved",
    4
  );

  if (!selected.length) {
    return ["Approval gates: none selected."];
  }

  return [
    "Approval gates:",
    ...selected.map(
      (approval) =>
        `Approval ${approval.id}: ${approval.title}; status=${approval.status}; risk=${approval.riskLevel}; requiredPermission=${approval.requiredPermissionMode}; action=${approval.actionType}`
    )
  ];
}

function summarizeConnectors(
  connectors: DailyWorkConnector[],
  requestedIds: string[]
) {
  const selected = selectRequestedOrDefault(
    connectors,
    requestedIds,
    (connector) =>
      connector.provider === "gmail" ||
      connector.provider === "google_calendar" ||
      connector.provider === "outlook" ||
      connector.provider === "outlook_calendar",
    5
  );

  if (!selected.length) {
    return ["Connectors: no mail or calendar connector catalog entries found."];
  }

  return [
    "Connector state:",
    ...selected.map(
      (connector) =>
        `Connector ${connector.id}: ${connector.displayName}; provider=${connector.provider}; status=${connector.status}; permission=${connector.permissionState}; actions=${connector.availableActions.join(", ") || "none"}; approvals=${connector.requiredApprovalRequestIds.join(", ") || "none"}; notes=${truncateText(connector.notes.join(" "), 220)}`
    )
  ];
}

function summarizeGoogleAuthorization(
  status: Awaited<ReturnType<typeof getGoogleConnectionStatus>>
) {
  if (status.connected) {
    if (!status.scopesComplete) {
      const missingScopes = status.missingScopes.join(", ") || "unknown";

      return [
        `Google authorization: connected${status.accountEmail ? ` as ${status.accountEmail}` : ""}, but required scopes are incomplete. Missing scopes=${missingScopes}.`,
        "Google tool availability: do not call Gmail or Calendar read tools until OAuth is refreshed with all required scopes. Gmail draft and calendar event preview tools can still create local payload previews when the user provides all content."
      ];
    }

    return [
      `Google authorization: connected${status.accountEmail ? ` as ${status.accountEmail}` : ""}; scopes=${status.scopes.join(", ") || "unknown"}.`,
      "Google tool availability: gmail.search_threads, gmail.read_thread, and calendar.list_events may read authorized metadata. Gmail draft and calendar event tools remain local previews only."
    ];
  }

  const missingConfig = status.missingConfig?.length
    ? ` Missing config: ${status.missingConfig.join(", ")}.`
    : "";

  return [
    `Google authorization: not connected.${missingConfig}`,
    "Google tool availability: do not claim Gmail or Calendar data was read until OAuth is connected. If the user asks for Google data, explain that authorization is required or attempt the tool only when the request explicitly asks for connector verification."
  ];
}

function summarizeMicrosoftAuthorization(
  status: Awaited<ReturnType<typeof getMicrosoftConnectionStatus>>
) {
  if (status.connected) {
    if (!status.scopesComplete) {
      const missingScopes = status.missingScopes.join(", ") || "unknown";

      return [
        `Microsoft authorization: connected${status.accountEmail ? ` as ${status.accountEmail}` : ""}, but required scopes are incomplete. Missing scopes=${missingScopes}.`,
        "Microsoft tool availability: do not call Outlook Mail or Outlook Calendar read tools until OAuth is refreshed with all required scopes. Outlook draft and calendar event preview tools can still create local payload previews when the user provides all content."
      ];
    }

    return [
      `Microsoft authorization: connected${status.accountEmail ? ` as ${status.accountEmail}` : ""}; scopes=${status.scopes.join(", ") || "unknown"}.`,
      "Microsoft tool availability: outlook.search_messages, outlook.read_message, and outlook.calendar.list_events may read authorized metadata. Outlook draft and calendar event tools remain local previews only."
    ];
  }

  const missingConfig = status.missingConfig?.length
    ? ` Missing config: ${status.missingConfig.join(", ")}.`
    : "";

  return [
    `Microsoft authorization: not connected.${missingConfig}`,
    "Microsoft tool availability: do not claim Outlook Mail or Outlook Calendar data was read until OAuth is connected. If the user asks for Outlook data, explain that authorization is required or attempt the tool only when the request explicitly asks for connector verification."
  ];
}

function summarizeWorkflows(
  workflows: DailyWorkWorkflow[],
  requestedIds: string[]
) {
  const selected = selectRequestedOrDefault(
    workflows,
    requestedIds,
    (workflow) => workflow.status !== "blocked",
    3
  );

  if (!selected.length) {
    return ["Workflows: none selected."];
  }

  return [
    "Candidate workflows:",
    ...selected.map(
      (workflow) =>
        `Workflow ${workflow.id}: ${workflow.title}; status=${workflow.status}; queuedActions=${workflow.actionQueue.length}; description=${truncateText(workflow.description, 220)}`
    )
  ];
}

function selectRequestedOrDefault<T extends { id: string }>(
  values: T[],
  requestedIds: string[],
  isDefaultCandidate: (value: T) => boolean,
  limit: number
) {
  if (requestedIds.length > 0) {
    const requested = requestedIds
      .map((id) => values.find((value) => value.id === id))
      .filter((value): value is T => Boolean(value));

    return requested.slice(0, limit);
  }

  return values.filter(isDefaultCandidate).slice(0, limit);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}
