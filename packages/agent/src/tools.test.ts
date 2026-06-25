import { describe, expect, it } from "vitest";

import {
  ToolOrchestrator,
  ToolRegistry,
  createDefaultToolRegistry,
  createModelToolDefinitions,
  fromModelToolName,
  toModelToolName
} from "./tools.js";

describe("ToolRegistry", () => {
  it("registers and looks up tool definitions", () => {
    const registry = new ToolRegistry();

    const definition = registry.register({
      name: "daily_work.preview_summary",
      mode: "daily_work",
      description: "Preview a summary action."
    });

    expect(definition).toEqual(
      expect.objectContaining({
        name: "daily_work.preview_summary",
        mode: "daily_work",
        permissionPolicy: "preview_only",
        defaultResultStatus: "completed"
      })
    );
    expect(registry.has("daily_work.preview_summary")).toBe(true);
    expect(registry.get("daily_work.preview_summary")).toBe(definition);
    expect(registry.list()).toEqual([definition]);
  });

  it("throws when registering duplicate tool names", () => {
    const registry = new ToolRegistry([
      {
        name: "daily_work.preview_summary",
        mode: "daily_work",
        description: "Preview a summary action."
      }
    ]);

    expect(() =>
      registry.register({
        name: "daily_work.preview_summary",
        mode: "daily_work",
        description: "Another summary tool."
      })
    ).toThrow('Tool "daily_work.preview_summary" is already registered.');
  });
});

describe("ToolOrchestrator", () => {
  it("returns preview-only completed or planned results for daily-work tools", async () => {
    const registry = new ToolRegistry([
      {
        name: "daily_work.preview_summary",
        mode: "daily_work",
        description: "Preview a summary action."
      },
      {
        name: "daily_work.plan_email",
        mode: "daily_work",
        description: "Plan an email action.",
        defaultResultStatus: "planned"
      }
    ]);
    const orchestrator = new ToolOrchestrator(registry);

    await expect(
      orchestrator.orchestrate({
        name: "daily_work.preview_summary",
        inputJson: {
          artifactId: "artifact-123"
        }
      })
    ).resolves.toEqual(
      expect.objectContaining({
        name: "daily_work.preview_summary",
        status: "completed",
        mode: "daily_work",
        previewOnly: true,
        permissionRequired: false,
        outputJson: {
          previewOnly: true,
          planned: false
        }
      })
    );

    await expect(
      orchestrator.orchestrate({
        name: "daily_work.plan_email"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        name: "daily_work.plan_email",
        status: "planned",
        previewOnly: true,
        permissionRequired: false,
        outputJson: {
          previewOnly: true,
          planned: true
        }
      })
    );
  });

  it("returns permission_required for coding tools", async () => {
    const orchestrator = new ToolOrchestrator(
      new ToolRegistry([
        {
          name: "coding.run_shell",
          mode: "coding_agent",
          description: "Reserved shell access."
        }
      ])
    );

    await expect(
      orchestrator.orchestrate({
        name: "coding.run_shell",
        inputJson: {
          command: "npm test"
        }
      })
    ).resolves.toEqual(
      expect.objectContaining({
        name: "coding.run_shell",
        status: "permission_required",
        mode: "coding_agent",
        previewOnly: false,
        permissionRequired: true
      })
    );
  });

  it("exposes coding tools to the model and keeps write tools permission-gated", async () => {
    const registry = createDefaultToolRegistry();
    const toolNames = createModelToolDefinitions(registry, "coding_agent").map(
      (tool) => tool.function.name
    );

    expect(toolNames).toContain("coding_read_file");
    expect(toolNames).toContain("coding_run_shell");
    expect(toolNames).toContain("coding_run_tests");

    await expect(
      new ToolOrchestrator(registry).orchestrate({
        name: "coding.run_shell",
        inputJson: {
          command: "npm test"
        }
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: "permission_required",
        previewOnly: false,
        permissionRequired: true
      })
    );
  });

  it("returns failed for unknown tools", async () => {
    const orchestrator = new ToolOrchestrator(new ToolRegistry());

    await expect(
      orchestrator.orchestrate({
        name: "missing.tool"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        name: "missing.tool",
        status: "failed",
        error: "unknown_tool"
      })
    );
  });

  it("maps model-safe tool names back to internal tool names", async () => {
    const orchestrator = new ToolOrchestrator(
      new ToolRegistry([
        {
          name: "coding.grep",
          mode: "coding_agent",
          description: "Search workspace files.",
          parametersJsonSchema: {
            type: "object",
            properties: {}
          }
        }
      ])
    );

    await expect(
      orchestrator.orchestrate({
        name: "coding_grep"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        name: "coding.grep",
        status: "permission_required",
        mode: "coding_agent"
      })
    );
  });
});

describe("model tool names", () => {
  it("converts internal dotted names to DeepSeek-compatible names", () => {
    expect(toModelToolName("coding.read_file")).toBe("coding_read_file");
    expect(toModelToolName("coding.run_tests")).toBe("coding_run_tests");
  });

  it("emits model-safe tool definitions and resolves them", () => {
    const registry = new ToolRegistry([
      {
        name: "coding.read_file",
        mode: "coding_agent",
        description: "Read a workspace file.",
        parametersJsonSchema: {
          type: "object",
          properties: {}
        }
      }
    ]);

    expect(createModelToolDefinitions(registry)).toEqual([
      expect.objectContaining({
        function: expect.objectContaining({
          name: "coding_read_file"
        })
      })
    ]);
    expect(fromModelToolName(registry, "coding_read_file")).toBe(
      "coding.read_file"
    );
  });
});
