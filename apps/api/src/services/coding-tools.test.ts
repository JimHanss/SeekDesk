import { describe, expect, it, vi } from "vitest";

import type { CodingToolName, RuntimeMode } from "@seekdesk/shared";

import { SeedDailyWorkRepository } from "../repositories/daily-work-repository.js";
import {
  createCodingPermissionGrant,
  executeAuthorizedCodingToolCall
} from "./coding-tools.js";
import {
  CodingRuntimeError,
  type CodingRuntime,
  type CodingRuntimeExecutionContext
} from "./coding-runtime.js";

const ownerId = "local-dev-user";
const sessionId = "session-1";
const workspaceId = "server-local-runtime";
const runtimeMode: RuntimeMode = "server_local";

describe("authorized coding tool execution", () => {
  it("claims a pending tool call once and preserves its request context", async () => {
    const repository = await createRepositoryWithPendingTool(
      "coding.run_shell",
      { command: "npm test", timeoutMs: 30_000 }
    );
    await grant(repository, "coding.run_shell");
    const execute = vi.fn(async (_name, _input, context?: CodingRuntimeExecutionContext) => {
      void _name;
      void _input;
      void context;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return {
        command: "npm test",
        cwd: "/workspace",
        stdout: "passed",
        stderr: "",
        exitCode: 0,
        timedOut: false,
        truncated: false
      };
    });
    const runtime = createRuntime(execute);

    const [first, second] = await Promise.allSettled([
      runPending(repository, runtime),
      runPending(repository, runtime)
    ]);

    expect([first.status, second.status].sort()).toEqual(["fulfilled", "rejected"]);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[2]).toEqual({ requestId: "request-1" });
    const completed = (await repository.listToolCalls({ ownerId, sessionId }))[0];
    expect(completed).toMatchObject({
      status: "completed",
      requestId: "request-1",
      outputJson: {
        command: "npm test",
        stdout: "passed",
        exitCode: 0,
        timeout: false,
        timedOut: false,
        truncated: false,
        workspaceId,
        runtimeMode
      }
    });
    expect((await repository.listRuntimeOperations({ ownerId, workspaceId }))[0]).toMatchObject({
      status: "completed",
      idempotencyKey: "tool-call:tool-1"
    });
  });

  it("rejects revoked, expired, and cross-scope grants", async () => {
    for (const variant of ["revoked", "expired", "cross_workspace", "cross_runtime"] as const) {
      const repository = await createRepositoryWithPendingTool(
        "coding.run_shell",
        { command: "npm test", timeoutMs: 30_000 }
      );
      const baseGrant = createCodingPermissionGrant({
        ownerId,
        sessionId,
        workspaceId,
        runtimeMode,
        action: "coding.run_shell"
      });
      await repository.upsertPermissionGrant({
        ...baseGrant,
        ...(variant === "revoked" ? { status: "revoked" as const, revokedAt: new Date().toISOString() } : {}),
        ...(variant === "expired" ? { expiresAt: "2020-01-01T00:00:00.000Z" } : {}),
        ...(variant === "cross_workspace" ? { workspaceId: "other-workspace" } : {}),
        ...(variant === "cross_runtime" ? { provider: "local_daemon" as const, runtimeMode: "local_daemon" as const } : {})
      });
      const execute = vi.fn();

      await expect(runPending(repository, createRuntime(execute))).rejects.toMatchObject({
        code: "permission_required"
      });
      expect(execute).not.toHaveBeenCalled();
      expect((await repository.listToolCalls({ ownerId, sessionId }))[0]?.status)
        .toBe("permission_required");
    }
  });

  it("associates a file write with an artifact, session, workspace, and refreshed diff", async () => {
    const repository = await createRepositoryWithPendingTool(
      "coding.write_file",
      { path: "src/example.ts", content: "export const value = 1;", createDirs: true }
    );
    await grant(repository, "coding.write_file");
    const runtime = createRuntime(async () => ({
      path: "src/example.ts",
      bytesWritten: 23,
      previewOnly: false,
      externalEffects: ["workspace.file.write"]
    }));

    const result = await runPending(repository, runtime);
    expect(result.result).toMatchObject({
      artifactId: "coding-artifact-tool-1",
      workspaceId,
      runtimeMode,
      requestId: "request-1",
      gitDiff: { stdout: "diff --git a/src/example.ts b/src/example.ts" }
    });
    expect(await repository.listArtifacts({ ownerId, workspaceId, runtimeMode })).toEqual([
      expect.objectContaining({
        id: "coding-artifact-tool-1",
        sessionId,
        workspaceId,
        runtimeMode,
        toolCallId: "tool-1",
        requestId: "request-1",
        path: "src/example.ts"
      })
    ]);
    const session = (await repository.listSessionDetails({ ownerId, workspaceId, runtimeMode }))
      .find((candidate) => candidate.id === sessionId);
    expect(session?.artifactIds).toContain("coding-artifact-tool-1");
  });

  it("records interrupted execution as cancelled across trace and operation audit", async () => {
    const repository = await createRepositoryWithPendingTool(
      "coding.run_tests",
      { command: "npm test", timeoutMs: 120_000 }
    );
    await grant(repository, "coding.run_tests");
    const runtime = createRuntime(async () => {
      throw new CodingRuntimeError(
        "Runtime request was cancelled.",
        "runtime_request_cancelled"
      );
    });

    await expect(runPending(repository, runtime)).rejects.toMatchObject({
      code: "runtime_request_cancelled"
    });
    expect((await repository.listToolCalls({ ownerId, sessionId }))[0]?.status)
      .toBe("cancelled");
    expect((await repository.listRuntimeOperations({ ownerId, workspaceId }))[0]?.status)
      .toBe("cancelled");
    expect(await repository.listEvents({ ownerId, workspaceId, runtimeMode })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "cancelled",
          metadata: expect.objectContaining({
            toolPhase: "cancelled",
            requestId: "request-1",
            runtimeMode
          })
        })
      ])
    );
  });
});

