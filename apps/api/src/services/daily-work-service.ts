import {
  appModeSchema,
  createDailyModelUsageResponse,
  type ArtifactType,
  type AppMode,
  type ApprovalDecision,
  type ApprovalDecisionInput,
  type ConnectorAction,
  type ConnectorActionPreviewResponse,
  type DailyActivityEvent,
  type DailyApprovalDecisionResponse,
  type DailyApprovalRequest,
  type DailyContextItem,
  type DailyContextUsePreviewResponse,
  type DailyModelUsageResponse,
  type DailyWorkConnector,
  type DailyWorkSessionDetail,
  type DailyWorkSessionMessage,
  type DailyWorkSessionRestorePreviewResponse,
  type DailyWorkTemplate,
  type DailyWorkTemplateApplyPreviewResponse,
  type DailyWorkWorkflow,
  type ModelRoute,
  type ToolModelUsageRecord,
  type DailyWorkWorkflowPreviewResponse,
  type WorkflowActionQueueItem,
  type WorkflowLinkedContext
} from "@seekdesk/shared";
import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
export function normalizeAppMode(mode: unknown): AppMode {
  const parsed = appModeSchema.safeParse(mode);
  return parsed.success ? parsed.data : "daily_work";
}

export function createValidationError(
  error: string,
  issues: Array<{ path: PropertyKey[]; message: string }>
) {
  return {
    error,
    issues: issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message
    }))
  };
}

export function createDailyContextUsePreviewResponse(input: {
  mode: AppMode;
  contextItem: DailyContextItem;
  prompt?: string;
  templateId?: string;
}): DailyContextUsePreviewResponse {
  const requiredApprovalRequestIds = getContextUseApprovalRequestIds(
    input.contextItem
  );
  const promptDraft = createDailyContextUsePreviewPrompt({
    contextItem: input.contextItem,
    requiredApprovalRequestIds,
    ...(input.prompt ? { prompt: input.prompt } : {}),
    ...(input.templateId ? { templateId: input.templateId } : {})
  });

  return {
    mode: input.mode,
    preview: {
      id: `${input.contextItem.id}:use-preview`,
      mode: input.mode,
      contextItemId: input.contextItem.id,
      title: input.contextItem.title,
      sourceType: input.contextItem.sourceType,
      permissionState: input.contextItem.permissionState,
      tags: input.contextItem.tags,
      promptDraft,
      ...(input.templateId ? { templateId: input.templateId } : {}),
      requiredApprovalRequestIds,
      steps: createDailyContextUsePreviewSteps({
        contextItem: input.contextItem,
        requiredApprovalRequestIds
      }),
      previewOnly: true,
      externalEffects: ["none"],
      safetyBoundary: {
        previewOnly: true,
        externalEffects: ["none"],
        prohibitedExternalActions: [
          "send_email",
          "write_document",
          "schedule_calendar_event",
          "create_task",
          "read_private_external_data",
          "read_real_file_content",
          "read_real_email_content",
          "read_real_notes_content"
        ],
        statement:
          "Preview-only context use: SeekDesk uses stored daily_work context metadata to draft a prompt. It does not read real files, emails, notes, or private external data, and it performs no external effects such as sending, writing, scheduling, or task creation."
      },
      generatedAt: new Date().toISOString()
    }
  };
}

export function createContextUsePreviewActivityEvent(input: {
  mode: AppMode;
  contextItem: DailyContextItem;
  response: DailyContextUsePreviewResponse;
}): DailyActivityEvent {
  const generatedAt = input.response.preview.generatedAt;
  const approvalRequestIds = input.response.preview.requiredApprovalRequestIds;

  return {
    id: `daily-event-context-${input.contextItem.id}-use-preview`,
    mode: input.mode,
    eventType: "workflow.preview.completed",
    status: "completed",
    timestamp: generatedAt,
    title: "Context preview generated",
    summary:
      `Generated a preview-only prompt draft for ${input.contextItem.title}; no real files, emails, notes, or private external data were read.`,
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: [],
      templateIds: input.response.preview.templateId
        ? [input.response.preview.templateId]
        : [],
      workflowIds: [],
      actionQueueItemIds: [],
      artifactIds: [],
      approvalRequestIds,
      connectorIds: [],
      contextItemIds: [input.contextItem.id]
    },
    safetyBoundary: createPersistedActivitySafetyBoundary(
      "Context preview write-back records metadata only and performs no external effects."
    ),
    nextAction: {
      label: "Review context preview",
      description:
        approvalRequestIds.length > 0
          ? `Review approval gates before using ${input.contextItem.title}.`
          : `Use ${input.contextItem.title} metadata in the next safe daily-work response.`,
      targetType: "context",
      targetId: input.contextItem.id,
      requiredStatus:
        approvalRequestIds.length > 0 ? "waiting_for_approval" : "completed"
    },
    taskStatus: {
      approvalStatus: approvalRequestIds.length > 0 ? "pending" : undefined
    },
    metadata: {
      riskLevel: contextRiskLevel(input.contextItem),
      permissionState: contextPermissionState(input.contextItem),
      externalEffects: ["none"]
    }
  };
}

