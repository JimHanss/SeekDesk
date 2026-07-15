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
      process.env.BROWSER_PATH,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Volumes/SSD/Google Chrome.app/Contents/MacOS/Google Chrome"
    ].filter(Boolean);
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
  const sendButton = page.locator("[data-chat-send]");
  await input.click();
  await input.fill("");
  await input.pressSequentially(prompt, { delay: 1 });
  await page.waitForFunction(
    () => {
        const button = document.querySelector("[data-chat-send]");
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
  const readyCloudWorkspace = workspaces.find(
    (item) =>
      item.runtimeMode === "cloud_runtime" &&
      item.connected &&
      ["ready", "busy"].includes(item.status)
  );
  if (!workspace?.workspaceId) {
    fail("Workspace selection failed.");
  }

  log(`using workspace ${workspace.workspaceId}`);

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const consoleErrors = [];
  const pageErrors = [];
  const responseErrors = [];
  const requests = [];

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
  page.on("request", (request) => {
    if (request.url().includes("/api/")) requests.push(`${request.method()} ${request.url()}`);
  });
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
    try {
      await page.waitForSelector("[data-coding-dialog-create]", { timeout: 15_000 });
    } catch (error) {
      const state = await page.evaluate(() => ({
        url: window.location.href,
        activeView: document.querySelector("[data-daily-active-view]")?.getAttribute("data-daily-active-view"),
        sendDisabled: document.querySelector("[data-chat-send]")?.hasAttribute("disabled"),
        newConversationButtons: document.querySelectorAll("[data-daily-new-conversation]").length,
        dialogButtons: document.querySelectorAll("[data-coding-dialog-create]").length,
        scripts: Array.from(document.scripts).map((script) => script.src || "inline").slice(0, 20),
        nextResources: performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.includes("/_next/"))
          .slice(0, 30),
        bodyText: document.body.innerText.slice(0, 1600)
      }));
      throw new Error(
        `Workspace dialog did not open: ${JSON.stringify({
          ...state,
          consoleErrors,
          pageErrors,
          responseErrors,
          requests
        })}; ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    await page.getByRole("tab", { name: "云端工作区" }).click();
    await page.getByPlaceholder("https://github.com/org/repo.git").waitFor({ state: "visible" });
    if (await page.locator('input[type="password"]').count()) {
      fail("Cloud workspace form must not render a repository token field.");
    }
    if (readyCloudWorkspace) {
      const cloudSelector = `[data-coding-dialog-workspace="${readyCloudWorkspace.workspaceId}"]`;
      await page.locator(cloudSelector).click();
      await page.waitForTimeout(300);
      if (!(await page.locator("[data-coding-dialog-create]").isEnabled())) {
        fail("Ready cloud workspace did not enable conversation creation.");
      }
    } else if (await page.locator("[data-coding-dialog-create]").isEnabled()) {
      fail("Conversation creation must stay disabled without a ready cloud workspace.");
    }
    await page.getByRole("tab", { name: "本机项目" }).click();
    const workspaceSelector = `[data-coding-dialog-workspace="${workspace.workspaceId}"]`;
    if (await page.locator(workspaceSelector).count()) {
      await page.click(workspaceSelector);
    } else if (await page.locator("[data-coding-dialog-workspace]").count()) {
      await page.locator("[data-coding-dialog-workspace]").first().click();
    }
    await page.waitForTimeout(500);
    if (!(await page.locator("[data-coding-dialog-create]").isEnabled())) {
      const dialogState = await page.evaluate(() => ({
        workspaces: Array.from(document.querySelectorAll("[data-coding-dialog-workspace]")).map(
          (node) => ({
            id: node.getAttribute("data-coding-dialog-workspace"),
            className: node.getAttribute("class"),
            text: node.textContent
          })
        ),
        createDisabled: document
          .querySelector("[data-coding-dialog-create]")
          ?.hasAttribute("disabled"),
        bodyText: document.body.innerText.slice(0, 1600)
      }));
      fail(
        `Ready local daemon workspace did not enable conversation creation: ${JSON.stringify(dialogState)}`
      );
    }
    await page.click("[data-coding-dialog-create]");
    await page.waitForSelector("[data-chat-thread]", { timeout: 15_000 });
    if (await page.locator("[data-coding-panel]").count()) {
      fail("Default chat view rendered a right-side workbench panel before it was opened.");
    }
    const legacyText = await page.locator("body").innerText();
    for (const forbidden of ["客户更新邮件", "例会纪要压缩", "资料研究简报", "daily_work"]) {
      if (legacyText.includes(forbidden)) {
        fail(`Default coding UI still renders legacy text: ${forbidden}`);
      }
    }

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
    const finalBodyText = await page.locator("body").innerText();
    if (/\uFFFD|\?{3,}/.test(finalBodyText)) {
      fail("The rendered page contains mojibake or repeated question-mark placeholders.");
    }
    const forbiddenNetworkTerms = [
      "/connectors/",
      "/oauth/",
      "gmail",
      "outlook",
      "google_calendar",
      "microsoft/oauth"
    ];
    const forbiddenRequests = requests.filter((request) =>
      forbiddenNetworkTerms.some((term) => request.toLowerCase().includes(term))
    );
    if (forbiddenRequests.length) {
      fail(`Removed connector requests were observed: ${forbiddenRequests.join(" | ")}`);
    }
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
