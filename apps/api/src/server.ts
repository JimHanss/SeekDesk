
import {
  DeepSeekModelProvider,
  MockModelProvider,
  streamAgentLoop,
  type ModelStreamChunk,
  type ModelProvider
} from "@seekdesk/agent";
import {
  chatRequestSchema,
  createDailyActivitySnapshotMessage,
  type ChatProvider,
  type ChatRequest
} from "@seekdesk/shared";
import websocket from "@fastify/websocket";
import Fastify, {
  type FastifyReply,
  type FastifyRequest
} from "fastify";
import { pathToFileURL } from "node:url";
import {
  createDailyWorkRepositoryFromEnv,
  type DailyWorkRepository
} from "./repositories/daily-work-repository.js";
import {
  createDailyModelUsageSnapshot,
  filterDailyActivityEvents,
  registerDailyWorkRoutes
} from "./routes/daily-work-routes.js";

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

  await registerDailyWorkRoutes(app, dailyWorkRepository);

  app.get("/health", async () => ({
    status: "ok",
    service: "seekdesk-api",
    version: "0.1.0"
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
