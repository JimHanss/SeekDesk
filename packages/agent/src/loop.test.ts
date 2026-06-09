import { describe, expect, it } from "vitest";

import { runAgentLoop } from "./loop.js";
import type {
  ModelChatRequest,
  ModelProvider,
  ModelStreamChunk
} from "./provider.js";
import { ToolOrchestrator, ToolRegistry } from "./tools.js";

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
      },
      contextSummaryLines: [
        "Context item project-brief: Project Brief; summary=Current scope.",
        "Connector customer-email: Customer Email; provider=gmail; status=available."
      ]
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
      "Context item project-brief: Project Brief"
    );
    expect(provider.request?.messages[0]?.content).toContain(
      "Connector customer-email: Customer Email"
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

  it("preserves assistant tool calls before sending tool results to the next turn", async () => {
    const provider = new ToolCallingProvider();
    const orchestrator = new ToolOrchestrator(
      new ToolRegistry([
        {
          name: "daily.persist_artifact",
          mode: "daily_work",
          description: "Persist a local daily-work artifact."
        }
      ])
    );

    const result = await runAgentLoop({
      provider,
      prompt: "persist an artifact",
      maxTurns: 2,
      orchestrator
    });

    expect(result.chunks).toEqual([
      {
        type: "tool-call",
        id: "call-1",
        name: "daily_persist_artifact",
        inputJson: {
          title: "Trace"
        },
        rawArguments: "{\"title\":\"Trace\"}"
      },
      expect.objectContaining({
        type: "tool-result",
        id: "call-1",
        name: "daily.persist_artifact"
      }),
      { type: "text-delta", delta: "done" },
      { type: "done" }
    ]);
    expect(provider.requests[1]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call-1",
              type: "function",
              function: {
                name: "daily_persist_artifact",
                arguments: "{\"title\":\"Trace\"}"
              }
            }
          ]
        }),
        expect.objectContaining({
          role: "tool",
          toolCallId: "call-1",
          name: "daily_persist_artifact"
        })
      ])
    );
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

class ToolCallingProvider implements ModelProvider {
  readonly requests: ModelChatRequest[] = [];

  async *streamChat(request: ModelChatRequest): AsyncIterable<ModelStreamChunk> {
    this.requests.push(request);

    if (this.requests.length === 1) {
      yield {
        type: "tool-call",
        id: "call-1",
        name: "daily_persist_artifact",
        inputJson: {
          title: "Trace"
        },
        rawArguments: "{\"title\":\"Trace\"}"
      };
      yield {
        type: "done"
      };
      return;
    }

    yield {
      type: "text-delta",
      delta: "done"
    };
    yield {
      type: "done"
    };
  }
}
