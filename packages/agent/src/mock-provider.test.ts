import { describe, expect, it } from "vitest";

import { MockModelProvider } from "./mock-provider.js";

describe("MockModelProvider", () => {
  it("streams a mock response", async () => {
    const provider = new MockModelProvider();
    const chunks = [];

    for await (const chunk of provider.streamChat({
      messages: [{ role: "user", content: "summarize this repository" }],
      maxTurns: 1
    })) {
      chunks.push(chunk);
    }

    expect(chunks.at(-1)).toEqual({ type: "done" });
    expect(chunks.some((chunk) => chunk.type === "text-delta")).toBe(true);
  });
});
