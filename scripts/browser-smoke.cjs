#!/usr/bin/env node
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const apiPort = Number(process.env.SEEKDESK_API_PORT || 4000);
let webPort = Number(process.env.SEEKDESK_WEB_PORT || 3000);
const apiUrl = process.env.SEEKDESK_API_URL || `http://127.0.0.1:${apiPort}`;
let webUrl = process.env.SEEKDESK_WEB_URL || `http://127.0.0.1:${webPort}`;
const spawned = [];
const useLiveProvider = process.env.SEEKDESK_BROWSER_SMOKE_PROVIDER === "live";
const useCloudRuntime = process.env.SEEKDESK_BROWSER_SMOKE_CLOUD === "1";
let cloudPort = Number(process.env.SEEKDESK_CLOUD_RUNTIME_PORT || 4100);
let cloudUrl = process.env.SEEKDESK_CLOUD_RUNTIME_URL || `http://127.0.0.1:${cloudPort}`;
const cloudServiceToken = process.env.SEEKDESK_CLOUD_RUNTIME_SERVICE_TOKEN || "seekdesk-browser-smoke-service-token";
const cloudStorageRoot = process.env.SEEKDESK_CLOUD_STORAGE_ROOT || path.join(
  os.homedir(),
  `.seekdesk-browser-cloud-${process.pid}`
);
let activeCloudWorkspaceId = null;

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

async function fetchSeekDeskWebBody(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    const body = await response.text();
    if (response.ok && body.includes("SeekDesk")) {
      return body;
    }
  } catch {
    return null;
  }
  return null;
}

async function isSeekDeskWeb(url) {
  return (await fetchSeekDeskWebBody(url)) !== null;
}

async function isSeekDeskWebForApi(url, expectedApiUrl) {
  const body = await fetchSeekDeskWebBody(url);
  if (!body) return false;
  return body.includes(expectedApiUrl);
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    // Next binds on the unspecified host by default, so probe the same address family.
    // An IPv6 wildcard listener can coexist with an IPv4 loopback probe but still make
    // Next fail with EADDRINUSE.
    server.listen({ port });
  });
}

async function isWebPortUnused(port) {
  if (!(await isPortAvailable(port))) {
    return false;
  }

  return !(await canFetch(`http://127.0.0.1:${port}`));
}

async function findAvailablePort(startPort) {
  for (let candidate = startPort; candidate < startPort + 100; candidate += 1) {
    if (await isWebPortUnused(candidate)) {
      return candidate;
    }
  }
  fail(`could not find an available web port starting at ${startPort}.`);
}

async function prepareDefaultWebUrl() {
  if (process.env.SEEKDESK_WEB_URL || process.env.SEEKDESK_WEB_PORT) {
    return;
  }

  const availablePort = await findAvailablePort(webPort);
  if (availablePort !== webPort) {
    log(`web port ${webPort} is busy; using ${availablePort}`);
    webPort = availablePort;
    webUrl = `http://127.0.0.1:${webPort}`;
    return;
  }

  if ((await canFetch(webUrl)) && !(await isSeekDeskWeb(webUrl))) {
    const nextPort = await findAvailablePort(webPort + 1);
    log(`${webUrl} is not a SeekDesk web app; using ${nextPort}`);
    webPort = nextPort;
    webUrl = `http://127.0.0.1:${webPort}`;
  }
}

