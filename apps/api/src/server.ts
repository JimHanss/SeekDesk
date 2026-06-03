import {
  DeepSeekModelProvider,
  MockModelProvider,
  type ModelMessage,
  type ModelProvider
} from "@seekdesk/agent";
import { appModeSchema, type AppMode } from "@seekdesk/shared";
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

  app.get("/health", async () => ({
    status: "ok",
    service: "seekdesk-api",
    version: "0.1.0"
  }));

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

function normalizeAppMode(mode: ChatRequest["mode"]): AppMode {
  const parsed = appModeSchema.safeParse(mode);
  return parsed.success ? parsed.data : "daily_work";
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
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return new MockModelProvider();
  }

  return new DeepSeekModelProvider({
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL_FAST ?? "deepseek-v4-flash"
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
