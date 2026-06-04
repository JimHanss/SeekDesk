import {
  DeepSeekModelProvider,
  MockModelProvider,
  streamAgentLoop,
  type ModelStreamChunk,
  type ModelProvider
} from "@seekdesk/agent";
import {
  appModeSchema,
  chatRequestSchema,
  connectorActionPreviewRequestSchema,
  createDailyActivityEventResponse,
  createDailyActivityEventsResponse,
  createDailyActivitySnapshotMessage,
  createDailyModelUsageResponse,
  dailyApprovalDecisionRequestSchema,
  dailyContextUsePreviewRequestSchema,
  dailyWorkSessionRestorePreviewRequestSchema,
  dailyWorkTemplateApplyPreviewRequestSchema,
  dailyWorkWorkflowPreviewRequestSchema,
  type ArtifactType,
  type AppMode,
  type ApprovalDecision,
  type ApprovalDecisionInput,
  type ChatProvider,
  type ChatRequest,
  type ConnectorAction,
  type ConnectorActionPreviewResponse,
  type DailyApprovalRequestsResponse,
  type DailyApprovalDecisionResponse,
  type DailyApprovalRequest,
  type DailyActivityEventResponse,
  type DailyActivityEventsResponse,
  type DailyContextItem,
  type DailyContextResponse,
  type DailyContextUsePreviewResponse,
  type DailyModelUsageResponse,
  type DailyWorkArtifactResponse,
  type DailyWorkArtifactsResponse,
  type DailyWorkConnector,
  type DailyWorkConnectorResponse,
  type DailyWorkConnectorsResponse,
  type DailyWorkSessionResponse,
  type DailyWorkSessionDetail,
  type DailyWorkSessionMessage,
  type DailyWorkSessionRestorePreviewResponse,
  type DailyWorkSessionsResponse,
  type DailyWorkTemplate,
  type DailyWorkTemplateApplyPreviewResponse,
  type DailyWorkTemplatesResponse,
  type DailyWorkWorkflow,
  type DailyWorkWorkflowResponse,
  type DailyWorkWorkflowPreviewResponse,
  type DailyWorkflowsResponse,
  type WorkflowActionQueueItem,
  type WorkflowLinkedContext
} from "@seekdesk/shared";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { pathToFileURL } from "node:url";

import {
  createDailyWorkRepositoryFromEnv,
  type DailyWorkRepository
} from "./repositories/daily-work-repository.js";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

