#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const baseUrl = trimTrailingSlash(args.baseUrl ?? "http://127.0.0.1:4000");
const requireGoogle = args.requireGoogle ?? false;
const gmailQuery = args.gmailQuery ?? "newer_than:30d";
const calendarId = args.calendarId ?? "primary";
const now = new Date();
const timeMin = now.toISOString();
const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

const summary = {
  baseUrl,
  health: null,
  google: null,
  artifact: null,
  googleTools: null
};

try {
  summary.health = await readJson("/health");
  assert(summary.health?.status === "ok", "API health check did not return ok.");
  assert(
    summary.health?.currentLayer === "postgres" &&
      summary.health?.postgresReady === true,
    "Real-agent verification requires a ready Postgres data layer."
  );

  summary.artifact = await verifyArtifactTool();
  summary.google = await readJson("/api/connectors/google/status");

  if (summary.google?.connected) {
    summary.googleTools = await verifyGoogleReadTools();
  } else if (requireGoogle) {
    const missing = Array.isArray(summary.google?.missingConfig)
      ? ` Missing config: ${summary.google.missingConfig.join(", ")}.`
      : "";
    throw new Error(`Google connector is not connected.${missing}`);
  } else {
    summary.googleTools = {
      status: "skipped",
      reason: "google_connector_not_connected",
      missingConfig: summary.google?.missingConfig ?? []
    };
  }

  console.log(JSON.stringify({ status: "passed", ...summary }, null, 2));
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        ...summary
      },
      null,
      2
    )
  );
  process.exit(1);
}

async function verifyArtifactTool() {
  const response = await sendChat({
    prompt:
      "Use the daily.persist_artifact tool to save a short daily work brief titled Real agent verification. Keep it preview-only and mention this verifies DeepSeek, Postgres, tool tracing, and artifact persistence.",
    context: {
      workspaceId: "workspace-seekdesk",
      locale: "zh-CN",
      timezone: "Asia/Shanghai"
    }
  });
  const trace = await readTrace(response.sessionId);
  const toolCalls = trace.toolCalls ?? [];
  const artifactTool = toolCalls.find(
    (tool) =>
      tool.name === "daily.persist_artifact" && tool.status === "completed"
  );

  assert(
    response.provider === "deepseek",
    `Expected DeepSeek provider, received ${response.provider ?? "unknown"}.`
  );
  assert(artifactTool, "DeepSeek did not complete daily.persist_artifact.");
  assert(
    trace.modelUsageSummary?.recordCount > 0 &&
      trace.modelUsageSummary?.provider === "deepseek",
    "Model usage was not recorded for the DeepSeek artifact verification."
  );

  return {
    status: "passed",
    provider: response.provider,
    sessionId: response.sessionId,
    responsePreview: response.text.slice(0, 400),
    toolCalls: summarizeToolCalls(toolCalls),
    usageSummary: trace.modelUsageSummary
  };
}

async function verifyGoogleReadTools() {
  const response = await sendChat({
    prompt:
      `Use the available preview-only tools to search Gmail threads with query "${gmailQuery}" and maxResults 1, then list Google Calendar events from calendar "${calendarId}" between ${timeMin} and ${timeMax} with maxResults 3. Return only a concise summary of what the tools found. Do not send email, create drafts externally, or create calendar events.`,
    context: {
      workspaceId: "workspace-seekdesk",
      connectorIds: ["google"],
      locale: "zh-CN",
      timezone: "Asia/Shanghai"
    }
  });
  const trace = await readTrace(response.sessionId);
  const toolCalls = trace.toolCalls ?? [];
  const gmailTool = toolCalls.find(
    (tool) => tool.name === "gmail.search_threads" && tool.status === "completed"
  );
  const calendarTool = toolCalls.find(
    (tool) => tool.name === "calendar.list_events" && tool.status === "completed"
  );

  assert(gmailTool, "DeepSeek did not complete gmail.search_threads.");
  assert(calendarTool, "DeepSeek did not complete calendar.list_events.");
  assert(
    trace.modelUsageSummary?.recordCount > 0,
    "Model usage was not recorded for the Google read verification."
  );

  return {
    status: "passed",
    provider: response.provider,
    sessionId: response.sessionId,
    responsePreview: response.text.slice(0, 400),
    toolCalls: summarizeToolCalls(toolCalls),
    usageSummary: trace.modelUsageSummary
  };
}

async function sendChat(input) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000"
    },
    body: JSON.stringify({
      mode: "daily_work",
      prompt: input.prompt,
      context: input.context
    })
  });
  const text = await response.text();
  const sessionId = response.headers.get("x-seekdesk-chat-session-id");
  const provider = response.headers.get("x-seekdesk-chat-provider");

  assert(
    response.ok,
    `/api/chat failed with ${response.status}: ${text.slice(0, 500)}`
  );
  assert(sessionId, "/api/chat did not return X-SeekDesk-Chat-Session-Id.");

  return {
    provider,
    sessionId,
    text
  };
}

async function readTrace(sessionId) {
  return readJson(`/api/chat/sessions/${encodeURIComponent(sessionId)}/trace`);
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
  } catch (error) {
    throw new Error(`${path} did not return JSON: ${text.slice(0, 500)}`);
  }
}

function summarizeToolCalls(toolCalls) {
  return toolCalls.map((tool) => ({
    name: tool.name,
    status: tool.status,
    previewOnly: tool.previewOnly,
    permissionRequired: tool.permissionRequired,
    hasInput: tool.inputJson !== undefined,
    hasOutput: tool.outputJson !== undefined,
    error: tool.error ?? null
  }));
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--require-google") {
      parsed.requireGoogle = true;
      continue;
    }

    if (arg === "--base-url") {
      parsed.baseUrl = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--gmail-query") {
      parsed.gmailQuery = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--calendar-id") {
      parsed.calendarId = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
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
  console.log(`Usage: npm run verify:real-agent -- [options]

Options:
  --base-url <url>       API base URL. Default: http://127.0.0.1:4000
  --require-google      Fail if Google is not connected.
  --gmail-query <query> Gmail query for the real read verification.
  --calendar-id <id>    Calendar id for event listing. Default: primary
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