function createDailyContextUsePreviewPrompt(input: {
  contextItem: DailyContextItem;
  requiredApprovalRequestIds: string[];
  prompt?: string;
  templateId?: string;
}) {
  const userPrompt = input.prompt
    ? `User prompt: ${input.prompt}`
    : "User prompt: use this context metadata to ask for the next safe daily-work step before drafting.";

  return [
    "Use SeekDesk daily_work context as a preview only.",
    `Context item id: ${input.contextItem.id}`,
    `Context title: ${input.contextItem.title}`,
    `Source type: ${input.contextItem.sourceType}`,
    `Permission state: ${input.contextItem.permissionState}`,
    `Tags: ${joinSessionRefIds(input.contextItem.tags)}`,
    `Template id: ${input.templateId ?? "none"}`,
    `Required approval request ids: ${joinSessionRefIds(input.requiredApprovalRequestIds)}`,
    "Safety boundary: previewOnly=true; externalEffects=[none]; no external effects; do not read real files, emails, notes, or private external data; do not send email, write documents, schedule calendar events, or create tasks.",
    userPrompt
  ].join("\n");
}

function createDailyContextUsePreviewSteps(input: {
  contextItem: DailyContextItem;
  requiredApprovalRequestIds: string[];
}) {
  return [
    {
      id: `${input.contextItem.id}:use-preview:step-1`,
      title: "Resolve context metadata",
      description:
        `Load metadata for ${input.contextItem.title} without reading the underlying ${input.contextItem.sourceType} content.`,
      previewOnly: true as const,
      externalEffect: "none" as const
    },
    {
      id: `${input.contextItem.id}:use-preview:step-2`,
      title: "Check permission boundary",
      description:
        `Apply permissionState=${input.contextItem.permissionState} and keep approval requirements visible before any real context access.`,
      previewOnly: true as const,
      externalEffect: "none" as const
    },
    {
      id: `${input.contextItem.id}:use-preview:step-3`,
      title: "Draft context-use prompt",
      description:
        "Create an in-response daily_work prompt draft that references metadata only and does not read real files, emails, or notes.",
      previewOnly: true as const,
      externalEffect: "none" as const
    },
    {
      id: `${input.contextItem.id}:use-preview:step-4`,
      title: "Hold for review",
      description:
        input.requiredApprovalRequestIds.length > 0
          ? `Surface approval gates: ${joinSessionRefIds(input.requiredApprovalRequestIds)}.`
          : "No approval request is required for this context-use preview, and no external action is executed.",
      previewOnly: true as const,
      externalEffect: "none" as const
    }
  ];
}

function getContextUseApprovalRequestIds(contextItem: DailyContextItem) {
  const approvalRequestIds: string[] = [];

  if (
    contextItem.id === "customer-email" ||
    contextItem.sourceType === "customer_email"
  ) {
    approvalRequestIds.push("read-customer-email-context");
  }

  if (
    contextItem.id === "meeting-notes" ||
    contextItem.id === "team-notes" ||
    contextItem.sourceType === "meeting_notes" ||
    contextItem.sourceType === "team_notes"
  ) {
    approvalRequestIds.push("use-internal-meeting-notes");
  }

  if (
    (contextItem.permissionState === "requires_review" ||
      contextItem.permissionState === "restricted") &&
    approvalRequestIds.length === 0
  ) {
    approvalRequestIds.push("read-customer-email-context");
  }

  return uniqueStrings(approvalRequestIds);
}

export function createDailyWorkTemplateApplyPreviewResponse(input: {
  mode: AppMode;
  template: DailyWorkTemplate;
  contextItemIds: string[];
  prompt?: string;
}): DailyWorkTemplateApplyPreviewResponse {
  const requestedContextItemIds = uniqueStrings(input.contextItemIds);
  const suggestedArtifactType =
    input.template.artifactType ?? suggestArtifactType(input.template.category);
  const requiredApprovalRequestIds =
    getTemplateApplyApprovalRequestIds(input.template);
  const promptDraft = createDailyWorkTemplateApplyPrompt({
    template: input.template,
    suggestedArtifactType,
    requestedContextItemIds,
    requiredApprovalRequestIds,
    ...(input.prompt ? { prompt: input.prompt } : {})
  });

  return {
    mode: input.mode,
    preview: {
      id: `${input.template.id}:apply-preview`,
      mode: input.mode,
      templateId: input.template.id,
      templateTitle: input.template.title,
      category: input.template.category,
      ...(input.template.artifactType
        ? { artifactType: input.template.artifactType }
        : {}),
      promptDraft,
      requestedContextItemIds,
      suggestedArtifactType,
      requiredApprovalRequestIds,
      steps: createDailyWorkTemplateApplyPreviewSteps({
        template: input.template,
        suggestedArtifactType,
        requestedContextItemIds,
        requiredApprovalRequestIds
      }),
      previewOnly: true,
      externalEffects: ["none"],
      safetyBoundary: {
        previewOnly: true,
        externalEffects: ["none"],
        prohibitedExternalActions: [
          "send_email",
          "write_document",
          "schedule_calendar_event",
          "create_task",
          "read_private_external_data",
          "create_artifact"
        ],
        statement:
          "Preview-only template application: SeekDesk drafts the daily_work prompt and artifact plan in the response only. It creates no artifact, reads no private external data, sends no email, writes no document, schedules no calendar event, and creates no task."
      },
      generatedAt: new Date().toISOString()
    }
  };
}

