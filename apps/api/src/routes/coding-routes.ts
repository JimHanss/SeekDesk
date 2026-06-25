import {
  codingGitDiffInputSchema,
  codingGrepInputSchema,
  codingListFilesInputSchema,
  codingPermissionGrantCreateRequestSchema,
  codingPermissionGrantRevokeRequestSchema,
  codingReadFileInputSchema,
  codingWorkspaceBrowseInputSchema,
  codingWorkspaceSelectInputSchema
} from "@seekdesk/shared";
import type { FastifyInstance } from "fastify";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import {
  createCodingPermissionGrant,
  executeAuthorizedCodingToolCall
} from "../services/coding-tools.js";
import { CodingRuntimeError, LocalCodingRuntime, type CodingRuntime } from "../services/coding-runtime.js";
import type { DaemonRegistry } from "../services/daemon-registry.js";

export async function registerCodingRoutes(
  app: FastifyInstance,
  repository: DailyWorkRepository,
  daemonRegistry?: DaemonRegistry
) {
  const localRuntime = new LocalCodingRuntime();

  for (const route of [
    "/api/coding/workspace",
    "/api/coding/workspace/browse",
    "/api/coding/workspace/select",
    "/api/coding/workspace/pick",
    "/api/coding/workspaces",
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

  app.get<{ Querystring: { workspaceId?: string } }>("/api/coding/workspaces", async () => ({
    mode: "coding_agent",
    workspaces: [
      ...(daemonRegistry?.listWorkspaces() ?? []),
      createServerLocalWorkspace(localRuntime)
    ]
  }));

  app.get<{ Querystring: { workspaceId?: string } }>("/api/coding/workspace", async (request) =>
    getRuntime(request.query.workspaceId).status()
  );

  app.post<{ Body: unknown }>("/api/coding/workspace/browse", async (request, reply) => {
    const parsed = codingWorkspaceBrowseInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }

    return safeRuntimeReply(reply, () => getRuntime(extractWorkspaceId(request.body)).browseWorkspaceDirectories(parsed.data));
  });

  app.post<{ Body: unknown }>("/api/coding/workspace/select", async (request, reply) => {
    const parsed = codingWorkspaceSelectInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }

    return safeRuntimeReply(reply, () => getRuntime(extractWorkspaceId(request.body)).selectWorkspace(parsed.data));
  });

  app.post<{ Body: unknown }>("/api/coding/workspace/pick", async (request, reply) => {
    const runtime = getRuntime(extractWorkspaceId(request.body));
    if (!runtime.pickWorkspaceDirectory) {
      return reply.code(400).send({
        mode: "coding_agent",
        error: "folder_picker_unavailable",
        message: "System folder picker is only available through a connected local daemon."
      });
    }

    return safeRuntimeReply(reply, () => runtime.pickWorkspaceDirectory!());
  });

  app.post<{ Body: unknown }>("/api/coding/files/tree", async (request, reply) => {
    const parsed = codingListFilesInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }

    return safeRuntimeReply(reply, () => getRuntime(extractWorkspaceId(request.body)).listFiles(parsed.data));
  });

  app.post<{ Body: unknown }>("/api/coding/files/read", async (request, reply) => {
    const parsed = codingReadFileInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }

    return safeRuntimeReply(reply, () => getRuntime(extractWorkspaceId(request.body)).readFile(parsed.data));
  });

  app.post<{ Body: unknown }>("/api/coding/search", async (request, reply) => {
    const parsed = codingGrepInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }

    return safeRuntimeReply(reply, () => getRuntime(extractWorkspaceId(request.body)).grep(parsed.data));
  });

  app.get<{ Querystring: { workspaceId?: string } }>("/api/coding/git/status", async (request, reply) =>
    safeRuntimeReply(reply, () => getRuntime(request.query?.workspaceId).gitStatus())
  );

  app.post<{ Body: unknown }>("/api/coding/git/diff", async (request, reply) => {
    const parsed = codingGitDiffInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(createValidationError(parsed.error.issues));
    }

    return safeRuntimeReply(reply, () => getRuntime(extractWorkspaceId(request.body)).gitDiff(parsed.data));
  });

  app.get<{ Querystring: { sessionId?: string; activeOnly?: string } }>(
    "/api/coding/permission-grants",
    async (request) => ({
      mode: "coding_agent",
      grants: await repository.listPermissionGrants({
        ...(request.query.sessionId ? { sessionId: request.query.sessionId } : {}),
        provider: "local_daemon",
        activeOnly: request.query.activeOnly === "true",
        limit: 100
      })
    })
  );

  app.post<{ Body: unknown }>(
    "/api/coding/permission-grants",
    async (request, reply) => {
      const parsed = codingPermissionGrantCreateRequestSchema.safeParse(
        request.body ?? {}
      );
      if (!parsed.success) {
        return reply.code(400).send(createValidationError(parsed.error.issues));
      }

      const grant = await repository.upsertPermissionGrant(
        createCodingPermissionGrant({
          sessionId: parsed.data.sessionId,
          action: parsed.data.action,
          ...(parsed.data.reason ? { reason: parsed.data.reason } : {})
        })
      );

      return {
        mode: "coding_agent",
        grant
      };
    }
  );

  app.post<{ Params: { grantId: string }; Body: unknown }>(
    "/api/coding/permission-grants/:grantId/revoke",
    async (request, reply) => {
      const parsed = codingPermissionGrantRevokeRequestSchema.safeParse(
        request.body ?? {}
      );
      if (!parsed.success) {
        return reply.code(400).send(createValidationError(parsed.error.issues));
      }

      const grant = (await repository.listPermissionGrants({ limit: 200 })).find(
        (candidate) => candidate.id === request.params.grantId
      );
      if (!grant) {
        return reply.code(404).send({
          mode: "coding_agent",
          error: "Coding permission grant not found."
        });
      }

      const revokedAt = new Date().toISOString();
      const revoked = await repository.upsertPermissionGrant({
        ...grant,
        status: "revoked",
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        revokedAt
      });

      return {
        mode: "coding_agent",
        grant: revoked
      };
    }
  );

  app.post<{ Params: { toolCallId: string }; Body: unknown }>(
    "/api/coding/tool-calls/:toolCallId/execute",
    async (request, reply) => {
      const body = request.body && typeof request.body === "object"
        ? (request.body as { sessionId?: unknown; workspaceId?: unknown })
        : {};
      const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
      if (!sessionId) {
        return reply.code(400).send({
          mode: "coding_agent",
          error: "sessionId is required."
        });
      }

      return safeRuntimeReply(reply, () =>
        executeAuthorizedCodingToolCall({
          repository,
          toolCallId: request.params.toolCallId,
          sessionId,
          runtime: getRuntime(typeof body.workspaceId === "string" ? body.workspaceId : undefined)
        })
      );
    }
  );
  function getRuntime(workspaceId: string | undefined): CodingRuntime {
    const daemonWorkspace = daemonRegistry?.getWorkspace(workspaceId);
    if (daemonWorkspace) {
      return daemonRegistry!.createRuntime(daemonWorkspace.workspaceId);
    }

    if (workspaceId && workspaceId !== "server-local-runtime") {
      return daemonRegistry?.createRuntime(workspaceId) ?? localRuntime;
    }

    return localRuntime;
  }
}

async function safeRuntimeReply<T>(
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  run: () => Promise<T>
) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof CodingRuntimeError) {
      return reply.code(error.code === "permission_required" ? 403 : 400).send({
        mode: "coding_agent",
        error: error.code,
        message: error.message,
        details: error.details
      });
    }

    return reply.code(500).send({
      mode: "coding_agent",
      error: "coding_runtime_failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

function createValidationError(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return {
    mode: "coding_agent",
    error: "Invalid coding request.",
    issues: issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message
    }))
  };
}

function extractWorkspaceId(body: unknown) {
  if (body && typeof body === "object" && typeof (body as { workspaceId?: unknown }).workspaceId === "string") {
    return (body as { workspaceId: string }).workspaceId.trim() || undefined;
  }

  return undefined;
}

function createServerLocalWorkspace(runtime: LocalCodingRuntime) {
  const status = runtime.status();
  return {
    workspaceId: status.workspaceId ?? "server-local-runtime",
    daemonId: "server-local-runtime",
    name: status.workspaceName ?? "server-local",
    rootPath: status.workspaceRoot,
    runtimeMode: "server_local" as const,
    connected: true,
    updatedAt: new Date().toISOString()
  };
}
