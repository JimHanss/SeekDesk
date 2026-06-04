#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const webDir = path.join(rootDir, "apps", "web");
const defaultHost = "127.0.0.1";
const defaultPort = Number(process.env.SEEKDESK_SMOKE_PORT || 3000);
const defaultUrl = `http://${defaultHost}:${defaultPort}`;
const smokeUrl = process.env.SEEKDESK_SMOKE_URL || defaultUrl;
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
  const server = await ensureWebServer();
  const browser = await launchBrowser();
  let client;

  try {
    client = await openPage(browser.debugPort, smokeUrl);
    await runPromptSmoke(client);

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
  }
}

function printHelp() {
  console.log(`SeekDesk browser smoke

Usage:
  npm run test:browser-smoke
  SEEKDESK_SMOKE_URL=http://127.0.0.1:3000 npm run test:browser-smoke

Environment:
  SEEKDESK_SMOKE_URL          Reuse an already-running web service.
  SEEKDESK_SMOKE_PORT         Port used when starting Next locally. Default: 3000.
  SEEKDESK_SMOKE_TIMEOUT_MS   Per-step timeout. Default: 30000.
  BROWSER_PATH                Chrome or Edge executable override.

The smoke starts or connects to a production web page, launches Chrome/Edge with
Chrome DevTools Protocol, clicks prompt controls with real mouse events, and
asserts that the chat input is populated and submit is enabled.`);
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

function noopServer(label) {
  return {
    label,
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
    return ${expression};
  })()`;
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

async function waitForValue(client, expression, predicate, label) {
  const startedAt = Date.now();
  let lastValue;
  while (Date.now() - startedAt < timeoutMs) {
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
