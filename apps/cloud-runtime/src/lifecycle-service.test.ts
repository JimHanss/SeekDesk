import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  CodingWorkspaceRecord,
  RuntimeExecuteRequest,
  RuntimeOperation
} from "@seekdesk/shared";
import { afterEach, describe, expect, it } from "vitest";

import type { CloudRuntimeConfig } from "./config.js";
import type {
  CloudContainerEngine,
  CloudContainerInspection,
  CloudContainerSpec
} from "./engine.js";
import type { GitBootstrapRequest, GitBootstrapper } from "./git-bootstrap.js";
import { CloudRuntimeLifecycleService } from "./lifecycle-service.js";
import { createCloudRuntimeServer } from "./server.js";
import { CloudWorkspaceStorage } from "./storage.js";

const openServices: CloudRuntimeLifecycleService[] = [];

afterEach(() => {
  for (const service of openServices.splice(0)) service.close();
});

describe("CloudRuntimeLifecycleService", () => {
  it("provisions idempotently, keeps tokens volatile, executes, idles, and deletes", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekdesk-cloud-runtime-"));
    const config = testConfig(root);
    const storage = new CloudWorkspaceStorage(root, config.workspaceQuotaBytes);
    const engine = new FakeEngine();
    const git = new FakeGit();
    let clock = Date.parse("2026-07-15T00:00:00.000Z");
    const service = new CloudRuntimeLifecycleService(
      config,
      storage,
      engine,
      git,
      () => new Date(clock)
    );
    openServices.push(service);
    await service.initialize();
    const workspace = createWorkspace();
    const provision = createOperation("provision", "provision-1");
    await service.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace,
      operation: provision,
      repositoryToken: "top-secret-repository-token"
    });
    await waitForOperation(service, workspace.ownerId, workspace.workspaceId, provision.id);

    const ready = service.getStatus(workspace.ownerId, workspace.workspaceId);
    expect(ready.workspace.status).toBe("ready");
    expect(ready.workspace.repository?.revision).toBe("a".repeat(40));
    expect(git.tokens).toEqual(["top-secret-repository-token"]);
    await service.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace: ready.workspace,
      operation: { ...provision, id: "duplicate-id" }
    });
    expect(service.getStatus(workspace.ownerId, workspace.workspaceId).operations).toHaveLength(1);

    const stateFile = storage.getRef(workspace.ownerId, workspace.workspaceId).stateFile;
    expect(await readFile(stateFile, "utf8")).not.toContain("top-secret-repository-token");
    const execution = await service.execute({
      requestId: "request-1",
      ownerId: workspace.ownerId,
      workspaceId: workspace.workspaceId,
      toolName: "coding.read_file",
      inputJson: { path: "README.md" }
    });
    expect(execution).toMatchObject({ ok: true, result: { executed: "coding.read_file" } });

    clock += config.idleTimeoutMs + 1;
    await service.stopIdleWorkspaces();
    expect(service.getStatus(workspace.ownerId, workspace.workspaceId).workspace.status).toBe("stopped");

    const deletion = createOperation("delete", "delete-1");
    const stopped = service.getStatus(workspace.ownerId, workspace.workspaceId).workspace;
    await service.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace: stopped,
      operation: deletion
    });
    await waitForOperation(service, workspace.ownerId, workspace.workspaceId, deletion.id);
    expect(service.getStatus(workspace.ownerId, workspace.workspaceId).workspace.status).toBe("deleted");
    await expect(stat(storage.getRef(workspace.ownerId, workspace.workspaceId).workspaceDirectory))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reconciles a missing container into a stable error", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekdesk-cloud-reconcile-"));
    const config = testConfig(root);
    const storage = new CloudWorkspaceStorage(root, config.workspaceQuotaBytes);
    const engine = new FakeEngine();
    const service = new CloudRuntimeLifecycleService(config, storage, engine, new FakeGit());
    openServices.push(service);
    await service.initialize();
    const workspace = createWorkspace();
    const provision = createOperation("provision", "provision-2");
    await service.submitLifecycle({ ownerId: workspace.ownerId, workspace, operation: provision });
    await waitForOperation(service, workspace.ownerId, workspace.workspaceId, provision.id);
    engine.containers.clear();
    await service.reconcile();
    expect(service.getStatus(workspace.ownerId, workspace.workspaceId).workspace).toMatchObject({
      status: "error",
      errorCode: "runtime_unavailable"
    });
  });

  it("serializes start, stop, retry, and cleanup recovery with strict idempotency", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekdesk-cloud-lifecycle-"));
    const config = testConfig(root);
    const storage = new CloudWorkspaceStorage(root, config.workspaceQuotaBytes);
    const engine = new FakeEngine();
    const service = new CloudRuntimeLifecycleService(config, storage, engine, new FakeGit());
    openServices.push(service);
    await service.initialize();
    const workspace = createWorkspace();
    const provision = createOperation("provision", "lifecycle-provision");
    await service.submitLifecycle({ ownerId: workspace.ownerId, workspace, operation: provision });
    await waitForOperation(service, workspace.ownerId, workspace.workspaceId, provision.id);

    const stop = createOperation("stop", "lifecycle-stop");
    await service.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace: service.getStatus(workspace.ownerId, workspace.workspaceId).workspace,
      operation: stop
    });
    await waitForOperation(service, workspace.ownerId, workspace.workspaceId, stop.id);
    expect(service.getStatus(workspace.ownerId, workspace.workspaceId).workspace.status).toBe("stopped");

    await expect(service.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace: service.getStatus(workspace.ownerId, workspace.workspaceId).workspace,
      operation: { ...createOperation("delete", "lifecycle-stop"), id: "conflicting-operation" }
    })).rejects.toMatchObject({ code: "workspace_operation_conflict" });

    const start = createOperation("start", "lifecycle-start");
    await service.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace: service.getStatus(workspace.ownerId, workspace.workspaceId).workspace,
      operation: start
    });
    await waitForOperation(service, workspace.ownerId, workspace.workspaceId, start.id);
    expect(service.getStatus(workspace.ownerId, workspace.workspaceId).workspace.status).toBe("ready");

    const retry = createOperation("retry", "lifecycle-retry");
    await service.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace: service.getStatus(workspace.ownerId, workspace.workspaceId).workspace,
      operation: retry
    });
    await waitForOperation(service, workspace.ownerId, workspace.workspaceId, retry.id);
    expect(service.getStatus(workspace.ownerId, workspace.workspaceId).workspace.status).toBe("ready");

    engine.deleteFailuresRemaining = 1;
    const failedDelete = createOperation("delete", "lifecycle-delete-failed");
    await service.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace: service.getStatus(workspace.ownerId, workspace.workspaceId).workspace,
      operation: failedDelete
    });
    await waitForTerminalOperation(service, workspace.ownerId, workspace.workspaceId, failedDelete.id);
    expect(service.getStatus(workspace.ownerId, workspace.workspaceId).workspace.status).toBe("error");

    const recoveredDelete = createOperation("delete", "lifecycle-delete-retry");
    await service.submitLifecycle({
      ownerId: workspace.ownerId,
      workspace: service.getStatus(workspace.ownerId, workspace.workspaceId).workspace,
      operation: recoveredDelete
    });
    await waitForOperation(service, workspace.ownerId, workspace.workspaceId, recoveredDelete.id);
    expect(service.getStatus(workspace.ownerId, workspace.workspaceId).workspace.status).toBe("deleted");
  });
});