export function createTemplateApplyPreviewActivityEvent(input: {
  mode: AppMode;
  template: DailyWorkTemplate;
  response: DailyWorkTemplateApplyPreviewResponse;
}): DailyActivityEvent {
  const preview = input.response.preview;
  const approvalRequestIds = preview.requiredApprovalRequestIds;

  return {
    id: `daily-event-template-${input.template.id}-apply-preview`,
    mode: input.mode,
    eventType: "template.applied",
    status: "completed",
    timestamp: preview.generatedAt,
    title: "Template preview generated",
    summary:
      `Generated a preview-only apply plan for ${input.template.title}; no artifact was created and no external action was performed.`,
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: [],
      templateIds: [input.template.id],
      workflowIds: [],
      actionQueueItemIds: [],
      artifactIds: [],
      approvalRequestIds,
      connectorIds: [],
      contextItemIds: preview.requestedContextItemIds
    },
    safetyBoundary: createPersistedActivitySafetyBoundary(
      "Template apply preview write-back records the generated plan only and does not create artifacts or perform external effects."
    ),
    nextAction: {
      label: "Review template preview",
      description:
        approvalRequestIds.length > 0
          ? `Review approval gates before applying ${input.template.title}.`
          : `Review the ${preview.suggestedArtifactType} plan before drafting.`,
      targetType: "template",
      targetId: input.template.id,
      requiredStatus:
        approvalRequestIds.length > 0 ? "waiting_for_approval" : "completed"
    },
    taskStatus: {
      workflowStatus: "preview",
      approvalStatus: approvalRequestIds.length > 0 ? "pending" : undefined
    },
    metadata: {
      riskLevel: approvalRequestIds.length > 0 ? "high" : "low",
      permissionState:
        approvalRequestIds.length > 0
          ? "requires_explicit_approval"
          : "workspace_shared",
      externalEffects: ["none"],
      artifactType: preview.suggestedArtifactType
    }
  };
}

function createDailyWorkTemplateApplyPrompt(input: {
  template: DailyWorkTemplate;
  suggestedArtifactType: ArtifactType;
  requestedContextItemIds: string[];
  requiredApprovalRequestIds: string[];
  prompt?: string;
}) {
  const templateArtifactType = input.template.artifactType ?? "unspecified";
  const userPrompt = input.prompt
    ? `User prompt: ${input.prompt}`
    : "User prompt: apply the template with the provided context and ask for missing inputs before drafting.";

  return [
    "Apply SeekDesk daily_work template as a preview only.",
    `Template id: ${input.template.id}`,
    `Template title: ${input.template.title}`,
    `Category: ${input.template.category}`,
    `Template artifact type: ${templateArtifactType}`,
    `Suggested artifact type: ${input.suggestedArtifactType}`,
    `Requested context item ids: ${joinSessionRefIds(input.requestedContextItemIds)}`,
    `Required approval request ids: ${joinSessionRefIds(input.requiredApprovalRequestIds)}`,
    "Safety boundary: previewOnly=true; externalEffects=[none]; no external effects; do not create artifacts, send email, write documents, schedule calendar events, create tasks, or read private external data.",
    `Template prompt: ${input.template.prompt}`,
    userPrompt
  ].join("\n");
}

function createDailyWorkTemplateApplyPreviewSteps(input: {
  template: DailyWorkTemplate;
  suggestedArtifactType: ArtifactType;
  requestedContextItemIds: string[];
  requiredApprovalRequestIds: string[];
}) {
  return [
    {
      id: `${input.template.id}:apply-preview:step-1`,
      title: "Resolve template",
      description:
        `Load metadata for ${input.template.title} and keep the action scoped to daily_work preview mode.`,
      previewOnly: true as const,
      externalEffect: "none" as const
    },
    {
      id: `${input.template.id}:apply-preview:step-2`,
      title: "Bind context",
      description:
        `Attach requested context ids: ${joinSessionRefIds(input.requestedContextItemIds)}.`,
      previewOnly: true as const,
      externalEffect: "none" as const
    },
    {
      id: `${input.template.id}:apply-preview:step-3`,
      title: "Draft artifact plan",
      description:
        `Prepare an in-response ${input.suggestedArtifactType} draft plan without creating an artifact record.`,
      previewOnly: true as const,
      externalEffect: "none" as const
    },
    {
      id: `${input.template.id}:apply-preview:step-4`,
      title: "Hold for review",
      description:
        input.requiredApprovalRequestIds.length > 0
          ? `Surface approval gates: ${joinSessionRefIds(input.requiredApprovalRequestIds)}.`
          : "No approval request is required for this preview, and no external action is executed.",
      previewOnly: true as const,
      externalEffect: "none" as const
    }
  ];
}

function getTemplateApplyApprovalRequestIds(template: DailyWorkTemplate) {
  if (template.id === "email-draft" || template.artifactType === "email_draft") {
    return ["draft-external-reply"];
  }

  if (
    template.id === "meeting-summary" ||
    template.artifactType === "meeting_summary"
  ) {
    return ["use-internal-meeting-notes"];
  }

  if (template.tags.includes("calendar")) {
    return ["schedule-calendar-follow-up"];
  }

  return [];
}

function suggestArtifactType(
  category: DailyWorkTemplate["category"]
): ArtifactType {
  const categorySuggestions: Record<
    DailyWorkTemplate["category"],
    ArtifactType
  > = {
    triage: "brief",
    planning: "task_list",
    execution: "checklist",
    review: "status_update",
    handoff: "handoff_note",
    writing: "email_draft",
    research: "research_note",
    knowledge: "brief"
  };

  return categorySuggestions[category];
}

export function createConnectorActionPreviewResponse(input: {
  mode: AppMode;
  connector: DailyWorkConnector;
  action: ConnectorAction;
  contextItemIds: string[];
  prompt?: string;
}): ConnectorActionPreviewResponse {
  const actionCopy = connectorActionPreviewCopy[input.action];
  const relatedContextItemIds = uniqueStrings([
    ...input.connector.relatedContextItemIds,
    ...input.contextItemIds
  ]);

  return {
    mode: input.mode,
    preview: {
      id: `${input.connector.id}:${input.action}:preview`,
      mode: input.mode,
      connectorId: input.connector.id,
      connectorDisplayName: input.connector.displayName,
      action: input.action,
      previewOnly: true,
      permissionState: input.connector.permissionState,
      riskLevel: input.connector.riskLevel,
      relatedContextItemIds,
      requiredApprovalRequestIds: input.connector.requiredApprovalRequestIds,
      ...(input.prompt ? { prompt: input.prompt } : {}),
      summary: actionCopy.summary(input.connector.displayName),
      steps: actionCopy.steps.map((step, index) => ({
        id: `${input.connector.id}:${input.action}:step-${index + 1}`,
        title: step.title,
        description: step.description(input.connector.displayName),
        externalEffect: "none" as const
      })),
      safetyBoundary: {
        previewOnly: true,
        externalEffects: ["none"],
        prohibitedExternalActions: [
          "send_email",
          "write_document",
          "schedule_calendar_event",
          "create_task",
          "read_private_external_data"
        ],
        statement:
          "Preview only: SeekDesk describes the connector action plan but does not read private external data, send, write, schedule, or create records."
      }
    }
  };
}