export async function buildServer(options?: {
  dailyWorkRepository?: DailyWorkRepository;
}) {
  const dailyWorkRepository =
    options?.dailyWorkRepository ?? createDailyWorkRepositoryFromEnv();
  const app = Fastify({
    logger: true
  });

  await app.register(websocket);

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply);
  });

  app.options("/api/chat", async (_request, reply) => reply.code(204).send());
  app.options("/api/daily/context", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options(
    "/api/daily/context/:contextItemId/use-preview",
    async (_request, reply) => reply.code(204).send()
  );
  app.options("/api/daily/approvals", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options(
    "/api/daily/approvals/:approvalRequestId/decision",
    async (_request, reply) => reply.code(204).send()
  );
  app.options("/api/daily/templates", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options(
    "/api/daily/templates/:templateId/apply-preview",
    async (_request, reply) => reply.code(204).send()
  );
  app.options("/api/daily/model-usage", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/sessions", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/sessions/:sessionId", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options(
    "/api/daily/sessions/:sessionId/restore-preview",
    async (_request, reply) => reply.code(204).send()
  );
  app.options("/api/daily/artifacts", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/artifacts/:artifactId", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/events", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/events/:eventId", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/connectors", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/connectors/:connectorId", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options(
    "/api/daily/connectors/:connectorId/preview",
    async (_request, reply) => reply.code(204).send()
  );
  app.options("/api/daily/workflows", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/workflows/:workflowId", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options(
    "/api/daily/workflows/:workflowId/preview",
    async (_request, reply) => reply.code(204).send()
  );

  app.get("/health", async () => ({
    status: "ok",
    service: "seekdesk-api",
    version: "0.1.0"
  }));

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/context",
    async (request): Promise<DailyContextResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        items: await filterDailyWorkContextItems(dailyWorkRepository, mode)
      };
    }
  );

  app.post<{
    Params: { contextItemId: string };
    Body: unknown;
  }>(
    "/api/daily/context/:contextItemId/use-preview",
    async (
      request,
      reply
    ): Promise<DailyContextUsePreviewResponse | void> => {
      const parsed = dailyContextUsePreviewRequestSchema.safeParse(
        request.body ?? {}
      );
      if (!parsed.success) {
        reply
          .code(400)
          .send(
            createValidationError(
              "Invalid context use preview request.",
              parsed.error.issues
            )
          );
        return;
      }

      const mode = normalizeAppMode(parsed.data.mode);
      if (mode !== "daily_work") {
        reply.code(400).send({
          mode,
          error: "Context use previews are only available in daily_work mode."
        });
        return;
      }

      const contextItem = await filterDailyWorkContextItem(
        dailyWorkRepository,
        mode,
        request.params.contextItemId
      );

      if (!contextItem) {
        reply.code(404).send({
          mode,
          error: "Daily-work context item not found."
        });
        return;
      }

      return createDailyContextUsePreviewResponse({
        mode,
        contextItem,
        ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {}),
        ...(parsed.data.templateId ? { templateId: parsed.data.templateId } : {})
      });
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/approvals",
    async (request): Promise<DailyApprovalRequestsResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        requests: await filterDailyWorkApprovalRequests(dailyWorkRepository, mode)
      };
    }
  );

  app.post<{
    Params: { approvalRequestId: string };
    Body: unknown;
  }>(
    "/api/daily/approvals/:approvalRequestId/decision",
    async (
      request,
      reply
    ): Promise<DailyApprovalDecisionResponse | void> => {
      const parsed = dailyApprovalDecisionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        reply
          .code(400)
          .send(
            createValidationError(
              "Invalid approval decision.",
              parsed.error.issues
            )
          );
        return;
      }

      const mode = normalizeAppMode(parsed.data.mode);
      if (mode !== "daily_work") {
        reply.code(400).send({
          mode,
          error: "Approval decisions are only available in daily_work mode."
        });
        return;
      }

      const approvalRequest = (
        await filterDailyWorkApprovalRequests(dailyWorkRepository, mode)
      ).find((item) => item.id === request.params.approvalRequestId);

      if (!approvalRequest) {
        reply.code(404).send({
          mode,
          error: "Daily-work approval request not found."
        });
        return;
      }

      return createApprovalDecisionResponse({
        mode,
        approvalRequest,
        decisionInput: parsed.data.decision,
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {})
      });
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/templates",
    async (request): Promise<DailyWorkTemplatesResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        templates: await filterDailyWorkTemplates(dailyWorkRepository, mode)
      };
    }
  );

  app.post<{
    Params: { templateId: string };
    Body: unknown;
  }>(
    "/api/daily/templates/:templateId/apply-preview",
    async (
      request,
      reply
    ): Promise<DailyWorkTemplateApplyPreviewResponse | void> => {
      const parsed = dailyWorkTemplateApplyPreviewRequestSchema.safeParse(
        request.body ?? {}
      );
      if (!parsed.success) {
        reply
          .code(400)
          .send(
            createValidationError(
              "Invalid template apply preview request.",
              parsed.error.issues
            )
          );
        return;
      }

      const mode = normalizeAppMode(parsed.data.mode);
      if (mode !== "daily_work") {
        reply.code(400).send({
          mode,
          error: "Template apply previews are only available in daily_work mode."
        });
        return;
      }

      const template = await filterDailyWorkTemplate(
        dailyWorkRepository,
        mode,
        request.params.templateId
      );

      if (!template) {
        reply.code(404).send({
          mode,
          error: "Daily-work template not found."
        });
        return;
      }

      return createDailyWorkTemplateApplyPreviewResponse({
        mode,
        template,
        contextItemIds: parsed.data.contextItemIds,
        ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {})
      });
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/artifacts",
    async (request): Promise<DailyWorkArtifactsResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        artifacts: await filterDailyWorkArtifacts(dailyWorkRepository, mode)
      };
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/model-usage",
    async (request): Promise<DailyModelUsageResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return createDailyModelUsageSnapshot(mode);
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/sessions",
    async (request): Promise<DailyWorkSessionsResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        sessions: await filterDailyWorkSessionSummaries(dailyWorkRepository, mode)
      };
    }
  );

  app.get<{
    Params: { sessionId: string };
    Querystring: { mode?: string };
  }>(
    "/api/daily/sessions/:sessionId",
    async (request, reply): Promise<DailyWorkSessionResponse | void> => {
      const mode = normalizeAppMode(request.query.mode);
      const session = filterDailyWorkSessionDetail(
        dailyWorkRepository,
        mode,
        request.params.sessionId
      );
      const resolvedSession = await session;

      if (!resolvedSession) {
        reply.code(404).send({
          mode,
          error: "Daily-work session not found."
        });
        return;
      }

      return {
        mode,
        session: resolvedSession
      };
    }
  );

  app.post<{
    Params: { sessionId: string };
    Body: unknown;
  }>(
    "/api/daily/sessions/:sessionId/restore-preview",
    async (
      request,
      reply
    ): Promise<DailyWorkSessionRestorePreviewResponse | void> => {
      const parsed = dailyWorkSessionRestorePreviewRequestSchema.safeParse(
        request.body ?? {}
      );
      if (!parsed.success) {
        reply
          .code(400)
          .send(
            createValidationError(
              "Invalid session restore preview request.",
              parsed.error.issues
            )
          );
        return;
      }

      const mode = normalizeAppMode(parsed.data.mode);
      if (mode !== "daily_work") {
        reply.code(400).send({
          mode,
          error:
            "Session restore previews are only available in daily_work mode."
        });
        return;
      }

      const session = await filterDailyWorkSessionDetail(
        dailyWorkRepository,
        mode,
        request.params.sessionId
      );

      if (!session) {
        reply.code(404).send({
          mode,
          error: "Daily-work session not found."
        });
        return;
      }

      return createDailyWorkSessionRestorePreviewResponse({
        mode,
        session,
        includeRecentMessages: parsed.data.includeRecentMessages,
        ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {})
      });
    }
  );

  app.get<{
    Params: { artifactId: string };
    Querystring: { mode?: string };
  }>(
    "/api/daily/artifacts/:artifactId",
    async (request, reply): Promise<DailyWorkArtifactResponse | void> => {
      const mode = normalizeAppMode(request.query.mode);
      const artifact = await filterDailyWorkArtifact(
        dailyWorkRepository,
        mode,
        request.params.artifactId
      );

      if (!artifact) {
        reply.code(404).send({
          mode,
          error: "Daily-work artifact not found."
        });
        return;
      }

      return {
        mode,
        artifact
      };
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/events",
    async (request): Promise<DailyActivityEventsResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return createDailyActivityEventsResponse({
        mode,
        events: await filterDailyActivityEvents(dailyWorkRepository, mode)
      });
    }
  );

  app.get<{
    Params: { eventId: string };
    Querystring: { mode?: string };
  }>(
    "/api/daily/events/:eventId",
    async (request, reply): Promise<DailyActivityEventResponse | void> => {
      const mode = normalizeAppMode(request.query.mode);
      const event = await filterDailyActivityEvent(
        dailyWorkRepository,
        mode,
        request.params.eventId
      );

      if (!event) {
        reply.code(404).send({
          mode,
          eventId: request.params.eventId,
          error: "Daily-work activity event not found."
        });
        return;
      }

      return createDailyActivityEventResponse({
        mode,
        event
      });
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/connectors",
    async (request): Promise<DailyWorkConnectorsResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        connectors: await filterDailyWorkConnectors(dailyWorkRepository, mode)
      };
    }
  );

  app.get<{
    Params: { connectorId: string };
    Querystring: { mode?: string };
  }>(
    "/api/daily/connectors/:connectorId",
    async (request, reply): Promise<DailyWorkConnectorResponse | void> => {
      const mode = normalizeAppMode(request.query.mode);
      const connector = await filterDailyWorkConnector(
        dailyWorkRepository,
        mode,
        request.params.connectorId
      );

      if (!connector) {
        reply.code(404).send({
          mode,
          error: "Daily-work connector not found."
        });
        return;
      }

      return {
        mode,
        connector
      };
    }
  );

  app.post<{
    Params: { connectorId: string };
    Body: unknown;
  }>(
    "/api/daily/connectors/:connectorId/preview",
    async (
      request,
      reply
    ): Promise<ConnectorActionPreviewResponse | void> => {
      const parsed = connectorActionPreviewRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        reply
          .code(400)
          .send(
            createValidationError(
              "Invalid connector action preview request.",
              parsed.error.issues
            )
          );
        return;
      }

      const mode = normalizeAppMode(parsed.data.mode);
      if (mode !== "daily_work") {
        reply.code(400).send({
          mode,
          error: "Connector action previews are only available in daily_work mode."
        });
        return;
      }

      const connector = await filterDailyWorkConnector(
        dailyWorkRepository,
        mode,
        request.params.connectorId
      );

      if (!connector) {
        reply.code(404).send({
          mode,
          error: "Daily-work connector not found."
        });
        return;
      }

      if (!connector.availableActions.includes(parsed.data.action)) {
        reply.code(400).send({
          mode,
          connectorId: connector.id,
          action: parsed.data.action,
          error: "Connector action is not available for this connector."
        });
        return;
      }

      return createConnectorActionPreviewResponse({
        mode,
        connector,
        action: parsed.data.action,
        contextItemIds: parsed.data.contextItemIds,
        ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {})
      });
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/workflows",
    async (request): Promise<DailyWorkflowsResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        workflows: await filterDailyWorkWorkflows(dailyWorkRepository, mode)
      };
    }
  );

  app.get<{
    Params: { workflowId: string };
    Querystring: { mode?: string };
  }>(
    "/api/daily/workflows/:workflowId",
    async (request, reply): Promise<DailyWorkWorkflowResponse | void> => {
      const mode = normalizeAppMode(request.query.mode);
      const workflow = await filterDailyWorkWorkflow(
        dailyWorkRepository,
        mode,
        request.params.workflowId
      );

      if (!workflow) {
        reply.code(404).send({
          mode,
          error: "Daily-work workflow not found."
        });
        return;
      }

      return {
        mode,
        workflow
      };
    }
  );

  app.post<{
    Params: { workflowId: string };
    Body: unknown;
  }>(
    "/api/daily/workflows/:workflowId/preview",
    async (
      request,
      reply
    ): Promise<DailyWorkWorkflowPreviewResponse | void> => {
      const parsed = dailyWorkWorkflowPreviewRequestSchema.safeParse(
        request.body
      );
      if (!parsed.success) {
        reply
          .code(400)
          .send(
            createValidationError(
              "Invalid workflow preview request.",
              parsed.error.issues
            )
          );
        return;
      }

      const mode = normalizeAppMode(parsed.data.mode);
      if (mode !== "daily_work") {
        reply.code(400).send({
          mode,
          error: "Workflow previews are only available in daily_work mode."
        });
        return;
      }

      const workflow = await filterDailyWorkWorkflow(
        dailyWorkRepository,
        mode,
        request.params.workflowId
      );

      if (!workflow) {
        reply.code(404).send({
          mode,
          error: "Daily-work workflow not found."
        });
        return;
      }

      const selectedAction = selectWorkflowPreviewAction(
        workflow,
        parsed.data.actionId
      );
      if (!selectedAction) {
        reply.code(400).send({
          mode,
          workflowId: workflow.id,
          ...(parsed.data.actionId ? { actionId: parsed.data.actionId } : {}),
          error: parsed.data.actionId
            ? "Workflow action is not available for this workflow."
            : "Daily-work workflow has no action queue to preview."
        });
        return;
      }

      return createDailyWorkWorkflowPreviewResponse({
        mode,
        workflow,
        selectedAction,
        selectedActionOnly: Boolean(parsed.data.actionId),
        contextItems: await filterDailyWorkContextItems(
          dailyWorkRepository,
          mode
        ),
        contextItemIds: parsed.data.contextItemIds,
        ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {})
      });
    }
  );

  app.post<{ Body: unknown }>("/api/chat", async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid chat request.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const chatRequest = parsed.data;
    const providerSelection = createModelProvider();
    const stream = modelStreamToReadableStream(
      streamAgentLoop(createAgentLoopInput(chatRequest, providerSelection.provider))
    );

    return reply
      .header("Content-Type", "text/plain; charset=utf-8")
      .header("Cache-Control", "no-cache, no-transform")
      .header("X-Accel-Buffering", "no")
      .header("X-SeekDesk-Chat-Mode", chatRequest.mode)
      .header("X-SeekDesk-Chat-Provider", providerSelection.providerName)
      .send(stream);
  });

  app.get("/ws", { websocket: true }, async (socket) => {
    socket.send(
      JSON.stringify({
        type: "connection.ready",
        service: "seekdesk-api",
        message: "Daily activity WebSocket connected."
      })
    );
    socket.send(
      JSON.stringify(
        createDailyActivitySnapshotMessage({
          mode: "daily_work",
          events: await filterDailyActivityEvents(
            dailyWorkRepository,
            "daily_work"
          )
        })
      )
    );

    socket.on("message", (message: Buffer) => {
      socket.send(
        JSON.stringify({
          type: "echo",
          payload: message.toString()
        })
      );
    });
  });

  return app;
}

