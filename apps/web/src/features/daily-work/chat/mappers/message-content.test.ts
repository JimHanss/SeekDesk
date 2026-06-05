import { describe, expect, it } from "vitest";

import {
  normalizeCodeLanguage,
  parseMessageSegments,
  syntaxTokenClass,
  tokenizeCode
} from "./message-content";

describe("chat message content mappers", () => {
  it("splits markdown code fences into text and code segments", () => {
    const segments = parseMessageSegments(
      "Plan\n```ts\nconst answer = 42;\n```\nDone"
    );

    expect(segments).toEqual([
      { type: "text", content: "Plan\n" },
      { type: "code", language: "ts", content: "const answer = 42;" },
      { type: "text", content: "\nDone" }
    ]);
  });

  it("normalizes familiar language aliases", () => {
    expect(normalizeCodeLanguage("tsx")).toBe("typescript");
    expect(normalizeCodeLanguage("sh")).toBe("bash");
    expect(normalizeCodeLanguage("jsonc")).toBe("json");
  });

  it("tokenizes script code for syntax highlighting", () => {
    const tokens = tokenizeCode("const total = 12;", "typescript");

    expect(tokens.some((token) => token.kind === "keyword")).toBe(true);
    expect(tokens.some((token) => token.kind === "number")).toBe(true);
    expect(syntaxTokenClass("keyword")).toContain("violet");
  });
});