export function createConnectorActionPreviewActivityEvent(input: {
  mode: AppMode;
  connector: DailyWorkConnector;
  response: ConnectorActionPreviewResponse;
}): DailyActivityEvent {
  const preview = input.response.preview;
  const approvalRequestIds = preview.requiredApprovalRequestIds;

  return {
    id: `daily-event-connector-${input.connector.id}-${preview.action}-preview`,
    mode: input.mode,
    eventType: "workflow.preview.completed",
    status: "completed",
    timestamp: new Date().toISOString(),
    title: "Connector preview generated",
    summary:
      `Generated a preview-only ${preview.action} plan for ${input.connector.displayName}; no connector call, external read, send, write, schedule, or task creation was performed.`,
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: [],
      templateIds: [],
      workflowIds: [],
      actionQueueItemIds: [],
      artifactIds: [],
      approvalRequestIds,
      connectorIds: [input.connector.id],
      contextItemIds: preview.relatedContextItemIds
    },
    safetyBoundary: createPersistedActivitySafetyBoundary(
      "Connector preview write-back records the simulated connector plan only and performs no external connector action."
    ),
    nextAction: {
      label: "Review connector preview",
      description:
        approvalRequestIds.length > 0
          ? `Review approval gates before using ${input.connector.displayName}.`
          : `Use the ${input.connector.displayName} preview plan in the next daily-work step.`,
      targetType: "connector",
      targetId: input.connector.id,
      requiredStatus:
        approvalRequestIds.length > 0 ? "waiting_for_approval" : "completed"
    },
    taskStatus: {
      workflowStatus: "preview",
      approvalStatus: approvalRequestIds.length > 0 ? "pending" : undefined
    },
    metadata: {
      riskLevel: input.connector.riskLevel,
      permissionState: input.connector.permissionState,
      externalEffects: ["none"]
    }
  };
}

export function createDailyWorkWorkflowPreviewResponse(input: {
  mode: AppMode;
  workflow: DailyWorkWorkflow;
  selectedAction: WorkflowActionQueueItem;
  selectedActionOnly: boolean;
  contextItems: DailyContextItem[];
  contextItemIds: string[];
  prompt?: string;
}): DailyWorkWorkflowPreviewResponse {
  const requestedContextItemIds = uniqueStrings(input.contextItemIds);
  const requestedContextLinks = createRequestedWorkflowContextLinks(
    requestedContextItemIds,
    input.contextItems
  );
  const previewActions = input.selectedActionOnly
    ? [input.selectedAction]
    : input.workflow.actionQueue;
  const connectorLinks = uniqueBy(
    [
      ...input.workflow.connectorLinks,
      ...previewActions.flatMap((action) => action.connectorLinks)
    ],
    (link) => `${link.connectorId}:${link.action}`
  );
  const contextLinks = uniqueBy(
    [
      ...input.workflow.contextLinks,
      ...previewActions.flatMap((action) => action.contextLinks),
      ...requestedContextLinks
    ],
    (link) => `${link.contextItemId}:${link.usage}`
  );
  const artifactLinks = uniqueBy(
    [
      ...input.workflow.artifactLinks,
      ...previewActions.flatMap((action) => action.artifactLinks)
    ],
    (link) => link.artifactId
  );
  const approvalLinks = uniqueBy(
    [
      ...input.workflow.approvalLinks,
      ...previewActions.flatMap((action) => action.approvalLinks)
    ],
    (link) => link.approvalRequestId
  );
  const steps = previewActions.map((action, index) =>
    createWorkflowPreviewStep(action, index)
  );
  const selectedActionLabel = input.selectedActionOnly
    ? `selected action "${input.selectedAction.title}"`
    : `${steps.length} queued workflow step${steps.length === 1 ? "" : "s"}`;

  return {
    mode: input.mode,
    preview: {
      id: `${input.workflow.id}:${input.selectedAction.id}:preview`,
      mode: input.mode,
      workflowId: input.workflow.id,
      workflowTitle: input.workflow.title,
      selectedActionId: input.selectedAction.id,
      selectedActionType: input.selectedAction.actionType,
      selectedActionStatus: input.selectedAction.status,
      previewOnly: true,
      externalEffects: ["none"],
      ...(input.prompt ? { prompt: input.prompt } : {}),
      requestedContextItemIds,
      summary:
        `${input.workflow.title} preview for ${selectedActionLabel}. ` +
        `${input.selectedAction.preview.summary} No connector action, external write, calendar update, email send, or task creation is performed.`,
      steps,
      connectorLinks,
      contextLinks,
      artifactLinks,
      approvalLinks,
      safetyBoundary: {
        ...input.workflow.safetyBoundary,
        previewOnly: true,
        externalEffects: ["none"]
      }
    }
  };
}

