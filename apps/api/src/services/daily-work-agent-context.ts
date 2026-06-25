import {
  dailyWorkToolNameSchema,
  type ChatContext,
  type ChatRequest,
  type DailyApprovalRequest,
  type DailyContextDocument,
  type DailyContextItem,
  type DailyWorkArtifact,
  type DailyWorkConnector,
  type DailyWorkSessionDetail,
  type DailyWorkTemplate,
  type DailyWorkToolName,
  type DailyWorkWorkflow,
  type ModelRoute,
  type ToolCallRecord,
  type ToolModelUsageRecord
} from "@seekdesk/shared";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";

export interface DailyWorkAgentContext {
  context: ChatContext;
  summaryLines: string[];
  template?: DailyWorkTemplate;
  modelRoute?: ModelRoute;
  allowedToolNames?: DailyWorkToolName[];
}

export async function createDailyWorkAgentContext(input: {
  repository: DailyWorkRepository;
  chatRequest: ChatRequest;
  sessionId: string;
  now?: Date;
}): Promise<DailyWorkAgentContext> {
  const context = normalizeChatContext(input.chatRequest.context);
  const [
    templates,
    contextItems,
    contextDocuments,
    artifacts,
    approvalRequests,
    connectors,
    workflows,
    sessionDetails,
    sessionToolCalls,
    sessionModelUsageRecords
  ] = await Promise.all([
    input.repository.listTemplates(),
    input.repository.listContextItems(),
    input.repository.listContextDocuments(),
    input.repository.listArtifacts(),
    input.repository.listApprovalRequests(),
    input.repository.listConnectors(),
    input.repository.listWorkflows(),
    input.repository.listSessionDetails(),
    input.repository.listToolCalls({ sessionId: input.sessionId, limit: 50 }),
    input.repository.listModelUsageRecords({
      sessionId: input.sessionId,
      limit: 50
    })
  ]);
  const activeSession = sessionDetails.find(
    (session) => session.id === input.sessionId
  );
  const activeTemplate = selectActiveTemplate(
    templates,
    input.chatRequest.templateId
  );
  const allowedToolNames = activeTemplate
    ? normalizeAllowedToolNames(activeTemplate.allowedToolNames)
    : undefined;
  const contextPolicy = activeTemplate?.contextPolicy;

  return {
    context,
    ...(activeTemplate ? { template: activeTemplate } : {}),
    ...(activeTemplate ? { modelRoute: activeTemplate.defaultModelRoute } : {}),
    ...(allowedToolNames ? { allowedToolNames } : {}),
    summaryLines: [
      "Daily-work repository context snapshot:",
      ...summarizeTemplateRuntime(activeTemplate, input.chatRequest.templateId),
      ...summarizeTemporalContext(context, input.now ?? new Date()),
      ...(contextPolicy?.includeRecentSession === false
        ? ["Session context: disabled by selected template context policy."]
        : [
            ...summarizeSession(activeSession),
            ...summarizeToolTrace(sessionToolCalls),
            ...summarizeModelUsage(sessionModelUsageRecords)
          ]),
      ...(contextPolicy?.includeSelectedContext === false
        ? [
            "Context items: disabled by selected template context policy.",
            "Uploaded context documents: disabled by selected template context policy."
          ]
        : [
            ...summarizeContextItems(contextItems, context.contextItemIds),
            ...summarizeContextDocuments(
              contextDocuments,
              context.contextItemIds,
              contextPolicy?.maxContextTokens
            )
          ]),
      ...(contextPolicy?.includeArtifacts === false
        ? ["Artifacts: disabled by selected template context policy."]
        : summarizeArtifacts(artifacts, context.artifactIds)),
      ...summarizeApprovals(approvalRequests, context.approvalRequestIds),
      ...summarizeConnectors(connectors, context.connectorIds),
      ...summarizeWorkflows(workflows, context.workflowIds),
      ...summarizeAllowedTools(allowedToolNames),
      "Tool planning hint: email and calendar connectors are removed in this build. Use coding_agent tools for local workspace inspection, edits, commands, git, and tests.",
      "Tool execution boundary: coding_agent writes and commands require same-session authorization and must stay inside the workspace root."
    ]
  };
}

