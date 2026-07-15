import { describe, expect, it } from "vitest";

import {
  compareWorkspaceConversations,
  createWorkspaceSessionBinding,
  isHttpsGitRepositoryUrl,
  isWorkspaceReady,
  runtimeErrorMessage,
  runtimeModeLabel,
  validateCloudWorkspaceDraft,
  workspaceStatusMessage
} from "./workspace-runtime";

const readyCloudWorkspace = {
  workspaceId: "cloud-a",
  name: "Cloud A",
  runtimeMode: "cloud_runtime" as const,
  status: "ready" as const,
  rootPath: "/workspace",
  connected: true,
  supportedCapabilities: [],
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z"
};

describe("workspace runtime UI domain", () => {
  it("only permits ready and connected workspaces to create conversations", () => {
    expect(isWorkspaceReady(readyCloudWorkspace)).toBe(true);
    expect(isWorkspaceReady({ ...readyCloudWorkspace, connected: false })).toBe(false);
    expect(isWorkspaceReady({ ...readyCloudWorkspace, status: "cloning" })).toBe(false);
  });

  it("builds an immutable workspace and Runtime session binding", () => {
    expect(createWorkspaceSessionBinding(readyCloudWorkspace)).toEqual({
      workspaceId: "cloud-a",
      runtimeMode: "cloud_runtime"
    });
    expect(createWorkspaceSessionBinding({
      ...readyCloudWorkspace,
      status: "provisioning"
    })).toBeNull();
  });

  it("validates HTTPS repository drafts without accepting credential text", () => {
    expect(isHttpsGitRepositoryUrl("https://github.com/acme/repo.git")).toBe(true);
    expect(isHttpsGitRepositoryUrl("git@github.com:acme/repo.git")).toBe(false);
    expect(validateCloudWorkspaceDraft({
      name: "Acme",
      repositoryUrl: "https://github.com/acme/repo.git",
      branch: "main"
    })).toBeNull();
    expect(validateCloudWorkspaceDraft({
      name: "Acme",
      repositoryUrl: "http://github.com/acme/repo.git",
      branch: "main"
    })).toContain("HTTPS");
  });

  it("labels both Runtime modes and transitional states", () => {
    expect(runtimeModeLabel("local_daemon")).toBe("本机 daemon");
    expect(runtimeModeLabel("cloud_runtime")).toBe("云端 Runtime");
    expect(workspaceStatusMessage({ ...readyCloudWorkspace, status: "cloning" }))
      .toContain("克隆");
  });

  it("maps Runtime errors to one clear user-facing message", () => {
    expect(runtimeErrorMessage("runtime_unavailable", "raw", "fallback"))
      .toContain("离线");
    expect(runtimeErrorMessage("custom_error", "自定义错误", "fallback"))
      .toBe("自定义错误");
  });

  it("sorts pinned conversations first and then by creation time descending", () => {
    const records = [
      { createdAt: "2026-07-14T00:00:00.000Z", sourceIndex: 0, item: { id: "old" } },
      { createdAt: "2026-07-15T00:00:00.000Z", sourceIndex: 1, item: { id: "new" } },
      { createdAt: "2026-07-13T00:00:00.000Z", sourceIndex: 2, item: { id: "pinned", pinned: true } }
    ];
    expect(records.sort(compareWorkspaceConversations).map((record) => record.item.id))
      .toEqual(["pinned", "new", "old"]);
  });
});
