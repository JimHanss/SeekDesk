import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  daemonClientMessageSchema,
  type CodingGitDiffInput,
  type CodingGrepInput,
  type CodingListFilesInput,
  type CodingReadFileInput,
  type CodingToolName,
  type CodingWorkspaceBrowseInput,
  type CodingWorkspaceSelectInput,
  type DaemonStatus,
  type DaemonWorkspace
} from "@seekdesk/shared";

import {
  CodingRuntimeError,
  type CodingRuntime,
  type CodingRuntimeExecutionContext
} from "./coding-runtime.js";
import {
  createDaemonDeviceTokenServiceFromEnv,
  type DaemonDeviceTokenService
} from "./daemon-device-token.js";

interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "message", listener: (message: Buffer) => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
}

interface ConnectedDaemon {
  socket: WebSocketLike;
  ownerId: string;
  status: DaemonStatus;
  workspace: DaemonWorkspace;
  connectedAt: string;
  lastSeenAt: string;
}

const daemonSupportedCapabilities: CodingToolName[] = [
  "coding.read_file",
  "coding.write_file",
  "coding.edit_file",
  "coding.list_files",
  "coding.grep",
  "coding.run_shell",
  "coding.git_diff",
  "coding.git_status",
  "coding.run_tests"
];

interface PendingDaemonRequest {
  workspaceId: string;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class DaemonRegistry {
  private readonly daemons = new Map<string, ConnectedDaemon>();
  private readonly workspaceToDaemon = new Map<string, string>();
  private readonly pending = new Map<string, PendingDaemonRequest>();

  constructor(
    readonly ownerId = resolveDaemonOwnerId(),
    private readonly deviceTokens: DaemonDeviceTokenService = createDaemonDeviceTokenServiceFromEnv()
  ) {}

  handleConnection(socket: WebSocketLike) {
    let daemonId: string | null = null;

    socket.send(JSON.stringify({ type: "daemon.ready", service: "seekdesk-api" }));

    socket.on("message", (message) => {
      try {
        const parsed = daemonClientMessageSchema.parse(JSON.parse(message.toString()));

        if (parsed.type === "daemon.register") {
          const ownerId = validatePairingToken(
            parsed.token,
            parsed.status.daemonId,
            this.ownerId,
            this.deviceTokens
          );
          daemonId = parsed.status.daemonId;
          const workspace = createWorkspace(parsed.status);
          this.daemons.set(daemonId, {
            socket,
            ownerId,
            status: parsed.status,
            workspace,
            connectedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString()
          });
          this.workspaceToDaemon.set(workspace.workspaceId, daemonId);
          socket.send(JSON.stringify({ type: "daemon.registered", workspace }));
          return;
        }

        if (parsed.type === "daemon.heartbeat") {
          if (daemonId) {
            const current = this.daemons.get(daemonId);
            if (current) {
              const nextStatus = parsed.status ?? current.status;
              this.updateDaemonStatus(daemonId, nextStatus);
            }
          }
          return;
        }

        const pending = this.pending.get(parsed.requestId);
        if (!pending) {
          return;
        }
        clearTimeout(pending.timer);
        this.pending.delete(parsed.requestId);

        if (parsed.ok) {
          pending.resolve(parsed.result);
        } else {
          pending.reject(
            new CodingRuntimeError(
              parsed.error?.message ?? "Daemon request failed.",
              parsed.error?.code ?? "daemon_request_failed",
              parsed.error?.details ?? {}
            )
          );
        }
      } catch (error) {
        socket.send(JSON.stringify({
          type: "daemon.error",
          error: error instanceof Error ? error.message : String(error)
        }));
      }
    });

    socket.on("close", () => {
      if (daemonId) {
        this.removeDaemon(daemonId);
      }
    });

    socket.on("error", () => {
      if (daemonId) {
        this.removeDaemon(daemonId);
      }
    });
  }

  listWorkspaces(ownerId?: string) {
    return [...this.daemons.values()]
      .filter((client) => !ownerId || client.ownerId === ownerId)
      .map((client) => ({
        ...client.workspace,
        connected: true,
        updatedAt: client.lastSeenAt
      }));
  }

  getWorkspace(workspaceId: string | undefined, ownerId?: string) {
    if (!workspaceId) {
      return this.listWorkspaces(ownerId)[0] ?? null;
    }

    const daemonId = this.workspaceToDaemon.get(workspaceId);
    const client = daemonId ? this.daemons.get(daemonId) : undefined;
    if (!client || (ownerId && client.ownerId !== ownerId)) {
      return null;
    }
    return client.workspace;
  }

  createRuntime(workspaceId: string, ownerId = this.ownerId): CodingRuntime {
    return new LocalDaemonRuntimeAdapter(this, workspaceId, ownerId);
  }

  async requestWorkspace(workspaceId: string, command: "workspace.browse" | "workspace.select" | "workspace.pick", payload: unknown) {
    const result = await this.request(workspaceId, command, payload);
    if (command === "workspace.select" || command === "workspace.pick") {
      const daemonId = this.workspaceToDaemon.get(workspaceId);
      const status = extractDaemonStatus(result);
      if (daemonId && status) {
        this.updateDaemonStatus(daemonId, status);
        const workspace = this.daemons.get(daemonId)?.workspace;
        return { ...(isRecord(result) ? result : {}), workspace };
      }
    }
    return result;
  }

  async requestTool(
    workspaceId: string,
    toolName: CodingToolName,
    input: unknown,
    requestId?: string
  ) {
    return this.request(workspaceId, "tool.execute", { toolName, input }, requestId);
  }

  private request(
    workspaceId: string,
    command: string,
    payload: unknown,
    suppliedRequestId?: string
  ) {
    const daemonId = this.workspaceToDaemon.get(workspaceId);
    const client = daemonId ? this.daemons.get(daemonId) : undefined;

    if (!client) {
      throw new CodingRuntimeError("No local daemon is connected for this workspace.", "runtime_unavailable", { workspaceId });
    }

    const requestId = suppliedRequestId ?? `daemon-request-${randomUUID()}`;
    if (this.pending.has(requestId)) {
      throw new CodingRuntimeError(
        "A Runtime request with this requestId is already running.",
        "runtime_request_conflict",
        { requestId, workspaceId }
      );
    }
    const timeoutMs = command === "tool.execute" ? 125_000 : 30_000;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        client.socket.send(JSON.stringify({
          type: "daemon.request",
          requestId: `cancel-${requestId}`,
          protocolVersion: 1,
          command: "request.cancel",
          payload: { requestId },
          timeoutMs: 5_000
        }));
        reject(new CodingRuntimeError("Daemon request timed out.", "daemon_request_timeout", { workspaceId, command }));
      }, timeoutMs);

