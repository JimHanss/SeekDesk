import { describe, expect, it } from "vitest";

import {
  DaemonDeviceTokenError,
  DaemonDeviceTokenService
} from "./daemon-device-token.js";

const secret = "test-device-secret-with-enough-entropy";

describe("DaemonDeviceTokenService", () => {
  it("issues and verifies an owner-bound daemon token", () => {
    const service = new DaemonDeviceTokenService(secret, { now: () => 1_000 });
    const issued = service.issue({ ownerId: "owner-a", daemonId: "daemon-a" });

    expect(service.verify(issued.token, "daemon-a")).toMatchObject({
      ownerId: "owner-a",
      daemonId: "daemon-a",
      issuedAt: 1_000
    });
  });

  it("rejects tampering, expiry and daemon mismatch", () => {
    let now = 1_000;
    const service = new DaemonDeviceTokenService(secret, {
      now: () => now,
      tokenTtlMs: 100
    });
    const issued = service.issue({ ownerId: "owner-a", daemonId: "daemon-a" });

    expect(() => service.verify(`${issued.token}x`)).toThrow(DaemonDeviceTokenError);
    expect(() => service.verify(issued.token, "daemon-b")).toThrow("does not belong");
    now = 1_101;
    expect(() => service.verify(issued.token)).toThrow("expired");
  });
});
