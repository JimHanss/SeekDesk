import { describe, expect, it } from "vitest";

import {
  codingEditFileInputSchema,
  codingRunShellInputSchema,
  codingToolInputSchemas,
  codingToolNameSchema
} from "./tools.js";

describe("coding tool schemas", () => {
  it("registers coding tool names", () => {
    expect(codingToolNameSchema.parse("coding.read_file")).toBe("coding.read_file");
    expect(codingToolNameSchema.parse("coding.edit_file")).toBe("coding.edit_file");
    expect(codingToolNameSchema.parse("coding.run_shell")).toBe("coding.run_shell");
  });

  it("validates edit input with a safe replacement default", () => {
    expect(
      codingEditFileInputSchema.parse({
        path: "apps/web/src/app/page.tsx",
        search: "daily_work",
        replace: "coding_agent"
      })
    ).toEqual({
      path: "apps/web/src/app/page.tsx",
      search: "daily_work",
      replace: "coding_agent",
      expectedReplacements: 1
    });
  });

  it("uses the same schema map for command tools", () => {
    expect(codingToolInputSchemas["coding.run_shell"]).toBe(
      codingRunShellInputSchema
    );
  });

  it("records canonical runtime bindings without breaking legacy calls", async () => {
    const { toolCallRecordSchema } = await import("./tools.js");
    const parsed = toolCallRecordSchema.parse({
      id: "tool-call-1",
      ownerId: "user-1",
      sessionId: "session-1",
      workspaceId: "workspace-1",
      runtimeMode: "cloud_workspace",
      requestId: "request-1",
      name: "coding.read_file",
      status: "completed",
      inputJson: { path: "README.md" },
      previewOnly: false,
      permissionRequired: false,
      createdAt: "2026-07-15T00:00:00.000Z"
    });

    expect(parsed.runtimeMode).toBe("cloud_runtime");
  });
});
