import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerDaemonPairingRoutes } from "./daemon-pairing-routes.js";
import { DaemonDeviceTokenService } from "../services/daemon-device-token.js";
import { DaemonPairingService } from "../services/daemon-pairing-service.js";

describe("daemon pairing routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.decorateRequest("actor");
    app.addHook("onRequest", async (request) => {
      request.actor = {
        ownerId: "owner-a",
        subject: "owner-a",
        authMode: "development",
        claims: { sub: "owner-a" }
      };
    });
    await registerDaemonPairingRoutes(
      app,
      new DaemonPairingService(
        new DaemonDeviceTokenService("test-device-secret-with-enough-entropy")
      )
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates, claims and polls a pairing session", async () => {
    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/coding/daemon-pairings",
      payload: { apiUrl: "http://127.0.0.1:4100" }
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json() as { pairingId: string; code: string };

    const claimResponse = await app.inject({
      method: "POST",
      url: "/api/coding/daemon-pairings/claim",
      payload: {
        code: created.code,
        daemonId: "daemon-a",
        machineName: "workstation",
        platform: "win32"
      }
    });
    expect(claimResponse.statusCode).toBe(200);
    expect(claimResponse.json()).toMatchObject({ daemonId: "daemon-a" });

    const statusResponse = await app.inject({
      method: "GET",
      url: `/api/coding/daemon-pairings/${created.pairingId}`
    });
    expect(statusResponse.json()).toMatchObject({
      status: "claimed",
      device: { daemonId: "daemon-a" }
    });
  });
});
