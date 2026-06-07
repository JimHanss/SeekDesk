import type {
  ChatContext,
  ChatRequest,
  DailyApprovalRequest,
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
    artifacts,
    approvalRequests,
    connectors,
    workflows,
    sessionDetails,
    googleStatus,
    sessionToolCalls,
    sessionModelUsageRecords
  ] = await Promise.all([
    input.repository.listContextItems(),
    input.repository.listArtifacts(),
    input.repository.listApprovalRequests(),
    input.repository.listConnectors(),
    input.repository.listWorkflows(),
    input.repository.listSessionDetails(),
    getGoogleConnectionStatus({ repository: input.repository }),
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
      ...summarizeArtifacts(artifacts, context.artifactIds),
      ...summarizeApprovals(approvalRequests, context.approvalRequestIds),
      ...summarizeConnectors(connectors, context.connectorIds),
      ...summarizeGoogleAuthorization(googleStatus),
      ...summarizeWorkflows(workflows, context.workflowIds),
      "Tool planning hint: use gmail.search_threads before gmail.read_thread, use calendar.list_events for schedule or time-window questions, and use daily.persist_artifact for reviewable local work artifacts.",
      "Tool execution boundary: Gmail and Calendar read tools may use an authorized Google connector. Draft email and calendar event tools only create local payload previews; they must not send email or insert events."
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
    return `${output.messages.length} Gmail message metadata record(s)`;
  }

  if (Array.isArray(output.events)) {
    return `${output.events.length} calendar event result(s)`;
  }

  if (output.draftPayloadPreview) {
    return "local Gmail draft payload preview";
  }

  if (output.eventPayloadPreview) {
    return "local Calendar event payload preview";
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
      connector.provider === "google_calendar",
    5
  );

  if (!selected.length) {
    return ["Connectors: no Gmail or Calendar connector catalog entries found."];
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