function selectActiveTemplate(
  templates: DailyWorkTemplate[],
  templateId: string | undefined
) {
  if (!templateId) {
    return undefined;
  }

  return templates.find(
    (template) =>
      template.id === templateId &&
      template.mode === "daily_work" &&
      template.status === "active" &&
      template.enabled !== false
  );
}

function normalizeAllowedToolNames(values: string[]) {
  const allowed: DailyWorkToolName[] = [];

  for (const value of values) {
    const parsed = dailyWorkToolNameSchema.safeParse(value);
    if (parsed.success && !allowed.includes(parsed.data)) {
      allowed.push(parsed.data);
    }
  }

  return allowed;
}

function summarizeTemplateRuntime(
  template: DailyWorkTemplate | undefined,
  requestedTemplateId: string | undefined
) {
  if (!requestedTemplateId) {
    return [
      "Template runtime: no template selected; default daily_work orchestration applies."
    ];
  }

  if (!template) {
    return [
      `Template runtime: requested template ${requestedTemplateId} was not found or is not active; default daily_work orchestration applies.`
    ];
  }

  const lines = [
    `Template runtime: selected=${template.id}; title=${template.title}; category=${template.category}; version=${template.version}; modelRoute=${template.defaultModelRoute}.`,
    `Template base prompt: ${truncateText(template.prompt, 800)}`,
    `Template context policy: maxContextTokens=${template.contextPolicy.maxContextTokens}; includeSelectedContext=${template.contextPolicy.includeSelectedContext}; includeRecentSession=${template.contextPolicy.includeRecentSession}; includeArtifacts=${template.contextPolicy.includeArtifacts}.`
  ];

  if (template.systemPrompt.trim()) {
    lines.push(
      `Template system instruction: ${truncateText(template.systemPrompt, 1200)}`
    );
  }

  if (template.promptTemplate?.trim()) {
    lines.push(
      `Template prompt template: ${truncateText(template.promptTemplate, 1200)}`
    );
  }

  return lines;
}

function summarizeAllowedTools(allowedToolNames: DailyWorkToolName[] | undefined) {
  if (!allowedToolNames) {
    return [
      "Template tool policy: no template-specific whitelist; all daily_work preview tools remain available."
    ];
  }

  if (!allowedToolNames.length) {
    return [
      "Template tool policy: selected template allows no tools; respond without tool calls."
    ];
  }

  return [
    `Template tool policy: only these daily_work tools may be called: ${allowedToolNames.join(", ")}.`
  ];
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

  if (Array.isArray(output.entries)) {
    return `${output.entries.length} file tree entr${output.entries.length === 1 ? "y" : "ies"}`;
  }

  if (Array.isArray(output.matches)) {
    return `${output.matches.length} workspace search match${output.matches.length === 1 ? "" : "es"}`;
  }

  if (typeof output.content === "string") {
    return `file read ${typeof output.path === "string" ? output.path : "content"}`;
  }

  if (typeof output.diff === "string") {
    return "git diff captured";
  }

  if (typeof output.statusShort === "string" || typeof output.branch === "string") {
    return "git status captured";
  }

  if (typeof output.stdout === "string" || typeof output.stderr === "string") {
    const exitCode = typeof output.exitCode === "number" ? output.exitCode : "unknown";
    return `command completed with exit code ${exitCode}`;
  }

  if (typeof output.writtenPath === "string") {
    return `file written ${output.writtenPath}`;
  }

  if (typeof output.editedPath === "string") {
    return `file edited ${output.editedPath}`;
  }

  return `fields ${Object.keys(output).join(", ") || "none"}`;
}

function summarizeTemporalContext(context: ChatContext, now: Date) {
  return [
    `Current time: ${now.toISOString()}.`,
    `Requested locale/timezone: locale=${context.locale ?? "not provided"}; timezone=${context.timezone ?? "not provided"}.`,
    "Temporal planning: preserve explicit dates, times, versions, and file paths in the user request before planning coding tools."
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
  void connectors;
  void requestedIds;
  return ["Connectors: email and calendar connectors are removed in coding-agent mode."];
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
