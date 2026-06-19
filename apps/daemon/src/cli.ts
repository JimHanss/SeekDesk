#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export interface DaemonCliResult {
  exitCode: number;
  output: string;
}

const runtimeMode = "local-runtime";
const supportedCapabilities = [
  "health",
  "workspace-root-resolution",
  "coding.list_files",
  "coding.read_file",
  "coding.grep",
  "coding.git_status",
  "coding.git_diff",
  "coding.write_file",
  "coding.edit_file",
  "coding.run_shell",
  "coding.run_tests"
] as const;
const safetyBoundary = {
  readsUserFiles: true,
  writesUserFiles: true,
  executesShell: true,
  startsLongRunningServices: false,
  opensNetworkListeners: false,
  workspaceRootLocked: true,
  requiresApprovalForWritesAndCommands: true
} as const;

interface ParsedDaemonArgs {
  command: string;
  workspaceRoot: string;
  error?: string;
}

function helpText() {
  return [
    "SeekDesk daemon",
    "",
    "Usage:",
    "  seekdesk-daemon --help",
    "  seekdesk-daemon health [--workspace <path>]",
    "  seekdesk-daemon start [--workspace <path>]",
    "",
    "The daemon reports a local coding runtime boundary. File writes and commands require API session approval."
  ].join("\n");
}

function parseDaemonArgs(args: string[]): ParsedDaemonArgs {
  let command: string | undefined;
  let workspace = process.cwd();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help") {
      command = "--help";
      continue;
    }

    if (arg === "--workspace") {
      const workspaceArg = args[index + 1];
      if (!workspaceArg || workspaceArg.startsWith("--")) {
        return {
          command: command ?? "--help",
          workspaceRoot: path.resolve(workspace),
          error: "Missing value for --workspace."
        };
      }

      workspace = workspaceArg;
      index += 1;
      continue;
    }

    if (!command) {
      command = arg;
    }
  }

  return {
    command: command ?? "--help",
    workspaceRoot: path.resolve(workspace)
  };
}

function createRuntimeStatus(status: "ok" | "preview-ready", workspaceRoot: string) {
  return {
    status,
    service: "seekdesk-daemon",
    workspaceRoot,
    pid: process.pid,
    runtimeMode,
    previewOnly: false,
    supportedCapabilities,
    safetyBoundary,
    ipc: {
      transport: "api-mediated",
      endpoint: "/api/coding"
    },
    webSocket: {
      transport: "api-mediated",
      endpoint: "/api/coding"
    }
  };
}

export function runDaemonCli(args: string[]): DaemonCliResult {
  const parsed = parseDaemonArgs(args);

  if (parsed.error) {
    return {
      exitCode: 1,
      output: `${parsed.error}\n\n${helpText()}`
    };
  }

  if (parsed.command === "--help" || parsed.command === "help") {
    return {
      exitCode: 0,
      output: helpText()
    };
  }

  if (parsed.command === "health") {
    return {
      exitCode: 0,
      output: JSON.stringify(createRuntimeStatus("ok", parsed.workspaceRoot), null, 2)
    };
  }

  if (parsed.command === "start") {
    return {
      exitCode: 0,
      output: JSON.stringify(
        createRuntimeStatus("ok", parsed.workspaceRoot),
        null,
        2
      )
    };
  }

  return {
    exitCode: 1,
    output: `Unknown command: ${parsed.command}\n\n${helpText()}`
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDaemonCli(process.argv.slice(2));
  console.log(result.output);
  process.exitCode = result.exitCode;
}
