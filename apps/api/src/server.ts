import {
  DeepSeekModelProvider,
  MockModelProvider,
  type ModelMessage,
  type ModelProvider
} from "@seekdesk/agent";
import {
  appModeSchema,
  defaultDailyWorkApprovalRequests,
  defaultDailyWorkConnectors,
  defaultDailyActivityEvents,
  defaultDailyWorkArtifacts,
  defaultDailyWorkContextItems,
  defaultDailyWorkSessionDetails,
  defaultDailyWorkSessionSummaries,
  defaultDailyWorkTemplates,
  defaultDailyWorkflows,
  createDailyActivityEventResponse,
  createDailyActivityEventsResponse,
  createDailyActivitySnapshotMessage,
  createDailyModelUsageResponse,
  type AppMode,
  type DailyApprovalRequestsResponse,
  type DailyWorkArtifactResponse,
  type DailyWorkArtifactsResponse,
  type DailyActivityEventResponse,
  type DailyActivityEventsResponse,
  type DailyWorkConnectorResponse,
  type DailyWorkConnectorsResponse,
  type DailyModelUsageResponse,
  type DailyWorkSessionResponse,
  type DailyWorkSessionsResponse,
  type DailyWorkTemplatesResponse,
  type DailyContextResponse,
  type DailyWorkWorkflowResponse,
  type DailyWorkflowsResponse
} from "@seekdesk/shared";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { pathToFileURL } from "node:url";

type ChatRequest = {
  mode?: AppMode;
  prompt?: string;
  messages?: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
};

type ChatRequestBody = ChatRequest | undefined;

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

