#!/usr/bin/env node

const { setTimeout: delay } = require("node:timers/promises");
const { chromium } = require("playwright");

const apiUrl = process.env.SEEKDESK_API_URL || "http://127.0.0.1:4000";
const webUrl = process.env.SEEKDESK_WEB_URL || "http://127.0.0.1:3000";
const preferredWorkspaceId = process.env.SEEKDESK_SMOKE_WORKSPACE_ID || "";

function log(message) {
  process.stdout.write(`[browser-ui-smoke] ${message}\n`);
}

function fail(message) {
  throw new Error(message);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(options.timeoutMs || 15_000)
  });
  const body = await response.text();
  if (!response.ok) {
    fail(`${url} returned HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  return JSON.parse(body);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    const candidatePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Volumes/SSD/Google Chrome.app/Contents/MacOS/Google Chrome"
    ];
    for (const executablePath of candidatePaths) {
      try {
        return await chromium.launch({ executablePath, headless: true });
      } catch {
        // Try the next known browser path before falling back to bundled Chromium.
      }
    }
    return chromium.launch({ headless: true });
  }
}

async function waitForChatIdle(page, minMessages) {
  try {
    await page.waitForFunction(
      (count) => {
        const thread = document.querySelector("[data-chat-thread]");
        if (!thread) return false;
        const messageCount = Number(thread.getAttribute("data-chat-message-count") || "0");
        const status = thread.getAttribute("data-chat-status");
        return messageCount >= count && status === "idle";
      },
      minMessages,
      { timeout: 90_000 }
    );
  } catch (error) {
    const state = await page.evaluate(() => {
      const thread = document.querySelector("[data-chat-thread]");
      return {
        status: thread?.getAttribute("data-chat-status"),
        messageCount: thread?.getAttribute("data-chat-message-count"),
        bodyText: document.body.innerText.slice(0, 1000)
      };
    });
    throw new Error(
      `Chat did not become idle: ${JSON.stringify(state)}; ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function submitPrompt(page, prompt) {
  const input = page.locator('textarea[aria-label="输入编程请求"]');
  const sendButton = page.locator('form button[type="submit"]');
  await input.click();
  await input.fill("");
  await input.pressSequentially(prompt, { delay: 1 });
  await page.waitForFunction(
    () => {
      const button = document.querySelector('form button[type="submit"]');
      const textarea = document.querySelector('textarea[aria-label="输入编程请求"]');
      return Boolean(
        button &&
          textarea &&
          textarea.value.trim().length > 0 &&
          !button.hasAttribute("disabled")
      );
    },
    undefined,
    { timeout: 15_000 }
  );
  await sendButton.click();
}

async function waitForDiffApprovalTool(page) {
  try {
    await page.waitForSelector("[data-coding-diff-approval-tool]", {
      timeout: 45_000
    });
  } catch (error) {
    const state = await page.evaluate(() => ({
      chatStatus: document
        .querySelector("[data-chat-thread]")
        ?.getAttribute("data-chat-status"),
      chatMessageCount: document
        .querySelector("[data-chat-thread]")
        ?.getAttribute("data-chat-message-count"),
      approvalCount: document
        .querySelector("[data-coding-diff-approval-count]")
        ?.getAttribute("data-coding-diff-approval-count"),
      toolCalls: Array.from(document.querySelectorAll("[data-agent-tool-call]")).map(
        (node) => ({
          name: node.getAttribute("data-agent-tool-call"),
          status: node.getAttribute("data-agent-tool-execution"),
          result: node.getAttribute("data-agent-tool-result")
        })
      ),
      bodyText: document.body.innerText.slice(0, 1600)
    }));
    throw new Error(
      `Diff approval tool did not appear: ${JSON.stringify(state)}; ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function main() {
  const workspaceList = await fetchJson(`${apiUrl}/api/coding/workspaces`);
  const workspaces = Array.isArray(workspaceList.workspaces)
    ? workspaceList.workspaces
    : [];
  if (!workspaces.length) {
    fail("No coding workspace is available for UI smoke.");
  }

  const workspace =
    workspaces.find((item) => item.workspaceId === preferredWorkspaceId) ||
    workspaces.find((item) => item.runtimeMode === "local_daemon" && item.connected) ||
    workspaces.find((item) => item.workspaceId === "server-local-runtime") ||
    workspaces[0];
  if (!workspace?.workspaceId) {
    fail("Workspace selection failed.");
  }

  log(`using workspace ${workspace.workspaceId}`);

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const consoleErrors = [];
  const pageErrors = [];
  const responseErrors = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (
      text.includes("_next/webpack-hmr") ||
      text.includes("favicon.ico") ||
      text.includes("WebSocket connection") ||
      text.includes("Failed to load resource")
    ) {
      return;
    }
    const location = message.location();
    consoleErrors.push(`${text} @${location.url}:${location.lineNumber}:${location.columnNumber}`);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    if (
      url.includes("favicon.ico") ||
      url.includes("_next/webpack-hmr") ||
      url.includes("__nextjs")
    ) {
      return;
    }
    responseErrors.push(`${status} ${url}`);
  });

  try {
    await page.goto(webUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("[data-daily-new-conversation]", { timeout: 30_000 });

    await page.click("[data-daily-new-conversation]");
    await page.waitForSelector("[data-coding-dialog-create]", { timeout: 15_000 });
    const workspaceSelector = `[data-coding-dialog-workspace="${workspace.workspaceId}"]`;
    if (await page.locator(workspaceSelector).count()) {
      await page.click(workspaceSelector);
    } else if (await page.locator("[data-coding-dialog-workspace]").count()) {
      await page.locator("[data-coding-dialog-workspace]").first().click();
    }
    await page.click("[data-coding-dialog-create]");
    await page.waitForSelector("[data-chat-thread]", { timeout: 15_000 });

    await submitPrompt(
      page,
      "Read package.json and summarize the main npm scripts in two short sentences."
    );
    await waitForChatIdle(page, 2);

    await submitPrompt(
      page,
      "Use the coding.write_file tool to create .firecrawl/seekdesk-ui-diff-smoke.txt with content \"seekdesk ui diff approval smoke\". Emit the tool call and wait for approval; do not claim it ran before approval."
    );
    await waitForChatIdle(page, 4);

    await page.click('[data-daily-view-nav="diff"]');
    await page.waitForSelector("[data-coding-diff-panel]", { timeout: 15_000 });
    await waitForDiffApprovalTool(page);

    await page.locator("[data-coding-diff-approve-apply]").first().click();
    await page.click('[data-daily-view-nav="trace"]');
    await page.waitForSelector('[data-agent-tool-call="coding.write_file"][data-agent-tool-execution="completed"]', {
      timeout: 90_000
    });

    await page.click('[data-daily-view-nav="terminal"]');
    await page.waitForSelector("[data-coding-terminal-panel]", { timeout: 15_000 });

    await delay(500);
    if (pageErrors.length) {
      fail(`Page errors: ${pageErrors.join(" | ")}`);
    }
    if (consoleErrors.length) {
      fail(`Console errors: ${consoleErrors.slice(0, 5).join(" | ")}`);
    }
    if (responseErrors.length) {
      fail(`Network errors: ${responseErrors.slice(0, 8).join(" | ")}`);
    }
  } finally {
    await browser.close();
  }

  log("UI smoke passed");
}

main().catch((error) => {
  process.stderr.write(
    `[browser-ui-smoke] failed: ${error instanceof Error ? error.stack || error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
