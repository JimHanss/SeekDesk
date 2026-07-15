import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createCloudRuntimeConfig } from "./config.js";
import { ProcessGitBootstrapper } from "./git-bootstrap.js";
import { CloudWorkspaceStorage } from "./storage.js";

describe("CloudWorkspaceStorage", () => {
  it("isolates owner paths, enforces quotas, and refuses mismatched cleanup", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekdesk-cloud-storage-"));
    const storage = new CloudWorkspaceStorage(root, 4);
    await storage.initialize();
    const first = await storage.create("owner-a", "workspace-a");
    const second = storage.getRef("owner-b", "workspace-a");
    expect(first.baseDirectory).not.toBe(second.baseDirectory);
    await writeFile(join(first.workspaceDirectory, "large.txt"), "12345", "utf8");
    await expect(storage.assertWithinQuota(first)).rejects.toMatchObject({
      code: "workspace_limit_exceeded"
    });
    await expect(storage.deleteWorkspaceData("owner-b", "workspace-a")).rejects.toMatchObject({
      code: "workspace_access_denied"
    });
  });
});

describe("cloud runtime configuration", () => {
  it("maps the shared runtime resource environment into validated limits", () => {
    const config = createCloudRuntimeConfig({
      SEEKDESK_CLOUD_RUNTIME_SERVICE_TOKEN: "test-service-token-1234",
      SEEKDESK_RUNTIME_STORAGE_ROOT: "/tmp/seekdesk-runtime-config",
      SEEKDESK_RUNTIME_DISK_GB: "2",
      SEEKDESK_RUNTIME_IDLE_TTL_MINUTES: "15",
      SEEKDESK_RUNTIME_CPU_LIMIT: "3",
      SEEKDESK_RUNTIME_MEMORY_MB: "2048",
      SEEKDESK_RUNTIME_PID_LIMIT: "128",
      SEEKDESK_CLOUD_RUNTIME_UID: "10002",
      SEEKDESK_CLOUD_RUNTIME_GID: "10003"
    });
    expect(config).toMatchObject({
      workspaceQuotaBytes: 2 * 1024 * 1024 * 1024,
      idleTimeoutMs: 15 * 60 * 1000,
      cpuLimit: 3,
      memoryLimit: "2048m",
      pidsLimit: 128,
      runtimeUid: 10002,
      runtimeGid: 10003
    });
  });
});

describe("ProcessGitBootstrapper", () => {
  it("rejects non-HTTPS URLs, embedded credentials, and unsafe branches before spawning Git", async () => {
    const root = await mkdtemp(join(tmpdir(), "seekdesk-cloud-git-"));
    const storage = new CloudWorkspaceStorage(root, 1_000_000);
    const ref = await storage.create("owner-a", "workspace-a");
    const bootstrapper = new ProcessGitBootstrapper();
    await expect(bootstrapper.clone({
      repositoryUrl: "http://example.com/repository.git",
      branch: "main",
      storage: ref,
      timeoutMs: 1_000
    })).rejects.toMatchObject({ code: "repository_credentials_invalid" });
    await expect(bootstrapper.clone({
      repositoryUrl: "https://user:secret@example.com/repository.git",
      branch: "main",
      storage: ref,
      timeoutMs: 1_000
    })).rejects.toMatchObject({ code: "repository_credentials_invalid" });
    await expect(bootstrapper.clone({
      repositoryUrl: "https://example.com/repository.git",
      branch: "--upload-pack=bad",
      storage: ref,
      timeoutMs: 1_000
    })).rejects.toMatchObject({ code: "invalid_runtime_request" });
  });
});
