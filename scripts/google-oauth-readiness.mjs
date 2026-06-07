#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const baseUrl = trimTrailingSlash(args.baseUrl ?? "http://127.0.0.1:4000");

try {
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const health = await readJson("/health");
  assert(health?.status === "ok", "API health check did not return ok.");

  const google = await readJson("/api/connectors/google/status");
  const missingConfig = normalizeStringList(google?.missingConfig);
  const oauthStart =
    google?.connected || missingConfig.length > 0
      ? null
      : await readOAuthStart();

  if (args.requireConfigured && missingConfig.length > 0) {
    throw new Error(
      `Google OAuth is missing required config: ${missingConfig.join(", ")}.`
    );
  }

  if (args.requireConnected && !google?.connected) {
    throw new Error(
      missingConfig.length > 0
        ? `Google connector is not connected and config is incomplete: ${missingConfig.join(", ")}.`
        : "Google connector is configured but not connected. Complete the OAuth browser flow."
    );
  }

  console.log(
    JSON.stringify(
      {
        status: "passed",
        baseUrl,
        api: {
          status: health.status,
          currentLayer: health.currentLayer ?? null,
          postgresReady: health.postgresReady ?? null
        },
        google: {
          provider: google?.provider ?? "google",
          connected: Boolean(google?.connected),
          requiresSetup: Boolean(google?.requiresSetup),
          missingConfig,
          accountEmail: google?.accountEmail ?? null,
          connectedAt: google?.connectedAt ?? null,
          updatedAt: google?.updatedAt ?? null,
          scopes: normalizeStringList(google?.scopes)
        },
        oauthStart: oauthStart
          ? {
              ready: true,
              scopes: normalizeStringList(oauthStart.scopes),
              hasState: typeof oauthStart.state === "string" && oauthStart.state.length > 0,
              authorizationUrl: args.showAuthorizationUrl
                ? oauthStart.authorizationUrl
                : redactAuthorizationUrl(oauthStart.authorizationUrl)
            }
          : {
              ready: false,
              reason: google?.connected
                ? "google_connector_already_connected"
                : "google_oauth_config_incomplete"
            },
        nextStep: getNextStep({
          connected: Boolean(google?.connected),
          missingConfig,
          oauthStartReady: Boolean(oauthStart)
        })
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        baseUrl,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
}

async function readOAuthStart() {
  const payload = await readJson(
    "/api/connectors/google/oauth/start?workspaceId=workspace-seekdesk"
  );

  assert(
    typeof payload?.authorizationUrl === "string" &&
      payload.authorizationUrl.startsWith("https://"),
    "Google OAuth start route did not return an authorization URL."
  );

  return payload;
}

async function readJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "application/json",
      origin: "http://localhost:3000"
    }
  });
  const text = await response.text();

  assert(response.ok, `${path} failed with ${response.status}: ${text}`);

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path} did not return JSON: ${text.slice(0, 500)}`);
  }
}

function getNextStep(input) {
  if (input.connected) {
    return "Run npm run verify:real-agent -- --require-google to verify Gmail and Calendar real read tools.";
  }

  if (input.missingConfig.length > 0) {
    return "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the process environment, run npm run configure:google-oauth, restart the API, then run npm run verify:google-oauth -- --require-configured.";
  }

  if (input.oauthStartReady) {
    return "Open the OAuth authorization URL in the browser, complete Google consent, then run npm run verify:google-oauth -- --require-connected.";
  }

  return "Restart the API and rerun npm run verify:google-oauth.";
}

function redactAuthorizationUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.searchParams.has("client_id")) {
      url.searchParams.set("client_id", "[redacted]");
    }

    if (url.searchParams.has("state")) {
      url.searchParams.set("state", "[redacted]");
    }

    return url.toString();
  } catch {
    return "[invalid-url]";
  }
}

function normalizeStringList(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : [];
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--base-url") {
      parsed.baseUrl = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--require-configured") {
      parsed.requireConfigured = true;
      continue;
    }

    if (arg === "--require-connected") {
      parsed.requireConnected = true;
      continue;
    }

    if (arg === "--show-authorization-url") {
      parsed.showAuthorizationUrl = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function readValue(argv, index, flag) {
  const value = argv[index + 1]?.trim();
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printHelp() {
  console.log(`Usage: npm run verify:google-oauth -- [options]

Checks the running API's Google OAuth readiness without reading or printing
local secret values.

Options:
  --base-url <url>             API base URL. Default: http://127.0.0.1:4000
  --require-configured         Fail when Google OAuth env config is incomplete.
  --require-connected          Fail until a Google account is connected.
  --show-authorization-url     Print the full OAuth URL for browser setup.
                               Without this flag, client_id and state are redacted.
`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
