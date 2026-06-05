import { describe, expect, it } from "vitest";

import { runAgentLoop } from "./loop.js";
import type {
  ModelChatRequest,
  ModelProvider,
  ModelStreamChunk
} from "./provider.js";

describe("runAgentLoop", () => {
  it("adds read-only daily-work session and context before provider streaming", async () => {
    const provider = new CapturingProvider();

    const result = await runAgentLoop({
      provider,
      mode: "daily_work",
      sessionId: "planning-refresh-session",
      prompt: "draft the next action list",
      context: {
        workspaceId: "workspace-seekdesk",
        contextItemIds: ["project-brief", "meeting-notes"],
        artifactIds: ["task-list-artifact"],
        approvalRequestIds: [],
        connectorIds: [],
        workflowIds: []
      }
    });

    expect(result.status).toBe("completed");
    expect(result.chunks).toEqual([
      { type: "text-delta", delta: "ok" },
      { type: "done" }
    ]);
    expect(provider.request).toEqual(
      expect.objectContaining({
        mode: "daily_work",
        maxTurns: 1,
        messages: [
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("read-only")
          }),
          {
            role: "user",
            content: "draft the next action list"
          }
        ]
      })
    );
    expect(provider.request?.messages[0]?.content).toContain(
      "Session id: planning-refresh-session"
    );
    expect(provider.request?.messages[0]?.content).toContain(
      "Context item ids: project-brief, meeting-notes"
    );
    expect(provider.request?.messages[0]?.content).toContain(
      "Do not execute tools"
    );
  });

  it("carries tool plans without executing tools in the provider stream", async () => {
    const provider = new CapturingProvider();
    const toolPlan = [
      {
        name: "daily_work.plan",
        inputJson: {
          taskId: "task-123"
        },
        planOnly: true
      }
    ];

    const result = await runAgentLoop({
      provider,
      prompt: "prepare the plan",
      toolPlan
    });

    expect(result.toolPlan).toEqual(toolPlan);
    expect(provider.request?.toolPlan).toEqual(toolPlan);
    expect(provider.request?.messages[1]).toEqual(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("Tool plan is advisory only")
      })
    );
    expect(result.chunks).toEqual([
      { type: "text-delta", delta: "ok" },
      { type: "done" }
    ]);
  });
});

class CapturingProvider implements ModelProvider {
  request: ModelChatRequest | undefined;

  async *streamChat(request: ModelChatRequest): AsyncIterable<ModelStreamChunk> {
    this.request = request;
    yield {
      type: "text-delta",
      delta: "ok"
    };
    yield {
      type: "done"
    };
  }
}
