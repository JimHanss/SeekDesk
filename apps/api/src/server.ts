
import {
  DeepSeekModelProvider,
  MockModelProvider,
  createDefaultToolRegistry,
  fromModelToolName,
  streamAgentLoop,
  type ModelStreamChunk,
  type ModelProvider
} from "@seekdesk/agent";
import {
  chatRequestSchema,
  createDailyActivitySnapshotMessage,
  toolNameSchema,
  type ChatProvider,
  type ChatRequest,
  type DailyActivityEvent,
  type ModelRoute,
  type ToolCallRecord,
  type ToolModelUsageRecord
} from "@seekdesk/shared";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import Fastify, {
  type FastifyReply,
  type FastifyRequest
} from "fastify";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  createDailyWorkRepositoryFromEnv,
  type DailyWorkRepository
} from "./repositories/daily-work-repository.js";
import { registerDailyWorkRoutes } from "./routes/daily-work-routes.js";
import { registerGoogleConnectorRoutes } from "./routes/google-connector-routes.js";
import { registerMicrosoftConnectorRoutes } from "./routes/microsoft-connector-routes.js";
import {
  createDailyModelUsageSnapshot,
  filterDailyActivityEvents
} from "./services/daily-work-service.js";
import { createDailyWorkAgentContext } from "./services/daily-work-agent-context.js";
import { createDailyWorkToolRuntime } from "./services/daily-work-tools.js";
import { createToolActivityEvent } from "./services/daily-work-tool-activity.js";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);
const defaultToolRegistry = createDefaultToolRegistry();

export async function buildServer(options?: {
  dailyWorkRepository?: DailyWorkRepository;
}) {
  const dailyWorkRepository =
    options?.dailyWorkRepository ?? createDailyWorkRepositoryFromEnv();
  const app = Fastify({
    logger: true
  });

  await app.register(websocket);
  await app.register(multipart);

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply);
  });

  app.options("/api/chat", async (_request, reply) => reply.code(204).send());

  await registerDailyWorkRoutes(app, dailyWorkRepository);
  await registerGoogleConnectorRoutes(app, dailyWorkRepository);
  await registerMicrosoftConnectorRoutes(app, dailyWorkRepository);

  app.get("/health", async () => ({
    status: "ok",
    service: "seekdesk-api",
    version: "0.1.0",
    ...(await dailyWorkRepository.getDataLayerStatus())
  }));

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
    const sessionId = chatRequest.sessionId ?? `chat-${randomUUID()}`;
    const agentContext =
      chatRequest.mode === "daily_work"
        ? await createDailyWorkAgentContext({
            repository: dailyWorkRepository,
            chatRequest,
            sessionId
          })
        : undefined;
    const providerSelection = createModelProvider({
      ...(agentContext?.modelRoute ? { modelRoute: agentContext.modelRoute } : {})
    });
    const toolRuntime =
      chatRequest.mode === "daily_work"
        ? createDailyWorkToolRuntime(dailyWorkRepository, {
            ...(agentContext?.allowedToolNames
              ? { allowedToolNames: agentContext.allowedToolNames }
              : {})
          })
        : undefined;
    await recordIncomingChatMessage({
      dailyWorkRepository,
      chatRequest,
      sessionId
    });
    const stream = modelStreamToReadableStream(
      streamAgentLoop(
        createAgentLoopInput(chatRequest, providerSelection.provider, {
          sessionId,
          ...(agentContext ? { agentContext } : {}),
          ...(toolRuntime ? { toolRuntime } : {})
        })
      ),
      {
        dailyWorkRepository,
        sessionId,
        providerName: providerSelection.providerName,
        modelName: providerSelection.modelName
      }
    );

    return reply
      .header("Content-Type", "text/plain; charset=utf-8")
      .header("Cache-Control", "no-cache, no-transform")
      .header("X-Accel-Buffering", "no")
      .header("X-SeekDesk-Chat-Mode", chatRequest.mode)
      .header("X-SeekDesk-Chat-Provider", providerSelection.providerName)
      .header("X-SeekDesk-Chat-Session-Id", sessionId)
      .send(stream);
  });

  app.get<{ Params: { sessionId: string } }>(
    "/api/chat/sessions/:sessionId/trace",
    async (request) => {
      const sessionId = request.params.sessionId.trim();
      const [toolCalls, modelUsageRecords, activityEvents] = await Promise.all([
        dailyWorkRepository.listToolCalls({ sessionId, limit: 100 }),
        dailyWorkRepository.listModelUsageRecords({ sessionId, limit: 100 }),
        dailyWorkRepository.listEvents()
      ]);

      return {
        mode: "daily_work",
        sessionId,
        toolCalls,
        toolActivityEvents: filterSessionToolActivityEvents(
          activityEvents,
          sessionId
        ),
        modelUsageRecords,
        modelUsageSummary: summarizeModelUsageRecords(modelUsageRecords),
        permissionBoundary: createAgentPermissionBoundary(),
        generatedAt: new Date().toISOString()
      };
    }
  );

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
  reply.header(
    "Access-Control-Expose-Headers",
    "X-SeekDesk-Chat-Mode,X-SeekDesk-Chat-Provider,X-SeekDesk-Chat-Session-Id"
  );
}

