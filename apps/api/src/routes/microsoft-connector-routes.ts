import type { FastifyInstance } from "fastify";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import {
  MicrosoftConnectorConfigurationError,
  createMicrosoftAuthUrl,
  exchangeMicrosoftOAuthCode,
  getMicrosoftConnectionStatus,
  getMicrosoftOAuthConfigFromEnv,
  getMissingMicrosoftOAuthConfig
} from "../services/microsoft-connector-service.js";
import { sendEmailOAuthCallbackResponse } from "./email-oauth-callback-response.js";

export async function registerMicrosoftConnectorRoutes(
  app: FastifyInstance,
  repository: DailyWorkRepository
) {
  app.options("/api/connectors/microsoft/oauth/start", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/connectors/microsoft/oauth/callback", async (_request, reply) =>
    reply.code(204).send()
  );
  app.options("/api/connectors/microsoft/status", async (_request, reply) =>
    reply.code(204).send()
  );

  app.get<{
    Querystring: {
      workspaceId?: string;
    };
  }>("/api/connectors/microsoft/oauth/start", async (request, reply) => {
    const config = getMicrosoftOAuthConfigFromEnv();
    if (!config) {
      return reply.code(503).send({
        provider: "microsoft",
        connected: false,
        requiresSetup: true,
        error: "microsoft_oauth_not_configured",
        missingConfig: getMissingMicrosoftOAuthConfig()
      });
    }

    return {
      provider: "microsoft",
      ...createMicrosoftAuthUrl({
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
  }>("/api/connectors/microsoft/oauth/callback", async (request, reply) => {
    if (request.query.error) {
      return sendEmailOAuthCallbackResponse(request, reply, 400, {
        provider: "microsoft",
        connected: false,
        error: request.query.error,
        ...(request.query.error_description
          ? { description: request.query.error_description }
          : {})
      });
    }

    const config = getMicrosoftOAuthConfigFromEnv();
    if (!config) {
      return sendEmailOAuthCallbackResponse(request, reply, 503, {
        provider: "microsoft",
        connected: false,
        requiresSetup: true,
        error: "microsoft_oauth_not_configured",
        missingConfig: getMissingMicrosoftOAuthConfig()
      });
    }

    const code = request.query.code?.trim();
    if (!code) {
      return sendEmailOAuthCallbackResponse(request, reply, 400, {
        provider: "microsoft",
        connected: false,
        error: "missing_oauth_code"
      });
    }

    try {
      const account = await exchangeMicrosoftOAuthCode({
        code,
        ...(request.query.state ? { state: request.query.state } : {}),
        config,
        repository
      });

      return sendEmailOAuthCallbackResponse(request, reply, 200, {
        provider: "microsoft",
        connected: true,
        scopes: account.scopes,
        updatedAt: account.updatedAt,
        ...(account.accountEmail ? { accountEmail: account.accountEmail } : {})
      });
    } catch (error) {
      if (error instanceof MicrosoftConnectorConfigurationError) {
        return sendEmailOAuthCallbackResponse(request, reply, 400, {
          provider: "microsoft",
          connected: false,
          error: error.message
        });
      }

      throw error;
    }
  });

  app.get("/api/connectors/microsoft/status", async () =>
    getMicrosoftConnectionStatus({
      repository
    })
  );
}