async function resolveExistingNextDevUrl() {
  const lockPath = path.join(root, "apps", "web", ".next", "dev", "lock");
  try {
    const lock = JSON.parse(await fs.promises.readFile(lockPath, "utf8"));
    const candidates = [
      typeof lock.appUrl === "string" ? lock.appUrl : null,
      typeof lock.port === "number" ? "http://127.0.0.1:" + lock.port : null,
      typeof lock.port === "number" ? "http://localhost:" + lock.port : null
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (await isSeekDeskWebForApi(candidate, apiUrl)) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function spawnDev(name, npmScript, env = {}, args = []) {
  log(`starting ${name} with npm run ${npmScript}`);
  const child = spawn("npm", ["run", npmScript, ...args], {
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

function spawnWebDev(env = {}) {
  log(`starting web with next dev --port ${webPort}`);
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npxCommand, ["next", "dev", "--port", String(webPort)], {
    cwd: path.join(root, "apps", "web"),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => {
    if (process.env.SEEKDESK_SMOKE_VERBOSE === "1") {
      process.stdout.write(`[web] ${chunk}`);
    }
  });
  child.stderr.on("data", (chunk) => {
    if (process.env.SEEKDESK_SMOKE_VERBOSE === "1") {
      process.stderr.write(`[web] ${chunk}`);
    }
  });
  child.on("exit", (code, signal) => {
    if (!child.killed && code !== 0) {
      process.stderr.write(`[browser-smoke] web exited code=${code} signal=${signal}\n`);
    }
  });
  spawned.push(child);
}

function spawnLocalDaemon() {
  log("starting local daemon for browser smoke");
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(
    npmCommand,
    [
      "--workspace",
      "@seekdesk/daemon",
      "run",
      "dev",
      "--",
      "start",
      "--api",
      apiUrl,
      "--token",
      process.env.SEEKDESK_DAEMON_PAIRING_TOKEN || "seekdesk-local-dev",
      "--workspace",
      root
    ],
    {
      cwd: root,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  child.stdout.on("data", (chunk) => {
    if (process.env.SEEKDESK_SMOKE_VERBOSE === "1") {
      process.stdout.write(`[daemon] ${chunk}`);
    }
  });
  child.stderr.on("data", (chunk) => {
    if (process.env.SEEKDESK_SMOKE_VERBOSE === "1") {
      process.stderr.write(`[daemon] ${chunk}`);
    }
  });
  spawned.push(child);
}

async function ensureLocalDaemonWorkspace() {
  let workspaceList = await fetchJson(`${apiUrl}/api/coding/workspaces`);
  let workspace = workspaceList.json.workspaces?.find(
    (item) =>
      item.runtimeMode === "local_daemon" &&
      item.connected &&
      item.status === "ready"
  );
  if (workspace) {
    return workspace;
  }

  spawnLocalDaemon();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await delay(500);
    workspaceList = await fetchJson(`${apiUrl}/api/coding/workspaces`);
    workspace = workspaceList.json.workspaces?.find(
      (item) =>
        item.runtimeMode === "local_daemon" &&
        item.connected &&
        item.status === "ready"
    );
    if (workspace) {
      return workspace;
    }
  }
  fail("local daemon did not register a ready workspace for browser smoke.");
}

async function canFetchCloudHealth() {
  try {
    const response = await fetch(`${cloudUrl}/internal/health`, {
      headers: { authorization: `Bearer ${cloudServiceToken}` },
      signal: AbortSignal.timeout(1500)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureCloudRuntimeServer() {
  if (!useCloudRuntime || await canFetchCloudHealth()) return;
  if (!(await isPortAvailable(cloudPort))) {
    cloudPort = await findAvailablePort(cloudPort + 1);
    cloudUrl = `http://127.0.0.1:${cloudPort}`;
  }
  spawnDev("cloud-runtime", "dev:cloud-runtime", {
    SEEKDESK_CLOUD_RUNTIME_HOST: "127.0.0.1",
    SEEKDESK_CLOUD_RUNTIME_PORT: String(cloudPort),
    SEEKDESK_CLOUD_RUNTIME_SERVICE_TOKEN: cloudServiceToken,
    SEEKDESK_RUNTIME_IMAGE: process.env.SEEKDESK_RUNTIME_IMAGE || "seekdesk-runtime:node22",
    SEEKDESK_CLOUD_STORAGE_ROOT: cloudStorageRoot,
    SEEKDESK_CLOUD_RUNTIME_UID: String(process.getuid?.() ?? 10001),
    SEEKDESK_CLOUD_RUNTIME_GID: String(process.getgid?.() ?? 10001)
  });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await canFetchCloudHealth()) {
      log(`cloud runtime ready at ${cloudUrl}`);
      return;
    }
    await delay(750);
  }
  fail(`cloud runtime did not become ready at ${cloudUrl}.`);
}

async function provisionCloudWorkspace() {
  const idempotencyKey = `browser-cloud-provision-${Date.now()}`;
  const { json } = await fetchJson(`${apiUrl}/api/coding/workspaces/cloud`, {
    method: "POST",
    body: JSON.stringify({
      name: "Browser cloud fixture",
      repositoryUrl: process.env.SEEKDESK_CLOUD_SMOKE_REPOSITORY || "https://github.com/octocat/Hello-World.git",
      branch: process.env.SEEKDESK_CLOUD_SMOKE_BRANCH || "master",
      imageProfile: "node22",
      idempotencyKey
    }),
    timeoutMs: 15_000
  });
  activeCloudWorkspaceId = json.workspace?.workspaceId;
  if (!activeCloudWorkspaceId) fail("cloud workspace creation did not return a workspaceId.");
  const workspace = await waitForCloudWorkspace(activeCloudWorkspaceId, ["ready"], 180_000);
  log(`using cloud workspace ${workspace.workspaceId}`);
  return workspace;
}

async function waitForCloudWorkspace(workspaceId, expectedStatuses, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "unknown";
  while (Date.now() < deadline) {
    const { json } = await fetchJson(
      `${apiUrl}/api/coding/workspaces/${encodeURIComponent(workspaceId)}`,
      { timeoutMs: 10_000 }
    );
    lastStatus = json.status || "unknown";
    if (expectedStatuses.includes(lastStatus)) return json;
    if (lastStatus === "error") {
      fail(`cloud workspace failed: ${json.error?.code || json.errorCode || "unknown"} ${json.error?.message || json.errorMessage || ""}`);
    }
    await delay(750);
  }
  fail(`cloud workspace ${workspaceId} did not reach ${expectedStatuses.join("/")}; last status ${lastStatus}.`);
}

async function verifyCloudWorkspace(cloudWorkspace, localWorkspace) {
  const list = await fetchJson(`${apiUrl}/api/coding/workspaces`);
  const online = list.json.workspaces || [];
  if (!online.some((workspace) => workspace.workspaceId === localWorkspace.workspaceId && workspace.connected)) {
    fail("local daemon workspace disappeared while cloud runtime was online.");
  }
  if (!online.some((workspace) => workspace.workspaceId === cloudWorkspace.workspaceId && workspace.connected)) {
    fail("cloud workspace was not listed as online.");
  }

  const { json: read } = await fetchJson(`${apiUrl}/api/coding/files/read`, {
    method: "POST",
    body: JSON.stringify({
      workspaceId: cloudWorkspace.workspaceId,
      runtimeMode: "cloud_runtime",
      path: "README",
      maxBytes: 20_000
    }),
    timeoutMs: 30_000
  });
  if (typeof read.content !== "string" || !read.content.trim()) {
    fail("cloud workspace read_file did not return cloned repository content.");
  }
  const { json: gitStatus } = await fetchJson(
    `${apiUrl}/api/coding/git/status?workspaceId=${encodeURIComponent(cloudWorkspace.workspaceId)}&runtimeMode=cloud_runtime`,
    { timeoutMs: 30_000 }
  );
  if (typeof gitStatus.stdout !== "string") fail("cloud workspace git status failed.");

  const sessionId = `browser-smoke-cloud-${Date.now()}`;
  const chat = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "coding_agent",
      sessionId,
      prompt: "Summarize the purpose of this repository.",
      context: { workspaceId: cloudWorkspace.workspaceId, runtimeMode: "cloud_runtime" }
    }),
    signal: AbortSignal.timeout(45_000)
  });
  const body = await chat.text();
  if (!chat.ok) fail(`cloud workspace chat returned HTTP ${chat.status}: ${body.slice(0, 240)}`);
  const trace = await fetchJson(`${apiUrl}/api/chat/sessions/${sessionId}/trace`);
  if (
    trace.json.workspaceId !== cloudWorkspace.workspaceId ||
    trace.json.runtimeMode !== "cloud_runtime"
  ) {
    fail("cloud session trace did not preserve its Runtime binding.");
  }
}

async function cleanupCloudWorkspace() {
  if (!activeCloudWorkspaceId) return;
  const workspaceId = activeCloudWorkspaceId;
  try {
    await fetchJson(`${apiUrl}/api/coding/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
      body: JSON.stringify({ idempotencyKey: `browser-cloud-delete-${Date.now()}` }),
      timeoutMs: 15_000
    });
    await waitForCloudWorkspace(workspaceId, ["deleted"], 60_000);
    activeCloudWorkspaceId = null;
    log(`deleted cloud workspace ${workspaceId}`);
  } catch (error) {
    process.stderr.write(`[browser-smoke] cloud cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }
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
  await prepareDefaultWebUrl();
  await ensureCloudRuntimeServer();

  if (!(await canFetch(`${apiUrl}/health`))) {
    if (!useLiveProvider) {
      log("using deterministic mock provider for browser smoke");
    }
    spawnDev("api", "dev:api", {
      SEEKDESK_API_PORT: String(apiPort),
      SEEKDESK_WORKSPACE_ROOT: root,
      SEEKDESK_ALLOWED_ORIGINS: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        webUrl
      ].join(","),
      ...(useCloudRuntime ? {
        SEEKDESK_CLOUD_RUNTIME_ENABLED: "true",
        SEEKDESK_CLOUD_RUNTIME_URL: cloudUrl,
        SEEKDESK_CLOUD_RUNTIME_SERVICE_TOKEN: cloudServiceToken
      } : {}),
      ...(useLiveProvider ? {} : { DEEPSEEK_API_KEY: "" })
    });
  }
  await waitFor(`${apiUrl}/health`, "api");

  const forceSpawnWeb = process.env.SEEKDESK_FORCE_SPAWN_WEB === "1";
  if (forceSpawnWeb || !(await canFetch(webUrl))) {
    const shouldReuseExistingWeb =
      !process.env.SEEKDESK_WEB_URL &&
      (!process.env.SEEKDESK_WEB_PORT || process.env.SEEKDESK_WEB_PORT === "3000");
    const existingWebUrl = shouldReuseExistingWeb
      ? await resolveExistingNextDevUrl()
      : null;
    if (existingWebUrl) {
      webUrl = existingWebUrl;
      log("using existing web dev server at " + webUrl);
    } else {
      log("existing web dev server is absent or points at a different API; starting an isolated web server");
      spawnWebDev({
        SEEKDESK_WEB_PORT: String(webPort),
        PORT: String(webPort),
        NEXT_PUBLIC_SEEKDESK_API_URL: apiUrl
      });
    }
  }
  await waitFor(webUrl, "web");
}

async function runUiSmoke(workspaceId) {
  if (process.env.SEEKDESK_SKIP_UI_SMOKE === "1") {
    log("skipping real UI smoke because SEEKDESK_SKIP_UI_SMOKE=1");
    const holdMs = Number(process.env.SEEKDESK_BROWSER_SMOKE_HOLD_MS || 0);
    if (Number.isFinite(holdMs) && holdMs > 0) {
      log(`holding smoke services for ${holdMs}ms`);
      await delay(holdMs);
    }
    return;
  }

  log("starting real browser UI smoke");
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/browser-ui-smoke.cjs"],
      {
        cwd: root,
        env: {
          ...process.env,
          SEEKDESK_API_URL: apiUrl,
          SEEKDESK_WEB_URL: webUrl,
          SEEKDESK_SMOKE_WORKSPACE_ID: workspaceId
        },
        stdio: "inherit"
      }
    );
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`UI smoke exited code=${code} signal=${signal}`));
    });
  });
}