export function createWorkflowPreviewActivityEvent(input: {
  mode: AppMode;
  workflow: DailyWorkWorkflow;
  response: DailyWorkWorkflowPreviewResponse;
}): DailyActivityEvent {
  const preview = input.response.preview;
  const selectedStep = preview.steps.find(
    (step) => step.actionId === preview.selectedActionId
  );
  const artifactType = preview.artifactLinks[0]?.artifactType;
  const approvalStatus = workflowPreviewApprovalStatus(preview.approvalLinks);
  const approvalRequestIds = uniqueStrings(
    preview.approvalLinks.map((link) => link.approvalRequestId)
  );
  const actionQueueItemIds = uniqueStrings(
    preview.steps.map((step) => step.actionId)
  );

  return {
    id: `daily-event-workflow-${input.workflow.id}-${preview.selectedActionId}-preview`,
    mode: input.mode,
    eventType: "workflow.preview.completed",
    status: "completed",
    timestamp: new Date().toISOString(),
    title: "Workflow preview generated",
    summary:
      `${preview.summary} Preview write-back recorded workflow, action, context, artifact, and approval references only.`,
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: [],
      templateIds: [],
      workflowIds: [preview.workflowId],
      actionQueueItemIds,
      artifactIds: uniqueStrings(
        preview.artifactLinks.map((link) => link.artifactId)
      ),
      approvalRequestIds,
      connectorIds: uniqueStrings(
        preview.connectorLinks.map((link) => link.connectorId)
      ),
      contextItemIds: uniqueStrings([
        ...preview.contextLinks.map((link) => link.contextItemId),
        ...preview.requestedContextItemIds
      ])
    },
    safetyBoundary: createPersistedActivitySafetyBoundary(
      "Workflow preview write-back records local preview references only and performs no external workflow action."
    ),
    nextAction: {
      label: "Review workflow preview",
      description:
        approvalStatus === "pending"
          ? "Review approval gates before continuing the preview workflow."
          : "Review the workflow preview and decide the next local daily-work step.",
      targetType: "workflow",
      targetId: preview.workflowId,
      requiredStatus:
        approvalStatus === "pending" ? "waiting_for_approval" : "completed"
    },
    taskStatus: {
      workflowStatus: input.workflow.status,
      actionQueueStatus: preview.selectedActionStatus,
      artifactStatus: preview.artifactLinks[0]?.status,
      approvalStatus
    },
    metadata: {
      riskLevel: selectedStep?.riskLevel ?? "low",
      permissionState: selectedStep?.permissionState ?? "workspace_shared",
      externalEffects: ["none"],
      ...(artifactType ? { artifactType } : {})
    }
  };
}

export function createDailyWorkSessionRestorePreviewResponse(input: {
  mode: AppMode;
  session: DailyWorkSessionDetail;
  includeRecentMessages: boolean;
  prompt?: string;
}): DailyWorkSessionRestorePreviewResponse {
  const generatedAt = new Date().toISOString();
  const restorePrompt = createDailyWorkSessionRestorePrompt(input);

  return {
    mode: input.mode,
    preview: {
      id: `${input.session.id}:restore-preview`,
      mode: input.mode,
      sessionId: input.session.id,
      sessionTitle: input.session.title,
      status: input.session.status,
      summary: input.session.summary,
      lastAction: input.session.lastAction,
      restorePrompt,
      artifactIds: input.session.artifactIds,
      contextItemIds: input.session.contextItemIds,
      approvalRequestIds: input.session.approvalRequestIds,
      ...(input.includeRecentMessages
        ? {
            recentMessagesPreview: input.session.recentMessages
              .slice(-3)
              .map(createRecentMessagePreview)
          }
        : {}),
      previewOnly: true,
      externalEffects: ["none"],
      safetyBoundary: {
        previewOnly: true,
        externalEffects: ["none"],
        prohibitedExternalActions: [
          "send_email",
          "write_document",
          "schedule_calendar_event",
          "create_task",
          "read_private_external_data",
          "resume_real_execution"
        ],
        statement:
          "Preview-only restore: SeekDesk generates a daily_work prompt from stored session metadata and optional recent-message snippets. It performs no external effects and does not resume execution, read private external data, send, write, schedule, or create records."
      },
      generatedAt
    }
  };
}

export function createSessionRestoreWriteback(input: {
  session: DailyWorkSessionDetail;
  response: DailyWorkSessionRestorePreviewResponse;
}): DailyWorkSessionDetail {
  const generatedAt = input.response.preview.generatedAt;
  const approvalRequestId = input.session.approvalRequestIds[0];
  const artifactId = input.session.artifactIds[0];

  return {
    ...input.session,
    updatedAt: generatedAt,
    lastAction: {
      at: generatedAt,
      actor: "daily-work-agent",
      label: "Generated restore preview.",
      ...(artifactId ? { artifactId } : {}),
      ...(approvalRequestId ? { approvalRequestId } : {})
    }
  };
}

export function createSessionRestoreActivityEvent(input: {
  mode: AppMode;
  session: DailyWorkSessionDetail;
  response: DailyWorkSessionRestorePreviewResponse;
}): DailyActivityEvent {
  const generatedAt = input.response.preview.generatedAt;

  return {
    id: `daily-event-session-${input.session.id}-restore-preview`,
    mode: input.mode,
    eventType: "session.restored",
    status: "completed",
    timestamp: generatedAt,
    title: "Session restore preview generated",
    summary:
      `Generated a preview-only restore prompt for ${input.session.title}; no execution was resumed and no external action was performed.`,
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: [input.session.id],
      templateIds: [],
      workflowIds: [],
      actionQueueItemIds: [],
      artifactIds: input.session.artifactIds,
      approvalRequestIds: input.session.approvalRequestIds,
      connectorIds: [],
      contextItemIds: input.session.contextItemIds
    },
    safetyBoundary: createPersistedActivitySafetyBoundary(
      "Session restore write-back records the generated preview state only and does not resume execution."
    ),
    nextAction: {
      label: "Continue restored session",
      description:
        "Review the restore prompt and decide the next daily-work step manually.",
      targetType: "session",
      targetId: input.session.id,
      requiredStatus: sessionStatusToActivityStatus(input.session.status)
    },
    taskStatus: {
      workflowStatus: sessionStatusToWorkflowStatus(input.session.status)
    },
    metadata: {
      riskLevel:
        input.session.approvalRequestIds.length > 0 ? "high" : "medium",
      permissionState:
        input.session.approvalRequestIds.length > 0
          ? "requires_review"
          : "workspace_shared",
      externalEffects: ["none"]
    }
  };
}

