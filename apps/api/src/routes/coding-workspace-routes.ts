import { randomUUID } from "node:crypto";

import {
  cloudWorkspaceCreateRequestSchema,
  codingWorkspaceDetailSchema,
  codingWorkspaceSummarySchema,
  repositoryCredentialListResponseSchema,
  workspaceLifecycleRequestSchema,
  type CodingWorkspaceRecord,
  type RuntimeLifecycleStatus,
  type RuntimeOperation
} from "@seekdesk/shared";
import type { FastifyInstance } from "fastify";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import type { CloudRuntimeClient } from "../services/cloud-runtime-client.js";
import type { CredentialCipher } from "../services/credential-crypto.js";
import { CodingRuntimeError } from "../services/coding-runtime.js";
import type { RuntimeResolver } from "../services/runtime-resolver.js";
import { createValidationError, safeRuntimeReply } from "./runtime-http.js";

export async function registerCodingWorkspaceRoutes(
  app: FastifyInstance,
  repository: DailyWorkRepository,
  resolver: RuntimeResolver,
  cloudRuntimeClient: CloudRuntimeClient,
  credentialCipher?: Pick<CredentialCipher, "decrypt">
) {
  for (const route of [
    "/api/coding/workspaces",
    "/api/coding/workspaces/:workspaceId",
    "/api/coding/workspaces/cloud",
    "/api/coding/workspaces/:workspaceId/start",
    "/api/coding/workspaces/:workspaceId/stop",
    "/api/coding/workspaces/:workspaceId/retry",
    "/api/coding/repository-credentials"
  ]) {
    app.options(route, async (_request, reply) => reply.code(204).send());
  }

  app.get("/api/coding/workspaces", async (request) => ({
    mode: "coding_agent",
    workspaces: await resolver.listWorkspaces(request.actor.ownerId)
  }));

  app.get("/api/coding/repository-credentials", async (request) =>
    repositoryCredentialListResponseSchema.parse({
      mode: "coding_agent",
      credentials: await repository.listRepositoryCredentials(request.actor.ownerId)
    })
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/api/coding/workspaces/:workspaceId",
    async (request, reply) => safeRuntimeReply(reply, async () => {
      let workspace = await resolver.getWorkspaceRecord(
        request.actor.ownerId,
        request.params.workspaceId
      );
      if (!workspace) {
        throw workspaceNotFound(request.params.workspaceId);
      }
      if (workspace.runtimeMode === "cloud_runtime" && cloudRuntimeClient.configured) {
        try {
          const status = await cloudRuntimeClient.getStatus(
            request.actor.ownerId,
            workspace.workspaceId
          );
          workspace = status.workspace;
          await repository.upsertCodingWorkspace(workspace);
          for (const operation of status.operations) {
            await repository.upsertRuntimeOperation(operation);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Cloud runtime is unavailable.";
          workspace = {
            ...workspace,
            status: "error",
            connected: false,
            errorCode: "runtime_unavailable",
            errorMessage: message,
            updatedAt: new Date().toISOString()
          };
          await repository.upsertCodingWorkspace(workspace);
        }
      }
      const [latestOperation] = await repository.listRuntimeOperations({
        ownerId: request.actor.ownerId,
        workspaceId: workspace.workspaceId,
        limit: 1
      });
      return codingWorkspaceDetailSchema.parse({
        ...workspace,
        ...(latestOperation
          ? { latestOperation: omitOwner(latestOperation) }
          : {}),
        ...(workspace.errorCode && workspace.errorMessage
          ? { error: { code: workspace.errorCode, message: workspace.errorMessage } }
          : {})
      });
    })
  );

  app.post<{ Body: unknown }>(
    "/api/coding/workspaces/cloud",
    async (request, reply) => {
      const parsed = cloudWorkspaceCreateRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send(createValidationError(parsed.error.issues));
      }
      return safeRuntimeReply(reply, async () => {
        assertCloudConfigured(cloudRuntimeClient);
        const duplicate = await repository.getRuntimeOperationByIdempotencyKey(
          request.actor.ownerId,
          parsed.data.idempotencyKey
        );
        if (duplicate) {
          assertDuplicateOperation(duplicate, {
            type: "provision"
          });
          return sendAcceptedOperation(reply, repository, request.actor.ownerId, duplicate);
        }
        let repositoryToken: string | undefined;
        if (parsed.data.credentialId) {
          const credential = await repository.getRepositoryCredential(
            request.actor.ownerId,
            parsed.data.credentialId
          );
          if (!credential || credential.revokedAt) {
            throw new CodingRuntimeError(
              "Repository credential was not found or has been revoked.",
              "repository_credentials_invalid"
            );
          }
          if (!credentialCipher) {
            throw new CodingRuntimeError(
              "Repository credential encryption is not configured.",
              "repository_credentials_invalid"
            );
          }
          repositoryToken = credentialCipher.decrypt(
            credential.encryptedSecret,
            request.actor.ownerId
          );
        }
        const now = new Date().toISOString();
        const workspace: CodingWorkspaceRecord = {
          workspaceId: `cloud-${randomUUID()}`,
          ownerId: request.actor.ownerId,
          name: parsed.data.name,
          runtimeMode: "cloud_runtime",
          status: "provisioning",
          rootPath: "/workspace",
          connected: false,
          repository: {
            url: parsed.data.repositoryUrl,
            branch: parsed.data.branch
          },
          imageProfile: parsed.data.imageProfile,
          ...(parsed.data.credentialId ? { credentialRef: parsed.data.credentialId } : {}),
          supportedCapabilities: [],
          createdAt: now,
          updatedAt: now
        };
        const operation = createOperation({
          ownerId: request.actor.ownerId,
          workspaceId: workspace.workspaceId,
          type: "provision",
          idempotencyKey: parsed.data.idempotencyKey,
          requestPayload: parsed.data
        });
        await repository.upsertCodingWorkspace(workspace);
        await repository.upsertRuntimeOperation(operation);
        await submitOperation(
          repository,
          cloudRuntimeClient,
          workspace,
          operation,
          repositoryToken
        );
        return reply.code(202).send(createOperationResponse(workspace, operation));
      });
    }
  );

  for (const action of ["start", "stop", "retry"] as const) {
    app.post<{ Params: { workspaceId: string }; Body: unknown }>(
      `/api/coding/workspaces/:workspaceId/${action}`,
      async (request, reply) => lifecycleAction({
        request,
        reply,
        repository,
        cloudRuntimeClient,
        ...(credentialCipher ? { credentialCipher } : {}),
        action
      })
    );
  }

  app.delete<{ Params: { workspaceId: string }; Body: unknown }>(
    "/api/coding/workspaces/:workspaceId",
    async (request, reply) => lifecycleAction({
      request,
      reply,
      repository,
      cloudRuntimeClient,
      ...(credentialCipher ? { credentialCipher } : {}),
      action: "delete"
    })
  );
}

