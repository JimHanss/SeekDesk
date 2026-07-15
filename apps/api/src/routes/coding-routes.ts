import {
  codingGitDiffInputSchema,
  codingGrepInputSchema,
  codingListFilesInputSchema,
  codingPermissionGrantCreateRequestSchema,
  codingPermissionGrantRevokeRequestSchema,
  codingReadFileInputSchema,
  codingWorkspaceBrowseInputSchema,
  codingWorkspaceSelectInputSchema,
  normalizeRuntimeMode,
  type DailyWorkSessionDetail,
  type RuntimeMode
} from "@seekdesk/shared";
import type { FastifyInstance } from "fastify";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import {
  createCodingPermissionGrant,
  executeAuthorizedCodingToolCall
} from "../services/coding-tools.js";
import { CodingRuntimeError } from "../services/coding-runtime.js";
import type { RuntimeResolver } from "../services/runtime-resolver.js";
import { createValidationError, safeRuntimeReply } from "./runtime-http.js";

export async function registerCodingRoutes(
  app: FastifyInstance,
  repository: DailyWorkRepository,
  resolver: RuntimeResolver
) {
  for (const route of [
    "/api/coding/workspace",
    "/api/coding/workspace/browse",
    "/api/coding/workspace/select",
    "/api/coding/workspace/pick",
    "/api/coding/files/tree",
    "/api/coding/files/read",
    "/api/coding/search",
    "/api/coding/git/status",
    "/api/coding/git/diff",
    "/api/coding/permission-grants",
    "/api/coding/permission-grants/:grantId/revoke",
    "/api/coding/tool-calls/:toolCallId/execute"
  ]) {
    app.options(route, async (_request, reply) => reply.code(204).send());
  }

  app.get<{ Querystring: { workspaceId?: string; runtimeMode?: RuntimeMode } }>(
    "/api/coding/workspace",
    async (request, reply) => safeRuntimeReply(reply, async () => {
      const resolution = await resolver.resolve(
        request.actor.ownerId,
        request.query.workspaceId,
        request.query.runtimeMode
      );
      return resolution.runtime.status();
    })
  );

  app.post<{ Body: unknown }>("/api/coding/workspace/browse", async (request, reply) => {
    const parsed = codingWorkspaceBrowseInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }
    return withLocalDaemonRuntime(request, reply, resolver, (runtime) =>
      runtime.browseWorkspaceDirectories(parsed.data)
    );
  });

  app.post<{ Body: unknown }>("/api/coding/workspace/select", async (request, reply) => {
    const parsed = codingWorkspaceSelectInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }
    return withLocalDaemonRuntime(request, reply, resolver, async (runtime) => {
      const result = await runtime.selectWorkspace(parsed.data);
      await resolver.syncLocalDaemonWorkspaces(request.actor.ownerId);
      return result;
    });
  });

  app.post<{ Body: unknown }>("/api/coding/workspace/pick", async (request, reply) =>
    withLocalDaemonRuntime(request, reply, resolver, async (runtime) => {
      if (!runtime.pickWorkspaceDirectory) {
        throw new CodingRuntimeError(
          "System folder picker is unavailable for this local daemon.",
          "runtime_unavailable"
        );
      }
      const result = await runtime.pickWorkspaceDirectory();
      await resolver.syncLocalDaemonWorkspaces(request.actor.ownerId);
      return result;
    })
  );

  app.post<{ Body: unknown }>("/api/coding/files/tree", async (request, reply) => {
    const parsed = codingListFilesInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }
    return withResolvedRuntime(request, reply, resolver, (runtime) => runtime.listFiles(parsed.data));
  });

  app.post<{ Body: unknown }>("/api/coding/files/read", async (request, reply) => {
    const parsed = codingReadFileInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }
    return withResolvedRuntime(request, reply, resolver, (runtime) => runtime.readFile(parsed.data));
  });

  app.post<{ Body: unknown }>("/api/coding/search", async (request, reply) => {
    const parsed = codingGrepInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }
    return withResolvedRuntime(request, reply, resolver, (runtime) => runtime.grep(parsed.data));
  });

  app.get<{ Querystring: { workspaceId?: string; runtimeMode?: RuntimeMode } }>(
    "/api/coding/git/status",
    async (request, reply) => safeRuntimeReply(reply, async () => {
      const resolution = await resolver.resolve(
        request.actor.ownerId,
        request.query.workspaceId,
        request.query.runtimeMode
      );
      return resolution.runtime.gitStatus();
    })
  );

  app.post<{ Body: unknown }>("/api/coding/git/diff", async (request, reply) => {
    const parsed = codingGitDiffInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }
    return withResolvedRuntime(request, reply, resolver, (runtime) => runtime.gitDiff(parsed.data));
  });

  app.get<{ Querystring: { sessionId?: string; activeOnly?: string } }>(
    "/api/coding/permission-grants",
    async (request) => ({
      mode: "coding_agent",
      grants: await repository.listPermissionGrants({
        ownerId: request.actor.ownerId,
        ...(request.query.sessionId ? { sessionId: request.query.sessionId } : {}),
        activeOnly: request.query.activeOnly === "true",
        limit: 100
      })
    })
  );

  app.post<{ Body: unknown }>(
    "/api/coding/permission-grants",
    async (request, reply) => {
      const rawBody = recordValue(request.body);
      const parsed = codingPermissionGrantCreateRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send(createValidationError(parsed.error.issues));
      }
      return safeRuntimeReply(reply, async () => {
        const session = await requireSession(
          repository,
          request.actor.ownerId,
          parsed.data.sessionId
        );
        const binding = sessionBinding(session);
        assertOptionalBinding(parsed.data.workspaceId, parsed.data.runtimeMode, binding);
        if (rawBody.provider !== undefined && parsed.data.provider !== binding.runtimeMode) {
          throw sessionMismatch(binding, {
            workspaceId: parsed.data.workspaceId,
            runtimeMode: parsed.data.provider
          });
        }
        const workspace = await resolver.getWorkspaceRecord(
          request.actor.ownerId,
          binding.workspaceId
        );
        if (!workspace) {
          throw new CodingRuntimeError("Workspace was not found.", "workspace_not_found");
        }
        const grant = await repository.upsertPermissionGrant(
          createCodingPermissionGrant({
            ownerId: request.actor.ownerId,
            sessionId: parsed.data.sessionId,
            workspaceId: binding.workspaceId,
            runtimeMode: binding.runtimeMode,
            provider: binding.runtimeMode,
            action: parsed.data.action,
            ...(parsed.data.reason ? { reason: parsed.data.reason } : {})
          })
        );
        return { mode: "coding_agent", grant };
      });
    }
  );

  app.post<{ Params: { grantId: string }; Body: unknown }>(
    "/api/coding/permission-grants/:grantId/revoke",
    async (request, reply) => {
      const parsed = codingPermissionGrantRevokeRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send(createValidationError(parsed.error.issues));
      }
      const grant = (await repository.listPermissionGrants({
        ownerId: request.actor.ownerId,
        limit: 200
      })).find((candidate) => candidate.id === request.params.grantId);
      if (!grant) {
        return reply.code(404).send({
          mode: "coding_agent",
          error: "permission_grant_not_found",
          message: "Coding permission grant was not found."
        });
      }
      const revokedAt = new Date().toISOString();
      const revoked = await repository.upsertPermissionGrant({
        ...grant,
        status: "revoked",
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        revokedAt
      });
      return { mode: "coding_agent", grant: revoked };
    }
  );

  app.post<{ Params: { toolCallId: string }; Body: unknown }>(
    "/api/coding/tool-calls/:toolCallId/execute",
    async (request, reply) => {
      const body = recordValue(request.body);
      const sessionId = stringValue(body.sessionId);
      if (!sessionId) {
        return reply.code(400).send({
          mode: "coding_agent",
          error: "invalid_coding_request",
          message: "sessionId is required."
        });
      }
      return safeRuntimeReply(reply, async () => {
        const session = await requireSession(repository, request.actor.ownerId, sessionId);
        const binding = sessionBinding(session);
        assertOptionalBinding(
          stringValue(body.workspaceId),
          parseRuntimeMode(body.runtimeMode),
          binding
        );
        const toolCall = (await repository.listToolCalls({
          ownerId: request.actor.ownerId,
          sessionId,
          limit: 200
        })).find((candidate) => candidate.id === request.params.toolCallId);
        if (!toolCall) {
          throw new CodingRuntimeError("Coding tool call was not found.", "tool_call_not_found");
        }
        if (
          !toolCall.workspaceId ||
          !toolCall.runtimeMode ||
          toolCall.workspaceId !== binding.workspaceId ||
          normalizeRuntimeMode(toolCall.runtimeMode) !== binding.runtimeMode
        ) {
          throw sessionMismatch(binding, {
            workspaceId: toolCall.workspaceId,
            runtimeMode: toolCall.runtimeMode
          });
        }
        const resolution = await resolver.resolve(
          request.actor.ownerId,
          binding.workspaceId,
          binding.runtimeMode
        );
        return executeAuthorizedCodingToolCall({
          repository,
          ownerId: request.actor.ownerId,
          toolCallId: request.params.toolCallId,
          sessionId,
          runtime: resolution.runtime
        });
      });
    }
  );
}

