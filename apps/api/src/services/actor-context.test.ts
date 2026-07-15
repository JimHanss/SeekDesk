import { describe, expect, it } from "vitest";

import { ActorContextResolver } from "./actor-context.js";

describe("ActorContextResolver", () => {
  it("uses the configured development owner and ignores client user headers", async () => {
    const resolver = new ActorContextResolver({
      SEEKDESK_AUTH_MODE: "development",
      SEEKDESK_DEV_USER_ID: "trusted-local-user"
    });
    await expect(resolver.resolve({ headers: { "x-user-id": "attacker" } })).resolves.toMatchObject({
      ownerId: "trusted-local-user",
      authMode: "development"
    });
  });

  it("disables production cloud access when OIDC is incomplete", async () => {
    const resolver = new ActorContextResolver({ SEEKDESK_AUTH_MODE: "oidc" });
    expect(resolver.readiness).toMatchObject({
      configured: false,
      productionCloudRuntimeAllowed: false
    });
    await expect(resolver.resolve({ headers: {} })).rejects.toMatchObject({
      code: "auth_not_configured",
      statusCode: 503
    });
  });

  it("takes owner identity only from the verified JWT subject", async () => {
    const resolver = new ActorContextResolver(
      {
        SEEKDESK_AUTH_MODE: "oidc",
        SEEKDESK_OIDC_ISSUER: "https://issuer.example",
        SEEKDESK_OIDC_AUDIENCE: "seekdesk",
        SEEKDESK_OIDC_JWKS_URL: "https://issuer.example/.well-known/jwks.json"
      },
      { verifyToken: async () => ({ sub: "owner-from-token" }) }
    );
    await expect(resolver.resolve({
      headers: { authorization: "Bearer valid", "x-user-id": "attacker" }
    })).resolves.toMatchObject({ ownerId: "owner-from-token", authMode: "oidc" });
  });
});