function createDailyWorkSessionRestorePrompt(input: {
  session: DailyWorkSessionDetail;
  prompt?: string;
}) {
  const lastAction = formatSessionLastAction(input.session);
  const userPrompt = input.prompt
    ? `User continuation prompt: ${input.prompt}`
    : "User continuation prompt: ask the user what to do next before continuing.";

  return [
    "Restore SeekDesk daily_work session as a preview only.",
    `Session id: ${input.session.id}`,
    `Session title: ${input.session.title}`,
    `Status: ${input.session.status}`,
    `Summary: ${input.session.summary}`,
    `Last action: ${lastAction}`,
    `Artifact ids: ${joinSessionRefIds(input.session.artifactIds)}`,
    `Context item ids: ${joinSessionRefIds(input.session.contextItemIds)}`,
    `Approval request ids: ${joinSessionRefIds(input.session.approvalRequestIds)}`,
    "Safety boundary: previewOnly=true; externalEffects=[none]; no external effects; do not send email, write documents, schedule calendar events, create tasks, read private external data, or resume real execution.",
    userPrompt
  ].join("\n");
}

function createRecentMessagePreview(
  message: DailyWorkSessionMessage
): DailyWorkSessionMessage {
  return {
    ...message,
    content: truncateSessionRestoreText(message.content, 220)
  };
}

function formatSessionLastAction(session: DailyWorkSessionDetail) {
  if (!session.lastAction) {
    return "none";
  }

  return [
    `${session.lastAction.label} by ${session.lastAction.actor} at ${session.lastAction.at}`,
    session.lastAction.artifactId
      ? `artifact=${session.lastAction.artifactId}`
      : undefined,
    session.lastAction.approvalRequestId
      ? `approval=${session.lastAction.approvalRequestId}`
      : undefined
  ]
    .filter(Boolean)
    .join("; ");
}

function joinSessionRefIds(ids: string[]) {
  return ids.length > 0 ? ids.join(", ") : "none";
}

function truncateSessionRestoreText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function selectWorkflowPreviewAction(
  workflow: DailyWorkWorkflow,
  actionId?: string
) {
  if (actionId) {
    return workflow.actionQueue.find((action) => action.id === actionId);
  }

  return workflow.actionQueue[0];
}

function createWorkflowPreviewStep(
  action: WorkflowActionQueueItem,
  index: number
) {
  return {
    id: `${action.workflowId}:preview-step-${index + 1}`,
    actionId: action.id,
    actionType: action.actionType,
    title: action.title,
    description: action.description,
    status: action.status,
    riskLevel: action.riskLevel,
    permissionState: action.permissionState,
    requiredPermissionMode: action.requiredPermissionMode,
    previewOnly: true as const,
    externalEffect: "none" as const,
    summary: action.preview.summary,
    suggestedNextStep: action.preview.suggestedNextStep,
    userVisibleDraft: action.preview.userVisibleDraft,
    connectorLinks: action.connectorLinks,
    contextLinks: action.contextLinks,
    artifactLinks: action.artifactLinks,
    approvalLinks: action.approvalLinks
  };
}

function createRequestedWorkflowContextLinks(
  contextItemIds: string[],
  contextItems: DailyContextItem[]
): WorkflowLinkedContext[] {
  const contextById = new Map(contextItems.map((item) => [item.id, item]));

  return contextItemIds.flatMap((contextItemId) => {
    const contextItem = contextById.get(contextItemId);
    if (!contextItem) {
      return [];
    }

    return [
      {
        contextItemId: contextItem.id,
        title: contextItem.title,
        permissionState: contextItem.permissionState,
        usage: "reference" as const
      }
    ];
  });
}

export function createApprovalDecisionResponse(input: {
  mode: AppMode;
  approvalRequest: DailyApprovalRequest;
  decisionInput: ApprovalDecisionInput;
  reason?: string;
}): DailyApprovalDecisionResponse {
  const normalized = normalizeApprovalDecisionInput(input.decisionInput);
  const request: DailyApprovalRequest = {
    ...input.approvalRequest,
    decision: normalized.decision,
    status: normalized.status
  };

  return {
    mode: input.mode,
    request,
    audit: {
      previewOnly: true,
      decidedAt: new Date().toISOString(),
      decision: normalized.decision,
      status: normalized.status,
      ...(input.reason ? { reason: input.reason } : {}),
      externalEffects: ["none"],
      statement:
        "Decision preview only: this response records the simulated approval state and does not perform any external connector action."
    }
  };
}

