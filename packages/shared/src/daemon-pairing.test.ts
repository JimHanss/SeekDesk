import { describe, expect, it } from "vitest";

import {
  daemonPairingClaimRequestSchema,
  daemonPairingCreateRequestSchema
} from "./daemon-pairing.js";

describe("daemon pairing schemas", () => {
  it("normalizes a human pairing code", () => {
    const value = daemonPairingClaimRequestSchema.parse({
      code: "abcd-efgh-jk23",
      daemonId: "daemon-a",
      machineName: "workstation",
      platform: "win32"
    });

    expect(value.code).toBe("ABCD-EFGH-JK23");
  });

  it("accepts only HTTP API endpoints", () => {
    expect(daemonPairingCreateRequestSchema.safeParse({ apiUrl: "https://desk.example.com" }).success).toBe(true);
    expect(daemonPairingCreateRequestSchema.safeParse({ apiUrl: "file:///tmp/api" }).success).toBe(false);
  });
});
