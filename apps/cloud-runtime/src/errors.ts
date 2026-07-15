import { runtimeErrorCodeSchema, type RuntimeErrorCode } from "@seekdesk/shared";

export class CloudRuntimeServiceError extends Error {
  readonly code: RuntimeErrorCode;

  constructor(
    message: string,
    code: RuntimeErrorCode,
    readonly details: Record<string, unknown> = {},
    readonly statusCode = 409
  ) {
    super(redactSensitiveText(message));
    this.name = "CloudRuntimeServiceError";
    this.code = runtimeErrorCodeSchema.parse(code);
  }
}

export function redactSensitiveText(value: string) {
  return value
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[redacted]@")
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, "$1[redacted]")
    .replace(/([?&](?:access_token|token|key)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(seekdesk-credential:[^\s,;]+)/gi, "[redacted-credential]")
    .slice(0, 2000);
}

export function toCloudRuntimeServiceError(error: unknown) {
  if (error instanceof CloudRuntimeServiceError) {
    return error;
  }
  return new CloudRuntimeServiceError(
    "Cloud runtime operation failed.",
    "runtime_execution_failed",
    {},
    500
  );
}
