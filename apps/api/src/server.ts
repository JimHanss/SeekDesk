
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
  codingChatRequestSchema,
  normalizeRuntimeMode,
  createDailyActivitySnapshotMessage,
  toolNameSchema,
  type ChatProvider,
  type ChatRequest,
  type DailyActivityEvent,
  type ModelRoute,
  type RuntimeMode,
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
import { registerCodingRoutes } from "./routes/coding-routes.js";
import { registerCodingWorkspaceRoutes } from "./routes/coding-workspace-routes.js";
import { registerDaemonPairingRoutes } from "./routes/daemon-pairing-routes.js";
import { sendRuntimeError } from "./routes/runtime-http.js";
import { DaemonRegistry } from "./services/daemon-registry.js";
import {
  createDaemonDeviceTokenServiceFromEnv,
  type DaemonDeviceTokenService
} from "./services/daemon-device-token.js";
import { DaemonPairingService } from "./services/daemon-pairing-service.js";
import {
  createCloudRuntimeClientFromEnv,
  type CloudRuntimeClient
} from "./services/cloud-runtime-client.js";
import {
  createCredentialCipherFromEnv,
  type CredentialCipher
} from "./services/credential-crypto.js";
import {
  createDailyModelUsageSnapshot,
  filterDailyActivityEvents
} from "./services/daily-work-service.js";
import { createDailyWorkAgentContext } from "./services/daily-work-agent-context.js";
import { createCodingToolRuntime } from "./services/coding-tools.js";
import { createToolActivityEvent } from "./services/daily-work-tool-activity.js";
import {
  ActorAuthError,
  createActorContextResolver,
  type ActorContextResolver
} from "./services/actor-context.js";
import { CodingRuntimeError } from "./services/coding-runtime.js";
import { RuntimeResolver } from "./services/runtime-resolver.js";

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const defaultToolRegistry = createDefaultToolRegistry();

