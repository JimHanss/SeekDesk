
import { randomUUID } from "node:crypto";

import {
  connectorActionPreviewRequestSchema,
  createDailyActivityEventResponse,
  createDailyActivityEventsResponse,
  dailyApprovalDecisionRequestSchema,
  dailyContextUsePreviewRequestSchema,
  dailyWorkPermissionGrantCreateRequestSchema,
  dailyWorkPermissionGrantRevokeRequestSchema,
  dailyWorkSessionRestorePreviewRequestSchema,
  dailyWorkTemplateApplyPreviewRequestSchema,
  dailyWorkTemplateCreateRequestSchema,
  dailyWorkTemplateDuplicateRequestSchema,
  dailyWorkTemplateSchema,
  dailyWorkTemplateUpdateRequestSchema,
  dailyWorkWorkflowPreviewRequestSchema,
  type ConnectorActionPreviewResponse,
  type DailyActivityEventResponse,
  type DailyActivityEventsResponse,
  type DailyApprovalDecisionResponse,
  type DailyApprovalRequestsResponse,
  type DailyContextResponse,
  type DailyContextUploadResponse,
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
  createApprovalDecisionActivityEvent,
  createApprovalDecisionResponse,
  createConnectorActionPreviewActivityEvent,
  createConnectorActionPreviewResponse,
  createContextUsePreviewActivityEvent,
  createDailyContextUsePreviewResponse,
  createDailyModelUsageSnapshot,
  createSessionRestoreActivityEvent,
  createSessionRestoreWriteback,
  createDailyWorkSessionRestorePreviewResponse,
  createTemplateApplyPreviewActivityEvent,
  createDailyWorkTemplateApplyPreviewResponse,
  createDailyWorkWorkflowPreviewResponse,
  createWorkflowPreviewActivityEvent,
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
import {
  ContextDocumentParseError,
  createContextDocumentFromUpload,
  maxContextUploadBytes
} from "../services/daily-work-context-documents.js";
import { executeMicrosoftWriteToolCall } from "../services/daily-work-tools.js";

export async function registerDailyWorkRoutes(
  app: FastifyInstance,
  dailyWorkRepository: DailyWorkRepository
) {
  app.options("/api/daily/context", async (_request, reply) =>
    reply.code(204).send()
  );

  app.options("/api/daily/context/uploads", async (_request, reply) =>
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

  app.options("/api/daily/templates/:templateId", async (_request, reply) =>
    reply.code(204).send()
  );

  app.options(
    "/api/daily/templates/:templateId/duplicate",
    async (_request, reply) => reply.code(204).send()
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

  app.options("/api/daily/permission-grants", async (_request, reply) =>
    reply.code(204).send()
  );

  app.options(
    "/api/daily/permission-grants/:grantId/revoke",
    async (_request, reply) => reply.code(204).send()
  );

  app.options(
    "/api/daily/tool-calls/:toolCallId/execute",
    async (_request, reply) => reply.code(204).send()
  );

  app.get<{ Querystring: { sessionId?: string; activeOnly?: string } }>(
    "/api/daily/permission-grants",
    async (request) => ({
      mode: "daily_work",
      grants: await dailyWorkRepository.listPermissionGrants({
        ...(request.query.sessionId ? { sessionId: request.query.sessionId } : {}),
        activeOnly: request.query.activeOnly === "true",
        limit: 100
      })
    })
  );

  app.post<{ Body: unknown }>(
    "/api/daily/permission-grants",
    async (request, reply) => {
      const parsed = dailyWorkPermissionGrantCreateRequestSchema.safeParse(
        request.body ?? {}
      );
      if (!parsed.success) {
        reply
          .code(400)
          .send(
            createValidationError(
              "Invalid permission grant request.",
              parsed.error.issues
            )
          );
        return;
      }

      const now = new Date();
      const grant = await dailyWorkRepository.upsertPermissionGrant({
        id: `daily-work-grant-${randomUUID()}`,
        mode: "daily_work",
        provider: parsed.data.provider,
        sessionId: parsed.data.sessionId,
        action: parsed.data.action,
        decision: "allow_for_session",
        status: "active",
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      });

      return {
        mode: "daily_work",
        grant
      };
    }
  );

  app.post<{ Params: { grantId: string }; Body: unknown }>(
    "/api/daily/permission-grants/:grantId/revoke",
    async (request, reply) => {
      const parsed = dailyWorkPermissionGrantRevokeRequestSchema.safeParse(
        request.body ?? {}
      );
      if (!parsed.success) {
        reply
          .code(400)
          .send(
            createValidationError(
              "Invalid permission grant revoke request.",
              parsed.error.issues
            )
          );
        return;
      }

      const grant = (
        await dailyWorkRepository.listPermissionGrants({ limit: 200 })
      ).find((item) => item.id === request.params.grantId);
      if (!grant) {
        reply.code(404).send({
          mode: "daily_work",
          error: "Daily-work permission grant not found."
        });
        return;
      }

      const revoked = await dailyWorkRepository.upsertPermissionGrant({
        ...grant,
        status: "revoked",
        ...(parsed.data.reason
          ? { reason: parsed.data.reason }
          : grant.reason
            ? { reason: grant.reason }
            : {}),
        revokedAt: new Date().toISOString()
      });

      return {
        mode: "daily_work",
        grant: revoked
      };
    }
  );

  app.post<{ Params: { toolCallId: string }; Body: unknown }>(
    "/api/daily/tool-calls/:toolCallId/execute",
    async (request, reply) => {
      const body = request.body && typeof request.body === "object"
        ? (request.body as { sessionId?: unknown; mode?: unknown })
        : {};
      const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
      const mode = normalizeAppMode(
        typeof body.mode === "string" ? body.mode : undefined
      );

      if (mode !== "daily_work" || !sessionId) {
        reply.code(400).send({
          mode,
          error: "Tool execution requires a daily_work mode and sessionId."
        });
        return;
      }

      try {
        return await executeMicrosoftWriteToolCall({
          repository: dailyWorkRepository,
          sessionId,
          toolCallId: request.params.toolCallId
        });
      } catch (error) {
        reply.code(statusCodeForToolExecutionError(error)).send({
          mode: "daily_work",
          error: codeForToolExecutionError(error),
          message: messageForToolExecutionError(error)
        });
        return;
      }
    }
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

  app.post(
      "/api/daily/context/uploads",
      async (request, reply): Promise<DailyContextUploadResponse | void> => {
        if (!request.isMultipart()) {
          reply.code(400).send({
            mode: "daily_work",
            error: "Context upload requires multipart/form-data."
          });
          return;
        }

        try {
          const upload = await request.file({
            limits: {
              fileSize: maxContextUploadBytes,
              files: 1,
              fields: 8
            }
          });

          if (!upload) {
            reply.code(400).send({
              mode: "daily_work",
              error: "No file was uploaded."
            });
            return;
          }

          const title = readMultipartField(upload.fields, "title");
          const result = await createContextDocumentFromUpload({
            buffer: await upload.toBuffer(),
            originalFileName: upload.filename,
            mimeType: upload.mimetype,
            ...(title ? { title } : {}),
            tags: readMultipartTags(upload.fields)
          });
          await dailyWorkRepository.upsertContextDocument(result.document);
          await dailyWorkRepository.upsertContextItem(result.contextItem);

          return {
            mode: "daily_work",
            document: result.document,
            contextItem: result.contextItem,
            previewOnly: true,
            externalEffects: ["none"]
          };
        } catch (error) {
          if (error instanceof ContextDocumentParseError) {
            reply.code(400).send({
              mode: "daily_work",
              error: error.code,
              message: error.message
            });
            return;
          }

          if (isMultipartFileTooLargeError(error)) {
            reply.code(413).send({
              mode: "daily_work",
              error: "file_too_large",
              maxBytes: maxContextUploadBytes
            });
            return;
          }

          throw error;
        }
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

        const response = createDailyContextUsePreviewResponse({
          mode,
          contextItem,
          ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {}),
          ...(parsed.data.templateId ? { templateId: parsed.data.templateId } : {})
        });
        await dailyWorkRepository.upsertActivityEvent(
          createContextUsePreviewActivityEvent({
            mode,
            contextItem,
            response
          })
        );

        return response;
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

        const response = createApprovalDecisionResponse({
          mode,
          approvalRequest,
          decisionInput: parsed.data.decision,
          ...(parsed.data.reason ? { reason: parsed.data.reason } : {})
        });
        await dailyWorkRepository.updateApprovalRequest(response.request);
        await dailyWorkRepository.upsertActivityEvent(
          createApprovalDecisionActivityEvent({
            mode,
            response
          })
        );

        return response;
      }
    );

  app.get<{ Querystring: { mode?: string; activeOnly?: string } }>(
      "/api/daily/templates",
      async (request): Promise<DailyWorkTemplatesResponse> => {
        const mode = normalizeAppMode(request.query.mode);
        const templates = await filterDailyWorkTemplates(dailyWorkRepository, mode);

        return {
          mode,
          templates:
            request.query.activeOnly === "true"
              ? templates.filter((template) => template.status === "active" && template.enabled)
              : templates
        };
      }
    );

  app.post<{ Body: unknown }>(
      "/api/daily/templates",
      async (request, reply) => {
        const parsed = dailyWorkTemplateCreateRequestSchema.safeParse(
          request.body ?? {}
        );
        if (!parsed.success) {
          reply
            .code(400)
            .send(
              createValidationError("Invalid template create request.", parsed.error.issues)
            );
          return;
        }

        const mode = normalizeAppMode(parsed.data.mode);
        if (mode !== "daily_work") {
          reply.code(400).send({
            mode,
            error: "Templates are only editable in daily_work mode."
          });
          return;
        }

        const now = new Date().toISOString();
        const template = dailyWorkTemplateSchema.parse({
          ...parsed.data,
          id: createTemplateId(parsed.data.title),
          mode,
          createdAt: now,
          updatedAt: now,
          version: 1,
          status: parsed.data.enabled === false ? "disabled" : parsed.data.status
        });
        await dailyWorkRepository.upsertTemplate(template);

        return { mode, template };
      }
    );

  app.patch<{ Params: { templateId: string }; Body: unknown }>(
      "/api/daily/templates/:templateId",
      async (request, reply) => {
        const parsed = dailyWorkTemplateUpdateRequestSchema.safeParse(
          request.body ?? {}
        );
        if (!parsed.success) {
          reply
            .code(400)
            .send(
              createValidationError("Invalid template update request.", parsed.error.issues)
            );
          return;
        }

        const mode = normalizeAppMode(parsed.data.mode);
        const existing = (await dailyWorkRepository.listTemplates()).find(
          (template) => template.id === request.params.templateId && template.status !== "archived"
        );
        if (mode !== "daily_work" || !existing) {
          reply.code(existing ? 400 : 404).send({
            mode,
            error: existing
              ? "Templates are only editable in daily_work mode."
              : "Daily-work template not found."
          });
          return;
        }

        const template = dailyWorkTemplateSchema.parse({
          ...existing,
          ...parsed.data,
          id: existing.id,
          mode,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
          version: existing.version + 1,
          status: parsed.data.enabled === false ? "disabled" : (parsed.data.status ?? existing.status)
        });
        await dailyWorkRepository.upsertTemplate(template);

        return { mode, template };
      }
    );

  app.post<{ Params: { templateId: string }; Body: unknown }>(
      "/api/daily/templates/:templateId/duplicate",
      async (request, reply) => {
        const parsed = dailyWorkTemplateDuplicateRequestSchema.safeParse(
          request.body ?? {}
        );
        if (!parsed.success) {
          reply
            .code(400)
            .send(
              createValidationError("Invalid template duplicate request.", parsed.error.issues)
            );
          return;
        }

        const mode = normalizeAppMode(parsed.data.mode);
        const existing = (await filterDailyWorkTemplates(dailyWorkRepository, mode)).find(
          (template) => template.id === request.params.templateId
        );
        if (!existing) {
          reply.code(404).send({ mode, error: "Daily-work template not found." });
          return;
        }

        const now = new Date().toISOString();
        const title = parsed.data.title ?? `${existing.title} Copy`;
        const template = dailyWorkTemplateSchema.parse({
          ...existing,
          id: createTemplateId(title),
          title,
          status: "active",
          enabled: true,
          version: 1,
          createdAt: now,
          updatedAt: now
        });
        await dailyWorkRepository.upsertTemplate(template);

        return { mode, template };
      }
    );

  app.delete<{ Params: { templateId: string }; Querystring: { mode?: string } }>(
      "/api/daily/templates/:templateId",
      async (request, reply) => {
        const mode = normalizeAppMode(request.query.mode);
        const existing = (await dailyWorkRepository.listTemplates()).find(
          (template) => template.id === request.params.templateId && template.status !== "archived"
        );
        if (mode !== "daily_work" || !existing) {
          reply.code(existing ? 400 : 404).send({
            mode,
            error: existing
              ? "Templates are only editable in daily_work mode."
              : "Daily-work template not found."
          });
          return;
        }

        const template = dailyWorkTemplateSchema.parse({
          ...existing,
          status: "archived",
          enabled: false,
          version: existing.version + 1,
          updatedAt: new Date().toISOString()
        });
        await dailyWorkRepository.upsertTemplate(template);

        return { mode, template };
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

        const response = createDailyWorkTemplateApplyPreviewResponse({
          mode,
          template,
          contextItemIds: parsed.data.contextItemIds,
          ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {})
        });
        await dailyWorkRepository.upsertActivityEvent(
          createTemplateApplyPreviewActivityEvent({
            mode,
            template,
            response
          })
        );

        return response;
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

  app.get<{ Querystring: { mode?: string; sessionId?: string } }>(
      "/api/daily/model-usage",
      async (request): Promise<DailyModelUsageResponse> => {
        const mode = normalizeAppMode(request.query.mode);
        const records = await dailyWorkRepository.listModelUsageRecords({
          limit: 200
        });

        return createDailyModelUsageSnapshot(mode, records, request.query.sessionId);
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

        const response = createDailyWorkSessionRestorePreviewResponse({
          mode,
          session,
          includeRecentMessages: parsed.data.includeRecentMessages,
          ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {})
        });
        const updatedSession = createSessionRestoreWriteback({
          session,
          response
        });
        await dailyWorkRepository.updateSessionDetail(updatedSession);
        await dailyWorkRepository.upsertActivityEvent(
          createSessionRestoreActivityEvent({
            mode,
            session: updatedSession,
            response
          })
        );

        return response;
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

        const response = createConnectorActionPreviewResponse({
          mode,
          connector,
          action: parsed.data.action,
          contextItemIds: parsed.data.contextItemIds,
          ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {})
        });
        await dailyWorkRepository.upsertActivityEvent(
          createConnectorActionPreviewActivityEvent({
            mode,
            connector,
            response
          })
        );

        return response;
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

        const response = createDailyWorkWorkflowPreviewResponse({
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
        await dailyWorkRepository.upsertActivityEvent(
          createWorkflowPreviewActivityEvent({
            mode,
            workflow,
            response
          })
        );

        return response;
      }
    );
}

function readMultipartField(fields: unknown, name: string) {
  const value = readMultipartRawField(fields, name);
  return value ? String(value).trim() : undefined;
}

function readMultipartTags(fields: unknown) {
  const value = readMultipartRawField(fields, "tags");
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function readMultipartRawField(fields: unknown, name: string) {
  if (!fields || typeof fields !== "object") {
    return undefined;
  }

  const field = (fields as Record<string, unknown>)[name];
  if (!field || typeof field !== "object") {
    return undefined;
  }

  const value = (field as { value?: unknown }).value;
  return typeof value === "string" ? value : undefined;
}

function isMultipartFileTooLargeError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "RequestFileTooLargeError" ||
      error.message.toLowerCase().includes("request file too large"))
  );
}

function createTemplateId(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `agent-template-${slug || "template"}-${randomUUID().slice(0, 8)}`;
}

function statusCodeForToolExecutionError(error: unknown) {
  const code = codeForToolExecutionError(error);

  if (code === "tool_call_not_found") {
    return 404;
  }

  if (code === "unsupported_tool" || code === "invalid_tool_input") {
    return 400;
  }

  if (code === "permission_required") {
    return 403;
  }

  if (code === "connector_not_connected" || code === "connector_missing_scopes") {
    return 409;
  }

  if (code === "microsoft_oauth_not_configured") {
    return 424;
  }

  return 500;
}

function codeForToolExecutionError(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "tool_execution_failed");
  }

  return "tool_execution_failed";
}

function messageForToolExecutionError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}