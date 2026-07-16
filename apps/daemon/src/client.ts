import process from "node:process";
import { RuntimeError } from "@seekdesk/runtime-core";
import {
  codingToolNameSchema,
  daemonRequestMessageSchema,
  daemonServerMessageSchema,
  type CodingWorkspaceBrowseInput,
  type CodingWorkspaceSelectInput,
  type DaemonRequestMessage,
  type DaemonWorkspace
} from "@seekdesk/shared";

import { DaemonLocalRuntime, DaemonRuntimeError } from "./local-runtime.js";

export interface DaemonClientOptions {
  apiUrl: string;
  token: string;
  workspaceRoot: string;
  daemonId?: string;
  reconnect?: boolean;
  reconnectDelayMs?: number;
  signal?: AbortSignal;
  onStatus?: (status: DaemonClientStatus) => void;
}

export type DaemonClientPhase =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "stopped";

export interface DaemonClientStatus {
  phase: DaemonClientPhase;
  attempt: number;
  message?: string;
  workspace?: DaemonWorkspace;
}

export async function startDaemonClient(options: DaemonClientOptions) {
  const runtime = new DaemonLocalRuntime(options.workspaceRoot, options.daemonId);
  const url = createDaemonWebSocketUrl(options.apiUrl);
  const reconnect = options.reconnect ?? true;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1500;
  let attempt = 0;

  for (;;) {
    if (options.signal?.aborted) {
      emitStatus(options, { phase: "stopped", attempt });
      return;
    }
    attempt += 1;
    emitStatus(options, {
      phase: attempt === 1 ? "connecting" : "reconnecting",
      attempt
    });
    try {
      await runDaemonSocket({
        url,
        token: options.token,
        runtime,
        attempt,
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.onStatus ? { onStatus: options.onStatus } : {})
      });
    } catch (error) {
      const message = formatUnknownError(error);
      emitStatus(options, { phase: "error", attempt, message });
      console.error("[seekdesk-daemon] connection failed:", message);
    }
    if (options.signal?.aborted || !reconnect) {
      emitStatus(options, { phase: "stopped", attempt });
      return;
    }
    emitStatus(options, { phase: "reconnecting", attempt });
    await waitForReconnect(reconnectDelayMs, options.signal);
  }
}

function runDaemonSocket(input: {
  url: string;
  token: string;
  runtime: DaemonLocalRuntime;
  signal?: AbortSignal;
  attempt: number;
  onStatus?: (status: DaemonClientStatus) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    if (input.signal?.aborted) {
      resolve();
      return;
    }
    const socket = new WebSocket(input.url);
    const requests = new Map<string, AbortController>();
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let settled = false;
    const abortSocket = () => {
      socket.close(1000, "daemon_stopped");
      finish();
    };

    const finish = (error?: unknown) => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      for (const controller of requests.values()) {
        controller.abort("socket_closed");
      }
      requests.clear();
      input.signal?.removeEventListener("abort", abortSocket);
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

    input.signal?.addEventListener("abort", abortSocket, { once: true });

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
      void handleMessage(
        socket,
        input.runtime,
        requests,
        String(event.data),
        input.attempt,
        input.onStatus
      ).catch((error) => {
        socket.close(1008, "daemon_protocol_error");
        finish(error);
      });
    });
    socket.addEventListener("close", () => finish());
    socket.addEventListener("error", () => finish(new Error("WebSocket error")));
  });
}

async function handleMessage(
  socket: WebSocket,
  runtime: DaemonLocalRuntime,
  requests: Map<string, AbortController>,
  rawMessage: string,
  attempt: number,
  onStatus?: (status: DaemonClientStatus) => void
) {
  let serverMessage: ReturnType<typeof daemonServerMessageSchema.parse>;
  try {
    serverMessage = daemonServerMessageSchema.parse(JSON.parse(rawMessage));
  } catch (error) {
    sendResponse(socket, "unknown", false, undefined, {
      code: "invalid_request",
      message: formatUnknownError(error)
    });
    return;
  }

  if (serverMessage.type === "daemon.ready") {
    return;
  }
  if (serverMessage.type === "daemon.registered") {
    onStatus?.({
      phase: "connected",
      attempt,
      workspace: serverMessage.workspace
    });
    return;
  }
  if (serverMessage.type === "daemon.error") {
    throw new Error(serverMessage.error);
  }

  let request: DaemonRequestMessage;
  try {
    request = daemonRequestMessageSchema.parse(serverMessage);
  } catch (error) {
    sendResponse(socket, "unknown", false, undefined, {
      code: "invalid_request",
      message: formatUnknownError(error)
    });
    return;
  }

  if (request.protocolVersion !== runtime.status().protocolVersion) {
    sendResponse(socket, request.requestId, false, undefined, {
      code: "runtime_protocol_mismatch",
      message: `Unsupported daemon protocol version ${request.protocolVersion}.`
    });
    return;
  }

  if (request.command === "request.cancel") {
    const targetRequestId = getTargetRequestId(request.payload);
    const controller = targetRequestId ? requests.get(targetRequestId) : undefined;
    controller?.abort("remote_cancelled");
    sendResponse(socket, request.requestId, true, { targetRequestId, cancelled: Boolean(controller) });
    return;
  }

  const controller = new AbortController();
  requests.set(request.requestId, controller);
  const timeout = setTimeout(() => controller.abort("request_timeout"), request.timeoutMs);

  try {
    const result = await executeRequest(runtime, request, controller.signal);
    if (controller.signal.aborted) {
      throw cancellationError(controller.signal.reason, request.requestId);
    }
    sendResponse(socket, request.requestId, true, result);
  } catch (error) {
    sendResponse(
      socket,
      request.requestId,
      false,
      undefined,
      formatDaemonError(
        controller.signal.aborted
          ? cancellationError(controller.signal.reason, request.requestId)
          : error
      )
    );
  } finally {
    clearTimeout(timeout);
    requests.delete(request.requestId);
  }
}

async function executeRequest(
  runtime: DaemonLocalRuntime,
  request: DaemonRequestMessage,
  signal: AbortSignal
) {
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
      return runtime.execute(toolName, payload.input ?? {}, { requestId: request.requestId, signal });
    }
    case "request.cancel":
      return undefined;
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

function getTargetRequestId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const value = (payload as { requestId?: unknown }).requestId;
  return typeof value === "string" && value.trim() ? value : null;
}

function cancellationError(reason: unknown, requestId: string) {
  const timedOut = reason === "request_timeout";
  return new RuntimeError(
    timedOut ? "Daemon request timed out." : "Daemon request was cancelled.",
    timedOut ? "runtime_request_timeout" : "runtime_request_cancelled",
    { requestId }
  );
}

export function createDaemonWebSocketUrl(apiUrl: string) {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/daemon";
  url.search = "";
  return url.toString();
}

function emitStatus(options: DaemonClientOptions, status: DaemonClientStatus) {
  options.onStatus?.(status);
}

function waitForReconnect(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, delayMs);
    const onAbort = () => finish();
    signal?.addEventListener("abort", onAbort, { once: true });
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
  });
}

function formatDaemonError(error: unknown) {
  if (error instanceof DaemonRuntimeError || error instanceof RuntimeError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  return { code: "daemon_request_failed", message: formatUnknownError(error) };
}

function formatUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

process.on("SIGINT", () => {
  process.exitCode = 0;
});