async function withResolvedRuntime(
  request: { actor: { ownerId: string }; body: unknown },
  reply: Parameters<typeof safeRuntimeReply>[0],
  resolver: RuntimeResolver,
  run: (runtime: Awaited<ReturnType<RuntimeResolver["resolve"]>>["runtime"]) => Promise<unknown>
) {
  const body = recordValue(request.body);
  return safeRuntimeReply(reply, async () => {
    const resolution = await resolver.resolve(
      request.actor.ownerId,
      stringValue(body.workspaceId),
      parseRuntimeMode(body.runtimeMode)
    );
    return run(resolution.runtime);
  });
}

async function withLocalDaemonRuntime(
  request: { actor: { ownerId: string }; body: unknown },
  reply: Parameters<typeof safeRuntimeReply>[0],
  resolver: RuntimeResolver,
  run: (runtime: Awaited<ReturnType<RuntimeResolver["resolve"]>>["runtime"]) => Promise<unknown>
) {
  const workspaceId = stringValue(recordValue(request.body).workspaceId);
  if (!workspaceId) {
    return reply.code(400).send({
      mode: "coding_agent",
      error: "invalid_coding_request",
      message: "A local daemon workspaceId is required."
    });
  }
  return safeRuntimeReply(reply, async () => {
    const resolution = await resolver.resolve(request.actor.ownerId, workspaceId, "local_daemon");
    if (resolution.workspace.runtimeMode !== "local_daemon") {
      throw new CodingRuntimeError(
        "Workspace browsing and selection require a local daemon.",
        "runtime_not_ready"
      );
    }
    return run(resolution.runtime);
  });
}

