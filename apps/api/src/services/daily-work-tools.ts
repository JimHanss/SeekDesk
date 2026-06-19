import {
  ToolOrchestrator,
  createDefaultToolRegistry,
  createModelToolDefinitions,
  ToolRegistry,
  type ToolDefinition
} from "@seekdesk/agent";
import {
  artifactTypeSchema,
  calendarListEventsInputSchema,
  calendarProposeEventPreviewInputSchema,
  dailyPersistArtifactInputSchema,
  dailyWorkToolNameSchema,
  gmailCreateDraftPreviewInputSchema,
  gmailReadThreadInputSchema,
  gmailSearchThreadsInputSchema,
  outlookCalendarCreateEventInputSchema,
  outlookCalendarListEventsInputSchema,
  outlookCalendarProposeEventPreviewInputSchema,
  outlookCreateDraftInputSchema,
  outlookCreateDraftPreviewInputSchema,
  outlookReadMessageInputSchema,
  outlookSearchMessagesInputSchema,
  outlookSendMailInputSchema,
  type DailyActivityEvent,
  type DailyWorkArtifact,
  type DailyWorkPermissionGrantAction,
  type DailyWorkToolName,
  type ToolCallRecord
} from "@seekdesk/shared";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import {
  createCalendarEventPreview,
  createGmailDraftPreview,
  createGoogleAuthenticatedClient,
  getGoogleConnectionStatus,
  getGoogleOAuthConfigFromEnv,
  listCalendarEvents,
  readGmailThread,
  searchGmailThreads
} from "./google-connector-service.js";
import {
  createMicrosoftAccessToken,
  createOutlookCalendarEvent,
  createOutlookCalendarEventPreview,
  createOutlookDraft,
  createOutlookDraftPreview,
  getMicrosoftConnectionStatus,
  getMicrosoftOAuthConfigFromEnv,
  listOutlookCalendarEvents,
  readOutlookMessage,
  searchOutlookMessages,
  sendOutlookMail
} from "./microsoft-connector-service.js";
import { createToolActivityEvent } from "./daily-work-tool-activity.js";

const microsoftWriteToolNames = [
  "outlook.create_draft",
  "outlook.send_mail",
  "outlook.calendar.create_event"
] as const satisfies DailyWorkPermissionGrantAction[];

const microsoftWriteToolNameSet = new Set<string>(microsoftWriteToolNames);

export function isMicrosoftWriteToolName(
  name: string
): name is DailyWorkPermissionGrantAction {
  return microsoftWriteToolNameSet.has(name);
}

export function createDailyWorkToolRuntime(
  repository: DailyWorkRepository,
  options: { allowedToolNames?: DailyWorkToolName[] } = {}
) {
  const registry = createDailyWorkToolRegistry(options.allowedToolNames);

  bindExecutor(registry, "gmail.search_threads", async ({ input }) => {
    const params = gmailSearchThreadsInputSchema.parse(input);
    const auth = await createGoogleAuthOrThrow(repository);

    return searchGmailThreads({ auth, params });
  });
  bindExecutor(registry, "gmail.read_thread", async ({ input }) => {
    const params = gmailReadThreadInputSchema.parse(input);
    const auth = await createGoogleAuthOrThrow(repository);

    return readGmailThread({ auth, params });
  });
  bindExecutor(registry, "gmail.create_draft_preview", async ({ input }) =>
    createGmailDraftPreview(gmailCreateDraftPreviewInputSchema.parse(input))
  );
  bindExecutor(registry, "calendar.list_events", async ({ input }) => {
    const params = calendarListEventsInputSchema.parse(input);
    const auth = await createGoogleAuthOrThrow(repository);

    return listCalendarEvents({ auth, params });
  });
  bindExecutor(registry, "calendar.propose_event_preview", async ({ input }) =>
    createCalendarEventPreview(calendarProposeEventPreviewInputSchema.parse(input))
  );
  bindExecutor(registry, "outlook.search_messages", async ({ input }) => {
    const params = outlookSearchMessagesInputSchema.parse(input);
    const accessToken = await createMicrosoftAccessTokenOrThrow(repository);

    return searchOutlookMessages({ accessToken, params });
  });
  bindExecutor(registry, "outlook.read_message", async ({ input }) => {
    const params = outlookReadMessageInputSchema.parse(input);
    const accessToken = await createMicrosoftAccessTokenOrThrow(repository);

    return readOutlookMessage({ accessToken, params });
  });
  bindExecutor(registry, "outlook.create_draft_preview", async ({ input }) =>
    createOutlookDraftPreview(outlookCreateDraftPreviewInputSchema.parse(input))
  );
  bindExecutor(registry, "outlook.calendar.list_events", async ({ input }) => {
    const params = outlookCalendarListEventsInputSchema.parse(input);
    const accessToken = await createMicrosoftAccessTokenOrThrow(repository);

    return listOutlookCalendarEvents({ accessToken, params });
  });
  bindExecutor(
    registry,
    "outlook.calendar.propose_event_preview",
    async ({ input }) =>
      createOutlookCalendarEventPreview(
        outlookCalendarProposeEventPreviewInputSchema.parse(input)
      )
  );
  bindExecutor(registry, "daily.persist_artifact", async ({ input }) => {
    const parsed = dailyPersistArtifactInputSchema.parse(input);
    const artifact = createPersistedArtifact(parsed);

    await repository.upsertArtifact(artifact);
    await repository.upsertActivityEvent(createPersistArtifactEvent(artifact));

    return {
      provider: "seekdesk",
      previewOnly: true,
      artifactId: artifact.id,
      artifact
    };
  });

  return {
    registry,
    orchestrator: new ToolOrchestrator(registry),
    modelTools: createModelToolDefinitions(registry, "daily_work")
  };
}

