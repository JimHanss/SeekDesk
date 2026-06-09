import type { FastifyInstance } from "fastify";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import { sendEmailOAuthCallbackResponse } from "./email-oauth-callback-response.js";
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
      return sendEmailOAuthCallbackResponse(request, reply, 400, {
        provider: "google",
        connected: false,
        error: request.query.error,
        ...(request.query.error_description
          ? { description: request.query.error_description }
          : {})
      });
    }

    const config = getGoogleOAuthConfigFromEnv();
    if (!config) {
      return sendEmailOAuthCallbackResponse(request, reply, 503, {
        provider: "google",
        connected: false,
        requiresSetup: true,
        error: "google_oauth_not_configured",
        missingConfig: getMissingGoogleOAuthConfig()
      });
    }

    const code = request.query.code?.trim();
    if (!code) {
      return sendEmailOAuthCallbackResponse(request, reply, 400, {
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

      return sendEmailOAuthCallbackResponse(request, reply, 200, {
        provider: "google",
        connected: true,
        scopes: account.scopes,
        updatedAt: account.updatedAt,
        ...(account.accountEmail ? { accountEmail: account.accountEmail } : {})
      });
    } catch (error) {
      if (error instanceof GoogleConnectorConfigurationError) {
        return sendEmailOAuthCallbackResponse(request, reply, 400, {
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