function createAgentLoopInput(
  chatRequest: ChatRequest,
  provider: ModelProvider,
  options: {
    sessionId: string;
    agentContext?: Awaited<ReturnType<typeof createDailyWorkAgentContext>>;
    toolRuntime?: ReturnType<typeof createDailyWorkToolRuntime>;
  }
) {
  return {
    provider,
    mode: chatRequest.mode,
    maxTurns: options.toolRuntime ? 3 : 1,
    ...(chatRequest.prompt ? { prompt: chatRequest.prompt } : {}),
    ...(chatRequest.messages ? { messages: chatRequest.messages } : {}),
    sessionId: options.sessionId,
    ...(options.agentContext
      ? { context: options.agentContext.context }
      : chatRequest.context
        ? { context: chatRequest.context }
        : {}),
    ...(options.agentContext?.summaryLines.length
      ? { contextSummaryLines: options.agentContext.summaryLines }
      : {}),
    ...(options.toolRuntime
      ? {
          tools: options.toolRuntime.modelTools,
          orchestrator: options.toolRuntime.orchestrator
        }
      : {})
  };
}

function createModelProvider(options: { modelRoute?: ModelRoute } = {}): {
  provider: ModelProvider;
  providerName: ChatProvider;
  modelName: string;
} {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    return {
      provider: new MockModelProvider(),
      providerName: "mock",
      modelName: "mock-daily-work"
    };
  }

  const modelConfig = createDailyModelUsageSnapshot(
    "daily_work",
    [],
    undefined,
    options.modelRoute ? { selectedRoute: options.modelRoute } : {}
  ).config;

  return {
    provider: new DeepSeekModelProvider({
      apiKey,
      baseUrl: modelConfig.baseUrl,
      model: modelConfig.selectedModel,
      thinkingMode: modelConfig.thinkingMode,
      includeUsage: modelConfig.streamUsageEnabled
    }),
    providerName: "deepseek",
    modelName: modelConfig.selectedModel
  };
}

async function recordIncomingChatMessage(input: {
  dailyWorkRepository: DailyWorkRepository;
  chatRequest: ChatRequest;
  sessionId: string;
}) {
  const message = input.chatRequest.prompt
    ? {
        role: "user" as const,
        content: input.chatRequest.prompt
      }
    : [...(input.chatRequest.messages ?? [])]
        .reverse()
        .find((candidate) => candidate.role === "user");

  if (!message?.content.trim()) {
    return;
  }

  await input.dailyWorkRepository.recordChatMessage({
    id: `message-${randomUUID()}`,
    sessionId: input.sessionId,
    role: message.role,
    content: message.content,
    createdAt: new Date().toISOString(),
    artifactIds: input.chatRequest.context?.artifactIds ?? [],
    contextItemIds: input.chatRequest.context?.contextItemIds ?? [],
    approvalRequestIds: input.chatRequest.context?.approvalRequestIds ?? []
  });
}

async function recordToolCallChunk(
  options: {
    dailyWorkRepository: DailyWorkRepository;
    sessionId: string;
  },
  chunk: Extract<ModelStreamChunk, { type: "tool-call" }>
) {
  const parsedName = parseRecordedToolName(chunk.name);
  if (!parsedName.success) {
    return;
  }

  const createdAt = new Date().toISOString();

  await options.dailyWorkRepository.recordToolCall({
    id: chunk.id ?? `tool-call-${randomUUID()}`,
    sessionId: options.sessionId,
    name: parsedName.data,
    status: "requested",
    inputJson: chunk.inputJson,
    previewOnly: true,
    permissionRequired: false,
    createdAt
  });
  await options.dailyWorkRepository.upsertActivityEvent(
    createToolActivityEvent({
      sessionId: options.sessionId,
      toolName: parsedName.data,
      status: "queued",
      timestamp: createdAt,
      inputJson: chunk.inputJson,
      ...(chunk.id ? { toolCallId: chunk.id } : {}),
      phase: "requested"
    })
  );
}