export async function executeMicrosoftWriteToolCall(input: {
  repository: DailyWorkRepository;
  sessionId: string;
  toolCallId: string;
}) {
  const toolCalls = await input.repository.listToolCalls({
    sessionId: input.sessionId,
    limit: 200
  });
  const toolCall = toolCalls.find((item) => item.id === input.toolCallId);

  if (!toolCall) {
    throw createToolError("tool_call_not_found", "Daily-work tool call was not found for this session.");
  }

  if (!isMicrosoftWriteToolName(toolCall.name)) {
    throw createToolError("unsupported_tool", "Only Microsoft write tools can be executed through this endpoint.");
  }

  const grant = await findActiveSessionGrant(input.repository, {
    sessionId: input.sessionId,
    action: toolCall.name
  });

  if (!grant) {
    await markToolCallPermissionRequired(input.repository, toolCall);
    throw createToolError("permission_required", "This Microsoft write requires same-session authorization before execution.");
  }

  try {
    const accessToken = await createMicrosoftAccessTokenOrThrow(input.repository);
    const result = await executeAuthorizedMicrosoftWriteTool({
      accessToken,
      toolCall
    });
    const completedAt = new Date().toISOString();
    const artifact = createMicrosoftWriteArtifact({
      toolCall,
      result,
      timestamp: completedAt
    });
    const outputJson = {
      ...asRecord(result),
      artifactId: artifact.id
    };
    const updatedToolCall = await input.repository.recordToolCall({
      ...toolCall,
      status: "completed",
      previewOnly: false,
      permissionRequired: false,
      outputJson,
      completedAt
    });

    await input.repository.upsertArtifact(artifact);
    await input.repository.upsertActivityEvent(
      createToolActivityEvent({
        sessionId: input.sessionId,
        toolName: toolCall.name,
        status: "completed",
        timestamp: completedAt,
        inputJson: toolCall.inputJson,
        outputJson,
        toolCallId: toolCall.id,
        phase: "completed"
      })
    );

    return {
      mode: "daily_work" as const,
      previewOnly: false,
      grant,
      toolCall: updatedToolCall,
      artifact,
      result: outputJson
    };
  } catch (error) {
    await markToolCallFailed(input.repository, toolCall, error);
    throw error;
  }
}

async function executeAuthorizedMicrosoftWriteTool(input: {
  accessToken: string;
  toolCall: ToolCallRecord;
}) {
  switch (input.toolCall.name) {
    case "outlook.create_draft":
      return createOutlookDraft({
        accessToken: input.accessToken,
        params: outlookCreateDraftInputSchema.parse(input.toolCall.inputJson)
      });
    case "outlook.send_mail":
      return sendOutlookMail({
        accessToken: input.accessToken,
        params: outlookSendMailInputSchema.parse(input.toolCall.inputJson)
      });
    case "outlook.calendar.create_event":
      return createOutlookCalendarEvent({
        accessToken: input.accessToken,
        params: outlookCalendarCreateEventInputSchema.parse(input.toolCall.inputJson)
      });
    default:
      throw createToolError("unsupported_tool", "Unsupported Microsoft write tool.");
  }
}

async function findActiveSessionGrant(
  repository: DailyWorkRepository,
  query: { sessionId: string; action: DailyWorkPermissionGrantAction }
) {
  const grants = await repository.listPermissionGrants({
    sessionId: query.sessionId,
    provider: "microsoft",
    action: query.action,
    activeOnly: true,
    limit: 20
  });

  return grants.at(-1) ?? null;
}

