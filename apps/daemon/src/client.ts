import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import {
  codingToolNameSchema,
  daemonRequestMessageSchema,
  type CodingWorkspaceBrowseInput,
  type CodingWorkspaceSelectInput,
  type DaemonRequestMessage
} from "@seekdesk/shared";

import { DaemonLocalRuntime, DaemonRuntimeError } from "./local-runtime.js";

export interface DaemonClientOptions {
  apiUrl: string;
  token: string;
  workspaceRoot: string;
  daemonId?: string;
  reconnect?: boolean;
}

export async function startDaemonClient(options: DaemonClientOptions) {
  const runtime = new DaemonLocalRuntime(options.workspaceRoot, options.daemonId);
  const url = createDaemonWebSocketUrl(options.apiUrl);
  const reconnect = options.reconnect ?? true;

  for (;;) {
    try {
      await runDaemonSocket({ url, token: options.token, runtime });
    } catch (error) {
      console.error("[seekdesk-daemon] connection failed:", formatUnknownError(error));
    }

    if (!reconnect) {
      return;
    }

    await delay(1500);
  }
}

function runDaemonSocket(input: {
  url: string;
  token: string;
  runtime: DaemonLocalRuntime;
}) {
  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(input.url);
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let settled = false;

    const finish = (error?: unknown) => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        type: "daemon.register",
        token: input.token,
        status: input.runtime.status()
      }));

      heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "daemon.heartbeat", status: input.runtime.status() }));
        }
      }, 10_000);
    });

    socket.addEventListener("message", (event) => {
      void handleMessage(socket, input.runtime, String(event.data));
    });

    socket.addEventListener("close", () => finish());
    socket.addEventListener("error", () => finish(new Error("WebSocket error")));
  });
}

async function handleMessage(
  socket: WebSocket,
  runtime: DaemonLocalRuntime,
  rawMessage: string
) {
  let request: DaemonRequestMessage;
  try {
    request = daemonRequestMessageSchema.parse(JSON.parse(rawMessage));
  } catch (error) {
    sendResponse(socket, "unknown", false, undefined, {
      code: "invalid_request",
      message: formatUnknownError(error)
    });
    return;
  }

  try {
    const result = await executeRequest(runtime, request);
    sendResponse(socket, request.requestId, true, result);
  } catch (error) {
    sendResponse(socket, request.requestId, false, undefined, formatDaemonError(error));
  }
}

async function executeRequest(runtime: DaemonLocalRuntime, request: DaemonRequestMessage) {
  switch (request.command) {
    case "workspace.browse":
      return runtime.browseWorkspaceDirectories(request.payload as CodingWorkspaceBrowseInput);
    case "workspace.select":
      return runtime.selectWorkspace(request.payload as CodingWorkspaceSelectInput);
    case "workspace.pick":
      return runtime.pickWorkspaceDirectory();
    case "tool.execute": {
      const payload = request.payload as { toolName?: unknown; input?: unknown };
      const toolName = codingToolNameSchema.parse(payload.toolName);
      return runtime.execute(toolName, payload.input ?? {});
    }
  }
}

function sendResponse(
  socket: WebSocket,
  requestId: string,
  ok: boolean,
  result?: unknown,
  error?: { code: string; message: string; details?: Record<string, unknown> }
) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({
    type: "daemon.response",
    requestId,
    ok,
    ...(result === undefined ? {} : { result }),
    ...(error ? { error } : {})
  }));
}

function createDaemonWebSocketUrl(apiUrl: string) {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/daemon";
  url.search = "";
  return url.toString();
}

function formatDaemonError(error: unknown) {
  if (error instanceof DaemonRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  return {
    code: "daemon_request_failed",
    message: formatUnknownError(error)
  };
}

function formatUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

process.on("SIGINT", () => {
  process.exitCode = 0;
});