async function lifecycleAction(input: {
  request: {
    actor: { ownerId: string };
    params: { workspaceId: string };
    body: unknown;
  };
  reply: Parameters<typeof safeRuntimeReply>[0];
  repository: DailyWorkRepository;
  cloudRuntimeClient: CloudRuntimeClient;
  credentialCipher?: Pick<CredentialCipher, "decrypt">;
  action: "start" | "stop" | "retry" | "delete";
}) {
  const parsed = workspaceLifecycleRequestSchema.safeParse(input.request.body ?? {});
  if (!parsed.success) {
    return input.reply.code(400).send(createValidationError(parsed.error.issues));
  }
  return safeRuntimeReply(input.reply, async () => {
    assertCloudConfigured(input.cloudRuntimeClient);
    const duplicate = await input.repository.getRuntimeOperationByIdempotencyKey(
      input.request.actor.ownerId,
      parsed.data.idempotencyKey
    );
    if (duplicate) {
      assertDuplicateOperation(duplicate, {
        workspaceId: input.request.params.workspaceId,
        type: input.action
      });
      return sendAcceptedOperation(
        input.reply,
        input.repository,
        input.request.actor.ownerId,
        duplicate
      );
    }
    const workspace = await input.repository.getCodingWorkspace(
      input.request.actor.ownerId,
      input.request.params.workspaceId
    );
    if (!workspace) {
      throw workspaceNotFound(input.request.params.workspaceId);
    }
    if (workspace.runtimeMode !== "cloud_runtime") {
      throw new CodingRuntimeError(
        "Lifecycle actions are only available for cloud workspaces.",
        "runtime_not_ready"
      );
    }
    const updatedAt = new Date().toISOString();
    const pendingWorkspace: CodingWorkspaceRecord = {
      ...workspace,
      status: actionStatus(input.action),
      connected: false,
      errorCode: undefined,
      errorMessage: undefined,
      updatedAt
    };
    const operation = createOperation({
      ownerId: input.request.actor.ownerId,
      workspaceId: workspace.workspaceId,
      type: input.action,
      idempotencyKey: parsed.data.idempotencyKey,
      requestPayload: parsed.data
    });
    const repositoryToken = await resolveWorkspaceCredentialToken(
      input.repository,
      pendingWorkspace,
      input.credentialCipher
    );
    await input.repository.upsertCodingWorkspace(pendingWorkspace);
    await input.repository.upsertRuntimeOperation(operation);
    await submitOperation(
      input.repository,
      input.cloudRuntimeClient,
      pendingWorkspace,
      operation,
      repositoryToken
    );
    return input.reply.code(202).send(createOperationResponse(pendingWorkspace, operation));
  });
}