async function markToolCallPermissionRequired(
  repository: DailyWorkRepository,
  toolCall: ToolCallRecord
) {
  const completedAt = new Date().toISOString();
  const outputJson = {
    error: "permission_required",
    permissionRequired: true
  };
  await repository.recordToolCall({
    ...toolCall,
    status: "permission_required",
    previewOnly: false,
    permissionRequired: true,
    outputJson,
    error: "permission_required",
    completedAt
  });
  await repository.upsertActivityEvent(
    createToolActivityEvent({
      sessionId: toolCall.sessionId ?? "unknown-session",
      toolName: toolCall.name,
      status: "failed",
      timestamp: completedAt,
      inputJson: toolCall.inputJson,
      outputJson,
      error: "permission_required",
      toolCallId: toolCall.id,
      phase: "completed"
    })
  );
}

async function markToolCallFailed(
  repository: DailyWorkRepository,
  toolCall: ToolCallRecord,
  error: unknown
) {
  const completedAt = new Date().toISOString();
  const errorCode = formatToolErrorCode(error);
  await repository.recordToolCall({
    ...toolCall,
    status: "failed",
    previewOnly: false,
    permissionRequired: false,
    outputJson: { message: formatToolErrorMessage(error) },
    error: errorCode,
    completedAt
  });
  await repository.upsertActivityEvent(
    createToolActivityEvent({
      sessionId: toolCall.sessionId ?? "unknown-session",
      toolName: toolCall.name,
      status: "failed",
      timestamp: completedAt,
      inputJson: toolCall.inputJson,
      outputJson: { message: formatToolErrorMessage(error) },
      error: errorCode,
      toolCallId: toolCall.id,
      phase: "completed"
    })
  );
}

function createMicrosoftWriteArtifact(input: {
  toolCall: ToolCallRecord;
  result: unknown;
  timestamp: string;
}): DailyWorkArtifact {
  const result = asRecord(input.result);
  const subject = typeof result.subject === "string" ? result.subject : input.toolCall.name;
  const content = JSON.stringify(input.result, null, 2);

  return {
    id: `microsoft-write-artifact-${crypto.randomUUID()}`,
    mode: "daily_work",
    artifactType: input.toolCall.name === "outlook.calendar.create_event" ? "status_update" : "email_draft",
    title: `Microsoft write result: ${subject}`,
    description: truncateText(content, 180),
    summary: truncateText(content, 260),
    status: "ready",
    owner: {
      id: "daily-work-agent",
      displayName: "SeekDesk Daily Agent",
      team: "daily-work"
    },
    updatedAt: input.timestamp,
    sourceContextIds: [],
    approvalRequestIds: [],
    version: 1,
    reusable: false,
    nextAction: {
      type: "archive",
      label: "Archive write receipt",
      description: "External Microsoft write completed and has been recorded for audit."
    },
    permissionState: "restricted",
    trace: {
      origin: "daily_chat",
      createdAt: input.timestamp,
      createdBy: "daily-work-agent",
      events: [
        {
          at: input.timestamp,
          actor: "daily-work-agent",
          type: "created",
          summary: `Recorded external Microsoft write for ${input.toolCall.name}.`
        }
      ]
    },
    lifecycle: [
      {
        at: input.timestamp,
        actor: "daily-work-agent",
        type: "created",
        summary: `Recorded external Microsoft write for ${input.toolCall.name}.`
      }
    ],
    tags: ["microsoft", "external-write", input.toolCall.name]
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function formatToolErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "tool_failed")
    : "tool_failed";
}

function formatToolErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createDailyWorkToolRegistry(allowedToolNames?: DailyWorkToolName[]) {
  const baseRegistry = createDefaultToolRegistry();
  if (!allowedToolNames) {
    return baseRegistry;
  }

  const allowed = new Set(allowedToolNames);
  return new ToolRegistry(
    baseRegistry.list().filter((definition) => {
      if (definition.mode !== "daily_work") {
        return true;
      }

      const parsed = dailyWorkToolNameSchema.safeParse(definition.name);
      return parsed.success && allowed.has(parsed.data);
    })
  );
}

function bindExecutor(
  registry: ToolRegistry,
  name: string,
  execute: NonNullable<ToolDefinition["execute"]>
) {
  const definition = registry.get(name);
  if (!definition) {
    return;
  }

  definition.execute = execute;
}

