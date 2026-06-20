import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

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

import { CodingRuntimeError, type CodingRuntime } from "./coding-runtime.js";

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
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class DaemonRegistry {
  private readonly daemons = new Map<string, ConnectedDaemon>();
  private readonly workspaceToDaemon = new Map<string, string>();
  private readonly pending = new Map<string, PendingDaemonRequest>();

  handleConnection(socket: WebSocketLike) {
    let daemonId: string | null = null;

    socket.send(JSON.stringify({ type: "daemon.ready", service: "seekdesk-api" }));

    socket.on("message", (message) => {
      try {
        const parsed = daemonClientMessageSchema.parse(JSON.parse(message.toString()));

        if (parsed.type === "daemon.register") {
          validatePairingToken(parsed.token);
          daemonId = parsed.status.daemonId;
          const workspace = createWorkspace(parsed.status);
          this.daemons.set(daemonId, {
            socket,
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

  listWorkspaces() {
    return [...this.daemons.values()].map((client) => ({
      ...client.workspace,
      connected: true,
      updatedAt: client.lastSeenAt
    }));
  }

  getWorkspace(workspaceId: string | undefined) {
    if (!workspaceId) {
      return this.listWorkspaces()[0] ?? null;
    }

    const daemonId = this.workspaceToDaemon.get(workspaceId);
    return daemonId ? this.daemons.get(daemonId)?.workspace ?? null : null;
  }

  createRuntime(workspaceId: string): CodingRuntime {
    return new DaemonBackedCodingRuntime(this, workspaceId);
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

  async requestTool(workspaceId: string, toolName: CodingToolName, input: unknown) {
    return this.request(workspaceId, "tool.execute", { toolName, input });
  }

  private request(workspaceId: string, command: string, payload: unknown) {
    const daemonId = this.workspaceToDaemon.get(workspaceId);
    const client = daemonId ? this.daemons.get(daemonId) : undefined;

    if (!client) {
      throw new CodingRuntimeError("No local daemon is connected for this workspace.", "runtime_unavailable", { workspaceId });
    }

    const requestId = `daemon-request-${randomUUID()}`;
    const timeoutMs = command === "tool.execute" ? 125_000 : 30_000;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new CodingRuntimeError("Daemon request timed out.", "daemon_request_timeout", { workspaceId, command }));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timer });
      client.socket.send(JSON.stringify({ type: "daemon.request", requestId, command, payload }));
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
    }
    this.daemons.delete(daemonId);
  }
}

class DaemonBackedCodingRuntime implements CodingRuntime {
  constructor(private readonly registry: DaemonRegistry, private readonly workspaceId: string) {}

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

  execute(name: CodingToolName, input: unknown) {
    return this.registry.requestTool(this.workspaceId, name, input);
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
    const workspace = this.registry.getWorkspace(this.workspaceId);
    if (!workspace) {
      throw new CodingRuntimeError("No local daemon is connected for this workspace.", "runtime_unavailable", { workspaceId: this.workspaceId });
    }
    return workspace;
  }
}

function validatePairingToken(token: string) {
  const expected = process.env.SEEKDESK_DAEMON_PAIRING_TOKEN?.trim() || "seekdesk-local-dev";
  if (token !== expected) {
    throw new CodingRuntimeError("Invalid daemon pairing token.", "invalid_pairing_token");
  }
}

function createWorkspace(status: DaemonStatus): DaemonWorkspace {
  const rootPath = status.workspaceRoot;
  return {
    workspaceId: createWorkspaceId(status.daemonId, rootPath),
    daemonId: status.daemonId,
    name: path.basename(rootPath) || rootPath,
    rootPath,
    runtimeMode: "local_daemon",
    connected: true,
    platform: status.platform,
    machineName: status.machineName,
    updatedAt: new Date().toISOString()
  };
}

function createWorkspaceId(daemonId: string, rootPath: string) {
  const hash = createHash("sha256").update(`${daemonId}:${rootPath}`).digest("hex").slice(0, 12);
  const name = path.basename(rootPath).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "workspace";
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