      this.pending.set(requestId, { workspaceId, resolve, reject, timer });
      client.socket.send(JSON.stringify({
        type: "daemon.request",
        requestId,
        protocolVersion: 1,
        command,
        payload,
        timeoutMs
      }));
    });
  }

  private updateDaemonStatus(daemonId: string, status: DaemonStatus) {
    const current = this.daemons.get(daemonId);
    if (!current) {
      return;
    }

    this.workspaceToDaemon.delete(current.workspace.workspaceId);
    const workspace = createWorkspace(status);
    this.daemons.set(daemonId, {
      ...current,
      status,
      workspace,
      lastSeenAt: new Date().toISOString()
    });
    this.workspaceToDaemon.set(workspace.workspaceId, daemonId);
  }

  private removeDaemon(daemonId: string) {
    const current = this.daemons.get(daemonId);
    if (current) {
      this.workspaceToDaemon.delete(current.workspace.workspaceId);
      for (const [requestId, pending] of this.pending) {
        if (pending.workspaceId !== current.workspace.workspaceId) {
          continue;
        }
        clearTimeout(pending.timer);
        pending.reject(new CodingRuntimeError(
          "The local daemon disconnected while handling the request.",
          "runtime_unavailable",
          { workspaceId: pending.workspaceId, reason: "daemon_disconnected" }
        ));
        this.pending.delete(requestId);
      }
    }
    this.daemons.delete(daemonId);
  }
}

export class LocalDaemonRuntimeAdapter implements CodingRuntime {
  constructor(
    private readonly registry: DaemonRegistry,
    private readonly workspaceId: string,
    private readonly ownerId: string
  ) {}

