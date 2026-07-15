import { randomUUID } from "node:crypto";

import {
  codingWorkspaceRecordSchema,
  codingWorkspaceSummarySchema,
  normalizeRuntimeMode,
  type CodingGitDiffInput,
  type CodingGrepInput,
  type CodingListFilesInput,
  type CodingReadFileInput,
  type CodingToolName,
  type CodingWorkspaceBrowseInput,
  type CodingWorkspaceRecord,
  type CodingWorkspaceSelectInput,
  type CodingWorkspaceSummary,
  type RuntimeMode
} from "@seekdesk/shared";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import type { CloudRuntimeClient } from "./cloud-runtime-client.js";
import { CodingRuntimeError, LocalCodingRuntime, type CodingRuntime } from "./coding-runtime.js";
import type { DaemonRegistry } from "./daemon-registry.js";

const serverLocalWorkspaceId = "server-local-runtime";
const processStartedAt = new Date().toISOString();

export interface RuntimeResolution {
  workspace: CodingWorkspaceRecord;
  runtime: CodingRuntime;
}

export interface RuntimeResolverOptions {
  repository: DailyWorkRepository;
  daemonRegistry: DaemonRegistry;
  cloudRuntimeClient: CloudRuntimeClient;
  serverLocalRuntime?: LocalCodingRuntime;
  serverLocalEnabled?: boolean;
}

export class RuntimeResolver {
  readonly serverLocalEnabled: boolean;
  private readonly repository: DailyWorkRepository;
  private readonly daemonRegistry: DaemonRegistry;
  private readonly cloudRuntimeClient: CloudRuntimeClient;
  private readonly serverLocalRuntime: LocalCodingRuntime;

  constructor(options: RuntimeResolverOptions) {
    this.repository = options.repository;
    this.daemonRegistry = options.daemonRegistry;
    this.cloudRuntimeClient = options.cloudRuntimeClient;
    this.serverLocalRuntime = options.serverLocalRuntime ?? new LocalCodingRuntime();
    this.serverLocalEnabled = options.serverLocalEnabled ?? isServerLocalEnabled();
  }

  async listWorkspaces(ownerId: string): Promise<CodingWorkspaceSummary[]> {
    await this.syncLocalDaemonWorkspaces(ownerId);
    const persisted = await this.repository.listCodingWorkspaces({ ownerId });
    const live = new Map(
      this.daemonRegistry.listWorkspaces(ownerId).map((workspace) => [workspace.workspaceId, workspace])
    );
    const merged = persisted.map((workspace) => {
      if (workspace.runtimeMode !== "local_daemon") {
        return toWorkspaceSummary(workspace);
      }
      const online = live.get(workspace.workspaceId);
      return toWorkspaceSummary(online
        ? mergeDaemonWorkspace(workspace, online)
        : { ...workspace, status: "offline", connected: false });
    });
    if (this.serverLocalEnabled) {
      merged.push(toWorkspaceSummary(this.createServerLocalWorkspace(ownerId)));
    }
    return deduplicateWorkspaces(merged).sort(compareWorkspaces);
  }

  async getWorkspace(ownerId: string, workspaceId: string) {
    const workspaces = await this.listWorkspaces(ownerId);
    return workspaces.find((workspace) => workspace.workspaceId === workspaceId) ?? null;
  }

  async getWorkspaceRecord(ownerId: string, workspaceId: string): Promise<CodingWorkspaceRecord | null> {
    if (workspaceId === serverLocalWorkspaceId && this.serverLocalEnabled) {
      return this.createServerLocalWorkspace(ownerId);
    }
    await this.syncLocalDaemonWorkspaces(ownerId);
    const persisted = await this.repository.getCodingWorkspace(ownerId, workspaceId);
    if (!persisted) {
      return null;
    }
    if (persisted.runtimeMode === "local_daemon") {
      const online = this.daemonRegistry.getWorkspace(workspaceId, ownerId);
      return online
        ? mergeDaemonWorkspace(persisted, online)
        : { ...persisted, status: "offline", connected: false };
    }
    return persisted;
  }