async function createMicrosoftAccessTokenOrThrow(repository: DailyWorkRepository) {
  const config = getMicrosoftOAuthConfigFromEnv();
  if (!config) {
    throw createToolError(
      "microsoft_oauth_not_configured",
      "Microsoft OAuth environment variables are not configured."
    );
  }

  const status = await getMicrosoftConnectionStatus({ repository });
  if (!status.connected) {
    throw createToolError(
      "connector_not_connected",
      "Microsoft connector is not connected."
    );
  }

  if (!status.scopesComplete) {
    throw createToolError(
      "connector_missing_scopes",
      `Microsoft connector is missing required OAuth scopes: ${status.missingScopes.join(", ") || "unknown"}.`
    );
  }

  try {
    return await createMicrosoftAccessToken({
      repository,
      config
    });
  } catch (error) {
    throw createToolError(
      "connector_not_connected",
      error instanceof Error ? error.message : "Microsoft connector is not connected."
    );
  }
}

async function createGoogleAuthOrThrow(repository: DailyWorkRepository) {
  const config = getGoogleOAuthConfigFromEnv();
  if (!config) {
    throw createToolError(
      "google_oauth_not_configured",
      "Google OAuth environment variables are not configured."
    );
  }

  const status = await getGoogleConnectionStatus({ repository });
  if (!status.connected) {
    throw createToolError(
      "connector_not_connected",
      "Google connector is not connected."
    );
  }

  if (!status.scopesComplete) {
    throw createToolError(
      "connector_missing_scopes",
      `Google connector is missing required OAuth scopes: ${status.missingScopes.join(", ") || "unknown"}.`
    );
  }

  try {
    return await createGoogleAuthenticatedClient({
      repository,
      config
    });
  } catch (error) {
    throw createToolError(
      "connector_not_connected",
      error instanceof Error ? error.message : "Google connector is not connected."
    );
  }
}

function createPersistedArtifact(
  input: ReturnType<typeof dailyPersistArtifactInputSchema.parse>
): DailyWorkArtifact {
  const now = new Date().toISOString();
  const artifactType = artifactTypeSchema.safeParse(input.artifactType);

  return {
    id: `ai-artifact-${crypto.randomUUID()}`,
    mode: "daily_work",
    artifactType: artifactType.success ? artifactType.data : "brief",
    title: input.title,
    description: truncateText(input.content, 180),
    summary: truncateText(input.content, 260),
    status: "draft",
    owner: {
      id: "daily-work-agent",
      displayName: "SeekDesk Daily Agent",
      team: "daily-work"
    },
    updatedAt: now,
    sourceContextIds: [],
    approvalRequestIds: [],
    version: 1,
    reusable: false,
    nextAction: {
      type: "request_review",
      label: "Review generated artifact",
      description:
        "Inspect this AI-generated daily-work artifact before reuse or sharing."
    },
    permissionState: "requires_review",
    trace: {
      origin: "daily_chat",
      createdAt: now,
      createdBy: "daily-work-agent",
      events: [
        {
          at: now,
          actor: "daily-work-agent",
          type: "created",
          summary: "Created by the daily.persist_artifact preview-only tool."
        }
      ]
    },
    lifecycle: [
      {
        at: now,
        actor: "daily-work-agent",
        type: "created",
        summary: "Created by the daily.persist_artifact preview-only tool."
      }
    ],
    tags: input.tags
  };
}

function createPersistArtifactEvent(artifact: DailyWorkArtifact): DailyActivityEvent {
  return {
    id: `daily-event-artifact-${artifact.id}-persisted`,
    mode: "daily_work",
    eventType: "artifact.updated",
    status: "in_progress",
    timestamp: artifact.updatedAt,
    title: "Artifact persisted",
    summary:
      `Persisted ${artifact.title} as a local review artifact; no external provider write occurred.`,
    actor: "daily-work-agent",
    relatedRefs: {
      sessionIds: [],
      templateIds: [],
      workflowIds: [],
      actionQueueItemIds: [],
      artifactIds: [artifact.id],
      approvalRequestIds: [],
      connectorIds: [],
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
        "Artifact persistence is local to SeekDesk. It does not send, write to external documents, schedule calendar events, or create tasks."
    },
    nextAction: {
      label: "Review artifact",
      targetType: "artifact",
      targetId: artifact.id,
      requiredStatus: "ready"
    },
    taskStatus: {
      artifactStatus: artifact.status
    },
    metadata: {
      riskLevel: "medium",
      permissionState: "requires_review",
      externalEffects: ["none"],
      artifactType: artifact.artifactType
    }
  };
}

function createToolError(code: string, message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;

  return error;
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}