export function createApprovalDecisionActivityEvent(input: {
  mode: AppMode;
  response: DailyApprovalDecisionResponse;
}): DailyActivityEvent {
  const request = input.response.request;
  const status =
    input.response.audit.status === "approved" ? "completed" : "blocked";

  return {
    id: `daily-event-approval-${request.id}-decision`,
    mode: input.mode,
    eventType: "approval.changed",
    status,
    timestamp: input.response.audit.decidedAt,
    title:
      input.response.audit.status === "approved"
        ? "Approval allowed"
        : "Approval denied",
    summary:
      `Recorded ${request.title} as ${input.response.audit.status} in preview-only mode; no external connector action was performed.`,
    actor: "account-owner",
    relatedRefs: {
      sessionIds: [],
      templateIds: [],
      workflowIds: [],
      actionQueueItemIds: [],
      artifactIds: [],
      approvalRequestIds: [request.id],
      connectorIds: [],
      contextItemIds: request.contextItemIds
    },
    safetyBoundary: createPersistedActivitySafetyBoundary(
      "Approval decision write-back records simulated approval state only and performs no external connector action."
    ),
    nextAction: {
      label:
        input.response.audit.status === "approved"
          ? "Continue preview workflow"
          : "Revise or cancel preview workflow",
      description:
        input.response.audit.status === "approved"
          ? "Proceed with preview-only drafting while keeping external actions disabled."
          : "Keep the workflow blocked until the user revises the request.",
      targetType: "approval",
      targetId: request.id,
      requiredStatus: status
    },
    taskStatus: {
      approvalStatus: input.response.audit.status
    },
    metadata: {
      riskLevel: request.riskLevel,
      permissionState: approvalPermissionState(request),
      externalEffects: ["none"]
    }
  };
}

