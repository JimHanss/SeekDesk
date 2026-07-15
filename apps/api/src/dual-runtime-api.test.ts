import type { CodingWorkspaceRecord } from "@seekdesk/shared";
import { describe, expect, it } from "vitest";

import { SeedDailyWorkRepository } from "./repositories/daily-work-repository.js";
import { buildServer } from "./server.js";
import type {
  CloudRuntimeClient,
  CloudRuntimeExecuteInput,
  CloudRuntimeLifecycleRequest
} from "./services/cloud-runtime-client.js";

const now = "2026-07-15T00:00:00.000Z";

describe("dual-runtime public API", () => {
  it("creates and controls cloud workspaces with owner-scoped idempotent operations", async () => {
    const repository = new SeedDailyWorkRepository();
    const cloudClient = new MockCloudRuntimeClient();
    const app = await buildServer({
      dailyWorkRepository: repository,
      cloudRuntimeClient: cloudClient
    });

    try {
      const createPayload = {
        name: "SeekDesk Cloud",
        repositoryUrl: "https://github.com/example/seekdesk.git",
        branch: "main",
        imageProfile: "node22",
        idempotencyKey: "create-cloud-a"
      };
      const created = await app.inject({
        method: "POST",
        url: "/api/coding/workspaces/cloud",
        payload: createPayload
      });
      expect(created.statusCode).toBe(202);
      const createResult = created.json();
      expect(createResult.workspace).toEqual(expect.objectContaining({
        runtimeMode: "cloud_runtime",
        status: "provisioning",
        rootPath: "/workspace"
      }));

      const replay = await app.inject({
        method: "POST",
        url: "/api/coding/workspaces/cloud",
        payload: createPayload
      });
      expect(replay.statusCode).toBe(202);
      expect(replay.json()).toEqual(expect.objectContaining({
        workspace: expect.objectContaining({
          workspaceId: createResult.workspace.workspaceId
        }),
        operation: expect.objectContaining({ id: createResult.operation.id })
      }));
      expect(cloudClient.lifecycleRequests).toHaveLength(1);

      const detail = await app.inject({
        method: "GET",
        url: `/api/coding/workspaces/${createResult.workspace.workspaceId}`
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json()).toEqual(expect.objectContaining({
        workspaceId: createResult.workspace.workspaceId,
        latestOperation: expect.objectContaining({ status: "running" })
      }));

      const stopped = await app.inject({
        method: "POST",
        url: `/api/coding/workspaces/${createResult.workspace.workspaceId}/stop`,
        payload: { idempotencyKey: "stop-cloud-a" }
      });
      expect(stopped.statusCode).toBe(202);
      expect(stopped.json().workspace.status).toBe("stopping");

      const conflict = await app.inject({
        method: "DELETE",
        url: `/api/coding/workspaces/${createResult.workspace.workspaceId}`,
        payload: { idempotencyKey: "stop-cloud-a" }
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json()).toEqual(expect.objectContaining({
        error: "workspace_operation_conflict"
      }));

      const deleted = await app.inject({
        method: "DELETE",
        url: `/api/coding/workspaces/${createResult.workspace.workspaceId}`,
        payload: { idempotencyKey: "delete-cloud-a" }
      });
      expect(deleted.statusCode).toBe(202);
      expect(deleted.json().workspace.status).toBe("deleting");
      expect(cloudClient.lifecycleRequests).toHaveLength(3);
    } finally {
      await app.close();
    }
  });

  it("pins chat sessions to their persisted workspace and Runtime", async () => {
    const repository = new SeedDailyWorkRepository();
    const cloudClient = new MockCloudRuntimeClient();
    await repository.upsertCodingWorkspace(createReadyCloudWorkspace("cloud-a"));
    await repository.upsertCodingWorkspace(createReadyCloudWorkspace("cloud-b"));
    const app = await buildServer({
      dailyWorkRepository: repository,
      cloudRuntimeClient: cloudClient
    });

    try {
      const first = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {
          mode: "coding_agent",
          sessionId: "cloud-session",
          prompt: "Explain this workspace.",
          context: {
            workspaceId: "cloud-a",
            runtimeMode: "cloud_runtime"
          }
        }
      });
      expect(first.statusCode).toBe(200);

      const mismatched = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {
          mode: "coding_agent",
          sessionId: "cloud-session",
          prompt: "Switch workspaces.",
          context: {
            workspaceId: "cloud-b",
            runtimeMode: "cloud_runtime"
          }
        }
      });
      expect(mismatched.statusCode).toBe(409);
      expect(mismatched.json()).toEqual(expect.objectContaining({
        error: "session_workspace_mismatch"
      }));

      const unknown = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {
          mode: "coding_agent",
          prompt: "Open an unknown workspace.",
          context: { workspaceId: "cloud-missing" }
        }
      });
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json()).toEqual(expect.objectContaining({
        error: "workspace_not_found"
      }));

      const trace = await app.inject({
        method: "GET",
        url: "/api/chat/sessions/cloud-session/trace"
      });
      expect(trace.statusCode).toBe(200);
      expect(trace.json()).toEqual(expect.objectContaining({
        workspaceId: "cloud-a",
        runtimeMode: "cloud_runtime",
        workspace: expect.objectContaining({ workspaceId: "cloud-a" })
      }));

      const sessions = await app.inject({
        method: "GET",
        url: "/api/daily/sessions?mode=coding_agent"
      });
      expect(sessions.statusCode).toBe(200);
      expect(sessions.json().sessions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: "cloud-session",
          workspaceId: "cloud-a",
          workspaceRuntimeMode: "cloud_runtime"
        })
      ]));
    } finally {
      await app.close();
    }
  });

  it("executes cloud writes only with an active same-session grant and audits every result", async () => {
    const repository = new SeedDailyWorkRepository();
    const cloudClient = new MockCloudRuntimeClient();
    await repository.upsertCodingWorkspace(createReadyCloudWorkspace("cloud-authorized"));
    await repository.recordChatMessage({
      id: "cloud-authorized-message",
      ownerId: "local-dev-user",
      sessionId: "cloud-authorized-session",
      appMode: "coding_agent",
      role: "user",
      content: "Update the cloud workspace and run its tests.",
      workspaceId: "cloud-authorized",
      workspaceName: "cloud-authorized",
      workspaceRuntimeMode: "cloud_runtime",
      createdAt: now
    });
    await repository.recordToolCall({
      id: "cloud-write-tool",
      ownerId: "local-dev-user",
      sessionId: "cloud-authorized-session",
      workspaceId: "cloud-authorized",
      runtimeMode: "cloud_runtime",
      requestId: "cloud-write-request",
      name: "coding.write_file",
      status: "permission_required",
      inputJson: { path: "notes.txt", content: "cloud runtime write" },
      previewOnly: false,
      permissionRequired: true,
      createdAt: now
    });
    await repository.recordToolCall({
      id: "cloud-tests-tool",
      ownerId: "local-dev-user",
      sessionId: "cloud-authorized-session",
      workspaceId: "cloud-authorized",
      runtimeMode: "cloud_runtime",
      requestId: "cloud-tests-request",
      name: "coding.run_tests",
      status: "permission_required",
      inputJson: { command: "npm test", timeoutMs: 30_000 },
      previewOnly: false,
      permissionRequired: true,
      createdAt: now
    });
    const app = await buildServer({
      dailyWorkRepository: repository,
      cloudRuntimeClient: cloudClient
    });

    try {
      const blocked = await app.inject({
        method: "POST",
        url: "/api/coding/tool-calls/cloud-write-tool/execute",
        payload: {
          sessionId: "cloud-authorized-session",
          workspaceId: "cloud-authorized",
          runtimeMode: "cloud_runtime"
        }
      });
      expect(blocked.statusCode).toBe(403);

      const granted = await app.inject({
        method: "POST",
        url: "/api/coding/permission-grants",
        payload: {
          sessionId: "cloud-authorized-session",
          workspaceId: "cloud-authorized",
          runtimeMode: "cloud_runtime",
          provider: "cloud_runtime",
          action: "coding.write_file",
          reason: "dual-runtime integration approval"
        }
      });
      expect(granted.statusCode).toBe(200);

      const executed = await app.inject({
        method: "POST",
        url: "/api/coding/tool-calls/cloud-write-tool/execute",
        payload: {
          sessionId: "cloud-authorized-session",
          workspaceId: "cloud-authorized",
          runtimeMode: "cloud_runtime"
        }
      });
      expect(executed.statusCode).toBe(200);
      expect(executed.json()).toEqual(expect.objectContaining({
        toolCall: expect.objectContaining({
          id: "cloud-write-tool",
          status: "completed",
          workspaceId: "cloud-authorized",
          runtimeMode: "cloud_runtime"
        })
      }));
      expect(cloudClient.executions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          workspaceId: "cloud-authorized",
          requestId: "cloud-write-request",
          toolName: "coding.write_file"
        }),
        expect.objectContaining({
          workspaceId: "cloud-authorized",
          toolName: "coding.git_diff"
        })
      ]));

      const trace = await app.inject({
        method: "GET",
        url: "/api/chat/sessions/cloud-authorized-session/trace"
      });
      expect(trace.json()).toEqual(expect.objectContaining({
        workspaceId: "cloud-authorized",
        runtimeMode: "cloud_runtime",
        permissionGrants: expect.arrayContaining([
          expect.objectContaining({
            action: "coding.write_file",
            status: "active",
            workspaceId: "cloud-authorized"
          })
        ]),
        toolCalls: expect.arrayContaining([
          expect.objectContaining({
            id: "cloud-write-tool",
            status: "completed",
            requestId: "cloud-write-request"
          })
        ]),
        toolActivityEvents: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining("cloud-write-tool"),
            metadata: expect.objectContaining({
              toolName: "coding.write_file",
              requestId: "cloud-write-request",
              runtimeMode: "cloud_runtime"
            })
          })
        ])
      }));
      const artifacts = await repository.listArtifacts({
        ownerId: "local-dev-user",
        workspaceId: "cloud-authorized"
      });
      expect(artifacts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: "coding-artifact-cloud-write-tool",
          sourceContextIds: ["cloud-authorized"]
        })
      ]));

      const testsGrant = await app.inject({
        method: "POST",
        url: "/api/coding/permission-grants",
        payload: {
          sessionId: "cloud-authorized-session",
          workspaceId: "cloud-authorized",
          runtimeMode: "cloud_runtime",
          action: "coding.run_tests"
        }
      });
      const testsGrantId = testsGrant.json().grant.id as string;
      const revoked = await app.inject({
        method: "POST",
        url: `/api/coding/permission-grants/${testsGrantId}/revoke`,
        payload: { reason: "approval withdrawn" }
      });
      expect(revoked.json().grant.status).toBe("revoked");
      const revokedExecution = await app.inject({
        method: "POST",
        url: "/api/coding/tool-calls/cloud-tests-tool/execute",
        payload: {
          sessionId: "cloud-authorized-session",
          workspaceId: "cloud-authorized",
          runtimeMode: "cloud_runtime"
        }
      });
      expect(revokedExecution.statusCode).toBe(403);
      expect(revokedExecution.json()).toEqual(expect.objectContaining({
        error: "permission_required"
      }));
    } finally {
      await app.close();
    }
  });

  it("decrypts repository credentials only for the internal lifecycle request", async () => {
    const repository = new SeedDailyWorkRepository();
    await repository.upsertRepositoryCredential({
      id: "credential-a",
      ownerId: "local-dev-user",
      provider: "https_token",
      label: "Private repository",
      encryptedSecret: "encrypted-token-envelope",
      keyVersion: "v1",
      createdAt: now,
      updatedAt: now
    });
    const cloudClient = new MockCloudRuntimeClient();
    const app = await buildServer({
      dailyWorkRepository: repository,
      cloudRuntimeClient: cloudClient,
      credentialCipher: {
        decrypt: () => "plain-repository-token"
      }
    });
    try {
      const credentialList = await app.inject({
        method: "GET",
        url: "/api/coding/repository-credentials"
      });
      expect(credentialList.statusCode).toBe(200);
      expect(credentialList.json()).toEqual({
        mode: "coding_agent",
        credentials: [expect.objectContaining({
          id: "credential-a",
          provider: "https_token",
          label: "Private repository"
        })]
      });
      expect(credentialList.body).not.toContain("encrypted-token-envelope");
      expect(credentialList.body).not.toContain("plain-repository-token");

      const response = await app.inject({
        method: "POST",
        url: "/api/coding/workspaces/cloud",
        payload: {
          name: "Private cloud",
          repositoryUrl: "https://github.com/example/private.git",
          credentialId: "credential-a",
          idempotencyKey: "private-cloud-a"
        }
      });
      expect(response.statusCode).toBe(202);
      expect(response.body).not.toContain("plain-repository-token");
      expect(response.body).not.toContain("encrypted-token-envelope");
      expect(cloudClient.lifecycleRequests[0]?.repositoryToken)
        .toBe("plain-repository-token");
    } finally {
      await app.close();
    }
  });

  it("returns a stable conflict when cloud runtime is not configured", async () => {
    const app = await buildServer({
      dailyWorkRepository: new SeedDailyWorkRepository(),
      cloudRuntimeClient: new MockCloudRuntimeClient(false)
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/coding/workspaces/cloud",
        payload: {
          name: "Unavailable",
          repositoryUrl: "https://github.com/example/unavailable.git",
          idempotencyKey: "unavailable-cloud"
        }
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual(expect.objectContaining({
        error: "runtime_unavailable"
      }));
    } finally {
      await app.close();
    }
  });
});