  async resolve(
    ownerId: string,
    workspaceId: string | undefined,
    expectedRuntimeMode?: RuntimeMode
  ): Promise<RuntimeResolution> {
    const resolvedId = workspaceId?.trim() || (
      this.serverLocalEnabled ? serverLocalWorkspaceId : ""
    );
    if (!resolvedId) {
      throw new CodingRuntimeError(
        "A workspace must be selected before using coding tools.",
        "workspace_not_found"
      );
    }
    const workspace = await this.getWorkspaceRecord(ownerId, resolvedId);
    if (!workspace || workspace.deletedAt) {
      throw new CodingRuntimeError("Workspace was not found.", "workspace_not_found", {
        workspaceId: resolvedId
      });
    }
    const runtimeMode = normalizeRuntimeMode(workspace.runtimeMode);
    if (expectedRuntimeMode && normalizeRuntimeMode(expectedRuntimeMode) !== runtimeMode) {
      throw new CodingRuntimeError(
        "The request Runtime does not match the workspace binding.",
        "session_workspace_mismatch",
        { workspaceId: resolvedId, expectedRuntimeMode, actualRuntimeMode: runtimeMode }
      );
    }
    if (runtimeMode === "local_daemon") {
      if (!this.daemonRegistry.getWorkspace(resolvedId, ownerId)) {
        throw new CodingRuntimeError(
          "The local daemon for this workspace is offline.",
          "runtime_unavailable",
          { workspaceId: resolvedId, reason: "daemon_offline" }
        );
      }
      return { workspace, runtime: this.daemonRegistry.createRuntime(resolvedId, ownerId) };
    }
    if (runtimeMode === "cloud_runtime") {
      assertWorkspaceReady(workspace);
      if (!this.cloudRuntimeClient.configured) {
        throw new CodingRuntimeError(
          "Cloud runtime is not configured.",
          "runtime_unavailable",
          { workspaceId: resolvedId }
        );
      }
      return {
        workspace,
        runtime: new CloudCodingRuntimeAdapter(workspace, this.cloudRuntimeClient)
      };
    }
    if (!this.serverLocalEnabled || resolvedId !== serverLocalWorkspaceId) {
      throw new CodingRuntimeError(
        "Server-local runtime is disabled.",
        "runtime_unavailable",
        { workspaceId: resolvedId }
      );
    }
    return { workspace, runtime: this.serverLocalRuntime };
  }

  async syncLocalDaemonWorkspaces(ownerId: string) {
    for (const daemonWorkspace of this.daemonRegistry.listWorkspaces(ownerId)) {
      const existing = await this.repository.getCodingWorkspace(ownerId, daemonWorkspace.workspaceId);
      await this.repository.upsertCodingWorkspace(
        codingWorkspaceRecordSchema.parse({
          ...existing,
          ...daemonWorkspace,
          ownerId,
          runtimeMode: "local_daemon",
          status: "ready",
          connected: true,
          rootPath: daemonWorkspace.rootPath,
          createdAt: existing?.createdAt ?? daemonWorkspace.createdAt,
          updatedAt: daemonWorkspace.updatedAt
        })
      );
    }
  }

  async health() {
    return {
      cloud: await this.cloudRuntimeClient.health(),
      localDaemon: {
        connected: this.daemonRegistry.listWorkspaces().length,
        ownerConfigured: Boolean(this.daemonRegistry.ownerId)
      },
      serverLocal: {
        enabled: this.serverLocalEnabled,
        workspaceId: this.serverLocalEnabled ? serverLocalWorkspaceId : null
      }
    };
  }