function normalizeApprovalDecisionInput(decisionInput: ApprovalDecisionInput): {
  decision: ApprovalDecision;
  status: DailyApprovalRequest["status"];
} {
  if (decisionInput === "denied" || decisionInput === "deny") {
    return {
      decision: "deny",
      status: "denied"
    };
  }

  return {
    decision:
      decisionInput === "allow_for_session" ? "allow_for_session" : "allow_once",
    status: "approved"
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function uniqueBy<T>(values: T[], createKey: (value: T) => string) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = createKey(value);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function workflowPreviewApprovalStatus(
  approvalLinks: DailyWorkWorkflowPreviewResponse["preview"]["approvalLinks"]
): NonNullable<DailyActivityEvent["taskStatus"]>["approvalStatus"] {
  if (approvalLinks.some((link) => link.status === "pending")) {
    return "pending";
  }

  if (approvalLinks.some((link) => link.status === "denied")) {
    return "denied";
  }

  if (approvalLinks.some((link) => link.status === "approved")) {
    return "approved";
  }

  return undefined;
}

function createPersistedActivitySafetyBoundary(statement: string) {
  return {
    previewOnly: true as const,
    externalEffects: ["none" as const],
    prohibitedExternalActions: [
      "send_email" as const,
      "write_document" as const,
      "schedule_calendar_event" as const,
      "create_task" as const
    ],
    statement
  };
}

function contextRiskLevel(contextItem: DailyContextItem) {
  if (
    contextItem.permissionState === "restricted" ||
    contextItem.sourceType === "customer_email"
  ) {
    return "high" as const;
  }

  if (contextItem.permissionState === "requires_review") {
    return "medium" as const;
  }

  return "low" as const;
}

function contextPermissionState(contextItem: DailyContextItem) {
  if (contextItem.permissionState === "public") {
    return "public" as const;
  }

  if (contextItem.permissionState === "workspace_shared") {
    return "workspace_shared" as const;
  }

  if (contextItem.permissionState === "restricted") {
    return "restricted" as const;
  }

  return "requires_review" as const;
}

function approvalPermissionState(request: DailyApprovalRequest) {
  if (request.riskLevel === "critical" || request.riskLevel === "high") {
    return "requires_explicit_approval" as const;
  }

  if (request.riskLevel === "medium") {
    return "requires_review" as const;
  }

  return "workspace_shared" as const;
}

function sessionStatusToActivityStatus(
  status: DailyWorkSessionDetail["status"]
): DailyActivityEvent["status"] {
  if (status === "completed") {
    return "completed";
  }

  if (status === "waiting_for_approval") {
    return "waiting_for_approval";
  }

  if (status === "archived") {
    return "blocked";
  }

  return "in_progress";
}

function sessionStatusToWorkflowStatus(
  status: DailyWorkSessionDetail["status"]
): NonNullable<DailyActivityEvent["taskStatus"]>["workflowStatus"] {
  if (status === "completed") {
    return "ready";
  }

  if (status === "waiting_for_approval") {
    return "waiting_for_approval";
  }

  if (status === "archived") {
    return "blocked";
  }

  return "preview";
}

const connectorActionPreviewCopy: Record<
  ConnectorAction,
  {
    summary: (connectorName: string) => string;
    steps: Array<{
      title: string;
      description: (connectorName: string) => string;
    }>;
  }
> = {
  search: {
    summary: (connectorName) =>
      `Prepare a search plan for ${connectorName} without querying the external provider.`,
    steps: [
      {
        title: "Scope query",
        description: (connectorName) =>
          `Define search keywords and filters for ${connectorName}.`
      },
      {
        title: "Return preview",
        description: () =>
          "Show the proposed query, expected fields, and approval needs only."
      }
    ]
  },
  read_context: {
    summary: (connectorName) =>
      `Preview which context would be read from ${connectorName}.`,
    steps: [
      {
        title: "List context targets",
        description: (connectorName) =>
          `Identify candidate context records from ${connectorName}.`
      },
      {
        title: "Hold for permission",
        description: () =>
          "Wait for explicit approval before any private context is read."
      }
    ]
  },
  summarize: {
    summary: (connectorName) =>
      `Preview a summarization plan for workspace-safe material in ${connectorName}.`,
    steps: [
      {
        title: "Choose sources",
        description: (connectorName) =>
          `Select the notes or references that would be summarized from ${connectorName}.`
      },
      {
        title: "Draft outline",
        description: () =>
          "Return only a summary outline and required review gates."
      }
    ]
  },
  draft_document: {
    summary: (connectorName) =>
      `Preview a document draft workflow using ${connectorName}.`,
    steps: [
      {
        title: "Collect inputs",
        description: (connectorName) =>
          `Map relevant source documents from ${connectorName}.`
      },
      {
        title: "Prepare draft shell",
        description: () =>
          "Create a draft outline in the response only; no file is written."
      }
    ]
  },
  prepare_email_draft: {
    summary: (connectorName) =>
      `Preview an email draft plan using ${connectorName}.`,
    steps: [
      {
        title: "Review thread boundary",
        description: (connectorName) =>
          `Show which email context from ${connectorName} would require approval.`
      },
      {
        title: "Prepare response draft",
        description: () =>
          "Return a draft plan only; no email is sent or queued."
      }
    ]
  },
  prepare_calendar_follow_up: {
    summary: (connectorName) =>
      `Preview a calendar follow-up plan using ${connectorName}.`,
    steps: [
      {
        title: "Check scheduling intent",
        description: (connectorName) =>
          `Describe the calendar hold that would be prepared in ${connectorName}.`
      },
      {
        title: "Wait for confirmation",
        description: () =>
          "Return proposed timing and attendees only; no calendar event is created."
      }
    ]
  },
  open_reference: {
    summary: (connectorName) =>
      `Preview a safe reference-opening handoff for ${connectorName}.`,
    steps: [
      {
        title: "Identify reference",
        description: (connectorName) =>
          `Resolve the reference label inside ${connectorName}.`
      },
      {
        title: "Prepare handoff",
        description: () =>
          "Return a user-visible reference target without opening a browser or provider."
      }
    ]
  }
};

export async function filterDailyWorkTemplates(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return (await repository.listTemplates()).filter(
    (template) => template.status !== "archived"
  );
}

export async function filterDailyWorkTemplate(
  repository: DailyWorkRepository,
  mode: AppMode,
  templateId: string
) {
  return (await filterDailyWorkTemplates(repository, mode)).find(
    (template) => template.id === templateId
  );
}

export async function filterDailyWorkArtifacts(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listArtifacts();
}

export async function filterDailyWorkArtifact(
  repository: DailyWorkRepository,
  mode: AppMode,
  artifactId: string
) {
  return (await filterDailyWorkArtifacts(repository, mode)).find(
    (artifact) => artifact.id === artifactId
  );
}

export async function filterDailyActivityEvents(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listEvents();
}

export async function filterDailyActivityEvent(
  repository: DailyWorkRepository,
  mode: AppMode,
  eventId: string
) {
  return (await filterDailyActivityEvents(repository, mode)).find(
    (event) => event.id === eventId
  );
}

export async function filterDailyWorkConnectors(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listConnectors();
}

export async function filterDailyWorkConnector(
  repository: DailyWorkRepository,
  mode: AppMode,
  connectorId: string
) {
  return (await filterDailyWorkConnectors(repository, mode)).find(
    (connector) => connector.id === connectorId
  );
}

export async function filterDailyWorkWorkflows(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listWorkflows();
}

export async function filterDailyWorkWorkflow(
  repository: DailyWorkRepository,
  mode: AppMode,
  workflowId: string
) {
  return (await filterDailyWorkWorkflows(repository, mode)).find(
    (workflow) => workflow.id === workflowId
  );
}

export async function filterDailyWorkSessionSummaries(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listSessionSummaries();
}

export async function filterDailyWorkSessionDetail(
  repository: DailyWorkRepository,
  mode: AppMode,
  sessionId: string
) {
  if (mode !== "daily_work") {
    return undefined;
  }

  return (await repository.listSessionDetails()).find(
    (session) => session.id === sessionId
  );
}

export async function filterDailyWorkContextItems(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listContextItems();
}

export async function filterDailyWorkContextItem(
  repository: DailyWorkRepository,
  mode: AppMode,
  contextItemId: string
) {
  return (await filterDailyWorkContextItems(repository, mode)).find(
    (item) => item.id === contextItemId
  );
}

export async function filterDailyWorkApprovalRequests(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listApprovalRequests();
}

export function createDailyModelUsageSnapshot(
  mode: AppMode,
  records: ToolModelUsageRecord[] = [],
  sessionId?: string,
  options: { selectedRoute?: ModelRoute } = {}
): DailyModelUsageResponse {
  return createDailyModelUsageResponse({
    mode,
    records: records
      .filter((record) => record.provider === "deepseek")
      .map((record) => ({
        id: record.id,
        sessionId: record.sessionId ?? "unknown-session",
        provider: "deepseek" as const,
        model: record.model,
        inputTokens: record.promptTokens,
        outputTokens: record.completionTokens,
        totalTokens: record.totalTokens,
        createdAt: record.createdAt
      })),
    ...(sessionId ? { sessionId } : {}),
    configured: hasDeepSeekApiKey(),
    baseUrl: process.env.DEEPSEEK_BASE_URL,
    fastModel: process.env.DEEPSEEK_MODEL_FAST,
    proModel: process.env.DEEPSEEK_MODEL_PRO,
    selectedRoute: options.selectedRoute ?? process.env.DEEPSEEK_MODEL_ROUTE,
    thinkingMode: process.env.DEEPSEEK_THINKING_MODE,
    streamUsageEnabled:
      process.env.DEEPSEEK_STREAM_USAGE_ENABLED ??
      process.env.DEEPSEEK_STREAM_USAGE
  });
}

function hasDeepSeekApiKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}
