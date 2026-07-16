import { describe, expect, it } from "vitest";

import { DaemonDeviceTokenService } from "./daemon-device-token.js";
import { DaemonPairingError, DaemonPairingService } from "./daemon-pairing-service.js";

const secret = "test-device-secret-with-enough-entropy";

describe("DaemonPairingService", () => {
  it("creates, claims and reports a one-time pairing", () => {
    let now = 1_000;
    const tokens = new DaemonDeviceTokenService(secret, { now: () => now });
    const service = new DaemonPairingService(tokens, { now: () => now });
    const created = service.create({ ownerId: "owner-a", apiUrl: "http://127.0.0.1:4100/" });

    expect(created.deepLink).toContain("seekdesk://pair");
    const claimed = service.claim({
      code: created.code,
      daemonId: "daemon-a",
      machineName: "workstation",
      platform: "win32"
    });

    expect(tokens.verify(claimed.deviceToken, "daemon-a").ownerId).toBe("owner-a");
    expect(service.getStatus("owner-a", created.pairingId)).toMatchObject({
      status: "claimed",
      device: { daemonId: "daemon-a" }
    });
    expect(() => service.claim({
      code: created.code,
      daemonId: "daemon-a",
      machineName: "workstation",
      platform: "win32"
    })).toThrow("already been used");
    now += 1;
  });

  it("expires a pending code and enforces owner scope", () => {
    let now = 1_000;
    const service = new DaemonPairingService(
      new DaemonDeviceTokenService(secret, { now: () => now }),
      { now: () => now, pairingTtlMs: 100 }
    );
    const created = service.create({ ownerId: "owner-a", apiUrl: "https://desk.example.com" });

    expect(() => service.getStatus("owner-b", created.pairingId)).toThrow(DaemonPairingError);
    now = 1_101;
    expect(service.getStatus("owner-a", created.pairingId).status).toBe("expired");
    expect(() => service.claim({
      code: created.code,
      daemonId: "daemon-a",
      machineName: "workstation",
      platform: "darwin"
    })).toThrow("expired");
  });

  it("requires HTTPS for non-local production APIs", () => {
    const service = new DaemonPairingService(
      new DaemonDeviceTokenService(secret),
      { production: true }
    );
    expect(() => service.create({ ownerId: "owner-a", apiUrl: "http://desk.example.com" })).toThrow("HTTPS");
    expect(() => service.create({ ownerId: "owner-a", apiUrl: "http://localhost:4100" })).not.toThrow();
  });
});
