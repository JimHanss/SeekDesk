import { describe, expect, it } from "vitest";

import type { CloudRuntimeConfig } from "./config.js";
import {
  DockerCliContainerEngine,
  type DockerCommandResult,
  type DockerCommandRunner
} from "./engine.js";

describe("DockerCliContainerEngine", () => {
  it("creates containers with the mandatory isolation and resource limits", async () => {
    const calls: string[][] = [];
    const runner: DockerCommandRunner = {
      async run(args) {
        calls.push(args);
        return success("container-123\n");
      }
    };
    const engine = new DockerCliContainerEngine(config(), runner);
    await engine.provision({
      ownerId: "owner-1",
      workspaceId: "workspace-1",
      workspacePath: "/storage/workspace-1",
      image: "seekdesk-runtime:node22"
    });
    const args = calls[0] ?? [];
    expect(args).toContain("--read-only");
    expect(args).toContain("none");
    expect(args).toContain("ALL");
    expect(args).toContain("no-new-privileges=true");
    expect(args).toContain("10001:10001");
    expect(args).toContain("2");
    expect(args).toContain("4g");
    expect(args.some((value) => value.includes("dst=/workspace"))).toBe(true);
    expect(args.at(-1)).toBe("idle");
  });
});

function success(stdout = ""): DockerCommandResult {
  return { exitCode: 0, stdout, stderr: "", timedOut: false, truncated: false };
}

function config(): CloudRuntimeConfig {
  return {
    host: "127.0.0.1",
    port: 4100,
    serviceToken: "test-service-token-1234",
    dockerBinary: "docker",
    runtimeImage: "seekdesk-runtime:node22",
    storageRoot: "/tmp/seekdesk-test",
    workspaceQuotaBytes: 10_000_000,
    idleTimeoutMs: 60_000,
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