describe("cloud runtime internal API", () => {
  it("authenticates every internal route and returns request IDs", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekdesk-cloud-server-"));
    const config = testConfig(root);
    const server = await createCloudRuntimeServer({
      config,
      engine: new FakeEngine(),
      git: new FakeGit(),
      storage: new CloudWorkspaceStorage(root, config.workspaceQuotaBytes)
    });
    const unauthorized = await server.app.inject({ method: "GET", url: "/internal/health" });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json()).toMatchObject({ error: "workspace_access_denied" });
    const authorized = await server.app.inject({
      method: "GET",
      url: "/internal/health",
      headers: {
        authorization: `Bearer ${config.serviceToken}`,
        "x-request-id": "request-health-1"
      }
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.headers["x-request-id"]).toBe("request-health-1");
    expect(authorized.json()).toMatchObject({
      status: "ok",
      service: "seekdesk-cloud-runtime",
      dockerReady: true
    });
    await server.app.close();
  });
});

class FakeGit implements GitBootstrapper {
  readonly tokens: Array<string | undefined> = [];

  async clone(request: GitBootstrapRequest) {
    this.tokens.push(request.token);
    return { revision: "a".repeat(40) };
  }
}

class FakeEngine implements CloudContainerEngine {
  readonly containers = new Map<string, CloudContainerInspection>();
  deleteFailuresRemaining = 0;

