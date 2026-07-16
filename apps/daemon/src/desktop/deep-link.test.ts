import { describe, expect, it } from "vitest";

import { findPairingDeepLink, parsePairingDeepLink } from "./deep-link.js";

describe("daemon pairing deep links", () => {
  it("parses a valid pairing link", () => {
    expect(parsePairingDeepLink(
      "seekdesk://pair?api=https%3A%2F%2Fdesk.example.com&code=ABCD-EFGH-JK23"
    )).toEqual({
      apiUrl: "https://desk.example.com",
      code: "ABCD-EFGH-JK23"
    });
  });

  it("ignores unrelated or malformed arguments", () => {
    expect(parsePairingDeepLink("https://desk.example.com")).toBeNull();
    expect(findPairingDeepLink(["--hidden", "seekdesk://pair?code=bad"])).toBeNull();
  });
});
