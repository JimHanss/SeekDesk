#!/usr/bin/env node
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const apiPort = Number(process.env.SEEKDESK_API_PORT || 4000);
const webPort = Number(process.env.SEEKDESK_WEB_PORT || 3000);
const apiUrl = process.env.SEEKDESK_API_URL || `http://127.0.0.1:${apiPort}`;
const webUrl = process.env.SEEKDESK_WEB_URL || `http://127.0.0.1:${webPort}`;
const spawned = [];

function log(message) {
  process.stdout.write(`[browser-smoke] ${message}\n`);
}

function fail(message) {
  throw new Error(message);
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs || 8000)
  });
  const body = await response.text();
  if (!response.ok) {
    fail(`${url} returned HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  return { response, body };
}

async function fetchJson(url, options = {}) {
  const { response, body } = await fetchText(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  try {
    return { response, json: JSON.parse(body) };
  } catch (error) {
    fail(`${url} did not return JSON: ${body.slice(0, 240)}`);
  }
}

async function canFetch(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

function spawnDev(name, npmScript, env = {}) {
  log(`starting ${name} with npm run ${npmScript}`);
  const child = spawn("npm", ["run", npmScript], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => {
    if (process.env.SEEKDESK_SMOKE_VERBOSE === "1") {
      process.stdout.write(`[${name}] ${chunk}`);
    }
  });
  child.stderr.on("data", (chunk) => {
    if (process.env.SEEKDESK_SMOKE_VERBOSE === "1") {
      process.stderr.write(`[${name}] ${chunk}`);
    }
  });
  child.on("exit", (code, signal) => {
    if (!child.killed && code !== 0) {
      process.stderr.write(`[browser-smoke] ${name} exited code=${code} signal=${signal}\n`);
    }
  });
  spawned.push(child);
}

async function waitFor(url, label) {
  const deadline = Date.now() + 45_000;
  let lastError = "not attempted";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        log(`${label} ready`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(750);
  }
  fail(`${label} did not become ready at ${url}: ${lastError}`);
}

async function ensureServers() {
  if (!(await canFetch(`${apiUrl}/health`))) {
    spawnDev("api", "dev:api", {
      SEEKDESK_API_PORT: String(apiPort),
      SEEKDESK_WORKSPACE_ROOT: root
    });
  }
  await waitFor(`${apiUrl}/health`, "api");

  if (!(await canFetch(webUrl))) {
    spawnDev("web", "dev:web", {
      SEEKDESK_WEB_PORT: String(webPort),
      NEXT_PUBLIC_SEEKDESK_API_BASE_URL: apiUrl
    });
  }
  await waitFor(webUrl, "web");
}

function assertNoEmailConnectorText(label, value) {
  const forbidden = /(gmail|outlook|google oauth|microsoft oauth|connectors\/google|connectors\/microsoft)/i;
  if (forbidden.test(value)) {
    fail(`${label} still contains removed email connector text.`);
  }
}

async function main() {
  await ensureServers();

  const { json: health } = await fetchJson(`${apiUrl}/health`);
  if (health.status !== "ok") fail("/health did not return ok.");

  const { body: pageHtml } = await fetchText(webUrl);
  if (!pageHtml.includes("SeekDesk")) fail("web page did not render SeekDesk shell.");
  assertNoEmailConnectorText("web html", pageHtml);

  const { json: workspace } = await fetchJson(`${apiUrl}/api/coding/workspace`);
  if (workspace.mode && workspace.mode !== "coding_agent") fail("workspace endpoint returned wrong mode.");
  if (workspace.service !== "seekdesk-coding-runtime") fail("workspace runtime service mismatch.");
  if (!workspace.supportedCapabilities?.includes("coding.read_file")) {
    fail("workspace runtime did not expose coding.read_file.");
  }

  const { json: tree } = await fetchJson(`${apiUrl}/api/coding/files/tree`, {
    method: "POST",
    body: JSON.stringify({ path: ".", maxDepth: 1 })
  });
  if (!Array.isArray(tree.entries) || !tree.entries.length) {
    fail("file tree did not return entries.");
  }

  const { json: packageFile } = await fetchJson(`${apiUrl}/api/coding/files/read`, {
    method: "POST",
    body: JSON.stringify({ path: "package.json", maxBytes: 12000 })
  });
  if (!packageFile.content?.includes('"seekdesk"')) {
    fail("read_file did not return package.json content.");
  }

  const { json: search } = await fetchJson(`${apiUrl}/api/coding/search`, {
    method: "POST",
    body: JSON.stringify({ query: "coding_agent", path: ".", maxResults: 20 })
  });
  if (!Array.isArray(search.matches)) {
    fail("grep did not return a matches array.");
  }

  const sessionId = `browser-smoke-coding-${Date.now()}`;
  const chat = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "coding_agent",
      sessionId,
      prompt: "Inspect package.json and explain which npm scripts are available.",
      context: { workspaceId: "workspace-seekdesk" }
    }),
    signal: AbortSignal.timeout(45_000)
  });
  const chatBody = await chat.text();
  if (!chat.ok) fail(`/api/chat returned HTTP ${chat.status}: ${chatBody.slice(0, 240)}`);
  if (chat.headers.get("x-seekdesk-chat-mode") !== "coding_agent") {
    fail("/api/chat did not use coding_agent mode.");
  }
  assertNoEmailConnectorText("chat response", chatBody);

  const { json: trace } = await fetchJson(`${apiUrl}/api/chat/sessions/${sessionId}/trace`);
  if (trace.mode !== "coding_agent" || trace.sessionId !== sessionId) {
    fail("chat trace did not return the coding session.");
  }
  if (!trace.permissionBoundary?.statement?.includes("workspace root")) {
    fail("chat trace did not expose workspace permission boundary.");
  }

  const { json: grants } = await fetchJson(`${apiUrl}/api/coding/permission-grants?sessionId=${encodeURIComponent(sessionId)}&activeOnly=true`);
  if (grants.mode !== "coding_agent" || !Array.isArray(grants.grants)) {
    fail("permission grants endpoint did not return coding grants shape.");
  }

  log("coding-agent smoke passed");
}

main()
  .catch((error) => {
    process.stderr.write(`[browser-smoke] failed: ${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const child of spawned.reverse()) {
      child.kill("SIGTERM");
    }
  });
