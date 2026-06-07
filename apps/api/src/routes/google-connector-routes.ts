import type { FastifyInstance } from "fastify";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import {
  exchangeGoogleOAuthCode,
  getGoogleConnectionStatus,
  getGoogleOAuthConfigFromEnv,
  getMissingGoogleOAuthConfig,
  createGoogleAuthUrl,
  GoogleConnectorConfigurationError
} from "../services/google-connector-service.js";

export async function registerGoogleConnectorRoutes(
  app: FastifyInstance,
  repository: DailyWorkRepository
) {
  app.options("/api/connectors/google/oauth/start", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/connectors/google/oauth/callback", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/connectors/google/status", async (_request, reply) =>
    reply.code(204).send()
  );

  app.get<{
    Querystring: {
      workspaceId?: string;
    };
  }>("/api/connectors/google/oauth/start", async (request, reply) => {
    const config = getGoogleOAuthConfigFromEnv();
    if (!config) {
      return reply.code(503).send({
        provider: "google",
        connected: false,
        requiresSetup: true,
        error: "google_oauth_not_configured",
        missingConfig: getMissingGoogleOAuthConfig()
      });
    }

    return {
      provider: "google",
      ...createGoogleAuthUrl({
        config,
        ...(request.query.workspaceId
          ? { workspaceId: request.query.workspaceId }
          : {})
      })
    };
  });

  app.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>("/api/connectors/google/oauth/callback", async (request, reply) => {
    if (request.query.error) {
      return reply.code(400).send({
        provider: "google",
        connected: false,
        error: request.query.error,
        description: request.query.error_description
      });
    }

    const config = getGoogleOAuthConfigFromEnv();
    if (!config) {
      return reply.code(503).send({
        provider: "google",
        connected: false,
        requiresSetup: true,
        error: "google_oauth_not_configured",
        missingConfig: getMissingGoogleOAuthConfig()
      });
    }

    const code = request.query.code?.trim();
    if (!code) {
      return reply.code(400).send({
        provider: "google",
        connected: false,
        error: "missing_oauth_code"
      });
    }

    try {
      const account = await exchangeGoogleOAuthCode({
        code,
        ...(request.query.state ? { state: request.query.state } : {}),
        config,
        repository
      });

      return {
        provider: "google",
        connected: true,
        accountEmail: account.accountEmail,
        scopes: account.scopes,
        updatedAt: account.updatedAt
      };
    } catch (error) {
      if (error instanceof GoogleConnectorConfigurationError) {
        return reply.code(400).send({
          provider: "google",
          connected: false,
          error: error.message
        });
      }

      throw error;
    }
  });

  app.get("/api/connectors/google/status", async () =>
    getGoogleConnectionStatus({
      repository
    })
  );
}
