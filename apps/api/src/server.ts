import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { pathToFileURL } from "node:url";

export async function buildServer() {
  const app = Fastify({
    logger: true
  });

  await app.register(websocket);

  app.get("/health", async () => ({
    status: "ok",
    service: "seekdesk-api",
    version: "0.1.0"
  }));

  app.post("/api/chat", async (_request, reply) => {
    return reply.code(501).send({
      status: "planned",
      message: "DeepSeek streaming chat will be implemented in Milestone 0."
    });
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
