import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { hostname, platform } from "node:os";
import process from "node:process";
import { promisify } from "node:util";

import {
  NodeWorkspaceRuntime,
  RuntimeError,
  type RuntimeExecutionContext
} from "@seekdesk/runtime-core";
import type {
  CodingToolName,
  CodingWorkspaceBrowseInput,
  CodingWorkspaceSelectInput,
  DaemonStatus
} from "@seekdesk/shared";

const execFileAsync = promisify(execFile);

export { createShellCommandInvocation } from "@seekdesk/runtime-core";

export class DaemonRuntimeError extends RuntimeError {
  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message, code, details);
    this.name = "DaemonRuntimeError";
  }
}

export class DaemonLocalRuntime {
  private readonly core: NodeWorkspaceRuntime;
  readonly daemonId: string;

  constructor(workspaceRoot = process.cwd(), daemonId = `daemon-${randomUUID()}`) {
    this.core = new NodeWorkspaceRuntime(workspaceRoot);
    this.daemonId = daemonId;
  }

  get workspaceRoot() {
    return this.core.workspaceRoot;
  }

  status(): DaemonStatus {
    return {
      daemonId: this.daemonId,
      machineName: hostname(),
      platform: platform(),
      workspaceRoot: this.workspaceRoot,
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
      protocolVersion: 1,
      capabilityVersion: "1",
      pid: process.pid
    };
  }

  execute(name: CodingToolName, input: unknown, context: RuntimeExecutionContext = {}) {
    return this.translateError(() => this.core.execute(name, input, context));
  }

  browseWorkspaceDirectories(input: CodingWorkspaceBrowseInput) {
    return this.translateError(() => this.core.browseWorkspaceDirectories(input));
  }

  async selectWorkspace(input: CodingWorkspaceSelectInput) {
    const result = await this.translateError(() => this.core.selectWorkspace(input));
    return {
      ...(isRecord(result) ? result : {}),
      status: this.status()
    };
  }

  async pickWorkspaceDirectory() {
    const selectedPath = await pickDirectoryWithSystemDialog();
    return this.selectWorkspace({ path: selectedPath });
  }

  private async translateError<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw new DaemonRuntimeError(error.message, error.code, error.details);
      }
      throw error;
    }
  }
}

async function pickDirectoryWithSystemDialog() {
  if (process.platform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      "$dialog.Description = 'Select SeekDesk workspace'",
      "if ($dialog.ShowDialog() -eq 'OK') { [Console]::Out.Write($dialog.SelectedPath) } else { exit 2 }"
    ].join("; ");
    const result = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", script],
      { windowsHide: false }
    );
    return result.stdout.trim();
  }

  if (process.platform === "darwin") {
    const result = await execFileAsync("osascript", [
      "-e",
      "POSIX path of (choose folder with prompt \"Select SeekDesk workspace\")"
    ]);
    return result.stdout.trim();
  }

  if (existsSync("/usr/bin/zenity")) {
    const result = await execFileAsync("zenity", [
      "--file-selection",
      "--directory",
      "--title=Select SeekDesk workspace"
    ]);
    return result.stdout.trim();
  }

  throw new DaemonRuntimeError(
    "No system folder picker is available on this host.",
    "folder_picker_unavailable"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
