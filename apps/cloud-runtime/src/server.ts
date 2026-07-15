import { randomUUID, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

import {
  codingToolNameSchema,
  cloudRuntimeLifecycleSubmissionSchema,
  runtimeExecuteRequestSchema
} from "@seekdesk/shared";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import { createCloudRuntimeConfig, type CloudRuntimeConfig } from "./config.js";
import { DockerCliContainerEngine, type CloudContainerEngine } from "./engine.js";
import {
  CloudRuntimeServiceError,
  redactSensitiveText,
  toCloudRuntimeServiceError
} from "./errors.js";
import { ProcessGitBootstrapper, type GitBootstrapper } from "./git-bootstrap.js";
import {
  CloudRuntimeLifecycleService,
  type CloudExecuteSubmission
} from "./lifecycle-service.js";
import { CloudWorkspaceStorage } from "./storage.js";

const executeSubmissionSchema = runtimeExecuteRequestSchema.extend({
  toolName: codingToolNameSchema
});

export interface CloudRuntimeServerDependencies {
  config?: CloudRuntimeConfig;
  engine?: CloudContainerEngine;
  git?: GitBootstrapper;
  storage?: CloudWorkspaceStorage;
  lifecycle?: CloudRuntimeLifecycleService;
}

export async function createCloudRuntimeServer(
  dependencies: CloudRuntimeServerDependencies = {}
) {
  const config = dependencies.config ?? createCloudRuntimeConfig();
  const engine = dependencies.engine ?? new DockerCliContainerEngine(config);
  const storage = dependencies.storage ?? new CloudWorkspaceStorage(
    config.storageRoot,
    config.workspaceQuotaBytes
  );
  const lifecycle = dependencies.lifecycle ?? new CloudRuntimeLifecycleService(
    config,
    storage,
    engine,
    dependencies.git ?? new ProcessGitBootstrapper()
  );
  await lifecycle.initialize();
  lifecycle.startMaintenance();

  const app = Fastify({
    bodyLimit: 2_000_000,
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
      redact: {
        paths: [
          "req.headers.authorization",
          "request.headers.authorization",
          "body.repositoryToken",
          "repositoryToken"
        ],
        censor: "[redacted]"
      }
    },
    genReqId: (request) => headerValue(request.headers["x-request-id"]) ?? randomUUID()
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    if (!request.url.startsWith("/internal/")) return;
    const authorization = headerValue(request.headers.authorization);
    if (!isValidBearerToken(authorization, config.serviceToken)) {
      throw new CloudRuntimeServiceError(
        "Internal service authentication failed.",
        "workspace_access_denied",
        {},
        401
      );
    }
  });

  app.get("/internal/health", async () => {
    const readiness = await engine.readiness();
    return {
      status: readiness.dockerReady ? "ok" : "degraded",
      service: "seekdesk-cloud-runtime",
      dockerReady: readiness.dockerReady,
      activeWorkspaces: lifecycle.listStatuses().filter(
        (state) => !["deleted", "offline"].includes(state.workspace.status)
      ).length,
      ...(readiness.message ? { message: readiness.message } : {})
    };
  });

  app.post<{
    Params: { workspaceId: string };
    Body: unknown;
  }>("/internal/workspaces/:workspaceId/operations", async (request, reply) => {
    const input = parseBody(cloudRuntimeLifecycleSubmissionSchema, request.body);
    assertRouteWorkspace(request.params.workspaceId, input.workspace.workspaceId);
    const operation = await lifecycle.submitLifecycle({
      ownerId: input.ownerId,
      workspace: input.workspace,
      operation: input.operation,
      ...(input.repositoryToken ? { repositoryToken: input.repositoryToken } : {})
    });
    return reply.code(202).send({ accepted: true, operation });
  });

  app.get<{
    Params: { workspaceId: string };
    Querystring: { ownerId?: string };
  }>("/internal/workspaces/:workspaceId", async (request) => {
    const ownerId = z.string().trim().min(1).parse(request.query.ownerId);
    return lifecycle.getStatus(ownerId, request.params.workspaceId);
  });

  app.post<{
    Params: { workspaceId: string };
    Body: unknown;
  }>("/internal/workspaces/:workspaceId/execute", async (request) => {
    const input = parseBody(executeSubmissionSchema, request.body) as CloudExecuteSubmission;
    assertRouteWorkspace(request.params.workspaceId, input.workspaceId);
    return lifecycle.execute(input);
  });

  app.post<{
    Params: { workspaceId: string; requestId: string };
    Body: unknown;
  }>("/internal/workspaces/:workspaceId/requests/:requestId/cancel", async (request) => {
    const ownerId = z.object({ ownerId: z.string().trim().min(1) }).parse(request.body).ownerId;
    return {
      cancelled: lifecycle.cancel(ownerId, request.params.workspaceId, request.params.requestId),
      requestId: request.params.requestId
    };
  });

  app.setErrorHandler((error, request, reply) => {
    const formatted = formatRequestError(error);
    request.log.warn({
      requestId: request.id,
      code: formatted.code,
      statusCode: formatted.statusCode
    }, "cloud runtime request failed");
    void reply.code(formatted.statusCode).send({
      error: formatted.code,
      code: formatted.code,
      message: formatted.message,
      requestId: request.id,
      details: formatted.details
    });
  });

  app.addHook("onClose", async () => lifecycle.close());
  return { app, config, lifecycle, engine };
}

export async function startCloudRuntimeServer() {
  const { app, config } = await createCloudRuntimeServer();
  const shutdown = async () => {
    await app.close();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  await app.listen({ host: config.host, port: config.port });
  return app;
}

function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new CloudRuntimeServiceError(
      "Internal runtime request is invalid.",
      "invalid_runtime_request",
      {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message
        }))
      },
      400
    );
  }
  return parsed.data;
}

function assertRouteWorkspace(routeWorkspaceId: string, bodyWorkspaceId: string) {
  if (routeWorkspaceId !== bodyWorkspaceId) {
    throw new CloudRuntimeServiceError(
      "Route workspace does not match the request payload.",
      "runtime_workspace_mismatch",
      {},
      409
    );
  }
}

function isValidBearerToken(value: string | undefined, expected: string) {
  if (!value?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(value.slice(7), "utf8");
  const target = Buffer.from(expected, "utf8");
  return provided.length === target.length && timingSafeEqual(provided, target);
}

function formatRequestError(error: unknown) {
  if (error instanceof z.ZodError) {
    return new CloudRuntimeServiceError(
      "Internal runtime request is invalid.",
      "invalid_runtime_request",
      {},
      400
    );
  }
  if (error instanceof CloudRuntimeServiceError) return error;
  return toCloudRuntimeServiceError(error);
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isDirectInvocation() {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isDirectInvocation()) {
  startCloudRuntimeServer().catch((error) => {
    process.stderr.write(`${redactSensitiveText(error instanceof Error ? error.message : String(error))}\n`);
    process.exitCode = 1;
  });
}

export type CloudRuntimeFastifyInstance = FastifyInstance;
