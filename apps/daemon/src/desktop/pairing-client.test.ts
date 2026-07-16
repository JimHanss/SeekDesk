import { describe, expect, it, vi } from "vitest";

import { claimDaemonPairing } from "./pairing-client.js";

describe("claimDaemonPairing", () => {
  it("claims a pairing without exposing transport details", async () => {
    const fetchImplementation = vi.fn(async () => new Response(JSON.stringify({
      apiUrl: "https://desk.example.com",
      daemonId: "daemon-a",
      deviceToken: "sd1.payload.signature-with-enough-length",
      tokenExpiresAt: "2027-01-01T00:00:00.000Z"
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await claimDaemonPairing({
      apiUrl: "https://desk.example.com/",
      code: "ABCD-EFGH-JK23",
      daemonId: "daemon-a",
      machineName: "workstation",
      platform: "win32"
    }, fetchImplementation as typeof fetch);

    expect(result.daemonId).toBe("daemon-a");
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://desk.example.com/api/coding/daemon-pairings/claim",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("surfaces a stable API error message", async () => {
    const fetchImplementation = vi.fn(async () => new Response(JSON.stringify({
      error: "daemon_pairing_code_expired",
      message: "Daemon pairing code has expired."
    }), { status: 410, headers: { "Content-Type": "application/json" } }));

    await expect(claimDaemonPairing({
      apiUrl: "https://desk.example.com",
      code: "ABCD-EFGH-JK23",
      daemonId: "daemon-a",
      machineName: "workstation",
      platform: "darwin"
    }, fetchImplementation as typeof fetch)).rejects.toThrow("expired");
  });
});