async function submitOperation(
  repository: DailyWorkRepository,
  client: CloudRuntimeClient,
  workspace: CodingWorkspaceRecord,
  operation: RuntimeOperation,
  repositoryToken?: string
) {
  try {
    await client.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace,
      operation,
      ...(repositoryToken ? { repositoryToken } : {})
    });
    await repository.upsertRuntimeOperation({
      ...operation,
      status: "running",
      startedAt: new Date().toISOString()
    });
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    await repository.upsertRuntimeOperation({
      ...operation,
      status: "failed",
      errorCode: "runtime_unavailable",
      errorMessage: message,
      completedAt
    });
    await repository.upsertCodingWorkspace({
      ...workspace,
      status: "error",
      connected: false,
      errorCode: "runtime_unavailable",
      errorMessage: message,
      updatedAt: completedAt
    });
    throw error;
  }
}

async function resolveWorkspaceCredentialToken(
  repository: DailyWorkRepository,
  workspace: CodingWorkspaceRecord,
  credentialCipher?: Pick<CredentialCipher, "decrypt">
) {
  if (!workspace.credentialRef) return undefined;
  const credential = await repository.getRepositoryCredential(
    workspace.ownerId,
    workspace.credentialRef
  );
  if (!credential || credential.revokedAt || !credentialCipher) {
    throw new CodingRuntimeError(
      "Repository credential is unavailable or has been revoked.",
      "repository_credentials_invalid"
    );
  }
  return credentialCipher.decrypt(credential.encryptedSecret, workspace.ownerId);
}

async function sendAcceptedOperation(
  reply: Parameters<typeof safeRuntimeReply>[0],
  repository: DailyWorkRepository,
  ownerId: string,
  operation: RuntimeOperation
) {
  const workspace = await repository.getCodingWorkspace(ownerId, operation.workspaceId);
  if (!workspace) {
    throw workspaceNotFound(operation.workspaceId);
  }
  return reply.code(202).send(createOperationResponse(workspace, operation));
}

function createOperation(input: {
  ownerId: string;
  workspaceId: string;
  type: RuntimeOperation["type"];
  idempotencyKey: string;
  requestPayload: unknown;
}): RuntimeOperation {
  return {
    id: `runtime-operation-${randomUUID()}`,
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    type: input.type,
    status: "queued",
    idempotencyKey: input.idempotencyKey,
    requestPayload: input.requestPayload,
    createdAt: new Date().toISOString()
  };
}

function createOperationResponse(workspace: CodingWorkspaceRecord, operation: RuntimeOperation) {
  return {
    mode: "coding_agent",
    workspace: codingWorkspaceSummarySchema.parse(workspace),
    operation: omitOwner(operation)
  };
}

function omitOwner(operation: RuntimeOperation) {
  const { ownerId: _ownerId, ...publicOperation } = operation;
  void _ownerId;
  return publicOperation;
}

function actionStatus(action: "start" | "stop" | "retry" | "delete"): RuntimeLifecycleStatus {
  if (action === "start") return "starting";
  if (action === "stop") return "stopping";
  if (action === "retry") return "retrying";
  return "deleting";
}

function assertCloudConfigured(client: CloudRuntimeClient) {
  if (!client.configured) {
    throw new CodingRuntimeError("Cloud runtime is not configured.", "runtime_unavailable");
  }
}

function workspaceNotFound(workspaceId: string) {
  return new CodingRuntimeError("Workspace was not found.", "workspace_not_found", {
    workspaceId
  });
}

function assertDuplicateOperation(
  operation: RuntimeOperation,
  expected: { workspaceId?: string; type: RuntimeOperation["type"] }
) {
  if (
    operation.type !== expected.type ||
    (expected.workspaceId && operation.workspaceId !== expected.workspaceId)
  ) {
    throw new CodingRuntimeError(
      "The idempotency key is already bound to another workspace operation.",
      "workspace_operation_conflict",
      {
        operationId: operation.id,
        actualWorkspaceId: operation.workspaceId,
        actualType: operation.type,
        expectedWorkspaceId: expected.workspaceId,
        expectedType: expected.type
      }
    );
  }
}
