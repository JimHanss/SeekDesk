import {
  runtimeExecuteResponseSchema,
  type CodingToolName,
  type CodingWorkspaceRecord,
  type RuntimeOperation
} from "@seekdesk/shared";

import { redactCredentialText } from "./credential-crypto.js";
import { CodingRuntimeError } from "./coding-runtime.js";

export interface CloudRuntimeHealth {
  configured: boolean;
  reachable: boolean;
  service: string;
  dockerReady: boolean;
  message?: string;
}

export interface CloudRuntimeLifecycleRequest {
  ownerId: string;
  workspace: CodingWorkspaceRecord;
  operation: RuntimeOperation;
}

export interface CloudRuntimeExecuteInput {
  requestId: string;
  ownerId: string;
  workspaceId: string;
  toolName: CodingToolName;
  inputJson: unknown;
}

export interface CloudRuntimeClient {
  readonly configured: boolean;
  health(): Promise<CloudRuntimeHealth>;
  submitLifecycle(request: CloudRuntimeLifecycleRequest): Promise<void>;
  execute(input: CloudRuntimeExecuteInput): Promise<unknown>;
}

export class UnconfiguredCloudRuntimeClient implements CloudRuntimeClient {
  readonly configured = false;

  async health(): Promise<CloudRuntimeHealth> {
    return {
      configured: false,
      reachable: false,
      service: "seekdesk-cloud-runtime",
      dockerReady: false,
      message: "Cloud runtime is not configured."
    };
  }

  async submitLifecycle(_request: CloudRuntimeLifecycleRequest) {
    void _request;
    throw createUnavailableError();
  }

  async execute(_input: CloudRuntimeExecuteInput) {
    void _input;
    throw createUnavailableError();
  }
}

export class HttpCloudRuntimeClient implements CloudRuntimeClient {
  readonly configured = true;

  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async health(): Promise<CloudRuntimeHealth> {
    try {
      const response = await this.request("/internal/health", { method: "GET" }, 3_000);
      const payload = await readJsonRecord(response);
      return {
        configured: true,
        reachable: response.ok,
        service: stringValue(payload.service) ?? "seekdesk-cloud-runtime",
        dockerReady: payload.dockerReady === true,
        ...(response.ok
          ? {}
          : { message: sanitizeMessage(stringValue(payload.message) ?? response.statusText) })
      };
    } catch (error) {
      return {
        configured: true,
        reachable: false,
        service: "seekdesk-cloud-runtime",
        dockerReady: false,
        message: sanitizeMessage(error instanceof Error ? error.message : String(error))
      };
    }
  }

  async submitLifecycle(request: CloudRuntimeLifecycleRequest) {
    const response = await this.request(
      `/internal/workspaces/${encodeURIComponent(request.workspace.workspaceId)}/operations`,
      {
        method: "POST",
        body: JSON.stringify(request)
      },
      10_000
    );
    if (!response.ok) {
      throw await createHttpRuntimeError(response, "Cloud runtime rejected the lifecycle operation.");
    }
  }

  async execute(input: CloudRuntimeExecuteInput) {
    const response = await this.request(
      `/internal/workspaces/${encodeURIComponent(input.workspaceId)}/execute`,
      {
        method: "POST",
        body: JSON.stringify(input)
      },
      130_000
    );
    if (!response.ok) {
      throw await createHttpRuntimeError(response, "Cloud runtime tool execution failed.");
    }
    const parsed = runtimeExecuteResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new CodingRuntimeError(
        "Cloud runtime returned an invalid execution response.",
        "runtime_protocol_mismatch"
      );
    }
    if (!parsed.data.ok) {
      throw new CodingRuntimeError(
        parsed.data.error.message,
        parsed.data.error.code,
        parsed.data.error.details ?? {}
      );
    }
    return parsed.data.result;
  }

  private request(path: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init.headers,
        authorization: `Bearer ${this.serviceToken}`
      },
      signal: controller.signal
    }).finally(() => clearTimeout(timer));
  }
}

export function createCloudRuntimeClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): CloudRuntimeClient {
  const enabled = env.SEEKDESK_CLOUD_RUNTIME_ENABLED === "true";
  const baseUrl = env.SEEKDESK_CLOUD_RUNTIME_URL?.trim().replace(/\/+$/, "");
  const serviceToken = env.SEEKDESK_CLOUD_RUNTIME_SERVICE_TOKEN?.trim();
  if (!enabled || !baseUrl || !serviceToken) {
    return new UnconfiguredCloudRuntimeClient();
  }
  return new HttpCloudRuntimeClient(baseUrl, serviceToken, fetchImpl);
}

async function createHttpRuntimeError(response: Response, fallback: string) {
  const payload = await readJsonRecord(response);
  const code = stringValue(payload.error) ?? stringValue(payload.code) ?? "runtime_execution_failed";
  const message = sanitizeMessage(stringValue(payload.message) ?? fallback);
  return new CodingRuntimeError(message, code, {
    statusCode: response.status
  });
}

async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sanitizeMessage(message: string) {
  return redactCredentialText(message).slice(0, 1000);
}

function createUnavailableError() {
  return new CodingRuntimeError(
    "Cloud runtime is not configured or reachable.",
    "runtime_unavailable"
  );
}