export async function buildServer(options?: {
  dailyWorkRepository?: DailyWorkRepository;
  actorContextResolver?: ActorContextResolver;
  daemonRegistry?: DaemonRegistry;
  daemonDeviceTokenService?: DaemonDeviceTokenService;
  daemonPairingService?: DaemonPairingService;
  cloudRuntimeClient?: CloudRuntimeClient;
  credentialCipher?: Pick<CredentialCipher, "decrypt">;
  runtimeResolver?: RuntimeResolver;
}) {
  const dailyWorkRepository =
    options?.dailyWorkRepository ?? createDailyWorkRepositoryFromEnv();
  const app = Fastify({
    logger: true
  });
  const daemonDeviceTokenService =
    options?.daemonDeviceTokenService ?? createDaemonDeviceTokenServiceFromEnv();
  const daemonPairingService =
    options?.daemonPairingService ?? new DaemonPairingService(daemonDeviceTokenService);
  const daemonRegistry =
    options?.daemonRegistry ?? new DaemonRegistry(undefined, daemonDeviceTokenService);
  const actorContextResolver = options?.actorContextResolver ?? createActorContextResolver();
  const cloudRuntimeClient = options?.cloudRuntimeClient ?? createCloudRuntimeClientFromEnv();
  const credentialCipher = options?.credentialCipher ?? (
    process.env.SEEKDESK_CREDENTIAL_ENCRYPTION_KEY
      ? createCredentialCipherFromEnv()
      : undefined
  );
  const runtimeResolver = options?.runtimeResolver ?? new RuntimeResolver({
    repository: dailyWorkRepository,
    daemonRegistry,
    cloudRuntimeClient
  });

  await app.register(websocket);
  await app.register(multipart);
  app.decorateRequest("actor");

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply);
    if (isPublicRequest(request)) {
      return;
    }
    try {
      request.actor = await actorContextResolver.resolve(request);
    } catch (error) {
      if (error instanceof ActorAuthError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }
      throw error;
    }
  });

  app.options("/api/chat", async (_request, reply) => reply.code(204).send());

  await registerDailyWorkRoutes(app, dailyWorkRepository);
  await registerCodingRoutes(app, dailyWorkRepository, runtimeResolver);
  await registerDaemonPairingRoutes(app, daemonPairingService);
  await registerCodingWorkspaceRoutes(
    app,
    dailyWorkRepository,
    runtimeResolver,
    cloudRuntimeClient,
    credentialCipher
  );

  app.get("/health", async () => ({
    status: "ok",
    service: "seekdesk-api",
    version: "0.1.0",
    ...(await dailyWorkRepository.getDataLayerStatus()),
    auth: actorContextResolver.readiness,
    daemonPairing: daemonPairingService.readiness,
    runtime: await runtimeResolver.health()
  }));

  app.post<{ Body: unknown }>("/api/chat", async (request, reply) => {
    const parsed = codingChatRequestSchema.safeParse(request.body);
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
    const ownerId = request.actor.ownerId;
    const sessionId = chatRequest.sessionId ?? `chat-${randomUUID()}`;
    let codingResolution: Awaited<ReturnType<RuntimeResolver["resolve"]>> | undefined;
    if (chatRequest.mode === "coding_agent") {
      try {
        codingResolution = await resolveCodingChatWorkspace({
          repository: dailyWorkRepository,
          resolver: runtimeResolver,
          ownerId,
          sessionId,
          hasExplicitSessionId: Boolean(chatRequest.sessionId),
          workspaceId: chatRequest.context?.workspaceId,
          runtimeMode: chatRequest.context?.runtimeMode
        });
      } catch (error) {
        return sendRuntimeError(reply, error);
      }
    }
    const incomingUserMessage = findIncomingUserMessage(chatRequest);
    const shouldGenerateSessionTitle =
      !chatRequest.sessionId &&
      chatRequest.context?.["generateSessionTitle"] === true &&
      Boolean(incomingUserMessage?.content.trim());
    const agentContext =
      chatRequest.mode === "daily_work"
        ? await createDailyWorkAgentContext({
            repository: dailyWorkRepository,
            chatRequest,
            sessionId
          })
        : undefined;
    const providerSelection = createModelProvider({
      mode: chatRequest.mode,
      ...(agentContext?.modelRoute ? { modelRoute: agentContext.modelRoute } : {})
    });
    const toolRuntime =
      chatRequest.mode === "coding_agent"
        ? createCodingToolRuntime({
            runtime: codingResolution!.runtime
          })
        : undefined;
    await recordIncomingChatMessage({
      dailyWorkRepository,
      chatRequest,
      sessionId,
      ownerId,
      ...(codingResolution ? { workspace: codingResolution.workspace } : {})
    });
    const generatedSessionTitle = shouldGenerateSessionTitle && incomingUserMessage
      ? await generateSessionTitle({
          provider: providerSelection.provider,
          providerName: providerSelection.providerName,
          prompt: incomingUserMessage.content
        })
      : null;

    if (generatedSessionTitle) {
      await updateChatSessionTitle(dailyWorkRepository, ownerId, sessionId, generatedSessionTitle);
    }

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
        ownerId,
        workspaceId: codingResolution?.workspace.workspaceId ?? chatRequest.context?.workspaceId ?? "workspace-seekdesk",
        runtimeMode: codingResolution?.workspace.runtimeMode ?? "server_local",
        providerName: providerSelection.providerName,
        modelName: providerSelection.modelName
      }
    );

    const chatReply = reply
      .header("Content-Type", "text/plain; charset=utf-8")
      .header("Cache-Control", "no-cache, no-transform")
      .header("X-Accel-Buffering", "no")
      .header("X-SeekDesk-Chat-Mode", chatRequest.mode)
      .header("X-SeekDesk-Chat-Provider", providerSelection.providerName)
      .header("X-SeekDesk-Chat-Session-Id", sessionId);

    if (generatedSessionTitle) {
      chatReply.header(
        "X-SeekDesk-Chat-Session-Title",
        encodeURIComponent(generatedSessionTitle)
      );
    }

    return chatReply.send(stream);
  });

  app.get<{ Params: { sessionId: string } }>(
    "/api/chat/sessions/:sessionId/trace",
    async (request) => {
      const sessionId = request.params.sessionId.trim();
      const ownerId = request.actor.ownerId;
      const [sessions, toolCalls] = await Promise.all([
        dailyWorkRepository.listSessionDetails({ ownerId }),
        dailyWorkRepository.listToolCalls({ ownerId, sessionId, limit: 100 })
      ]);
      const session = sessions.find((candidate) => candidate.id === sessionId);
      const workspaceId = session?.workspaceId ?? toolCalls.at(-1)?.workspaceId;
      const runtimeMode = session?.workspaceRuntimeMode
        ? normalizeRuntimeMode(session.workspaceRuntimeMode)
        : toolCalls.at(-1)?.runtimeMode
          ? normalizeRuntimeMode(toolCalls.at(-1)!.runtimeMode)
          : undefined;
      const scope = {
        ownerId,
        sessionId,
        ...(workspaceId ? { workspaceId } : {}),
        ...(runtimeMode ? { runtimeMode } : {}),
        limit: 100
      };
      const [modelUsageRecords, activityEvents, permissionGrants, workspace, operations] =
        await Promise.all([
          dailyWorkRepository.listModelUsageRecords(scope),
          dailyWorkRepository.listEvents({ ownerId }),
          dailyWorkRepository.listPermissionGrants(scope),
          workspaceId ? runtimeResolver.getWorkspace(ownerId, workspaceId) : null,
          workspaceId
            ? dailyWorkRepository.listRuntimeOperations({ ownerId, workspaceId, limit: 10 })
            : []
        ]);

      return {
        mode: "coding_agent",
        sessionId,
        ...(workspace ? { workspace } : {}),
        ...(workspaceId ? { workspaceId } : {}),
        ...(runtimeMode ? { runtimeMode } : {}),
        operations,
        ...(operations[0] ? { latestOperation: operations[0] } : {}),
        toolCalls,
        toolActivityEvents: filterSessionToolActivityEvents(
          activityEvents,
          sessionId
        ),
        modelUsageRecords,
        modelUsageSummary: summarizeModelUsageRecords(modelUsageRecords),
        permissionGrants,
        permissionBoundary: createAgentPermissionBoundary(),
        generatedAt: new Date().toISOString()
      };
    }
  );

  app.get("/ws/daemon", { websocket: true }, async (socket) => {
    daemonRegistry.handleConnection(socket);
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
  if (origin && getAllowedOrigins().has(origin)) {
    reply.header("Access-Control-Allow-Origin", origin);
  }

  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  reply.header(
    "Access-Control-Expose-Headers",
    "X-SeekDesk-Chat-Mode,X-SeekDesk-Chat-Provider,X-SeekDesk-Chat-Session-Id,X-SeekDesk-Chat-Session-Title"
  );
}

function isPublicRequest(request: FastifyRequest) {
  const path = request.url.split("?", 1)[0];
  return request.method === "OPTIONS" ||
    path === "/health" ||
    path === "/ws/daemon" ||
    path === "/api/coding/daemon-pairings/claim";
}

function getAllowedOrigins() {
  const configuredOrigins = [
    ...(process.env.SEEKDESK_WEB_ORIGIN
      ? [process.env.SEEKDESK_WEB_ORIGIN]
      : []),
    ...(process.env.SEEKDESK_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  ];

  return new Set([...defaultAllowedOrigins, ...configuredOrigins]);
}

function createAgentLoopInput(
  chatRequest: ChatRequest,
  provider: ModelProvider,
  options: {
    sessionId: string;
    agentContext?: Awaited<ReturnType<typeof createDailyWorkAgentContext>>;
    toolRuntime?: ReturnType<typeof createCodingToolRuntime>;
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

function createModelProvider(options: {
  mode?: ChatRequest["mode"];
  modelRoute?: ModelRoute;
} = {}): {
  provider: ModelProvider;
  providerName: ChatProvider;
  modelName: string;
} {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    return {
      provider: new MockModelProvider(),
      providerName: "mock",
      modelName: options.mode === "daily_work" ? "mock-daily-work" : "mock-coding-agent"
    };
  }

  const modelConfig = createDailyModelUsageSnapshot(
    options.mode ?? "coding_agent",
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

async function resolveCodingChatWorkspace(input: {
  repository: DailyWorkRepository;
  resolver: RuntimeResolver;
  ownerId: string;
  sessionId: string;
  hasExplicitSessionId: boolean;
  workspaceId?: string | undefined;
  runtimeMode?: RuntimeMode | undefined;
}) {
  const session = (await input.repository.listSessionDetails({ ownerId: input.ownerId }))
    .find((candidate) => candidate.id === input.sessionId);
  if (session) {
    const sessionRuntimeMode = normalizeRuntimeMode(
      session.workspaceRuntimeMode ?? (
        session.workspaceId === "server-local-runtime" ? "server_local" : "local_daemon"
      )
    );
    if (
      session.appMode !== "coding_agent" ||
      session.workspaceId !== input.workspaceId ||
      (input.runtimeMode && normalizeRuntimeMode(input.runtimeMode) !== sessionRuntimeMode)
    ) {
      throw new CodingRuntimeError(
        "The chat request does not match the persisted session workspace.",
        "session_workspace_mismatch",
        {
          sessionId: input.sessionId,
          expectedWorkspaceId: session.workspaceId,
          expectedRuntimeMode: sessionRuntimeMode,
          actualWorkspaceId: input.workspaceId,
          actualRuntimeMode: input.runtimeMode
        }
      );
    }
    return input.resolver.resolve(
      input.ownerId,
      session.workspaceId,
      sessionRuntimeMode
    );
  }
  if (input.hasExplicitSessionId && !input.workspaceId) {
    throw new CodingRuntimeError("Coding session was not found.", "session_not_found", {
      sessionId: input.sessionId
    });
  }
  return input.resolver.resolve(input.ownerId, input.workspaceId, input.runtimeMode);
}

async function recordIncomingChatMessage(input: {
  dailyWorkRepository: DailyWorkRepository;
  chatRequest: ChatRequest;
  sessionId: string;
  ownerId: string;
  workspace?: { workspaceId: string; name: string; rootPath: string; runtimeMode: string };
}) {
  const message = findIncomingUserMessage(input.chatRequest);

  if (!message?.content.trim()) {
    return;
  }

  const workspaceId = input.workspace?.workspaceId ?? input.chatRequest.context?.workspaceId;

  await input.dailyWorkRepository.recordChatMessage({
    id: `message-${randomUUID()}`,
    ownerId: input.ownerId,
    sessionId: input.sessionId,
    appMode: input.chatRequest.mode,
    role: message.role,
    content: message.content,
    createdAt: new Date().toISOString(),
    artifactIds: input.chatRequest.context?.artifactIds ?? [],
    contextItemIds: input.chatRequest.context?.contextItemIds ?? [],
    approvalRequestIds: input.chatRequest.context?.approvalRequestIds ?? [],
    ...(workspaceId ? { workspaceId } : {}),
    ...(input.workspace?.name ? { workspaceName: input.workspace.name } : {}),
    ...(input.workspace?.rootPath ? { workspaceRoot: input.workspace.rootPath } : {}),
    ...(input.workspace?.runtimeMode ? { workspaceRuntimeMode: input.workspace.runtimeMode } : {})
  });
}

function findIncomingUserMessage(chatRequest: ChatRequest) {
  if (chatRequest.prompt?.trim()) {
    return {
      role: "user" as const,
      content: chatRequest.prompt
    };
  }

  return [...(chatRequest.messages ?? [])]
    .reverse()
    .find((candidate) => candidate.role === "user");
}

async function generateSessionTitle(input: {
  provider: ModelProvider;
  providerName: ChatProvider;
  prompt: string;
}) {
  const fallbackTitle = createFallbackSessionTitle(input.prompt);

  if (input.providerName !== "deepseek") {
    return fallbackTitle;
  }

  let content = "";

  try {
    for await (const chunk of input.provider.streamChat({
      mode: "coding_agent",
      maxTurns: 1,
      toolChoice: "none",
      messages: [
        {
          role: "user",
          content:
            "Create a short Chinese conversation title from this first user message. Return only the title, no punctuation wrapper, no explanation. Limit to 16 Chinese characters or 6 English words. Message: " +
            input.prompt
        }
      ]
    })) {
      if (chunk.type === "text-delta") {
        content += chunk.delta;
      }
    }
  } catch {
    return fallbackTitle;
  }

  return normalizeSessionTitle(content) ?? fallbackTitle;
}

async function updateChatSessionTitle(
  dailyWorkRepository: DailyWorkRepository,
  ownerId: string,
  sessionId: string,
  title: string
) {
  try {
    const sessions = await dailyWorkRepository.listSessionDetails({ ownerId });
    const session = sessions.find((item) => item.id === sessionId);

    if (!session) {
      return;
    }

    await dailyWorkRepository.updateSessionDetail({
      ...session,
      title
    });
  } catch {
    // Title generation is progressive enhancement. Chat streaming must continue.
  }
}

function createFallbackSessionTitle(prompt: string) {
  return normalizeSessionTitle(prompt) ?? "New chat";
}

function normalizeSessionTitle(value: string) {
  const title = value
    .replace(/[\r\n]+/g, " ")
    .replace(/^title\s*[:?]\s*/i, "")
    .replace(/^["'“”‘’]+|["'“”‘’.,，。]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) {
    return null;
  }

  return title.length > 32 ? `${title.slice(0, 31)}...` : title;
}

async function recordToolCallChunk(
  options: {
    dailyWorkRepository: DailyWorkRepository;
    sessionId: string;
    ownerId: string;
    workspaceId: string;
    runtimeMode: RuntimeMode;
  },
  chunk: Extract<ModelStreamChunk, { type: "tool-call" }>
) {
  const parsedName = parseRecordedToolName(chunk.name);
  if (!parsedName.success) {
    return;
  }

  const createdAt = new Date().toISOString();
  const toolCallId = chunk.id ?? `tool-call-${randomUUID()}`;
  const requestId = chunk.id ?? `request-${randomUUID()}`;

  await options.dailyWorkRepository.recordToolCall({
    id: toolCallId,
    ownerId: options.ownerId,
    sessionId: options.sessionId,
    workspaceId: options.workspaceId,
    runtimeMode: options.runtimeMode,
    requestId,
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
      toolCallId,
      runtimeMode: options.runtimeMode,
      requestId,
      phase: "requested"
    }),
    {
      ownerId: options.ownerId,
      workspaceId: options.workspaceId,
      runtimeMode: options.runtimeMode
    }
  );
}

async function recordToolResultChunk(
  options: {
    dailyWorkRepository: DailyWorkRepository;
    sessionId: string;
    ownerId: string;
    workspaceId: string;
    runtimeMode: RuntimeMode;
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
  const toolCallId = chunk.id ?? result?.id ?? `tool-call-${randomUUID()}`;
  const requestId = chunk.id ?? result?.id ?? `request-${randomUUID()}`;

  await options.dailyWorkRepository.recordToolCall({
    id: toolCallId,
    ownerId: options.ownerId,
    sessionId: options.sessionId,
    workspaceId: options.workspaceId,
    runtimeMode: options.runtimeMode,
    requestId,
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
      toolCallId,
      runtimeMode: options.runtimeMode,
      requestId,
      phase: "completed"
    }),
    {
      ownerId: options.ownerId,
      workspaceId: options.workspaceId,
      runtimeMode: options.runtimeMode
    }
  );
}

async function recordModelUsageChunk(
  options: {
    dailyWorkRepository: DailyWorkRepository;
    sessionId: string;
    ownerId: string;
    workspaceId: string;
    runtimeMode: RuntimeMode;
    providerName: ChatProvider;
    modelName: string;
  },
  chunk: Extract<ModelStreamChunk, { type: "usage" }>
) {
  const record: ToolModelUsageRecord = {
    id: `model-usage-${randomUUID()}`,
    ownerId: options.ownerId,
    sessionId: options.sessionId,
    workspaceId: options.workspaceId,
    runtimeMode: options.runtimeMode,
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
    previewOnly: false,
    externalEffects: ["none", "workspace.file.write", "workspace.command.run"],
    statement:
      "Coding-agent tools are scoped to the configured workspace root. Reads and git inspection may run directly; file writes, shell commands, and test commands require same-session authorization and are recorded in tool calls and activity events."
  };
}

function filterSessionToolActivityEvents(
  events: DailyActivityEvent[],
  sessionId: string
) {
  return events
    .filter(
      (event) =>
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
    ownerId: string;
    workspaceId: string;
    runtimeMode: RuntimeMode;
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
            ownerId: options.ownerId,
            sessionId: options.sessionId,
            workspaceId: options.workspaceId,
            workspaceRuntimeMode: options.runtimeMode,
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
