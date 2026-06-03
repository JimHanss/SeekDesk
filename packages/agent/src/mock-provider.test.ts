import { describe, expect, it } from "vitest";

import { MockModelProvider } from "./mock-provider.js";

describe("MockModelProvider", () => {
  it("streams a mock response", async () => {
    const provider = new MockModelProvider();
    const chunks = [];

    for await (const chunk of provider.streamChat({
      mode: "daily_work",
      messages: [{ role: "user", content: "summarize this repository" }],
      maxTurns: 1
    })) {
      chunks.push(chunk);
    }

    expect(chunks.at(-1)).toEqual({ type: "done" });
    expect(chunks.some((chunk) => chunk.type === "text-delta")).toBe(true);
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
  });
});
