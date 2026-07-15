import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { NodeWorkspaceRuntime, RuntimeError } from "@seekdesk/runtime-core";
import type {
  CodingGitDiffInput,
  CodingGrepInput,
  CodingListFilesInput,
  CodingReadFileInput,
  CodingToolName,
  CodingWorkspaceBrowseInput,
  CodingWorkspaceSelectInput
} from "@seekdesk/shared";

function resolveDefaultWorkspaceRoot() {
  const cwd = process.cwd();
  const monorepoRoot = path.resolve(cwd, "../..");
  if (
    path.basename(cwd) === "api" &&
    path.basename(path.dirname(cwd)) === "apps" &&
    existsSync(path.join(monorepoRoot, "package.json"))
  ) {
    return monorepoRoot;
  }
  return cwd;
}

export class CodingRuntimeError extends RuntimeError {
  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message, code, details);
    this.name = "CodingRuntimeError";
  }
}

export interface CodingRuntimeStatus {
  status: "ok";
  service: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceRoot: string;
  workspaceSelectable: boolean;
  runtimeMode: "local_daemon" | "cloud_runtime" | "server_local";
  supportedCapabilities: CodingToolName[];
  safetyBoundary: {
    readsUserFiles: true;
    writesUserFiles: true;
    executesShell: true;
    workspaceRootLocked: true;
    requiresApprovalForWritesAndCommands: true;
  };
}

export interface CodingRuntime {
  status(): CodingRuntimeStatus;
  browseWorkspaceDirectories(input: CodingWorkspaceBrowseInput): Promise<unknown>;
  selectWorkspace(input: CodingWorkspaceSelectInput): Promise<unknown>;
  pickWorkspaceDirectory?(): Promise<unknown>;
  execute(name: CodingToolName, input: unknown): Promise<unknown>;
  listFiles(input: CodingListFilesInput): Promise<unknown>;
  readFile(input: CodingReadFileInput): Promise<unknown>;
  grep(input: CodingGrepInput): Promise<unknown>;
  gitStatus(): Promise<unknown>;
  gitDiff(input: CodingGitDiffInput): Promise<unknown>;
}

export class LocalCodingRuntime implements CodingRuntime {
  private readonly core: NodeWorkspaceRuntime;

  constructor(workspaceRoot = process.env.SEEKDESK_WORKSPACE_ROOT ?? resolveDefaultWorkspaceRoot()) {
    this.core = new NodeWorkspaceRuntime(workspaceRoot);
  }

  get workspaceRoot() {
    return this.core.workspaceRoot;
  }

  status(): CodingRuntimeStatus {
    return {
      status: "ok",
      service: "seekdesk-coding-runtime",
      workspaceId: "server-local-runtime",
      workspaceName: path.basename(this.workspaceRoot) || "server-local",
      workspaceRoot: this.workspaceRoot,
      workspaceSelectable: true,
      runtimeMode: "server_local",
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
      ],
      safetyBoundary: {
        readsUserFiles: true,
        writesUserFiles: true,
        executesShell: true,
        workspaceRootLocked: true,
        requiresApprovalForWritesAndCommands: true
      }
    };
  }

  browseWorkspaceDirectories(input: CodingWorkspaceBrowseInput) {
    return this.translateError(() => this.core.browseWorkspaceDirectories(input));
  }

  async selectWorkspace(input: CodingWorkspaceSelectInput) {
    const result = await this.translateError(() => this.core.selectWorkspace(input));
    return {
      ...(isRecord(result) ? result : {}),
      workspace: this.status()
    };
  }

  execute(name: CodingToolName, input: unknown) {
    return this.translateError(() => this.core.execute(name, input));
  }

  listFiles(input: CodingListFilesInput) {
    return this.translateError(() => this.core.listFiles(input));
  }

  readFile(input: CodingReadFileInput) {
    return this.translateError(() => this.core.readFile(input));
  }

  grep(input: CodingGrepInput) {
    return this.translateError(() => this.core.grep(input));
  }

  gitStatus() {
    return this.translateError(() => this.core.gitStatus());
  }

  gitDiff(input: CodingGitDiffInput) {
    return this.translateError(() => this.core.gitDiff(input));
  }

  private async translateError<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw new CodingRuntimeError(error.message, error.code, error.details);
      }
      throw error;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