  status() {
    const workspace = this.requireWorkspace();
    return {
      status: "ok" as const,
      service: "seekdesk-daemon",
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.name,
      workspaceRoot: workspace.rootPath,
      workspaceSelectable: true as const,
      runtimeMode: "local_daemon" as const,
      supportedCapabilities: daemonSupportedCapabilities,
      safetyBoundary: {
        readsUserFiles: true as const,
        writesUserFiles: true as const,
        executesShell: true as const,
        workspaceRootLocked: true as const,
        requiresApprovalForWritesAndCommands: true as const
      }
    };
  }

  browseWorkspaceDirectories(input: CodingWorkspaceBrowseInput) {
    return this.registry.requestWorkspace(this.workspaceId, "workspace.browse", input);
  }

  selectWorkspace(input: CodingWorkspaceSelectInput) {
    return this.registry.requestWorkspace(this.workspaceId, "workspace.select", input);
  }

  pickWorkspaceDirectory() {
    return this.registry.requestWorkspace(this.workspaceId, "workspace.pick", {});
  }

  execute(name: CodingToolName, input: unknown, context?: CodingRuntimeExecutionContext) {
    return this.registry.requestTool(this.workspaceId, name, input, context?.requestId);
  }

  listFiles(input: CodingListFilesInput) {
    return this.execute("coding.list_files", input);
  }

  readFile(input: CodingReadFileInput) {
    return this.execute("coding.read_file", input);
  }

  grep(input: CodingGrepInput) {
    return this.execute("coding.grep", input);
  }

  gitStatus() {
    return this.execute("coding.git_status", {});
  }

  gitDiff(input: CodingGitDiffInput) {
    return this.execute("coding.git_diff", input);
  }

  private requireWorkspace() {
    const workspace = this.registry.getWorkspace(this.workspaceId, this.ownerId);
    if (!workspace) {
      throw new CodingRuntimeError("No local daemon is connected for this workspace.", "runtime_unavailable", { workspaceId: this.workspaceId });
    }
    return workspace;
  }
}

function validatePairingToken(
  token: string,
  daemonId: string,
  legacyOwnerId: string,
  deviceTokens: DaemonDeviceTokenService
) {
  const expected = process.env.SEEKDESK_DAEMON_PAIRING_TOKEN?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "seekdesk-local-dev");
  if (expected && secureTokenEqual(token, expected)) {
    return legacyOwnerId;
  }
  try {
    return deviceTokens.verify(token, daemonId).ownerId;
  } catch {
    throw new CodingRuntimeError("Invalid daemon pairing token.", "invalid_pairing_token");
  }
}

function secureTokenEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveDaemonOwnerId(env: NodeJS.ProcessEnv = process.env) {
  return env.SEEKDESK_DAEMON_OWNER_ID?.trim() ||
    env.SEEKDESK_DEV_USER_ID?.trim() ||
    "local-dev-user";
}

function createWorkspace(status: DaemonStatus): DaemonWorkspace {
  const rootPath = status.workspaceRoot;
  const now = new Date().toISOString();
  return {
    workspaceId: createWorkspaceId(status.daemonId, rootPath),
    daemonId: status.daemonId,
    name: getWorkspaceLeafName(rootPath),
    rootPath,
    runtimeMode: "local_daemon",
    connected: true,
    status: "ready",
    platform: status.platform,
    machineName: status.machineName,
    supportedCapabilities: status.supportedCapabilities,
    protocolVersion: status.protocolVersion,
    capabilityVersion: status.capabilityVersion,
    createdAt: now,
    updatedAt: now
  };
}

function getWorkspaceLeafName(rootPath: string) {
  const normalized = rootPath.replace(/[\\/]+$/g, "");
  const parts = normalized.split(/[\\/]+/).filter(Boolean);

  return parts.at(-1) ?? rootPath;
}

function createWorkspaceId(daemonId: string, rootPath: string) {
  const hash = createHash("sha256").update(`${daemonId}:${rootPath}`).digest("hex").slice(0, 12);
  const name = getWorkspaceLeafName(rootPath).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "workspace";
  return `local-${name}-${hash}`;
}

function extractDaemonStatus(value: unknown): DaemonStatus | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const status = (value as { status?: unknown }).status;
  if (!status || typeof status !== "object") {
    return null;
  }
  return status as DaemonStatus;
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
