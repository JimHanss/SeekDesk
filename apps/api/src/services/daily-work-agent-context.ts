import type {
  ChatContext,
  ChatRequest,
  DailyApprovalRequest,
  DailyContextItem,
  DailyWorkArtifact,
  DailyWorkConnector,
  DailyWorkSessionDetail,
  DailyWorkWorkflow
} from "@seekdesk/shared";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";

export interface DailyWorkAgentContext {
  context: ChatContext;
  summaryLines: string[];
}

export async function createDailyWorkAgentContext(input: {
  repository: DailyWorkRepository;
  chatRequest: ChatRequest;
  sessionId: string;
}): Promise<DailyWorkAgentContext> {
  const context = normalizeChatContext(input.chatRequest.context);
  const [
    contextItems,
    artifacts,
    approvalRequests,
    connectors,
    workflows,
    sessionDetails
  ] = await Promise.all([
    input.repository.listContextItems(),
    input.repository.listArtifacts(),
    input.repository.listApprovalRequests(),
    input.repository.listConnectors(),
    input.repository.listWorkflows(),
    input.repository.listSessionDetails()
  ]);
  const activeSession = sessionDetails.find(
    (session) => session.id === input.sessionId
  );

  return {
    context,
    summaryLines: [
      "Daily-work repository context snapshot:",
      ...summarizeSession(activeSession),
      ...summarizeContextItems(contextItems, context.contextItemIds),
      ...summarizeArtifacts(artifacts, context.artifactIds),
      ...summarizeApprovals(approvalRequests, context.approvalRequestIds),
      ...summarizeConnectors(connectors, context.connectorIds),
      ...summarizeWorkflows(workflows, context.workflowIds),
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