  async readiness() {
    return { dockerReady: true };
  }

  async provision(spec: CloudContainerSpec) {
    const containerRef = `container-${spec.workspaceId}`;
    this.containers.set(containerRef, {
      containerRef,
      workspaceId: spec.workspaceId,
      exists: true,
      running: false,
      status: "created"
    });
    return containerRef;
  }

  async inspect(containerRef: string) {
    return this.containers.get(containerRef) ?? {
      containerRef,
      workspaceId: "unknown",
      exists: false,
      running: false,
      status: "missing"
    };
  }

  async start(containerRef: string) {
    const current = await this.inspect(containerRef);
    this.containers.set(containerRef, { ...current, exists: true, running: true, status: "running" });
  }

  async stop(containerRef: string) {
    const current = await this.inspect(containerRef);
    if (current.exists) {
      this.containers.set(containerRef, { ...current, running: false, status: "exited" });
    }
  }

  async delete(containerRef: string) {
    if (this.deleteFailuresRemaining > 0) {
      this.deleteFailuresRemaining -= 1;
      throw new Error("simulated container cleanup failure");
    }
    this.containers.delete(containerRef);
  }

  async execute(_containerRef: string, request: RuntimeExecuteRequest) {
    return { executed: request.toolName };
  }

  async listManagedContainers() {
    return [...this.containers.values()];
  }
}

function createWorkspace(): CodingWorkspaceRecord {
  return {
    workspaceId: "cloud-workspace-1",
    ownerId: "owner-1",
    name: "Cloud workspace",
    runtimeMode: "cloud_runtime",
    status: "provisioning",
    rootPath: "/workspace",
    connected: false,
    repository: {
      url: "https://example.com/repository.git",
      branch: "main"
    },
    imageProfile: "node22",
    supportedCapabilities: [],
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z"
  };
}

function createOperation(
  type: RuntimeOperation["type"],
  idempotencyKey: string
): RuntimeOperation {
  return {
    id: `operation-${idempotencyKey}`,
    ownerId: "owner-1",
    workspaceId: "cloud-workspace-1",
    type,
    status: "queued",
    idempotencyKey,
    requestPayload: {},
    createdAt: "2026-07-15T00:00:00.000Z"
  };
}

function testConfig(storageRoot: string): CloudRuntimeConfig {
  return {
    host: "127.0.0.1",
    port: 4100,
    serviceToken: "test-service-token-1234",
    dockerBinary: "docker",
    runtimeImage: "seekdesk-runtime:node22",
    storageRoot,
    workspaceQuotaBytes: 10_000_000,
    idleTimeoutMs: 1_000,
    reconcileIntervalMs: 60_000,
    cloneTimeoutMs: 10_000,
    executeTimeoutMs: 10_000,
    maxCommandOutputBytes: 100_000,
    cpuLimit: 2,
    memoryLimit: "4g",
    pidsLimit: 256,
    tmpfsSize: "256m",
    runtimeUid: 10001,
    runtimeGid: 10001
  };
}

async function waitForOperation(
  service: CloudRuntimeLifecycleService,
  ownerId: string,
  workspaceId: string,
  operationId: string
) {
  for (let index = 0; index < 100; index += 1) {
    const operation = service.getStatus(ownerId, workspaceId).operations.find(
      (candidate) => candidate.id === operationId
    );
    if (operation && ["completed", "failed"].includes(operation.status)) {
      expect(operation.status).toBe("completed");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Lifecycle operation did not finish.");
}

async function waitForTerminalOperation(
  service: CloudRuntimeLifecycleService,
  ownerId: string,
  workspaceId: string,
  operationId: string
) {
  for (let index = 0; index < 100; index += 1) {
    const operation = service.getStatus(ownerId, workspaceId).operations.find(
      (candidate) => candidate.id === operationId
    );
    if (operation && ["completed", "failed"].includes(operation.status)) return operation;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Lifecycle operation did not reach a terminal state.");
}