async function recordToolResultChunk(
  options: {
    dailyWorkRepository: DailyWorkRepository;
    sessionId: string;
  },
  chunk: Extract<ModelStreamChunk, { type: "tool-result" }>
) {
  const parsedName = parseRecordedToolName(chunk.name);
  if (!parsedName.success) {
    return;
  }

  const result = isToolCallResult(chunk.result) ? chunk.result : undefined;
  const status = normalizeToolRecordStatus(result?.status);
  const completedAt = new Date().toISOString();

  await options.dailyWorkRepository.recordToolCall({
    id: chunk.id ?? result?.id ?? `tool-call-${randomUUID()}`,
    sessionId: options.sessionId,
    name: parsedName.data,
    status,
    inputJson: result?.inputJson ?? {},
    outputJson: result?.outputJson ?? chunk.result,
    previewOnly: result?.previewOnly ?? true,
    permissionRequired: result?.permissionRequired ?? false,
    ...(result?.error ? { error: result.error } : {}),
    createdAt: completedAt,
    completedAt
  });
  await options.dailyWorkRepository.upsertActivityEvent(
    createToolActivityEvent({
      sessionId: options.sessionId,
      toolName: parsedName.data,
      status: status === "failed" ? "failed" : "completed",
      timestamp: completedAt,
      inputJson: result?.inputJson ?? {},
      outputJson: result?.outputJson ?? chunk.result,
      ...(result?.error ? { error: result.error } : {}),
      ...(chunk.id ?? result?.id
        ? { toolCallId: String(chunk.id ?? result?.id) }
        : {}),
      phase: "completed"
    })
  );
}

async function recordModelUsageChunk(
  options: {
    dailyWorkRepository: DailyWorkRepository;
    sessionId: string;
    providerName: ChatProvider;
    modelName: string;
  },
  chunk: Extract<ModelStreamChunk, { type: "usage" }>
) {
  const record: ToolModelUsageRecord = {
    id: `model-usage-${randomUUID()}`,
    sessionId: options.sessionId,
    provider: options.providerName,
    model: options.modelName,
    promptTokens: chunk.usage.promptTokens,
    completionTokens: chunk.usage.completionTokens,
    totalTokens: chunk.usage.totalTokens,
    createdAt: new Date().toISOString()
  };

  await options.dailyWorkRepository.recordModelUsage(record);
}

function isToolCallResult(value: unknown): value is {
  id?: string;
  name: string;
  status: string;
  inputJson?: unknown;
  outputJson?: unknown;
  previewOnly: boolean;
  permissionRequired: boolean;
  error?: string;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      "status" in value &&
      "previewOnly" in value &&
      "permissionRequired" in value
  );
}

function normalizeToolRecordStatus(
  status: string | undefined
): ToolCallRecord["status"] {
  if (
    status === "permission_required" ||
    status === "failed" ||
    status === "completed"
  ) {
    return status;
  }

  return "completed";
}

function parseRecordedToolName(name: string) {
  const direct = toolNameSchema.safeParse(name);
  if (direct.success) {
    return direct;
  }

  return toolNameSchema.safeParse(fromModelToolName(defaultToolRegistry, name));
}

function summarizeModelUsageRecords(records: ToolModelUsageRecord[]) {
  const latest = records.at(-1);

  return {
    provider: latest?.provider ?? "unknown",
    model: latest?.model ?? "unknown",
    promptTokens: records.reduce((sum, record) => sum + record.promptTokens, 0),
    completionTokens: records.reduce(
      (sum, record) => sum + record.completionTokens,
      0
    ),
    totalTokens: records.reduce((sum, record) => sum + record.totalTokens, 0),
    recordCount: records.length
  };
}

function createAgentPermissionBoundary() {
  return {
    previewOnly: true,
    externalEffects: ["none"],
    statement:
      "Daily-work agent tools may read authorized connector data and create local previews only. SeekDesk does not send email, create calendar events, write external documents, or run coding-agent tools in this mode."
  };
}

function filterSessionToolActivityEvents(
  events: DailyActivityEvent[],
  sessionId: string
) {
  return events
    .filter(
      (event) =>
        event.mode === "daily_work" &&
        event.relatedRefs.sessionIds.includes(sessionId) &&
        Boolean(event.metadata.toolName)
    )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-100);
}

function modelStreamToReadableStream(
  chunks: AsyncIterable<ModelStreamChunk>,
  options: {
    dailyWorkRepository: DailyWorkRepository;
    sessionId: string;
    providerName: ChatProvider;
    modelName: string;
  }
) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let assistantContent = "";
      try {
        for await (const chunk of chunks) {
          if (chunk.type === "text-delta" && chunk.delta) {
            assistantContent += chunk.delta;
            controller.enqueue(encoder.encode(chunk.delta));
          }

          if (chunk.type === "tool-call") {
            await recordToolCallChunk(options, chunk);
          }

          if (chunk.type === "tool-result") {
            await recordToolResultChunk(options, chunk);
          }

          if (chunk.type === "usage") {
            await recordModelUsageChunk(options, chunk);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown model error";
        controller.enqueue(encoder.encode(`\n\n${message}`));
      } finally {
        if (assistantContent.trim()) {
          await options.dailyWorkRepository.recordChatMessage({
            id: `message-${randomUUID()}`,
            sessionId: options.sessionId,
            role: "assistant",
            content: assistantContent,
            createdAt: new Date().toISOString()
          });
        }
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
