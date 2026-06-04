#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const webDir = path.join(rootDir, "apps", "web");
const apiDir = path.join(rootDir, "apps", "api");
const defaultHost = "127.0.0.1";
const defaultPort = Number(process.env.SEEKDESK_SMOKE_PORT || 3000);
const defaultUrl = `http://${defaultHost}:${defaultPort}`;
const smokeUrl = process.env.SEEKDESK_SMOKE_URL || defaultUrl;
const smokeApiUrl = process.env.SEEKDESK_SMOKE_API_URL || "";
const timeoutMs = Number(process.env.SEEKDESK_SMOKE_TIMEOUT_MS || 30000);
const checks = [];

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

main().catch(async (error) => {
  const payload = {
    status: "failed",
    url: smokeUrl,
    error: error && error.stack ? error.stack : String(error),
    checks
  };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
});

async function main() {
  const apiServer = await ensureApiServer();
  const server = await ensureWebServer();
  const browser = await launchBrowser();
  let client;

  try {
    client = await openPage(browser.debugPort, smokePageUrl(apiServer.url));
    await runDailyEndpointsSmoke(apiServer.url);
    await runActivityStreamSmoke(client, apiServer.url);
    await runModelUsageSmoke(client, apiServer.url);
    await runDataLayerStateSmoke(client);
    await runPromptSmoke(client);
    await runChatSendSmoke(client);
    await runCodeBlockSmoke(client);

    const payload = {
      status: "passed",
      url: smokeUrl,
      browser: browser.executable,
      checks
    };
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    if (client) {
      client.close();
    }
    await browser.close();
    await server.close();
    await apiServer.close();
  }
}

function printHelp() {
  console.log(`SeekDesk browser smoke

Usage:
  npm run test:browser-smoke
  SEEKDESK_SMOKE_URL=http://127.0.0.1:3000 npm run test:browser-smoke

Environment:
  SEEKDESK_SMOKE_URL          Reuse an already-running web service.
  SEEKDESK_SMOKE_API_URL      Reuse an already-running API service.
  SEEKDESK_SMOKE_PORT         Port used when starting Next locally. Default: 3000.
  SEEKDESK_SMOKE_TIMEOUT_MS   Per-step timeout. Default: 30000.
  BROWSER_PATH                Chrome or Edge executable override.

The smoke starts or connects to a production web page, launches Chrome/Edge with
Chrome DevTools Protocol, clicks prompt controls with real mouse events, and
asserts that the activity stream binds to the API/WebSocket snapshot, verifies
that chat submit renders the API response, then checks code block highlighting
DOM for stable language and token markup.`);
}

async function ensureApiServer() {
  if (smokeApiUrl) {
    await waitForHttp(new URL("/health", smokeApiUrl).toString(), timeoutMs);
    checks.push({
      name: "api service",
      status: "reused",
      detail: smokeApiUrl
    });
    return noopServer("external api", smokeApiUrl);
  }

  const serverEntry = path.join(apiDir, "dist", "server.js");
  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Missing ${serverEntry}. Run npm run build before the browser smoke, or set SEEKDESK_SMOKE_API_URL to an already-running API service.`
    );
  }

  const apiPort = await findFreePort();
  const apiUrl = `http://${defaultHost}:${apiPort}`;
  const child = spawn(process.execPath, [serverEntry], {
    cwd: apiDir,
    env: {
      ...process.env,
      SEEKDESK_API_HOST: defaultHost,
      SEEKDESK_API_PORT: String(apiPort)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      output += `\napi server exited with code ${code}`;
    }
    if (signal) {
      output += `\napi server exited via signal ${signal}`;
    }
  });

  try {
    await waitForHttp(new URL("/health", apiUrl).toString(), timeoutMs, () => {
      if (child.exitCode !== null) {
        throw new Error(`api server exited early.\n${output.trim()}`);
      }
    });
  } catch (error) {
    killTree(child.pid);
    throw error;
  }

  checks.push({
    name: "api service",
    status: "started",
    detail: apiUrl
  });

  return {
    label: "api start",
    url: apiUrl,
    async close() {
      killTree(child.pid);
    }
  };
}

function smokePageUrl(apiUrl) {
  if (!apiUrl) {
    return smokeUrl;
  }

  const url = new URL(smokeUrl);
  url.searchParams.set("seekdeskSmokeApiUrl", apiUrl);
  return url.toString();
}