  private createServerLocalWorkspace(ownerId: string): CodingWorkspaceRecord {
    const status = this.serverLocalRuntime.status();
    return codingWorkspaceRecordSchema.parse({
      workspaceId: serverLocalWorkspaceId,
      ownerId,
      name: status.workspaceName ?? "server-local",
      runtimeMode: "server_local",
      status: "ready",
      rootPath: status.workspaceRoot,
      connected: true,
      supportedCapabilities: status.supportedCapabilities,
      safetyBoundary: {
        ...status.safetyBoundary,
        networkAccess: "restricted"
      },
      createdAt: processStartedAt,
      updatedAt: processStartedAt
    });
  }
}

class CloudCodingRuntimeAdapter implements CodingRuntime {
  constructor(
    private readonly workspace: CodingWorkspaceRecord,
    private readonly client: CloudRuntimeClient
  ) {}

  status() {
    return {
      status: "ok" as const,
      service: "seekdesk-cloud-runtime",
      workspaceId: this.workspace.workspaceId,
      workspaceName: this.workspace.name,
      workspaceRoot: "/workspace",
      workspaceSelectable: false,
      runtimeMode: "cloud_runtime" as const,
      supportedCapabilities: this.workspace.supportedCapabilities,
      safetyBoundary: {
        readsUserFiles: true as const,
        writesUserFiles: true as const,
        executesShell: true as const,
        workspaceRootLocked: true as const,
        requiresApprovalForWritesAndCommands: true as const
      }
    };
  }

  browseWorkspaceDirectories(_input: CodingWorkspaceBrowseInput) {
    void _input;
    return Promise.reject(cloudWorkspaceSelectionError());
  }

  selectWorkspace(_input: CodingWorkspaceSelectInput) {
    void _input;
    return Promise.reject(cloudWorkspaceSelectionError());
  }

  execute(name: CodingToolName, input: unknown) {
    return this.client.execute({
      requestId: `cloud-execute-${randomUUID()}`,
      ownerId: this.workspace.ownerId,
      workspaceId: this.workspace.workspaceId,
      toolName: name,
      inputJson: input
    });
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
}

function mergeDaemonWorkspace(
  persisted: CodingWorkspaceRecord,
  online: ReturnType<DaemonRegistry["listWorkspaces"]>[number]
): CodingWorkspaceRecord {
  return codingWorkspaceRecordSchema.parse({
    ...persisted,
    ...online,
    ownerId: persisted.ownerId,
    runtimeMode: "local_daemon",
    status: "ready",
    connected: true,
    rootPath: online.rootPath,
    createdAt: persisted.createdAt,
    updatedAt: online.updatedAt
  });
}

function assertWorkspaceReady(workspace: CodingWorkspaceRecord) {
  if (workspace.status !== "ready" && workspace.status !== "busy") {
    throw new CodingRuntimeError(
      `Workspace is ${workspace.status} and cannot execute tools.`,
      "runtime_not_ready",
      { workspaceId: workspace.workspaceId, status: workspace.status }
    );
  }
}

function toWorkspaceSummary(workspace: CodingWorkspaceRecord) {
  return codingWorkspaceSummarySchema.parse(workspace);
}

function deduplicateWorkspaces(workspaces: CodingWorkspaceSummary[]) {
  return [...new Map(workspaces.map((workspace) => [workspace.workspaceId, workspace])).values()];
}

function compareWorkspaces(left: CodingWorkspaceSummary, right: CodingWorkspaceSummary) {
  if (left.runtimeMode !== right.runtimeMode) {
    return left.runtimeMode.localeCompare(right.runtimeMode);
  }
  return right.updatedAt.localeCompare(left.updatedAt);
}

function cloudWorkspaceSelectionError() {
  return new CodingRuntimeError(
    "Cloud workspace root is fixed at /workspace and cannot be changed.",
    "runtime_not_ready"
  );
}

function isServerLocalEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.SEEKDESK_ENABLE_SERVER_LOCAL === "true" || env.NODE_ENV === "test";
}

export { serverLocalWorkspaceId };
