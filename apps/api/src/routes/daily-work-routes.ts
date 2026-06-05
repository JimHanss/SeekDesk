
import {
  connectorActionPreviewRequestSchema,
  createDailyActivityEventResponse,
  createDailyActivityEventsResponse,
  dailyApprovalDecisionRequestSchema,
  dailyContextUsePreviewRequestSchema,
  dailyWorkSessionRestorePreviewRequestSchema,
  dailyWorkTemplateApplyPreviewRequestSchema,
  dailyWorkWorkflowPreviewRequestSchema,
  type ConnectorActionPreviewResponse,
  type DailyActivityEventResponse,
  type DailyActivityEventsResponse,
  type DailyApprovalDecisionResponse,
  type DailyApprovalRequestsResponse,
  type DailyContextResponse,
  type DailyContextUsePreviewResponse,
  type DailyModelUsageResponse,
  type DailyWorkArtifactResponse,
  type DailyWorkArtifactsResponse,
  type DailyWorkConnectorResponse,
  type DailyWorkConnectorsResponse,
  type DailyWorkSessionResponse,
  type DailyWorkSessionRestorePreviewResponse,
  type DailyWorkSessionsResponse,
  type DailyWorkTemplateApplyPreviewResponse,
  type DailyWorkTemplatesResponse,
  type DailyWorkWorkflowPreviewResponse,
  type DailyWorkWorkflowResponse,
  type DailyWorkflowsResponse
} from "@seekdesk/shared";
import type { FastifyInstance } from "fastify";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import {
  createApprovalDecisionResponse,
  createConnectorActionPreviewResponse,
  createDailyContextUsePreviewResponse,
  createDailyModelUsageSnapshot,
  createDailyWorkSessionRestorePreviewResponse,
  createDailyWorkTemplateApplyPreviewResponse,
  createDailyWorkWorkflowPreviewResponse,
  createValidationError,
  filterDailyActivityEvent,
  filterDailyActivityEvents,
  filterDailyWorkApprovalRequests,
  filterDailyWorkArtifact,
  filterDailyWorkArtifacts,
  filterDailyWorkConnector,
  filterDailyWorkConnectors,
  filterDailyWorkContextItem,
  filterDailyWorkContextItems,
  filterDailyWorkSessionDetail,
  filterDailyWorkSessionSummaries,
  filterDailyWorkTemplate,
  filterDailyWorkTemplates,
  filterDailyWorkWorkflow,
  filterDailyWorkWorkflows,
  normalizeAppMode,
  selectWorkflowPreviewAction
} from "../services/daily-work-service.js";

export async function registerDailyWorkRoutes(
  app: FastifyInstance,
  dailyWorkRepository: DailyWorkRepository
) {
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
}