class MockCloudRuntimeClient implements CloudRuntimeClient {
  readonly lifecycleRequests: CloudRuntimeLifecycleRequest[] = [];
  readonly executions: CloudRuntimeExecuteInput[] = [];

  constructor(readonly configured = true) {}

  async health() {
    return {
      configured: this.configured,
      reachable: this.configured,
      service: "seekdesk-cloud-runtime",
      dockerReady: this.configured
    };
  }

  async submitLifecycle(request: CloudRuntimeLifecycleRequest) {
    this.lifecycleRequests.push(request);
  }

  async getStatus(ownerId: string, workspaceId: string) {
    const request = [...this.lifecycleRequests].reverse().find(
      (candidate) => candidate.ownerId === ownerId && candidate.workspace.workspaceId === workspaceId
    );
    const workspace = request?.workspace ?? createReadyCloudWorkspace(workspaceId);
    return {
      workspace,
      operations: request
        ? [{ ...request.operation, status: "running" as const, startedAt: now }]
        : [],
      updatedAt: now
    };
  }

  async execute(input: CloudRuntimeExecuteInput) {
    this.executions.push(input);
    if (input.toolName === "coding.git_diff") {
      return {
        command: "git diff -- notes.txt",
        stdout: "diff --git a/notes.txt b/notes.txt\n+cloud runtime write",
        stderr: "",
        exitCode: 0,
        timedOut: false,
        truncated: false
      };
    }
    if (input.toolName === "coding.run_tests") {
      return {
        command: "npm test",
        cwd: "/workspace",
        stdout: "tests passed",
        stderr: "",
        exitCode: 0,
        timedOut: false,
        truncated: false
      };
    }
    return { path: "notes.txt", bytesWritten: 19 };
  }
}

function createReadyCloudWorkspace(workspaceId: string): CodingWorkspaceRecord {
  return {
    workspaceId,
    ownerId: "local-dev-user",
    name: workspaceId,
    runtimeMode: "cloud_runtime",
    status: "ready",
    rootPath: "/workspace",
    connected: true,
    repository: {
      url: `https://github.com/example/${workspaceId}.git`,
      branch: "main"
    },
    imageProfile: "node22",
    supportedCapabilities: [],
    createdAt: now,
    updatedAt: now
  };
}
