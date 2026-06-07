import { describe, expect, it } from "vitest";

import { createDefaultToolRegistry, createModelToolDefinitions } from "./tools.js";
import { MockModelProvider } from "./mock-provider.js";

describe("MockModelProvider", () => {
  it("streams a mock response", async () => {
    const provider = new MockModelProvider();
    const chunks = [];
    const text: string[] = [];

    for await (const chunk of provider.streamChat({
      mode: "daily_work",
      messages: [{ role: "user", content: "summarize this repository" }],
      maxTurns: 1
    })) {
      chunks.push(chunk);
      if (chunk.type === "text-delta") {
        text.push(chunk.delta);
      }
    }

    expect(chunks.at(-1)).toEqual({ type: "done" });
    expect(chunks.some((chunk) => chunk.type === "text-delta")).toBe(true);
    expect(text.join("")).toContain("Mock daily-work AI response");
    expect(text.join("")).not.toContain("```");
  });

  it("streams fenced TypeScript code blocks for code prompts", async () => {
    const provider = new MockModelProvider();
    const text: string[] = [];

    for await (const chunk of provider.streamChat({
      mode: "daily_work",
      messages: [{ role: "user", content: "show TypeScript code for a signal" }],
      maxTurns: 1
    })) {
      if (chunk.type === "text-delta") {
        text.push(chunk.delta);
      }
    }

    const response = text.join("");
    expect(response).toContain("```ts");
    expect(response).toContain("type DailyWorkSignal");
    expect(response).toContain("```");
  });

  it("streams fenced JSON code blocks for JSON prompts", async () => {
    const provider = new MockModelProvider();
    const text: string[] = [];

    for await (const chunk of provider.streamChat({
      mode: "daily_work",
      messages: [{ role: "user", content: "请给我一段 json 代码" }],
      maxTurns: 1
    })) {
      if (chunk.type === "text-delta") {
        text.push(chunk.delta);
      }
    }

    const response = text.join("");
    expect(response).toContain("```json");
    expect(response).toContain('"signals"');
  });

  it("streams a deterministic daily-work tool call for agent trace smoke prompts", async () => {
    const provider = new MockModelProvider();
    const chunks = [];

    for await (const chunk of provider.streamChat({
      mode: "daily_work",
      messages: [
        {
          role: "user",
          content: "daily_work browser smoke agent tool trace"
        }
      ],
      maxTurns: 3,
      tools: createModelToolDefinitions(createDefaultToolRegistry(), "daily_work"),
      toolChoice: "auto"
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tool-call",
          id: expect.stringMatching(/^mock-call-daily-persist-artifact-/),
          name: "daily_persist_artifact",
          inputJson: expect.objectContaining({
            title: "Browser smoke agent trace"
          })
        })
      ])
    );
  });

  it("streams final text and usage after the deterministic smoke tool result", async () => {
    const provider = new MockModelProvider();
    const chunks = [];
    const text: string[] = [];

    for await (const chunk of provider.streamChat({
      mode: "daily_work",
      messages: [
        {
          role: "user",
          content: "daily_work browser smoke agent tool trace"
        },
        {
          role: "tool",
          toolCallId: "mock-call-daily-persist-artifact",
          name: "daily_persist_artifact",
          content: "{\"status\":\"completed\"}"
        }
      ],
      maxTurns: 3,
      tools: createModelToolDefinitions(createDefaultToolRegistry(), "daily_work"),
      toolChoice: "auto"
    })) {
      chunks.push(chunk);
      if (chunk.type === "text-delta") {
        text.push(chunk.delta);
      }
    }

    expect(text.join("")).toContain("Tool trace artifact saved for review");
    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "usage",
          usage: {
            promptTokens: 42,
            completionTokens: 18,
            totalTokens: 60
          }
        })
      ])
    );
  });

  it("keeps a reserved coding-agent compatibility path", async () => {
    const provider = new MockModelProvider();
    const text: string[] = [];

    for await (const chunk of provider.streamChat({
      mode: "coding_agent",
      messages: [{ role: "user", content: "inspect a repository" }],
      maxTurns: 1
    })) {
      if (chunk.type === "text-delta") {
        text.push(chunk.delta);
      }
    }

    expect(text.join("")).toContain("coding-agent compatibility");
    expect(text.join("")).not.toContain("```");
  });
});