function applyCorsHeaders(request: FastifyRequest, reply: FastifyReply) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    reply.header("Access-Control-Allow-Origin", origin);
  }

  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function normalizeAppMode(mode: unknown): AppMode {
  const parsed = appModeSchema.safeParse(mode);
  return parsed.success ? parsed.data : "daily_work";
}

function createValidationError(
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

function createDailyContextUsePreviewResponse(input: {
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

function createDailyWorkTemplateApplyPreviewResponse(input: {
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

function createConnectorActionPreviewResponse(input: {
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

function createDailyWorkWorkflowPreviewResponse(input: {
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

function createDailyWorkSessionRestorePreviewResponse(input: {
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

function selectWorkflowPreviewAction(
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

function createApprovalDecisionResponse(input: {
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

async function filterDailyWorkTemplates(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listTemplates();
}

async function filterDailyWorkTemplate(
  repository: DailyWorkRepository,
  mode: AppMode,
  templateId: string
) {
  return (await filterDailyWorkTemplates(repository, mode)).find(
    (template) => template.id === templateId
  );
}

async function filterDailyWorkArtifacts(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listArtifacts();
}

async function filterDailyWorkArtifact(
  repository: DailyWorkRepository,
  mode: AppMode,
  artifactId: string
) {
  return (await filterDailyWorkArtifacts(repository, mode)).find(
    (artifact) => artifact.id === artifactId
  );
}

async function filterDailyActivityEvents(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listEvents();
}

async function filterDailyActivityEvent(
  repository: DailyWorkRepository,
  mode: AppMode,
  eventId: string
) {
  return (await filterDailyActivityEvents(repository, mode)).find(
    (event) => event.id === eventId
  );
}

async function filterDailyWorkConnectors(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listConnectors();
}

async function filterDailyWorkConnector(
  repository: DailyWorkRepository,
  mode: AppMode,
  connectorId: string
) {
  return (await filterDailyWorkConnectors(repository, mode)).find(
    (connector) => connector.id === connectorId
  );
}

async function filterDailyWorkWorkflows(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listWorkflows();
}

async function filterDailyWorkWorkflow(
  repository: DailyWorkRepository,
  mode: AppMode,
  workflowId: string
) {
  return (await filterDailyWorkWorkflows(repository, mode)).find(
    (workflow) => workflow.id === workflowId
  );
}

async function filterDailyWorkSessionSummaries(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listSessionSummaries();
}

async function filterDailyWorkSessionDetail(
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

async function filterDailyWorkContextItems(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listContextItems();
}

async function filterDailyWorkContextItem(
  repository: DailyWorkRepository,
  mode: AppMode,
  contextItemId: string
) {
  return (await filterDailyWorkContextItems(repository, mode)).find(
    (item) => item.id === contextItemId
  );
}

async function filterDailyWorkApprovalRequests(
  repository: DailyWorkRepository,
  mode: AppMode
) {
  if (mode !== "daily_work") {
    return [];
  }

  return repository.listApprovalRequests();
}

function createDailyModelUsageSnapshot(mode: AppMode): DailyModelUsageResponse {
  return createDailyModelUsageResponse({
    mode,
    configured: hasDeepSeekApiKey(),
    baseUrl: process.env.DEEPSEEK_BASE_URL,
    fastModel: process.env.DEEPSEEK_MODEL_FAST,
    proModel: process.env.DEEPSEEK_MODEL_PRO,
    selectedRoute: process.env.DEEPSEEK_MODEL_ROUTE,
    thinkingMode: process.env.DEEPSEEK_THINKING_MODE,
    streamUsageEnabled:
      process.env.DEEPSEEK_STREAM_USAGE_ENABLED ??
      process.env.DEEPSEEK_STREAM_USAGE
  });
}

function hasDeepSeekApiKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

function createAgentLoopInput(chatRequest: ChatRequest, provider: ModelProvider) {
  return {
    provider,
    mode: chatRequest.mode,
    maxTurns: 1,
    ...(chatRequest.prompt ? { prompt: chatRequest.prompt } : {}),
    ...(chatRequest.messages ? { messages: chatRequest.messages } : {}),
    ...(chatRequest.sessionId ? { sessionId: chatRequest.sessionId } : {}),
    ...(chatRequest.context ? { context: chatRequest.context } : {})
  };
}

function createModelProvider(): {
  provider: ModelProvider;
  providerName: ChatProvider;
} {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    return {
      provider: new MockModelProvider(),
      providerName: "mock"
    };
  }

  const modelConfig = createDailyModelUsageSnapshot("daily_work").config;

  return {
    provider: new DeepSeekModelProvider({
      apiKey,
      baseUrl: modelConfig.baseUrl,
      model: modelConfig.selectedModel,
      thinkingMode: modelConfig.thinkingMode,
      includeUsage: modelConfig.streamUsageEnabled
    }),
    providerName: "deepseek"
  };
}

function modelStreamToReadableStream(
  chunks: AsyncIterable<ModelStreamChunk>
) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          if (chunk.type === "text-delta" && chunk.delta) {
            controller.enqueue(encoder.encode(chunk.delta));
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown model error";
        controller.enqueue(encoder.encode(`\n\n${message}`));
      } finally {
        controller.close();
      }
    }
  });
}

export async function startServer() {
  const app = await buildServer();
  const port = Number(process.env.SEEKDESK_API_PORT ?? process.env.PORT ?? 4000);
  const host = process.env.SEEKDESK_API_HOST ?? "127.0.0.1";

  await app.listen({ port, host });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
