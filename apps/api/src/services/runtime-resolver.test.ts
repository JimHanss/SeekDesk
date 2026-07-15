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
