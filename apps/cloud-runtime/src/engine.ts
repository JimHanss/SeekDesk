import { spawn } from "node:child_process";

import {
  runtimeExecuteResponseSchema,
  type RuntimeExecuteRequest
} from "@seekdesk/shared";

import type { CloudRuntimeConfig } from "./config.js";
import { CloudRuntimeServiceError, redactSensitiveText } from "./errors.js";

export interface CloudContainerSpec {
  ownerId: string;
  workspaceId: string;
  workspacePath: string;
  image: string;
}

export interface CloudContainerInspection {
  containerRef: string;
  workspaceId: string;
  exists: boolean;
  running: boolean;
  status: string;
}

export interface CloudContainerEngine {
  readiness(): Promise<{ dockerReady: boolean; message?: string }>;
  provision(spec: CloudContainerSpec): Promise<string>;
  inspect(containerRef: string): Promise<CloudContainerInspection>;
  start(containerRef: string): Promise<void>;
  stop(containerRef: string): Promise<void>;
  delete(containerRef: string): Promise<void>;
  execute(
    containerRef: string,
    request: RuntimeExecuteRequest,
    signal?: AbortSignal
  ): Promise<unknown>;
  listManagedContainers(): Promise<CloudContainerInspection[]>;
}

export interface DockerCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
}

export interface DockerCommandRunner {
  run(
    args: string[],
    options?: { input?: string; timeoutMs?: number; signal?: AbortSignal }
  ): Promise<DockerCommandResult>;
}

export class DockerCliContainerEngine implements CloudContainerEngine {
  private readonly runner: DockerCommandRunner;

  constructor(private readonly config: CloudRuntimeConfig, runner?: DockerCommandRunner) {
    this.runner = runner ?? new SpawnDockerCommandRunner(
      config.dockerBinary,
      config.maxCommandOutputBytes
    );
  }

  async readiness() {
    try {
      const result = await this.runner.run(["info", "--format", "{{json .ServerVersion}}"], {
        timeoutMs: 5_000
      });
      return result.exitCode === 0
        ? { dockerReady: true }
        : { dockerReady: false, message: redactSensitiveText(result.stderr || "Docker is unavailable.") };
    } catch {
      return { dockerReady: false, message: "Docker is unavailable." };
    }
  }

  async provision(spec: CloudContainerSpec) {
    const containerName = createContainerName(spec.workspaceId);
    const args = [
      "create",
      "--name", containerName,
      "--label", "seekdesk.managed=true",
      "--label", `seekdesk.workspace-id=${spec.workspaceId}`,
      "--read-only",
      "--tmpfs", `/tmp:rw,noexec,nosuid,size=${this.config.tmpfsSize}`,
      "--mount", `type=bind,src=${spec.workspacePath},dst=/workspace`,
      "--network", "none",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges=true",
      "--pids-limit", String(this.config.pidsLimit),
      "--cpus", String(this.config.cpuLimit),
      "--memory", this.config.memoryLimit,
      "--user", `${this.config.runtimeUid}:${this.config.runtimeGid}`,
      "--env", `SEEKDESK_RUNTIME_WORKSPACE_ID=${spec.workspaceId}`,
      spec.image,
      "idle"
    ];
    const result = await this.runner.run(args, { timeoutMs: 60_000 });
    assertCommandSuccess(result, "Docker could not create the runtime container.");
    const containerRef = result.stdout.trim();
    if (!containerRef) {
      throw new CloudRuntimeServiceError(
        "Docker returned an empty container reference.",
        "runtime_protocol_mismatch"
      );
    }
    return containerRef;
  }

  async inspect(containerRef: string) {
    assertContainerRef(containerRef);
    const result = await this.runner.run(["inspect", containerRef], { timeoutMs: 10_000 });
    if (result.exitCode !== 0) {
      return {
        containerRef,
        workspaceId: "unknown",
        exists: false,
        running: false,
        status: "missing"
      };
    }
    try {
      const [inspection] = JSON.parse(result.stdout) as Array<{
        State?: { Running?: boolean; Status?: string };
        Config?: { Labels?: Record<string, string> };
      }>;
      return {
        containerRef,
        workspaceId: inspection?.Config?.Labels?.["seekdesk.workspace-id"] ?? "unknown",
        exists: true,
        running: inspection?.State?.Running === true,
        status: inspection?.State?.Status ?? "unknown"
      };
    } catch {
      throw new CloudRuntimeServiceError(
        "Docker returned an invalid inspection payload.",
        "runtime_protocol_mismatch"
      );
    }
  }

  async start(containerRef: string) {
    await this.runContainerCommand(["start", assertContainerRef(containerRef)], "start");
  }

  async stop(containerRef: string) {
    await this.runContainerCommand(["stop", "--time", "10", assertContainerRef(containerRef)], "stop");
  }

  async delete(containerRef: string) {
    await this.runContainerCommand(["rm", "--force", assertContainerRef(containerRef)], "delete");
  }

