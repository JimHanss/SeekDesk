import { describe, expect, it } from "vitest";

import { codingChatRequestSchema } from "./chat.js";
import {
  codingPermissionGrantBindingSchema,
  codingPermissionGrantSchema
} from "./permissions.js";
import {
  normalizeRuntimeMode,
  runtimeErrorCodeSchema,
  runtimeExecuteResponseSchema,
  runtimeModeSchema
} from "./runtime.js";
import { toolCallRecordSchema } from "./tools.js";
import {
  codingWorkspaceSummarySchema,
  workspaceRuntimeSelectionSchema
} from "./workspaces.js";

describe("dual runtime contracts", () => {
  it("normalizes legacy runtime names to canonical values", () => {
    expect(normalizeRuntimeMode("cloud_workspace")).toBe("cloud_runtime");
    expect(normalizeRuntimeMode("local_runtime")).toBe("server_local");
    expect(runtimeModeSchema.parse("local_daemon")).toBe("local_daemon");
  });

  it("normalizes legacy cloud workspace summaries", () => {
    const workspace = codingWorkspaceSummarySchema.parse({
      workspaceId: "workspace-cloud-1",
      name: "SeekDesk",
      runtimeMode: "cloud_workspace",
      status: "ready",
      rootPath: "/workspace",
      connected: true,
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z"
    });

    expect(workspace.runtimeMode).toBe("cloud_runtime");
    expect(workspace.supportedCapabilities).toEqual([]);
  });

  it("only exposes local daemon and cloud runtime as user selections", () => {
    expect(
      workspaceRuntimeSelectionSchema.parse({
        workspaceId: "workspace-local-1",
        runtimeMode: "local_daemon"
      })
    ).toMatchObject({ runtimeMode: "local_daemon" });
    expect(() =>
      workspaceRuntimeSelectionSchema.parse({
        workspaceId: "server-local-runtime",
        runtimeMode: "server_local"
      })
    ).toThrow();
  });

  it("requires complete grant bindings for cross-runtime authorization", () => {
    expect(
      codingPermissionGrantBindingSchema.parse({
        ownerId: "user-1",
        sessionId: "session-1",
        workspaceId: "workspace-cloud-1",
        runtimeMode: "cloud_runtime",
        action: "coding.run_tests"
      })
    ).toMatchObject({ runtimeMode: "cloud_runtime" });

    expect(() =>
      codingPermissionGrantBindingSchema.parse({
        ownerId: "user-1",
        sessionId: "session-1",
        workspaceId: "workspace-cloud-1",
        runtimeMode: "server_local",
        action: "coding.run_tests"
      })
    ).toThrow();
  });

  it("keeps legacy grants and tool calls readable", () => {
    expect(
      codingPermissionGrantSchema.parse({
        id: "grant-1",
        provider: "local_daemon",
        sessionId: "session-1",
        action: "coding.run_shell",
        decision: "allow_for_session",
        status: "active",
        createdAt: "2026-07-15T00:00:00.000Z",
        expiresAt: "2026-07-16T00:00:00.000Z"
      }).workspaceId
    ).toBeUndefined();

    expect(
      toolCallRecordSchema.parse({
        id: "tool-1",
        sessionId: "session-1",
        name: "coding.read_file",
        status: "completed",
        inputJson: { path: "README.md" },
        previewOnly: false,
        permissionRequired: false,
        createdAt: "2026-07-15T00:00:00.000Z"
      }).runtimeMode
    ).toBeUndefined();
  });

  it("requires a workspace for strict coding chat requests", () => {
    expect(() =>
      codingChatRequestSchema.parse({
        mode: "coding_agent",
        prompt: "Read README.md"
      })
    ).toThrow(/workspaceId/);

    expect(
      codingChatRequestSchema.parse({
        mode: "coding_agent",
        prompt: "Read README.md",
        context: { workspaceId: "workspace-local-1" }
      }).context?.workspaceId
    ).toBe("workspace-local-1");
  });

  it("parses structured runtime failures", () => {
    expect(
      runtimeExecuteResponseSchema.parse({
        ok: false,
        requestId: "request-1",
        error: {
          code: "runtime_unavailable",
          message: "Runtime is offline."
        }
      })
    ).toMatchObject({ ok: false, requestId: "request-1" });
  });

  it("keeps worker transport and runtime-core errors inside the shared protocol", () => {
    expect([
      "invalid_json",
      "invalid_runtime_request",
      "runtime_input_too_large",
      "runtime_output_too_large",
      "runtime_tool_unsupported",
      "runtime_request_conflict",
      "runtime_workspace_mismatch",
      "path_outside_workspace",
      "binary_file",
      "dangerous_command"
    ].map((code) => runtimeErrorCodeSchema.parse(code))).toHaveLength(10);
  });
});
