import type { FastifyInstance } from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";

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
      return sendGoogleOAuthCallbackResponse(request, reply, 400, {
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
      return sendGoogleOAuthCallbackResponse(request, reply, 503, {
        provider: "google",
        connected: false,
        requiresSetup: true,
        error: "google_oauth_not_configured",
        missingConfig: getMissingGoogleOAuthConfig()
      });
    }

    const code = request.query.code?.trim();
    if (!code) {
      return sendGoogleOAuthCallbackResponse(request, reply, 400, {
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

      return sendGoogleOAuthCallbackResponse(request, reply, 200, {
        provider: "google",
        connected: true,
        scopes: account.scopes,
        updatedAt: account.updatedAt,
        ...(account.accountEmail ? { accountEmail: account.accountEmail } : {})
      });
    } catch (error) {
      if (error instanceof GoogleConnectorConfigurationError) {
        return sendGoogleOAuthCallbackResponse(request, reply, 400, {
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

interface GoogleOAuthCallbackPayload {
  provider: "google";
  connected: boolean;
  accountEmail?: string;
  scopes?: string[];
  updatedAt?: string;
  requiresSetup?: boolean;
  error?: string;
  description?: string;
  missingConfig?: string[];
}

function sendGoogleOAuthCallbackResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  payload: GoogleOAuthCallbackPayload
) {
  if (!wantsHtmlResponse(request)) {
    return reply.code(statusCode).send(payload);
  }

  return reply
    .code(statusCode)
    .type("text/html; charset=utf-8")
    .send(renderGoogleOAuthCallbackHtml(payload));
}

function wantsHtmlResponse(request: FastifyRequest) {
  return String(request.headers.accept ?? "")
    .toLowerCase()
    .includes("text/html");
}

function renderGoogleOAuthCallbackHtml(payload: GoogleOAuthCallbackPayload) {
  const title = payload.connected
    ? "Google Connected"
    : payload.requiresSetup
      ? "Google OAuth Setup Required"
      : "Google OAuth Failed";
  const summary = payload.connected
    ? `Connected${payload.accountEmail ? ` as ${payload.accountEmail}` : ""}.`
    : payload.requiresSetup
      ? "Google OAuth is not fully configured yet."
      : payload.description ?? payload.error ?? "Google OAuth could not complete.";
  const detail =
    payload.missingConfig && payload.missingConfig.length > 0
      ? `Missing config: ${payload.missingConfig.join(", ")}`
      : payload.scopes && payload.scopes.length > 0
        ? `${payload.scopes.length} scopes authorized.`
        : "No external write action was performed.";
  const message = {
    type: "seekdesk.google_oauth_callback",
    provider: "google",
    connected: payload.connected
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} - SeekDesk</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f0fdfa;
        color: #0f172a;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      main {
        width: min(520px, 100%);
        border: 1px solid #99f6e4;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 20px 48px rgb(15 23 42 / 12%);
        padding: 24px;
      }
      h1 {
        margin: 0;
        font-size: 20px;
        line-height: 1.25;
        color: #134e4a;
      }
      p {
        margin: 12px 0 0;
        font-size: 14px;
        line-height: 1.6;
      }
      code {
        border-radius: 6px;
        background: #f1f5f9;
        padding: 2px 6px;
      }
      button {
        margin-top: 20px;
        height: 36px;
        border: 0;
        border-radius: 8px;
        background: #0f766e;
        color: white;
        font-weight: 600;
        padding: 0 14px;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(summary)}</p>
      <p>${escapeHtml(detail)}</p>
      <p>Return to SeekDesk and refresh the Google connector status. This callback never sends email or creates calendar events.</p>
      <button type="button" onclick="window.close()">Close this tab</button>
    </main>
    <script>
      if (window.opener) {
        window.opener.postMessage(${JSON.stringify(message)}, "*");
      }
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