  async execute(containerRef: string, request: RuntimeExecuteRequest, signal?: AbortSignal) {
    if (signal?.aborted) {
      throw cancelledRequestError();
    }
    const result = await this.runner.run([
      "exec",
      "--interactive",
      assertContainerRef(containerRef),
      "node",
      "/opt/seekdesk/apps/runtime-worker/dist/cli.js",
      "execute"
    ], {
      input: `${JSON.stringify(request)}\n`,
      timeoutMs: this.config.executeTimeoutMs,
      ...(signal ? { signal } : {})
    });
    if (signal?.aborted) {
      throw cancelledRequestError();
    }
    assertCommandSuccess(result, "Runtime worker execution failed.");
    let payload: unknown;
    try {
      payload = JSON.parse(result.stdout.trim());
    } catch {
      throw new CloudRuntimeServiceError(
        "Runtime worker returned invalid JSON.",
        "runtime_protocol_mismatch"
      );
    }
    const parsed = runtimeExecuteResponseSchema.safeParse(payload);
    if (!parsed.success || parsed.data.requestId !== request.requestId) {
      throw new CloudRuntimeServiceError(
        "Runtime worker returned an invalid response envelope.",
        "runtime_protocol_mismatch"
      );
    }
    if (!parsed.data.ok) {
      throw new CloudRuntimeServiceError(
        parsed.data.error.message,
        parsed.data.error.code,
        parsed.data.error.details ?? {}
      );
    }
    return parsed.data.result;
  }

  async listManagedContainers() {
    const result = await this.runner.run([
      "ps",
      "--all",
      "--filter", "label=seekdesk.managed=true",
      "--format", "{{json .}}"
    ], { timeoutMs: 10_000 });
    assertCommandSuccess(result, "Docker could not list managed containers.");
    return result.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
      try {
        const row = JSON.parse(line) as { ID?: string; State?: string; Status?: string; Labels?: string };
        const labels = parseDockerLabels(row.Labels ?? "");
        return {
          containerRef: row.ID ?? "unknown",
          workspaceId: labels["seekdesk.workspace-id"] ?? "unknown",
          exists: true,
          running: row.State === "running",
          status: row.State ?? row.Status ?? "unknown"
        };
      } catch {
        throw new CloudRuntimeServiceError(
          "Docker returned an invalid managed-container row.",
          "runtime_protocol_mismatch"
        );
      }
    });
  }

  private async runContainerCommand(args: string[], action: string) {
    const result = await this.runner.run(args, { timeoutMs: 30_000 });
    assertCommandSuccess(result, `Docker could not ${action} the runtime container.`);
  }
}

export class SpawnDockerCommandRunner implements DockerCommandRunner {
  constructor(
    private readonly dockerBinary = "docker",
    private readonly maxOutputBytes = 2_000_000
  ) {}

  run(
    args: string[],
    options: { input?: string; timeoutMs?: number; signal?: AbortSignal } = {}
  ) {
    return new Promise<DockerCommandResult>((resolve, reject) => {
      const child = spawn(this.dockerBinary, args, {
        env: createDockerEnvironment(process.env),
        shell: false,
        stdio: ["pipe", "pipe", "pipe"]
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let truncated = false;
      let timedOut = false;
      let settled = false;

      const finish = (result: DockerCommandResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        resolve(result);
      };
      const abort = () => child.kill("SIGKILL");
      options.signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, options.timeoutMs ?? 30_000);

      child.stdout.on("data", (chunk: Buffer) => {
        const remaining = this.maxOutputBytes - stdoutBytes;
        if (remaining > 0) stdout.push(chunk.subarray(0, remaining));
        stdoutBytes += chunk.byteLength;
        truncated ||= stdoutBytes > this.maxOutputBytes;
      });
      child.stderr.on("data", (chunk: Buffer) => {
        const remaining = this.maxOutputBytes - stderrBytes;
        if (remaining > 0) stderr.push(chunk.subarray(0, remaining));
        stderrBytes += chunk.byteLength;
        truncated ||= stderrBytes > this.maxOutputBytes;
      });
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        reject(new CloudRuntimeServiceError(
          "Docker command could not be started.",
          "runtime_unavailable",
          { cause: nodeErrorCode(error) }
        ));
      });
      child.on("close", (code) => finish({
        exitCode: typeof code === "number" ? code : timedOut ? 124 : 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: redactSensitiveText(Buffer.concat(stderr).toString("utf8")),
        timedOut,
        truncated
      }));
      child.stdin.end(options.input ?? "");
    });
  }
}

function assertCommandSuccess(result: DockerCommandResult, fallbackMessage: string) {
  if (result.exitCode !== 0) {
    throw new CloudRuntimeServiceError(
      fallbackMessage,
      result.timedOut ? "runtime_request_timeout" : "runtime_execution_failed",
      { exitCode: result.exitCode, timedOut: result.timedOut, truncated: result.truncated }
    );
  }
}

function assertContainerRef(value: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value)) {
    throw new CloudRuntimeServiceError(
      "Container reference is invalid.",
      "invalid_runtime_request",
      {},
      400
    );
  }
  return value;
}

function createContainerName(workspaceId: string) {
  const safeId = workspaceId.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").slice(0, 80);
  return assertContainerRef(`seekdesk-${safeId || "workspace"}`);
}

function parseDockerLabels(value: string) {
  return Object.fromEntries(value.split(",").map((item) => {
    const separator = item.indexOf("=");
    return separator > 0
      ? [item.slice(0, separator), item.slice(separator + 1)]
      : [item, ""];
  }));
}

function createDockerEnvironment(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(Object.entries(env).filter(([key, value]) => (
    value !== undefined && !/token|secret|password|credential|auth_config/i.test(key)
  )));
}

function nodeErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "unknown";
}

function cancelledRequestError() {
  return new CloudRuntimeServiceError(
    "Runtime request was cancelled.",
    "runtime_request_cancelled"
  );
}