async function ensureWebServer() {
  if (process.env.SEEKDESK_SMOKE_URL) {
    await waitForHttp(smokeUrl, timeoutMs);
    return noopServer("external");
  }

  const existing = await isReachable(smokeUrl);
  if (existing) {
    checks.push({
      name: "web service",
      status: "reused",
      detail: smokeUrl
    });
    return noopServer("existing");
  }

  const nextBuildDir = path.join(webDir, ".next");
  if (!fs.existsSync(nextBuildDir)) {
    throw new Error(
      `Missing ${nextBuildDir}. Run npm run build before the browser smoke, or set SEEKDESK_SMOKE_URL to an already-running production web service.`
    );
  }

  const nextCli = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
  if (!fs.existsSync(nextCli)) {
    throw new Error(
      `Missing ${nextCli}. Run npm install before the browser smoke, or set SEEKDESK_SMOKE_URL to an already-running production web service.`
    );
  }

  const child = spawn(
    process.execPath,
    [
      nextCli,
      "start",
      "--port",
      String(defaultPort),
      "--hostname",
      defaultHost
    ],
    {
      cwd: webDir,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      output += `\nnext start exited with code ${code}`;
    }
    if (signal) {
      output += `\nnext start exited via signal ${signal}`;
    }
  });

  try {
    await waitForHttp(smokeUrl, timeoutMs, () => {
      if (child.exitCode !== null) {
        throw new Error(`next start exited early.\n${output.trim()}`);
      }
    });
  } catch (error) {
    killTree(child.pid);
    throw error;
  }

  checks.push({
    name: "web service",
    status: "started",
    detail: smokeUrl
  });

  return {
    label: "next start",
    async close() {
      killTree(child.pid);
    }
  };
}

function noopServer(label, url = "") {
  return {
    label,
    url,
    async close() {}
  };
}

