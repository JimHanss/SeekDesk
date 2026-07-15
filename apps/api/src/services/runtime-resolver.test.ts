import type { CodingWorkspaceRecord } from "@seekdesk/shared";
import { describe, expect, it } from "vitest";

import { SeedDailyWorkRepository } from "../repositories/daily-work-repository.js";
import type {
  CloudRuntimeClient,
  CloudRuntimeExecuteInput,
  CloudRuntimeLifecycleRequest
} from "./cloud-runtime-client.js";
import { DaemonRegistry } from "./daemon-registry.js";
import { RuntimeResolver } from "./runtime-resolver.js";

const now = "2026-07-15T00:00:00.000Z";

describe("RuntimeResolver", () => {
  it("resolves a ready cloud workspace and keeps it owner/runtime scoped", async () => {
    const repository = new SeedDailyWorkRepository();
    const cloudClient = new MockCloudRuntimeClient();
    const workspace = createCloudWorkspace("owner-a", "cloud-ready", "ready");
    await repository.upsertCodingWorkspace(workspace);
    const resolver = createResolver(repository, cloudClient);

    await expect(resolver.getWorkspace("owner-b", workspace.workspaceId)).resolves.toBeNull();
    await expect(resolver.resolve("owner-b", workspace.workspaceId)).rejects.toMatchObject({
      code: "workspace_not_found"
    });
    await expect(
      resolver.resolve("owner-a", workspace.workspaceId, "local_daemon")
    ).rejects.toMatchObject({ code: "session_workspace_mismatch" });

    const resolution = await resolver.resolve(
      "owner-a",
      workspace.workspaceId,
      "cloud_runtime"
    );
    await expect(resolution.runtime.readFile({ path: "README.md", maxBytes: 1000 }))
      .resolves.toEqual({ path: "README.md", content: "cloud result" });
    expect(cloudClient.executions).toEqual([
      expect.objectContaining({
        ownerId: "owner-a",
        workspaceId: workspace.workspaceId,
        toolName: "coding.read_file",
        inputJson: { path: "README.md", maxBytes: 1000 }
      })
    ]);
  });

  it("keeps local daemon and cloud requests isolated while both runtimes are online", async () => {
    const repository = new SeedDailyWorkRepository();
    const cloudClient = new MockCloudRuntimeClient();
    const daemonRegistry = new DaemonRegistry("owner-a");
    const daemonSocket = new FakeDaemonSocket();
    daemonRegistry.handleConnection(
      daemonSocket as unknown as Parameters<DaemonRegistry["handleConnection"]>[0]
    );
    daemonSocket.emitMessage({
      type: "daemon.register",
      token: "seekdesk-local-dev",
      status: {
        daemonId: "daemon-dual-runtime",
        machineName: "windows-workstation",
        platform: "win32",
        workspaceRoot: "E:\\Project\\LocalOnly",
        supportedCapabilities: ["coding.read_file"],
        pid: 42
      }
    });
    const localWorkspace = daemonRegistry.listWorkspaces("owner-a")[0];
    expect(localWorkspace).toBeDefined();
    daemonSocket.workspaceId = localWorkspace!.workspaceId;
    const cloudWorkspace = createCloudWorkspace("owner-a", "cloud-concurrent", "ready");
    await repository.upsertCodingWorkspace(cloudWorkspace);
    const resolver = new RuntimeResolver({
      repository,
      daemonRegistry,
      cloudRuntimeClient: cloudClient,
      serverLocalEnabled: false
    });

    const [localResolution, cloudResolution] = await Promise.all([
      resolver.resolve("owner-a", localWorkspace!.workspaceId, "local_daemon"),
      resolver.resolve("owner-a", cloudWorkspace.workspaceId, "cloud_runtime")
    ]);
    const [localRead, cloudRead] = await Promise.all([
      localResolution.runtime.readFile({ path: "README.md", maxBytes: 1000 }),
      cloudResolution.runtime.readFile({ path: "README.md", maxBytes: 1000 })
    ]);

    expect(localRead).toEqual({
      path: "README.md",
      content: "local daemon result",
      workspaceId: localWorkspace!.workspaceId
    });
    expect(cloudRead).toEqual({ path: "README.md", content: "cloud result" });
    expect(daemonSocket.toolRequests).toEqual([
      expect.objectContaining({
        command: "tool.execute",
        payload: expect.objectContaining({ toolName: "coding.read_file" })
      })
    ]);
    expect(cloudClient.executions).toEqual([
      expect.objectContaining({
        ownerId: "owner-a",
        workspaceId: "cloud-concurrent",
        toolName: "coding.read_file"
      })
    ]);
    daemonSocket.close();
  });

  it("returns stable failures for unknown, offline, and not-ready workspaces", async () => {
    const repository = new SeedDailyWorkRepository();
    const resolver = createResolver(repository, new MockCloudRuntimeClient());
    await repository.upsertCodingWorkspace(
      createCloudWorkspace("owner-a", "cloud-stopped", "stopped")
    );
    await repository.upsertCodingWorkspace(createOfflineDaemonWorkspace());

    await expect(resolver.resolve("owner-a", "missing-workspace")).rejects.toMatchObject({
      code: "workspace_not_found"
    });
    await expect(resolver.resolve("owner-a", "cloud-stopped")).rejects.toMatchObject({
      code: "runtime_not_ready"
    });
    await expect(resolver.resolve("owner-a", "local-offline")).rejects.toMatchObject({
      code: "runtime_unavailable",
      details: { reason: "daemon_offline" }
    });
    await expect(resolver.getWorkspace("owner-a", "local-offline")).resolves.toEqual(
      expect.objectContaining({ status: "offline", connected: false })
    );
  });

  it("does not silently enable server-local or unconfigured cloud execution", async () => {
    const repository = new SeedDailyWorkRepository();
    const cloudClient = new MockCloudRuntimeClient(false);
    const resolver = createResolver(repository, cloudClient);
    await repository.upsertCodingWorkspace(
      createCloudWorkspace("owner-a", "cloud-unconfigured", "ready")
    );

    await expect(resolver.resolve("owner-a", undefined)).rejects.toMatchObject({
      code: "workspace_not_found"
    });
    await expect(resolver.resolve("owner-a", "cloud-unconfigured")).rejects.toMatchObject({
      code: "runtime_unavailable"
    });
  });
});

