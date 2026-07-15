import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

import {
  NodeWorkspaceRuntime,
  RuntimeError
} from "@seekdesk/runtime-core";
import {
  codingToolInputSchemas,
  codingToolNameSchema,
  runtimeExecuteRequestSchema,
  runtimeExecuteResponseSchema,
  type RuntimeExecuteRequest,
  type RuntimeExecuteResponse
} from "@seekdesk/shared";

const defaultWorkspaceRoot = "/workspace";
const defaultWorkspaceId = "cloud-runtime-workspace";
const defaultRequestTimeoutMs = 125_000;
const defaultMaxInputBytes = 1_000_000;
const defaultMaxOutputBytes = 2_000_000;

export interface RuntimeWorkerOptions {
  workspaceRoot?: string;
  workspaceId?: string;
  requestTimeoutMs?: number;
  maxInputBytes?: number;
  maxOutputBytes?: number;
}

export class RuntimeWorker {
  readonly workspaceRoot: string;
  readonly workspaceId: string;
  readonly maxInputBytes: number;
  readonly maxOutputBytes: number;
  private readonly runtime: NodeWorkspaceRuntime;
  private readonly requestTimeoutMs: number;
  private readonly activeRequests = new Map<string, AbortController>();

  constructor(options: RuntimeWorkerOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? defaultWorkspaceRoot;
    this.workspaceId = options.workspaceId ?? defaultWorkspaceId;
    this.requestTimeoutMs = options.requestTimeoutMs ?? defaultRequestTimeoutMs;
    this.maxInputBytes = options.maxInputBytes ?? defaultMaxInputBytes;
    this.maxOutputBytes = options.maxOutputBytes ?? defaultMaxOutputBytes;
    this.runtime = new NodeWorkspaceRuntime(this.workspaceRoot);
  }

  health() {
    return {
      status: "ok" as const,
      service: "seekdesk-runtime-worker",
      protocolVersion: 1,
      workspaceId: this.workspaceId,
      workspaceRoot: this.workspaceRoot,
      runtimeMode: "cloud_runtime" as const,
      pid: process.pid,
      supportedCapabilities: [
        "coding.read_file",
        "coding.write_file",
        "coding.edit_file",
        "coding.list_files",
        "coding.grep",
        "coding.run_shell",
        "coding.git_diff",
        "coding.git_status",
        "coding.run_tests"
      ]
    };
  }

  async execute(request: RuntimeExecuteRequest): Promise<RuntimeExecuteResponse> {
    if (request.workspaceId !== this.workspaceId) {
      return createErrorResponse(
        request.requestId,
        "runtime_workspace_mismatch",
        "Runtime request does not match the worker workspace.",
        { expectedWorkspaceId: this.workspaceId }
      );
    }
    if (this.activeRequests.has(request.requestId)) {
      return createErrorResponse(
        request.requestId,
        "runtime_request_conflict",
        "A request with this requestId is already running."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort("request_timeout"),
      this.requestTimeoutMs
    );
    this.activeRequests.set(request.requestId, controller);

    try {
      const toolName = codingToolNameSchema.safeParse(request.toolName);
      if (!toolName.success) {
        return createErrorResponse(
          request.requestId,
          "runtime_tool_unsupported",
          "Runtime worker does not support this tool."
        );
      }
      const toolInput = codingToolInputSchemas[toolName.data].safeParse(request.inputJson);
      if (!toolInput.success) {
        return createErrorResponse(
          request.requestId,
          "invalid_runtime_request",
          "Runtime tool input does not match the shared schema.",
          {
            issues: toolInput.error.issues.map((issue) => ({
              path: issue.path.map(String).join("."),
              message: issue.message
            }))
          }
        );
      }
      const result = await this.runtime.execute(
        toolName.data,
        toolInput.data,
        { requestId: request.requestId, signal: controller.signal }
      );
      if (controller.signal.aborted) {
        return cancellationResponse(request.requestId, controller.signal.reason);
      }
      return fitResponse({ ok: true, requestId: request.requestId, result }, this.maxOutputBytes);
    } catch (error) {
      if (controller.signal.aborted) {
        return cancellationResponse(request.requestId, controller.signal.reason);
      }
      return fitResponse(formatWorkerError(request.requestId, error), this.maxOutputBytes);
    } finally {
      clearTimeout(timeout);
      this.activeRequests.delete(request.requestId);
    }
  }

  cancel(requestId: string, reason: "remote_cancelled" | "process_signal" = "remote_cancelled") {
    const controller = this.activeRequests.get(requestId);
    controller?.abort(reason);
    return Boolean(controller);
  }

  cancelAll(reason: "process_signal" = "process_signal") {
    for (const controller of this.activeRequests.values()) {
      controller.abort(reason);
    }
  }
}

export async function handleRuntimeWorkerLine(
  worker: RuntimeWorker,
  line: string
): Promise<RuntimeExecuteResponse> {
  if (Buffer.byteLength(line, "utf8") > worker.maxInputBytes) {
    return createErrorResponse(
      "unknown",
      "runtime_input_too_large",
      "Runtime request exceeds the input size limit.",
      { maxInputBytes: worker.maxInputBytes }
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return createErrorResponse("unknown", "invalid_json", "Runtime request is not valid JSON.");
  }

  const cancelRequest = parseCancelRequest(value);
  if (cancelRequest) {
    return runtimeExecuteResponseSchema.parse({
      ok: true,
      requestId: cancelRequest.requestId,
      result: {
        cancelled: worker.cancel(cancelRequest.targetRequestId),
        targetRequestId: cancelRequest.targetRequestId
      }
    });
  }

  const parsed = runtimeExecuteRequestSchema.safeParse(value);
  if (!parsed.success) {
    return createErrorResponse(
      requestIdFromUnknown(value),
      "invalid_runtime_request",
      "Runtime request does not match the execution protocol.",
      {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message
        }))
      }
    );
  }
  return worker.execute(parsed.data);
}

