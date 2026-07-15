import { DailyWorkRepositoryAccessError } from "../repositories/repository-errors.js";
import { CodingRuntimeError } from "../services/coding-runtime.js";

interface ReplyLike {
  code(statusCode: number): { send(payload: unknown): unknown };
}

export async function safeRuntimeReply<T>(reply: ReplyLike, run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    return sendRuntimeError(reply, error);
  }
}

export function sendRuntimeError(reply: ReplyLike, error: unknown) {
  if (error instanceof DailyWorkRepositoryAccessError) {
    return reply.code(403).send({
      mode: "coding_agent",
      error: error.code,
      message: error.message
    });
  }
  if (error instanceof CodingRuntimeError) {
    return reply.code(runtimeErrorStatus(error.code)).send({
      mode: "coding_agent",
      error: normalizeRuntimeErrorCode(error.code),
      message: error.message,
      details: error.details
    });
  }
  return reply.code(500).send({
    mode: "coding_agent",
    error: "coding_runtime_failed",
    message: "The coding Runtime request failed."
  });
}

export function createValidationError(
  issues: Array<{ path: PropertyKey[]; message: string }>
) {
  return {
    mode: "coding_agent",
    error: "invalid_coding_request",
    issues: issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message
    }))
  };
}

function runtimeErrorStatus(code: string) {
  if (code === "workspace_not_found" || code === "tool_call_not_found" || code === "session_not_found") {
    return 404;
  }
  if (code === "permission_required" || code === "workspace_access_denied") {
    return 403;
  }
  if (
    code === "runtime_unavailable" ||
    code === "runtime_not_ready" ||
    code === "session_workspace_mismatch" ||
    code === "workspace_operation_conflict" ||
    code === "runtime_request_timeout" ||
    code === "runtime_request_cancelled"
  ) {
    return 409;
  }
  return 400;
}

function normalizeRuntimeErrorCode(code: string) {
  if (code === "daemon_request_timeout") {
    return "runtime_request_timeout";
  }
  if (code === "daemon_request_cancelled") {
    return "runtime_request_cancelled";
  }
  return code;
}