class MockCloudRuntimeClient implements CloudRuntimeClient {
  readonly executions: CloudRuntimeExecuteInput[] = [];
  readonly lifecycleRequests: CloudRuntimeLifecycleRequest[] = [];

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
    return {
      workspace: createCloudWorkspace(ownerId, workspaceId, "ready"),
      operations: [],
      updatedAt: now
    };
  }

  async execute(input: CloudRuntimeExecuteInput) {
    this.executions.push(input);
    return { path: "README.md", content: "cloud result" };
  }
}

class FakeDaemonSocket {
  readonly readyState = 1;
  readonly toolRequests: Array<Record<string, unknown>> = [];
  workspaceId = "local-daemon-workspace";
  private readonly listeners = new Map<string, Array<(value: Buffer | Error) => void>>();

  send(data: string) {
    const message = JSON.parse(data) as Record<string, unknown>;
    if (message.type !== "daemon.request") {
      return;
    }
    this.toolRequests.push(message);
    const payload = message.payload as { toolName?: string } | undefined;
    queueMicrotask(() => this.emitMessage({
      type: "daemon.response",
      requestId: message.requestId,
      ok: true,
      result: {
        path: "README.md",
        content: "local daemon result",
        workspaceId: this.workspaceId
      },
      toolName: payload?.toolName
    }));
  }

  close() {
    this.emit("close", Buffer.alloc(0));
  }

  on(event: "message" | "close" | "error", listener: (value: Buffer | Error) => void) {
    const current = this.listeners.get(event) ?? [];
    current.push(listener);
    this.listeners.set(event, current);
  }

  emitMessage(message: unknown) {
    this.emit("message", Buffer.from(JSON.stringify(message)));
  }

  private emit(event: string, value: Buffer | Error) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(value);
    }
  }
}

function createResolver(
  repository: SeedDailyWorkRepository,
  cloudRuntimeClient: CloudRuntimeClient
) {
  return new RuntimeResolver({
    repository,
    daemonRegistry: new DaemonRegistry("owner-a"),
    cloudRuntimeClient,
    serverLocalEnabled: false
  });
}

function createCloudWorkspace(
  ownerId: string,
  workspaceId: string,
  status: CodingWorkspaceRecord["status"]
): CodingWorkspaceRecord {
  return {
    workspaceId,
    ownerId,
    name: workspaceId,
    runtimeMode: "cloud_runtime",
    status,
    rootPath: "/workspace",
    connected: status === "ready",
    repository: {
      url: "https://example.test/repository.git",
      branch: "main"
    },
    imageProfile: "node22",
    supportedCapabilities: ["coding.read_file"],
    createdAt: now,
    updatedAt: now
  };
}

function createOfflineDaemonWorkspace(): CodingWorkspaceRecord {
  return {
    workspaceId: "local-offline",
    ownerId: "owner-a",
    name: "offline-project",
    runtimeMode: "local_daemon",
    status: "ready",
    rootPath: "C:\\projects\\offline-project",
    connected: true,
    daemonId: "daemon-offline",
    machineName: "workstation",
    platform: "win32",
    supportedCapabilities: ["coding.read_file"],
    createdAt: now,
    updatedAt: now
  };
}
