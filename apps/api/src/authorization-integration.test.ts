import { describe, expect, it } from "vitest";

import { SeedDailyWorkRepository } from "./repositories/daily-work-repository.js";
import { buildServer } from "./server.js";
import { ActorContextResolver } from "./services/actor-context.js";

describe("API actor authorization", () => {
  it("keeps health public but disables protected routes when production auth is incomplete", async () => {
    const actorContextResolver = new ActorContextResolver({
      SEEKDESK_AUTH_MODE: "oidc"
    });
    const app = await buildServer({ actorContextResolver });

    try {
      const health = await app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
      expect(health.json().auth).toEqual(
        expect.objectContaining({
          mode: "oidc",
          configured: false,
          productionCloudRuntimeAllowed: false
        })
      );

      const protectedResponse = await app.inject({
        method: "GET",
        url: "/api/coding/workspaces"
      });
      expect(protectedResponse.statusCode).toBe(503);
      expect(protectedResponse.json()).toEqual(
        expect.objectContaining({ error: "auth_not_configured" })
      );
    } finally {
      await app.close();
    }
  });

  it("uses verified token identity and rejects client-side owner overrides in trace queries", async () => {
    const repository = new SeedDailyWorkRepository();
    await repository.recordToolCall(createToolCall("tool-a", "owner-a"));
    await repository.recordToolCall(createToolCall("tool-b", "owner-b"));
    const actorContextResolver = new ActorContextResolver(
      {
        SEEKDESK_AUTH_MODE: "oidc",
        SEEKDESK_OIDC_ISSUER: "https://issuer.example",
        SEEKDESK_OIDC_AUDIENCE: "seekdesk",
        SEEKDESK_OIDC_JWKS_URL: "https://issuer.example/.well-known/jwks.json"
      },
      { verifyToken: async () => ({ sub: "owner-a" }) }
    );
    const app = await buildServer({ dailyWorkRepository: repository, actorContextResolver });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/chat/sessions/shared-session/trace",
        headers: {
          authorization: "Bearer verified",
          "x-user-id": "owner-b"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().toolCalls).toEqual([
        expect.objectContaining({ id: "tool-a", ownerId: "owner-a" })
      ]);
    } finally {
      await app.close();
    }
  });
});

function createToolCall(id: string, ownerId: string) {
  return {
    id,
    ownerId,
    sessionId: "shared-session",
    workspaceId: "workspace-shared",
    runtimeMode: "cloud_runtime" as const,
    name: "coding.read_file" as const,
    status: "completed" as const,
    inputJson: { path: "README.md" },
    outputJson: { content: "scoped" },
    previewOnly: false,
    permissionRequired: false,
    createdAt: "2026-07-15T00:00:00.000Z"
  };
}
