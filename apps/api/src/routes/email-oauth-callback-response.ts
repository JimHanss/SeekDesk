import type { FastifyReply, FastifyRequest } from "fastify";

import type { EmailConnectorProvider } from "../services/email-connector-service.js";

export interface EmailOAuthCallbackPayload {
  provider: EmailConnectorProvider;
  connected: boolean;
  accountEmail?: string;
  scopes?: string[];
  updatedAt?: string;
  requiresSetup?: boolean;
  error?: string;
  description?: string;
  missingConfig?: string[];
}

export function sendEmailOAuthCallbackResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  payload: EmailOAuthCallbackPayload
) {
  if (!wantsHtmlResponse(request)) {
    return reply.code(statusCode).send(payload);
  }

  return reply
    .code(statusCode)
    .type("text/html; charset=utf-8")
    .send(renderEmailOAuthCallbackHtml(payload));
}

function wantsHtmlResponse(request: FastifyRequest) {
  return String(request.headers.accept ?? "")
    .toLowerCase()
    .includes("text/html");
}

function renderEmailOAuthCallbackHtml(payload: EmailOAuthCallbackPayload) {
  const providerLabel = payload.provider === "google" ? "Google" : "Microsoft";
  const title = payload.connected
    ? `${providerLabel} Email Authorized`
    : payload.requiresSetup
      ? `${providerLabel} Email Authorization Setup Required`
      : `${providerLabel} Email Authorization Failed`;
  const summary = payload.connected
    ? `Authorized${payload.accountEmail ? ` as ${payload.accountEmail}` : ""}.`
    : payload.requiresSetup
      ? `${providerLabel} email authorization is not fully configured yet.`
      : payload.description ??
        payload.error ??
        `${providerLabel} email authorization could not complete.`;
  const detail =
    payload.missingConfig && payload.missingConfig.length > 0
      ? `Missing config: ${payload.missingConfig.join(", ")}`
      : payload.scopes && payload.scopes.length > 0
        ? `${payload.scopes.length} scopes authorized.`
        : "No external write action was performed.";
  const message = {
    type: `seekdesk.${payload.provider}_oauth_callback`,
    provider: payload.provider,
    connected: payload.connected,
    ...(payload.accountEmail ? { accountEmail: payload.accountEmail } : {}),
    ...(payload.scopes ? { scopes: payload.scopes } : {}),
    ...(payload.updatedAt ? { updatedAt: payload.updatedAt } : {}),
    ...(payload.error ? { error: payload.error } : {}),
    ...(payload.requiresSetup ? { requiresSetup: payload.requiresSetup } : {})
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
      <p>Return to SeekDesk. The main window will refresh the email connector status automatically. This callback never sends email or creates calendar events.</p>
      <button type="button" onclick="window.close()">Close this tab</button>
    </main>
    <script>
      if (window.opener) {
        window.opener.postMessage(${JSON.stringify(message)}, "*");
      }
      ${payload.connected ? "window.setTimeout(() => window.close(), 900);" : ""}
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