async function launchBrowser() {
  const executable = findBrowserExecutable();
  const debugPort = await findFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "seekdesk-smoke-"));
  const child = spawn(
    executable,
    [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-features=Translate",
      "--disable-sync",
      "--hide-scrollbars",
      "--no-first-run",
      "--window-size=1440,1000",
      "about:blank"
    ],
    {
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`, timeoutMs, () => {
      if (child.exitCode !== null) {
        throw new Error(`Browser exited early.\n${output.trim()}`);
      }
    });
  } catch (error) {
    killTree(child.pid);
    removeDir(userDataDir);
    throw error;
  }

  return {
    executable,
    debugPort,
    async close() {
      killTree(child.pid);
      removeDir(userDataDir);
    }
  };
}

function findBrowserExecutable() {
  const override = process.env.BROWSER_PATH;
  if (override) {
    if (!fs.existsSync(override)) {
      throw new Error(`BROWSER_PATH does not exist: ${override}`);
    }
    return override;
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe")
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium"
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
            "/usr/bin/microsoft-edge-stable"
          ];

  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error(
      "Could not find Chrome or Edge. Set BROWSER_PATH to a Chrome/Edge executable."
    );
  }
  return executable;
}

async function openPage(debugPort, url) {
  const target = await createTarget(debugPort, "about:blank");
  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Page.navigate", { url });
  await waitForRuntime(client, "document.readyState === 'complete'", "page load");
  await waitForRuntime(
    client,
    "Boolean(document.querySelector('form input, form textarea'))",
    "chat input"
  );
  checks.push({
    name: "page rendered",
    status: "passed"
  });
  return client;
}

async function createTarget(debugPort, url) {
  const endpoint = `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`;
  const response = await fetch(endpoint, { method: "PUT" });
  if (!response.ok) {
    throw new Error(`Could not create browser target: ${response.status}`);
  }
  return response.json();
}

async function runPromptSmoke(client) {
  const templateRect = await waitForRect(client, templateButtonExpression(), "template button");
  await clickAt(client, templateRect);

  const templateState = await waitForValue(
    client,
    `(() => {
      const input = getSmokeInput();
      const submit = getSmokeSubmit();
      return {
        value: input ? input.value : "",
        submitDisabled: submit ? submit.disabled : true
      };
    })()`,
    (state) => state.value.trim().length > 0 && state.submitDisabled === false,
    "template prompt fills input"
  );
  checks.push({
    name: "template prompt click",
    status: "passed",
    valueLength: templateState.value.length,
    submitDisabled: templateState.submitDisabled
  });

  const actionRect = await waitForRect(
    client,
    workflowActionButtonExpression(),
    "workflow action button"
  );
  await clickAt(client, actionRect);
  checks.push({
    name: "workflow action select",
    status: "passed"
  });

  const promptRect = await waitForRect(
    client,
    workflowPromptButtonExpression(),
    "workflow prompt button"
  );
  await clickAt(client, promptRect);

  const workflowState = await waitForValue(
    client,
    `(() => {
      const input = getSmokeInput();
      const submit = getSmokeSubmit();
      const value = input ? input.value : "";
      return {
        value,
        includesDailyWork: value.includes("daily_work"),
        includesPreviewWorkflow: /workflow|工作流|预演/i.test(value),
        submitDisabled: submit ? submit.disabled : true
      };
    })()`,
    (state) =>
      state.value.trim().length > 0 &&
      state.includesDailyWork &&
      state.includesPreviewWorkflow &&
      state.submitDisabled === false,
    "workflow prompt fills input"
  );
  checks.push({
    name: "workflow prompt click",
    status: "passed",
    valueLength: workflowState.value.length,
    includesDailyWork: workflowState.includesDailyWork,
    includesPreviewWorkflow: workflowState.includesPreviewWorkflow,
    submitDisabled: workflowState.submitDisabled
  });
}

async function runActivityStreamSmoke(client, apiUrl) {
  const apiSnapshot = await fetchActivityEventsSnapshot(apiUrl);
  assertActivityEventsSnapshot(apiSnapshot, "activity API response");

  const wsSnapshot = await fetchActivityWebSocketSnapshot(apiUrl);
  assertActivityEventsSnapshot(wsSnapshot, "activity WebSocket snapshot", {
    expectGeneratedAt: true
  });
  assertMatchingActivityEvents(apiSnapshot.events, wsSnapshot.events);

  const expectedTitles = apiSnapshot.events.map((event) => event.title);
  const pageState = await waitForValue(
    client,
    activityFeedExpression(expectedTitles),
    (state) =>
      state.present &&
      state.count === apiSnapshot.events.length &&
      state.eventButtonCount >= apiSnapshot.events.length &&
      (state.source === "api" || state.source === "websocket") &&
      state.connectionStatus !== "connecting" &&
      state.hasStatusText &&
      state.hasCountText &&
      state.includesExpectedTitles,
    "activity stream API/WebSocket state"
  );

  checks.push({
    name: "activity stream API and WebSocket snapshot",
    status: "passed",
    events: apiSnapshot.events.length,
    source: pageState.source,
    connectionStatus: pageState.connectionStatus,
    generatedAt: wsSnapshot.generatedAt
  });
}

async function runDailyEndpointsSmoke(apiUrl) {
  const endpoints = [
    { path: "/api/daily/templates?mode=daily_work", collectionKey: "templates" },
    { path: "/api/daily/context?mode=daily_work", collectionKey: "items" },
    { path: "/api/daily/approvals?mode=daily_work", collectionKey: "requests" },
    { path: "/api/daily/artifacts?mode=daily_work", collectionKey: "artifacts" },
    { path: "/api/daily/connectors?mode=daily_work", collectionKey: "connectors" },
    { path: "/api/daily/workflows?mode=daily_work", collectionKey: "workflows" },
    { path: "/api/daily/sessions?mode=daily_work", collectionKey: "sessions" },
    { path: "/api/daily/events?mode=daily_work", collectionKey: "events" }
  ];
  const snapshots = [];

  for (const endpoint of endpoints) {
    const snapshot = await fetchDailyEndpointSnapshot(apiUrl, endpoint.path);
    assertDailyEndpointSnapshot(snapshot, endpoint.collectionKey, endpoint.path);
    snapshots.push({
      path: endpoint.path,
      count: snapshot[endpoint.collectionKey].length
    });
  }

  const modelUsageSnapshot = await fetchModelUsageSnapshot(apiUrl);
  assertModelUsageSnapshot(modelUsageSnapshot, "model usage API response");

  checks.push({
    name: "daily endpoints API contract",
    status: "passed",
    endpoints: snapshots,
    modelUsageRecords: modelUsageSnapshot.usage.records.length
  });
}

async function runModelUsageSmoke(client, apiUrl) {
  const apiSnapshot = await fetchModelUsageSnapshot(apiUrl);
  assertModelUsageSnapshot(apiSnapshot, "model usage API response");

  const pageState = await waitForValue(
    client,
    modelUsagePanelExpression(),
    (state) =>
      state.present &&
      state.source === "api" &&
      (state.status === "live" || state.status === "api") &&
      state.hasDeepSeekText &&
      state.hasUsageText,
    "model usage API panel state"
  );

  checks.push({
    name: "model usage API panel",
    status: "passed",
    source: pageState.source,
    syncStatus: pageState.status,
    selectedModel: apiSnapshot.config.selectedModel,
    recordCount: apiSnapshot.usage.records.length
  });
}

async function runDataLayerStateSmoke(client) {
  const pageState = await waitForValue(
    client,
    dataLayerStateExpression(),
    (state) =>
      state.hasDedicatedState ||
      (state.activityFeedSource !== "fallback" && state.modelUsageSource === "api"),
    "data layer state display",
    Math.min(timeoutMs, 5000)
  );

  if (pageState.hasDedicatedState) {
    if (!pageState.dedicatedTextLength) {
      throw new Error("Data layer state display was present but empty.");
    }

    if (!pageState.hasStateSignal) {
      throw new Error("Data layer state display did not expose source or status text.");
    }
  }

  checks.push({
    name: "data layer state display",
    status: pageState.hasDedicatedState ? "passed" : "fallback-compatible",
    dedicatedState: pageState.hasDedicatedState,
    activityFeedSource: pageState.activityFeedSource,
    activityConnectionStatus: pageState.activityConnectionStatus,
    modelUsageSource: pageState.modelUsageSource,
    modelUsageStatus: pageState.modelUsageStatus
  });
}

async function runCodeBlockSmoke(client) {
  const initialInspection = await inspectCodeBlockDom(client);
  if (initialInspection.hasBlocks) {
    assertCodeBlockDom(initialInspection, "existing code block highlighting DOM");
    return;
  }

  const endpoint = await getChatEndpoint(client);
  if (!endpoint) {
    throw new Error("Code block smoke could not find a visible chat endpoint.");
  }

  const healthUrl = new URL("/health", endpoint).toString();
  if (!(await isReachable(healthUrl))) {
    throw new Error(`Code block smoke could not reach chat API at ${healthUrl}.`);
  }

  const probe = await fetchCodeFenceProbe(endpoint);
  if (!probe.ok) {
    throw new Error(`Code block smoke probe failed: ${probe.reason}`);
  }

  const prompt = "Please return TypeScript code for a daily_work code block smoke.";
  const submitRect = await waitForRect(
    client,
    setSmokeInputExpression(prompt),
    "code block smoke prompt"
  );
  await clickAt(client, submitRect);

  let streamedState;
  try {
    streamedState = await waitForValue(
      client,
      codeBlockOrFenceExpression(),
      (state) => state.inspection.hasBlocks || (state.hasFence && state.submitDisabled === false),
      "code block smoke response",
      Math.min(timeoutMs, 8000)
    );
  } catch (error) {
    throw new Error(
      `Code block smoke probe passed, but the browser response did not finish: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (streamedState.inspection.hasBlocks) {
    assertCodeBlockDom(streamedState.inspection, "streamed code block highlighting DOM");
    return;
  }

  throw new Error(
    "Code block smoke streamed fenced code, but highlighted code block DOM was not rendered."
  );
}

async function runChatSendSmoke(client) {
  const endpoint = await getChatEndpoint(client);
  if (!endpoint) {
    throw new Error("Chat send smoke could not find a visible chat endpoint.");
  }

  const prompt = `daily_work browser smoke chat send ${Date.now()}`;
  const apiResponse = await fetchChatTextResponse(endpoint, prompt);
  assertChatTextApiResponse(apiResponse, prompt, "chat API response");
  const responseSignature = apiResponse.body.includes("Mock daily-work AI response")
    ? `Mock daily-work AI response for: ${prompt}`
    : "";

  const submitRect = await waitForRect(
    client,
    setSmokeInputExpression(prompt),
    "chat send smoke prompt"
  );
  await clickAt(client, submitRect);

  const pageState = await waitForValue(
    client,
    chatResponseExpression(prompt, responseSignature),
    (state) =>
      (state.hasStructuredChatResponse || state.hasResponseSignature) &&
      state.inputValue === "" &&
      state.submitDisabled === true &&
      !state.hasErrorText,
    "chat submit API response"
  );

  checks.push({
    name: "chat submit renders API response",
    status: "passed",
    endpoint,
    structuredChatDom: pageState.present,
    matchedResponseSignature: pageState.hasResponseSignature,
    responseLength: pageState.responseTextLength
  });
}

function activityFeedExpression(expectedTitles) {
  return withSmokeHelpers(`(() => {
    const root = document.querySelector("[data-activity-feed]");
    const text = root ? root.textContent || "" : "";
    const expectedTitles = ${JSON.stringify(expectedTitles)};
    return {
      present: Boolean(root),
      count: root ? Number(root.getAttribute("data-activity-feed-count")) : 0,
      source: root ? root.getAttribute("data-activity-feed-source") || "" : "",
      connectionStatus: root ? root.getAttribute("data-activity-connection-status") || "" : "",
      eventButtonCount: root
        ? [...root.querySelectorAll("button")].filter((button) => isClickableSmokeButton(button)).length
        : 0,
      hasStatusText: /WebSocket|\\/api\\/daily\\/events\\?mode=daily_work/.test(text),
      hasCountText: text.includes(String(expectedTitles.length)),
      includesExpectedTitles: expectedTitles.every((title) => text.includes(title))
    };
  })()`);
}

function modelUsagePanelExpression() {
  return withSmokeHelpers(`(() => {
    const root = document.querySelector("[data-model-usage-source]");
    const text = root ? root.textContent || "" : "";
    return {
      present: Boolean(root),
      source: root ? root.getAttribute("data-model-usage-source") || "" : "",
      status: root ? root.getAttribute("data-model-usage-status") || "" : "",
      hasDeepSeekText: /DeepSeek/i.test(text),
      hasUsageText: /usage|tokens|prompt|completion|用量|模型/i.test(text)
    };
  })()`);
}

function dataLayerStateExpression() {
  return withSmokeHelpers(`(() => {
    const dedicatedSelectors = [
      "[data-daily-data-layer]",
      "[data-data-layer-state]",
      "[data-persistence-panel]",
      "[data-persistence-state]",
      "[data-storage-state]",
      "[data-sync-state]"
    ];
    const dedicated = dedicatedSelectors
      .map((selector) => document.querySelector(selector))
      .find(Boolean);
    const dedicatedText = dedicated ? dedicated.textContent || "" : "";
    const activityRoot = document.querySelector("[data-activity-feed]");
    const modelUsageRoot = document.querySelector("[data-model-usage-source]");

    return {
      hasDedicatedState: Boolean(dedicated),
      dedicatedTextLength: dedicatedText.trim().length,
      hasStateSignal: /api|live|sync|persist|storage|fallback|degraded|connected|ready/i.test(dedicatedText),
      activityFeedSource: activityRoot ? activityRoot.getAttribute("data-activity-feed-source") || "" : "",
      activityConnectionStatus: activityRoot ? activityRoot.getAttribute("data-activity-connection-status") || "" : "",
      modelUsageSource: modelUsageRoot ? modelUsageRoot.getAttribute("data-model-usage-source") || "" : "",
      modelUsageStatus: modelUsageRoot ? modelUsageRoot.getAttribute("data-model-usage-status") || "" : ""
    };
  })()`);
}

function templateButtonExpression() {
  return withSmokeHelpers(`(() => {
    const aside = document.querySelector("aside");
    if (!aside) return null;
    const buttons = [...aside.querySelectorAll("button")]
      .filter((button) => isClickableSmokeButton(button));
    return smokeRect(buttons[0] || null);
  })()`);
}

function workflowActionButtonExpression() {
  return withSmokeHelpers(`(() => {
    const root = findActionQueueRoot();
    if (!root) return null;
    const buttons = [...root.querySelectorAll("button")]
      .filter((button) =>
        isClickableSmokeButton(button) &&
        !button.hasAttribute("aria-pressed") &&
        !/Prompt/i.test(button.textContent || "")
      );
    return smokeRect(buttons[0] || null);
  })()`);
}

function workflowPromptButtonExpression() {
  return withSmokeHelpers(`(() => {
    const root = findActionQueueRoot();
    if (!root) return null;
    const button = [...root.querySelectorAll("button")]
      .find((candidate) =>
        isClickableSmokeButton(candidate) && /Prompt/i.test(candidate.textContent || "")
      );
    return smokeRect(button || null);
  })()`);
}

function setSmokeInputExpression(value) {
  return withSmokeHelpers(`(() => {
    const input = getSmokeInput();
    const submit = getSmokeSubmit();
    if (!input || !submit) return null;

    const value = ${JSON.stringify(value)};
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    return smokeRect(submit.disabled ? null : submit);
  })()`);
}

function codeBlockOrFenceExpression() {
  return withSmokeHelpers(`(() => {
    const inspection = inspectCodeBlockDom();
    const bodyText = document.body.textContent || "";
    const submit = getSmokeSubmit();
    return {
      inspection,
      hasFence: bodyText.includes("\`\`\`ts") || bodyText.includes("DailyWorkSignal"),
      submitDisabled: submit ? submit.disabled : true
    };
  })()`);
}

function chatResponseExpression(prompt, responseSignature) {
  return withSmokeHelpers(`(() => {
    const root = document.querySelector("[data-chat-thread]");
    const input = getSmokeInput();
    const submit = getSmokeSubmit();
    const messages = root ? [...root.querySelectorAll("[data-chat-message-role]")] : [];
    const userMessages = messages.filter((message) => message.getAttribute("data-chat-message-role") === "user");
    const assistantMessages = messages.filter((message) => message.getAttribute("data-chat-message-role") === "assistant");
    const lastAssistant = assistantMessages.at(-1);
    const bodyText = root ? root.textContent || "" : document.body.textContent || "";
    const responseText = lastAssistant ? (lastAssistant.textContent || "").trim() : "";
    const responseSignature = ${JSON.stringify(responseSignature)};
    const hasStructuredChatResponse =
      Boolean(root) &&
      (root.getAttribute("data-chat-status") || "") === "idle" &&
      userMessages.length >= 1 &&
      assistantMessages.length >= 1 &&
      responseText.length > 0;
    return {
      present: Boolean(root),
      status: root ? root.getAttribute("data-chat-status") || "" : "",
      hasPrompt: bodyText.includes(${JSON.stringify(prompt)}),
      userCount: userMessages.length,
      assistantCount: assistantMessages.length,
      hasStructuredChatResponse,
      hasAssistantResponse: responseText.length > 0,
      hasResponseSignature: responseSignature ? bodyText.includes(responseSignature) : false,
      responseTextLength: responseText.length || responseSignature.length,
      inputValue: input ? input.value : null,
      submitDisabled: submit ? submit.disabled : true,
      hasErrorText: /request failed|chat api|code block smoke could not|璇锋眰澶辫触/i.test(bodyText)
    };
  })()`);
}

function withSmokeHelpers(expression) {
  return `(() => {
    window.getSmokeInput = function getSmokeInput() {
      return document.querySelector("form input:not([type]), form input[type='text'], form textarea, input[aria-label], textarea[aria-label]");
    };
    window.getSmokeSubmit = function getSmokeSubmit() {
      return document.querySelector("form button[type='submit']");
    };
    window.isClickableSmokeButton = function isClickableSmokeButton(button) {
      const rect = button.getBoundingClientRect();
      return !button.disabled && rect.width > 0 && rect.height > 0;
    };
    window.smokeRect = function smokeRect(element) {
      if (!element) return null;
      element.scrollIntoView({ block: "center", inline: "center" });
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
        text: element.textContent || ""
      };
    };
    window.findActionQueueRoot = function findActionQueueRoot() {
      const candidates = [...document.querySelectorAll("section, div")]
        .filter((element) =>
          (element.textContent || "").includes("Action Queue") &&
          [...element.querySelectorAll("button")].some((button) => /Prompt/i.test(button.textContent || ""))
        )
        .map((element) => ({
          element,
          area: element.getBoundingClientRect().width * element.getBoundingClientRect().height
        }))
        .filter((entry) => entry.area > 0)
        .sort((left, right) => left.area - right.area);
      return candidates[0] ? candidates[0].element : null;
    };
    window.inspectCodeBlockDom = function inspectCodeBlockDom() {
      const blocks = [...document.querySelectorAll("[data-code-block]")];
      return {
        hasBlocks: blocks.length > 0,
        count: blocks.length,
        blocks: blocks.slice(0, 3).map((block) => {
          const label = block.querySelector("[data-code-language], [data-language]");
          const pre = block.querySelector("pre");
          const code = block.querySelector("code");
          const tokenSpans = [...block.querySelectorAll("span")]
            .filter((span) =>
              /token|keyword|string|comment|function|punctuation|property|number|operator|class-name/i.test(String(span.className || "")) ||
              span.hasAttribute("data-token")
            );
          const tokenKinds = [...new Set(tokenSpans.map((span) => span.getAttribute("data-token") || String(span.className || "")))];
          return {
            language:
              block.getAttribute("data-language") ||
              block.getAttribute("data-code-language") ||
              block.getAttribute("data-code-block") ||
              (label ? label.textContent.trim() : ""),
            text: block.textContent || "",
            hasPanel: block.hasAttribute("data-code-block"),
            hasPreCode: Boolean(pre && code && pre.contains(code)),
            tokenCount: tokenSpans.length,
            tokenKinds: tokenKinds.slice(0, 8)
          };
        })
      };
    };
    return ${expression};
  })()`;
}

async function inspectCodeBlockDom(client) {
  return evaluate(client, withSmokeHelpers("inspectCodeBlockDom()"));
}

async function getChatEndpoint(client) {
  return evaluate(
    client,
    `(() => {
      const match = (document.body.textContent || "").match(/Endpoint:\\s*(https?:\\/\\/\\S+?\\/api\\/chat)/);
      return match ? match[1] : null;
    })()`
  );
}

async function fetchCodeFenceProbe(endpoint) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "daily_work",
        messages: [
          {
            role: "user",
            content: "Please return TypeScript code for a daily_work code block smoke."
          }
        ]
      }),
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: `chat API probe returned HTTP ${response.status}`
      };
    }

    const body = await response.text();
    return body.includes("```")
      ? { ok: true }
      : {
          ok: false,
          reason: "chat API probe did not return a fenced code block"
        };
  } catch (error) {
    return {
      ok: false,
      reason: `chat API probe failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function fetchChatTextResponse(endpoint, prompt) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      mode: "daily_work",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    }),
    signal: AbortSignal.timeout(5000)
  });

  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    body: await response.text()
  };
}

async function fetchActivityEventsSnapshot(apiUrl) {
  const response = await fetch(
    new URL("/api/daily/events?mode=daily_work", apiUrl).toString(),
    {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(5000)
    }
  );

  if (!response.ok) {
    throw new Error(`Activity API returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function fetchModelUsageSnapshot(apiUrl) {
  const response = await fetch(
    new URL("/api/daily/model-usage?mode=daily_work", apiUrl).toString(),
    {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(5000)
    }
  );

  if (!response.ok) {
    throw new Error(`Model usage API returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function fetchDailyEndpointSnapshot(apiUrl, path) {
  const response = await fetch(new URL(path, apiUrl).toString(), {
    headers: {
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function fetchActivityWebSocketSnapshot(apiUrl) {
  const wsUrl = activityWebSocketUrl(apiUrl);
  return new Promise((resolve, reject) => {
    if (typeof WebSocket === "undefined") {
      reject(new Error("This script requires Node.js with a global WebSocket implementation."));
      return;
    }

    const socket = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      closeSocket(socket);
      reject(new Error(`Timed out waiting for daily.activity.snapshot from ${wsUrl}.`));
    }, 5000);

    socket.addEventListener("message", (event) => {
      const payload = parseJsonMessage(normalizeWebSocketData(event.data));
      if (payload && payload.type === "daily.activity.snapshot") {
        clearTimeout(timer);
        closeSocket(socket);
        resolve(payload);
      }
    });
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        closeSocket(socket);
        reject(new Error(`Could not connect to activity WebSocket at ${wsUrl}.`));
      },
      { once: true }
    );
  });
}

function activityWebSocketUrl(apiUrl) {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function assertActivityEventsSnapshot(snapshot, label, options = {}) {
  if (!snapshot || snapshot.mode !== "daily_work" || !Array.isArray(snapshot.events)) {
    throw new Error(`${label} did not include a daily_work events array.`);
  }

  if (snapshot.events.length !== 7) {
    throw new Error(`${label} included ${snapshot.events.length} event(s), expected 7.`);
  }

  for (const event of snapshot.events) {
    if (
      !event ||
      typeof event.id !== "string" ||
      typeof event.title !== "string" ||
      typeof event.eventType !== "string" ||
      typeof event.status !== "string"
    ) {
      throw new Error(`${label} included an invalid event payload.`);
    }
  }

  if (options.expectGeneratedAt) {
    const generatedAt = Date.parse(snapshot.generatedAt);
    if (typeof snapshot.generatedAt !== "string" || Number.isNaN(generatedAt)) {
      throw new Error(`${label} was missing a valid generatedAt timestamp.`);
    }
  }
}

function assertModelUsageSnapshot(snapshot, label) {
  if (
    !snapshot ||
    snapshot.mode !== "daily_work" ||
    !snapshot.config ||
    typeof snapshot.config.fastModel !== "string" ||
    typeof snapshot.config.proModel !== "string" ||
    typeof snapshot.config.selectedModel !== "string" ||
    !snapshot.usage ||
    !Array.isArray(snapshot.usage.records)
  ) {
    throw new Error(`${label} did not include daily_work model usage data.`);
  }

  if (!["fast", "pro"].includes(snapshot.config.selectedRoute)) {
    throw new Error(`${label} included unsupported selectedRoute.`);
  }

  if (!snapshot.usage.records.length) {
    throw new Error(`${label} did not include any usage records.`);
  }
}

function assertDailyEndpointSnapshot(snapshot, collectionKey, path) {
  if (!snapshot || snapshot.mode !== "daily_work" || !Array.isArray(snapshot[collectionKey])) {
    throw new Error(`${path} did not return a daily_work ${collectionKey} array.`);
  }

  if (!snapshot[collectionKey].length) {
    throw new Error(`${path} returned an empty ${collectionKey} array.`);
  }
}

function assertMatchingActivityEvents(apiEvents, wsEvents) {
  const apiIds = apiEvents.map((event) => event.id);
  const wsIds = new Set(wsEvents.map((event) => event.id));

  if (wsEvents.length !== apiEvents.length) {
    throw new Error(
      `WebSocket snapshot event count ${wsEvents.length} did not match API count ${apiEvents.length}.`
    );
  }

  const missingIds = apiIds.filter((id) => !wsIds.has(id));
  if (missingIds.length) {
    throw new Error(`WebSocket snapshot missed API events: ${missingIds.join(", ")}.`);
  }
}

function assertChatTextApiResponse(response, prompt, label) {
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}.`);
  }

  if (!response.contentType.includes("text/plain")) {
    throw new Error(`${label} returned unexpected content type: ${response.contentType}.`);
  }

  if (!response.body.trim()) {
    throw new Error(`${label} returned an empty response for prompt: ${prompt}.`);
  }

  if (
    response.body.includes("Mock daily-work AI response") &&
    !response.body.includes(prompt)
  ) {
    throw new Error(`${label} did not echo the submitted mock prompt.`);
  }
}

function normalizeWebSocketData(data) {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }
  return String(data);
}

function parseJsonMessage(data) {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function closeSocket(socket) {
  try {
    socket.close();
  } catch {}
}

function assertCodeBlockDom(inspection, label) {
  const firstBlock = inspection.blocks[0] || {};
  const languageSignal = `${firstBlock.language || ""} ${firstBlock.text || ""}`.toLowerCase();
  const hasLanguageLabel = /\b(ts|tsx|typescript|json|javascript|js)\b/.test(languageSignal);

  if (!inspection.hasBlocks || !firstBlock.hasPanel) {
    throw new Error(`${label} was missing a data-code-block panel.`);
  }

  if (!firstBlock.hasPreCode) {
    throw new Error(`${label} was missing stable pre/code markup.`);
  }

  if (!hasLanguageLabel) {
    throw new Error(`${label} was missing a stable language label.`);
  }

  if (!firstBlock.tokenCount) {
    throw new Error(`${label} was missing syntax token spans or classes.`);
  }

  checks.push({
    name: "code block highlighting DOM",
    status: "passed",
    blocks: inspection.count,
    language: firstBlock.language,
    tokenCount: firstBlock.tokenCount,
    tokenKinds: firstBlock.tokenKinds
  });
}

async function waitForRect(client, expression, label) {
  return waitForValue(
    client,
    expression,
    (rect) =>
      rect &&
      Number.isFinite(rect.x) &&
      Number.isFinite(rect.y) &&
      rect.width > 0 &&
      rect.height > 0,
    label
  );
}

async function waitForRuntime(client, expression, label) {
  return waitForValue(client, expression, Boolean, label);
}

async function waitForValue(client, expression, predicate, label, waitTimeoutMs = timeoutMs) {
  const startedAt = Date.now();
  let lastValue;
  while (Date.now() - startedAt < waitTimeoutMs) {
    lastValue = await evaluate(client, expression);
    if (predicate(lastValue)) {
      return lastValue;
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(lastValue)}`);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const description =
      result.exceptionDetails.exception &&
      (result.exceptionDetails.exception.description || result.exceptionDetails.exception.value);
    throw new Error(`Runtime.evaluate failed: ${description || "unknown exception"}`);
  }
  return result.result.value;
}

async function clickAt(client, rect) {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: rect.x,
    y: rect.y,
    button: "none"
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1
  });
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(`${message.error.message}: ${message.error.data || ""}`));
        } else {
          resolve(message.result || {});
        }
      }
    });

    socket.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error("CDP socket closed"));
      }
      this.pending.clear();
    });
  }

  static connect(wsUrl) {
    return new Promise((resolve, reject) => {
      if (typeof WebSocket === "undefined") {
        reject(new Error("This script requires Node.js with a global WebSocket implementation."));
        return;
      }
      const socket = new WebSocket(wsUrl);
      socket.addEventListener("open", () => resolve(new CdpClient(socket)), { once: true });
      socket.addEventListener("error", () => reject(new Error(`Could not connect to ${wsUrl}`)), {
        once: true
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForHttp(url, timeout, beforeRetry = () => {}) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeout) {
    try {
      beforeRetry();
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(2000)
      });
      if (response.status >= 200 && response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError && lastError.message}`);
}

async function waitForJson(url, timeout, beforeRetry = () => {}) {
  const response = await waitForHttp(url, timeout, beforeRetry);
  return response.json();
}

async function isReachable(url) {
  try {
    await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(1000)
    });
    return true;
  } catch {
    return false;
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : null;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("Could not allocate a free port"));
        }
      });
    });
    server.on("error", reject);
  });
}

function killTree(pid) {
  if (!pid) {
    return;
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore"
    });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
    }
  }
}

function removeDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