export async function buildServer() {
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
  app.options("/api/daily/approvals", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/templates", async (_request, reply) =>
    reply.code(204).send()
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
  app.options("/api/daily/workflows", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/daily/workflows/:workflowId", async (_request, reply) =>
    reply.code(204).send()
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
        items: filterDailyWorkContextItems(mode)
      };
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/approvals",
    async (request): Promise<DailyApprovalRequestsResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        requests: filterDailyWorkApprovalRequests(mode)
      };
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/templates",
    async (request): Promise<DailyWorkTemplatesResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        templates: filterDailyWorkTemplates(mode)
      };
    }
  );

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/artifacts",
    async (request): Promise<DailyWorkArtifactsResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        artifacts: filterDailyWorkArtifacts(mode)
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
        sessions: filterDailyWorkSessionSummaries(mode)
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

      return {
        mode,
        session
      };
    }
  );

  app.get<{
    Params: { artifactId: string };
    Querystring: { mode?: string };
  }>(
    "/api/daily/artifacts/:artifactId",
    async (request, reply): Promise<DailyWorkArtifactResponse | void> => {
      const mode = normalizeAppMode(request.query.mode);
      const artifact = filterDailyWorkArtifact(mode, request.params.artifactId);

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
        events: filterDailyActivityEvents(mode)
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
      const event = filterDailyActivityEvent(mode, request.params.eventId);

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
        connectors: filterDailyWorkConnectors(mode)
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
      const connector = filterDailyWorkConnector(
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

  app.get<{ Querystring: { mode?: string } }>(
    "/api/daily/workflows",
    async (request): Promise<DailyWorkflowsResponse> => {
      const mode = normalizeAppMode(request.query.mode);

      return {
        mode,
        workflows: filterDailyWorkWorkflows(mode)
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
      const workflow = filterDailyWorkWorkflow(
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

  app.post<{ Body: ChatRequestBody }>("/api/chat", async (request, reply) => {
    const mode = normalizeAppMode(request.body?.mode);
    const messages = normalizeMessages(request.body);
    if (!messages.length) {
      return reply.code(400).send({
        error: "A prompt or at least one chat message is required."
      });
    }

    const stream = modelStreamToReadableStream(
      createModelProvider().streamChat({
        mode,
        messages,
        maxTurns: 1
      })
    );

    return reply
      .header("Content-Type", "text/plain; charset=utf-8")
      .header("Cache-Control", "no-cache, no-transform")
      .header("X-Accel-Buffering", "no")
      .send(stream);
  });

  app.get("/ws", { websocket: true }, (socket) => {
    socket.send(
      JSON.stringify({
        type: "connection.ready",
        service: "seekdesk-api",
        message: "WebSocket orchestration placeholder connected."
      })
    );
    socket.send(
      JSON.stringify(
        createDailyActivitySnapshotMessage({
          mode: "daily_work",
          events: filterDailyActivityEvents("daily_work")
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

function filterDailyWorkTemplates(mode: AppMode) {
  if (mode !== "daily_work") {
    return [];
  }

  return defaultDailyWorkTemplates;
}

function filterDailyWorkArtifacts(mode: AppMode) {
  if (mode !== "daily_work") {
    return [];
  }

  return defaultDailyWorkArtifacts;
}

function filterDailyWorkArtifact(mode: AppMode, artifactId: string) {
  return filterDailyWorkArtifacts(mode).find(
    (artifact) => artifact.id === artifactId
  );
}

function filterDailyActivityEvents(mode: AppMode) {
  if (mode !== "daily_work") {
    return [];
  }

  return defaultDailyActivityEvents;
}

function filterDailyActivityEvent(mode: AppMode, eventId: string) {
  return filterDailyActivityEvents(mode).find((event) => event.id === eventId);
}

function filterDailyWorkConnectors(mode: AppMode) {
  if (mode !== "daily_work") {
    return [];
  }

  return defaultDailyWorkConnectors;
}

function filterDailyWorkConnector(mode: AppMode, connectorId: string) {
  return filterDailyWorkConnectors(mode).find(
    (connector) => connector.id === connectorId
  );
}

function filterDailyWorkWorkflows(mode: AppMode) {
  if (mode !== "daily_work") {
    return [];
  }

  return defaultDailyWorkflows;
}

function filterDailyWorkWorkflow(mode: AppMode, workflowId: string) {
  return filterDailyWorkWorkflows(mode).find(
    (workflow) => workflow.id === workflowId
  );
}

function filterDailyWorkSessionSummaries(mode: AppMode) {
  if (mode !== "daily_work") {
    return [];
  }

  return defaultDailyWorkSessionSummaries;
}

function filterDailyWorkSessionDetail(mode: AppMode, sessionId: string) {
  if (mode !== "daily_work") {
    return undefined;
  }

  return defaultDailyWorkSessionDetails.find(
    (session) => session.id === sessionId
  );
}

function filterDailyWorkContextItems(mode: AppMode) {
  if (mode !== "daily_work") {
    return [];
  }

  return defaultDailyWorkContextItems;
}

function filterDailyWorkApprovalRequests(mode: AppMode) {
  if (mode !== "daily_work") {
    return [];
  }

  return defaultDailyWorkApprovalRequests;
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

function normalizeMessages(body: ChatRequestBody): ModelMessage[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  if (typeof body.prompt === "string" && body.prompt.trim()) {
    return [{ role: "user", content: body.prompt.trim() }];
  }

  if (!Array.isArray(body.messages)) {
    return [];
  }

  return body.messages
    .filter(
      (message) =>
        isSupportedRole(message.role) &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function isSupportedRole(role: string): role is "system" | "user" | "assistant" {
  return role === "system" || role === "user" || role === "assistant";
}

function createModelProvider(): ModelProvider {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    return new MockModelProvider();
  }

  const modelConfig = createDailyModelUsageSnapshot("daily_work").config;

  return new DeepSeekModelProvider({
    apiKey,
    baseUrl: modelConfig.baseUrl,
    model: modelConfig.selectedModel,
    thinkingMode: modelConfig.thinkingMode,
    includeUsage: modelConfig.streamUsageEnabled
  });
}

function modelStreamToReadableStream(
  chunks: AsyncIterable<{ type: string; delta?: string }>
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