async function requireSession(
  repository: DailyWorkRepository,
  ownerId: string,
  sessionId: string
) {
  const session = (await repository.listSessionDetails({ ownerId }))
    .find((candidate) => candidate.id === sessionId && candidate.appMode === "coding_agent");
  if (!session) {
    throw new CodingRuntimeError("Coding session was not found.", "session_not_found", {
      sessionId
    });
  }
  return session;
}

function sessionBinding(session: DailyWorkSessionDetail) {
  return {
    workspaceId: session.workspaceId,
    runtimeMode: normalizeRuntimeMode(
      session.workspaceRuntimeMode ?? (
        session.workspaceId === "server-local-runtime" ? "server_local" : "local_daemon"
      )
    )
  };
}

function assertOptionalBinding(
  workspaceId: string | undefined,
  runtimeMode: RuntimeMode | undefined,
  expected: { workspaceId: string; runtimeMode: RuntimeMode }
) {
  if (
    (workspaceId && workspaceId !== expected.workspaceId) ||
    (runtimeMode && normalizeRuntimeMode(runtimeMode) !== expected.runtimeMode)
  ) {
    throw sessionMismatch(expected, { workspaceId, runtimeMode });
  }
}

function sessionMismatch(
  expected: { workspaceId: string; runtimeMode: RuntimeMode },
  actual: { workspaceId?: string | undefined; runtimeMode?: unknown }
) {
  return new CodingRuntimeError(
    "Session, workspace, and Runtime binding do not match.",
    "session_workspace_mismatch",
    { expected, actual }
  );
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseRuntimeMode(value: unknown): RuntimeMode | undefined {
  if (value === undefined) return undefined;
  try {
    return normalizeRuntimeMode(value);
  } catch {
    return undefined;
  }
}