function assertNoEmailConnectorText(label, value) {
  const forbiddenTerms = [
    ["g", "mail"].join(""),
    ["out", "look"].join(""),
    ["google", "oauth"].join(" "),
    ["microsoft", "oauth"].join(" "),
    ["connectors", "google"].join("/"),
    ["connectors", "microsoft"].join("/")
  ];
  const normalized = value.toLowerCase();
  if (forbiddenTerms.some((term) => normalized.includes(term))) {
    fail(`${label} still contains removed email connector text.`);
  }
}

async function main() {
  await ensureServers();
  try {

  const { json: health } = await fetchJson(`${apiUrl}/health`);
  if (health.status !== "ok") fail("/health did not return ok.");

  const { body: pageHtml } = await fetchText(webUrl);
  if (!pageHtml.includes("SeekDesk")) fail("web page did not render SeekDesk shell.");
  assertNoEmailConnectorText("web html", pageHtml);
  for (const expectedLabel of ["AI 编程", "文件", "搜索", "Diff", "终端", "运行详情"]) {
    if (!pageHtml.includes(expectedLabel)) {
      fail(`web page did not render coding workbench label: ${expectedLabel}`);
    }
  }
  if (/\?\?\?\?|\?\? token/.test(pageHtml)) {
    fail("web page still contains placeholder question marks.");
  }
  if (pageHtml.includes("当前分支没有开放文件") || pageHtml.includes("daily_work templates")) {
    fail("web page still contains legacy daily-work/coding-disabled copy.");
  }
  const { body: templateHtml } = await fetchText(`${webUrl.replace(/\/$/, "")}/templates`);
  assertNoEmailConnectorText("template html", templateHtml);
  if (templateHtml.includes("daily_work templates") || templateHtml.includes("daily work mode")) {
    fail("template manager still contains legacy daily_work visible copy.");
  }
  if (!templateHtml.includes("Agent Template Manager")) {
    fail("template manager did not render.");
  }

  const smokeWorkspace = await ensureLocalDaemonWorkspace();
  const smokeWorkspaceId = smokeWorkspace.workspaceId;
  log(`using workspace ${smokeWorkspaceId} (${smokeWorkspace.runtimeMode})`);
  const cloudWorkspace = useCloudRuntime
    ? await provisionCloudWorkspace()
    : null;
  if (cloudWorkspace) {
    await verifyCloudWorkspace(cloudWorkspace, smokeWorkspace);
  }

  const workspaceQuery = `workspaceId=${encodeURIComponent(smokeWorkspaceId)}&runtimeMode=${encodeURIComponent(smokeWorkspace.runtimeMode)}`;
  const { json: workspace } = await fetchJson(`${apiUrl}/api/coding/workspace?${workspaceQuery}`);
  if (workspace.mode && workspace.mode !== "coding_agent") fail("workspace endpoint returned wrong mode.");
  if (!["seekdesk-coding-runtime", "seekdesk-daemon"].includes(workspace.service)) {
    fail("workspace runtime service mismatch.");
  }
  if (!workspace.supportedCapabilities?.includes("coding.read_file")) {
    fail("workspace runtime did not expose coding.read_file.");
  }

  const { json: workspaceBrowse } = await fetchJson(`${apiUrl}/api/coding/workspace/browse`, {
    method: "POST",
    body: JSON.stringify({ workspaceId: smokeWorkspaceId, runtimeMode: smokeWorkspace.runtimeMode, path: workspace.workspaceRoot })
  });
  if (workspaceBrowse.currentPath !== workspace.workspaceRoot || !Array.isArray(workspaceBrowse.entries)) {
    fail("workspace browse endpoint did not return the current root.");
  }

  const { json: workspaceSelect } = await fetchJson(`${apiUrl}/api/coding/workspace/select`, {
    method: "POST",
    body: JSON.stringify({ workspaceId: smokeWorkspaceId, runtimeMode: smokeWorkspace.runtimeMode, path: workspace.workspaceRoot })
  });
  const selectedWorkspaceRoot =
    workspaceSelect.workspace?.workspaceRoot ?? workspaceSelect.workspace?.rootPath;
  if (selectedWorkspaceRoot !== workspace.workspaceRoot) {
    fail("workspace select endpoint did not keep the selected root.");
  }

  const { json: tree } = await fetchJson(`${apiUrl}/api/coding/files/tree`, {
    method: "POST",
    body: JSON.stringify({ workspaceId: smokeWorkspaceId, runtimeMode: smokeWorkspace.runtimeMode, path: ".", maxDepth: 1 })
  });
  if (!Array.isArray(tree.entries) || !tree.entries.length) {
    fail("file tree did not return entries.");
  }

  const { json: packageFile } = await fetchJson(`${apiUrl}/api/coding/files/read`, {
    method: "POST",
    body: JSON.stringify({ workspaceId: smokeWorkspaceId, runtimeMode: smokeWorkspace.runtimeMode, path: "package.json", maxBytes: 12000 })
  });
  if (!packageFile.content?.includes('"seekdesk"')) {
    fail("read_file did not return package.json content.");
  }

  const { json: search } = await fetchJson(`${apiUrl}/api/coding/search`, {
    method: "POST",
    body: JSON.stringify({ workspaceId: smokeWorkspaceId, runtimeMode: smokeWorkspace.runtimeMode, query: "coding_agent", path: ".", maxResults: 20 })
  });
  if (!Array.isArray(search.matches)) {
    fail("grep did not return a matches array.");
  }

  const { json: gitStatus } = await fetchJson(`${apiUrl}/api/coding/git/status?${workspaceQuery}`);
  if (typeof gitStatus.stdout !== "string" || !gitStatus.command?.includes("git status")) {
    fail("git status endpoint did not return command output.");
  }

  const { json: gitDiff } = await fetchJson(`${apiUrl}/api/coding/git/diff`, {
    method: "POST",
    body: JSON.stringify({ workspaceId: smokeWorkspaceId, runtimeMode: smokeWorkspace.runtimeMode, staged: false })
  });
  if (typeof gitDiff.stdout !== "string" || !gitDiff.command?.includes("git diff")) {
    fail("git diff endpoint did not return command output.");
  }

  const sessionId = `browser-smoke-coding-${Date.now()}`;
  const chat = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "coding_agent",
      sessionId,
      prompt: "Inspect package.json and explain which npm scripts are available.",
      context: { workspaceId: smokeWorkspaceId, runtimeMode: smokeWorkspace.runtimeMode }
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
  if (trace.workspaceId !== smokeWorkspaceId || trace.runtimeMode !== smokeWorkspace.runtimeMode) {
    fail("chat trace did not preserve the workspace and Runtime binding.");
  }

  const { json: grants } = await fetchJson(`${apiUrl}/api/coding/permission-grants?sessionId=${encodeURIComponent(sessionId)}&activeOnly=true`);
  if (grants.mode !== "coding_agent" || !Array.isArray(grants.grants)) {
    fail("permission grants endpoint did not return coding grants shape.");
  }

  const approvalSessionId = `browser-smoke-approval-${Date.now()}`;
  const approvalChat = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "coding_agent",
      sessionId: approvalSessionId,
      prompt: "Use coding.run_shell.\nshell command: node -p 21+21",
      context: { workspaceId: smokeWorkspaceId, runtimeMode: smokeWorkspace.runtimeMode }
    }),
    signal: AbortSignal.timeout(45_000)
  });
  const approvalBody = await approvalChat.text();
  if (!approvalChat.ok) {
    fail(`/api/chat approval returned HTTP ${approvalChat.status}: ${approvalBody.slice(0, 240)}`);
  }
  const { json: approvalTrace } = await fetchJson(
    `${apiUrl}/api/chat/sessions/${approvalSessionId}/trace`
  );
  const pendingShellCall = approvalTrace.toolCalls?.find(
    (toolCall) =>
      toolCall.name === "coding.run_shell" &&
      toolCall.status === "permission_required"
  );
  if (!pendingShellCall) {
    fail(
      `approval chat did not record a pending shell tool call: ${approvalBody.slice(0, 240)}`
    );
  }
  await fetchJson(`${apiUrl}/api/coding/permission-grants`, {
    method: "POST",
    body: JSON.stringify({
      mode: "coding_agent",
      provider: smokeWorkspace.runtimeMode,
      sessionId: approvalSessionId,
      workspaceId: smokeWorkspaceId,
      runtimeMode: smokeWorkspace.runtimeMode,
      action: "coding.run_shell",
      reason: "browser smoke safe command"
    })
  });
  const { json: executedShell } = await fetchJson(
    `${apiUrl}/api/coding/tool-calls/${encodeURIComponent(pendingShellCall.id)}/execute`,
    {
      method: "POST",
      body: JSON.stringify({
        sessionId: approvalSessionId,
        workspaceId: smokeWorkspaceId,
        runtimeMode: smokeWorkspace.runtimeMode
      })
    }
  );
  if (
    executedShell.toolCall?.status !== "completed" ||
    executedShell.result?.exitCode !== 0
  ) {
    fail(
      "approved shell tool did not execute successfully: " +
        JSON.stringify(executedShell).slice(0, 400)
    );
  }

  await runUiSmoke(smokeWorkspaceId);

  log("coding-agent smoke passed");
  } finally {
    await cleanupCloudWorkspace();
  }
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