async function createRepositoryWithPendingTool(
  name: "coding.run_shell" | "coding.run_tests" | "coding.write_file",
  inputJson: unknown
) {
  const repository = new SeedDailyWorkRepository();
  await repository.recordChatMessage({
    id: "message-1",
    ownerId,
    sessionId,
    appMode: "coding_agent",
    role: "user",
    content: "Make a change.",
    workspaceId,
    workspaceName: "SeekDesk",
    workspaceRoot: "/workspace",
    workspaceRuntimeMode: runtimeMode,
    createdAt: new Date().toISOString()
  });
  await repository.recordToolCall({
    id: "tool-1",
    ownerId,
    sessionId,
    workspaceId,
    runtimeMode,
    requestId: "request-1",
    name,
    status: "permission_required",
    inputJson,
    previewOnly: false,
    permissionRequired: true,
    createdAt: new Date().toISOString()
  });
  return repository;
}

async function grant(
  repository: SeedDailyWorkRepository,
  action: "coding.run_shell" | "coding.run_tests" | "coding.write_file"
) {
  await repository.upsertPermissionGrant(createCodingPermissionGrant({
    ownerId,
    sessionId,
    workspaceId,
    runtimeMode,
    action
  }));
}

function runPending(repository: SeedDailyWorkRepository, runtime: CodingRuntime) {
  return executeAuthorizedCodingToolCall({
    repository,
    ownerId,
    toolCallId: "tool-1",
    sessionId,
    workspaceId,
    runtimeMode,
    runtime
  });
}

function createRuntime(
  execute: (
    name: CodingToolName,
    input: unknown,
    context?: CodingRuntimeExecutionContext
  ) => Promise<unknown>
): CodingRuntime {
  return {
    status: () => ({
      status: "ok",
      service: "test-runtime",
      workspaceId,
      workspaceName: "SeekDesk",
      workspaceRoot: "/workspace",
      workspaceSelectable: false,
      runtimeMode,
      supportedCapabilities: [
        "coding.write_file",
        "coding.run_shell",
        "coding.run_tests",
        "coding.git_diff"
      ],
      safetyBoundary: {
        readsUserFiles: true,
        writesUserFiles: true,
        executesShell: true,
        workspaceRootLocked: true,
        requiresApprovalForWritesAndCommands: true
      }
    }),
    browseWorkspaceDirectories: async () => ({}),
    selectWorkspace: async () => ({}),
    execute,
    listFiles: async () => ({}),
    readFile: async () => ({}),
    grep: async () => ({}),
    gitStatus: async () => ({}),
    gitDiff: async () => ({ stdout: "diff --git a/src/example.ts b/src/example.ts" })
  };
}