export async function serveRuntimeWorker(
  worker: RuntimeWorker,
  input: Readable,
  output: Writable
) {
  const lines = createInterface({ input, crlfDelay: Infinity, terminal: false });
  const pending = new Set<Promise<void>>();

  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const task = handleRuntimeWorkerLine(worker, line)
      .then((response) => writeResponse(output, response))
      .finally(() => pending.delete(task));
    pending.add(task);
  }
  await Promise.allSettled(pending);
}

export function writeResponse(output: Writable, response: RuntimeExecuteResponse) {
  output.write(`${JSON.stringify(response)}\n`);
}

function fitResponse(
  response: RuntimeExecuteResponse,
  maxOutputBytes: number
): RuntimeExecuteResponse {
  const size = Buffer.byteLength(JSON.stringify(response), "utf8");
  if (size <= maxOutputBytes) {
    return runtimeExecuteResponseSchema.parse(response);
  }
  return createErrorResponse(
    response.requestId,
    "runtime_output_too_large",
    "Runtime response exceeds the output size limit.",
    { maxOutputBytes, actualBytes: size }
  );
}

function formatWorkerError(requestId: string, error: unknown): RuntimeExecuteResponse {
  if (error instanceof RuntimeError) {
    return createErrorResponse(requestId, error.code, error.message, error.details);
  }
  return createErrorResponse(
    requestId,
    "runtime_execution_failed",
    "Runtime execution failed."
  );
}

function cancellationResponse(requestId: string, reason: unknown) {
  const timedOut = reason === "request_timeout";
  return createErrorResponse(
    requestId,
    timedOut ? "runtime_request_timeout" : "runtime_request_cancelled",
    timedOut ? "Runtime request timed out." : "Runtime request was cancelled."
  );
}

function createErrorResponse(
  requestId: string,
  code: string,
  message: string,
  details?: Record<string, unknown>
): RuntimeExecuteResponse {
  return runtimeExecuteResponseSchema.parse({
    ok: false,
    requestId,
    error: {
      code,
      message,
      ...(details && Object.keys(details).length ? { details } : {})
    }
  });
}

function parseCancelRequest(value: unknown) {
  if (!isRecord(value) || value.type !== "cancel") {
    return null;
  }
  const requestId = stringValue(value.requestId);
  const targetRequestId = stringValue(value.targetRequestId);
  return requestId && targetRequestId ? { requestId, targetRequestId } : null;
}

function requestIdFromUnknown(value: unknown) {
  return isRecord(value) ? stringValue(value.requestId) ?? "unknown" : "unknown";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
