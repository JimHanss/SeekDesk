import {
  ToolOrchestrator,
  createDefaultToolRegistry,
  createModelToolDefinitions,
  type ToolDefinition,
  type ToolRegistry
} from "@seekdesk/agent";
import {
  artifactTypeSchema,
  calendarListEventsInputSchema,
  calendarProposeEventPreviewInputSchema,
  dailyPersistArtifactInputSchema,
  gmailCreateDraftPreviewInputSchema,
  gmailReadThreadInputSchema,
  gmailSearchThreadsInputSchema,
  type DailyActivityEvent,
  type DailyWorkArtifact
} from "@seekdesk/shared";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import {
  createCalendarEventPreview,
  createGmailDraftPreview,
  createGoogleAuthenticatedClient,
  getGoogleOAuthConfigFromEnv,
  listCalendarEvents,
  readGmailThread,
  searchGmailThreads
} from "./google-connector-service.js";

export function createDailyWorkToolRuntime(repository: DailyWorkRepository) {
  const registry = createDefaultToolRegistry();

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

function bindExecutor(
  registry: ToolRegistry,
  name: string,
  execute: NonNullable<ToolDefinition["execute"]>
) {
  const definition = registry.get(name);
  if (!definition) {
    throw new Error(`Daily-work tool "${name}" is not registered.`);
  }

  definition.execute = execute;
}

async function createGoogleAuthOrThrow(repository: DailyWorkRepository) {
  const config = getGoogleOAuthConfigFromEnv();
  if (!config) {
    throw createToolError(
      "google_oauth_not_configured",
      "Google OAuth environment variables are not configured."
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
