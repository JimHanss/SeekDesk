#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { startDaemonClient } from "./client.js";

export interface DaemonCliResult {
  exitCode: number;
  output: string;
}

const runtimeMode = "local-daemon";
const supportedCapabilities = [
  "health",
  "workspace-root-resolution",
  "workspace-folder-picker",
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
  apiUrl?: string;
  token?: string;
  port?: number;
  daemonId?: string;
  error?: string;
}

function helpText() {
  return [
    "SeekDesk daemon",
    "",
    "Usage:",
    "  seekdesk-daemon --help",
    "  seekdesk-daemon health [--workspace <path>]",
    "  seekdesk-daemon start --api <url> --token <pairing-token> [--workspace <path>] [--port <local-port>]",
    "",
    "The daemon connects this machine to SeekDesk so coding-agent tools can operate inside the selected workspace.",
    "File writes and commands still require API session approval."
  ].join("\n");
}

function parseDaemonArgs(args: string[]): ParsedDaemonArgs {
  let command: string | undefined;
  let workspace = process.cwd();
  let apiUrl: string | undefined;
  let token: string | undefined;
  let port: number | undefined;
  let daemonId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help") {
      command = "--help";
      continue;
    }

    if (arg === "--workspace") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { command: command ?? "--help", workspaceRoot: path.resolve(workspace), error: "Missing value for --workspace." };
      }
      workspace = value;
      index += 1;
      continue;
    }

    if (arg === "--api") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { command: command ?? "--help", workspaceRoot: path.resolve(workspace), error: "Missing value for --api." };
      }
      apiUrl = value;
      index += 1;
      continue;
    }

    if (arg === "--token") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { command: command ?? "--help", workspaceRoot: path.resolve(workspace), error: "Missing value for --token." };
      }
      token = value;
      index += 1;
      continue;
    }

    if (arg === "--port") {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 65535) {
        return { command: command ?? "--help", workspaceRoot: path.resolve(workspace), error: "Invalid value for --port." };
      }
      port = value;
      index += 1;
      continue;
    }

    if (arg === "--daemon-id") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { command: command ?? "--help", workspaceRoot: path.resolve(workspace), error: "Missing value for --daemon-id." };
      }
      daemonId = value;
      index += 1;
      continue;
    }

    if (!command) {
      command = arg;
    }
  }

  return {
    command: command ?? "--help",
    workspaceRoot: path.resolve(workspace),
    ...(apiUrl ? { apiUrl } : {}),
    ...(token ? { token } : {}),
    ...(port ? { port } : {}),
    ...(daemonId ? { daemonId } : {})
  };
}

function createRuntimeStatus(status: "ok" | "preview-ready", parsed: ParsedDaemonArgs) {
  return {
    status,
    service: "seekdesk-daemon",
    workspaceRoot: parsed.workspaceRoot,
    pid: process.pid,
    runtimeMode,
    previewOnly: false,
    supportedCapabilities,
    safetyBoundary,
    pairing: {
      transport: "websocket",
      apiUrl: parsed.apiUrl ?? null,
      tokenConfigured: Boolean(parsed.token),
      port: parsed.port ?? null
    }
  };
}

export function parseDaemonCliArgs(args: string[]) {
  return parseDaemonArgs(args);
}

export function runDaemonCli(args: string[]): DaemonCliResult {
  const parsed = parseDaemonArgs(args);

  if (parsed.error) {
    return { exitCode: 1, output: `${parsed.error}\n\n${helpText()}` };
  }

  if (parsed.command === "--help" || parsed.command === "help") {
    return { exitCode: 0, output: helpText() };
  }

  if (parsed.command === "health") {
    return { exitCode: 0, output: JSON.stringify(createRuntimeStatus("ok", parsed), null, 2) };
  }

  if (parsed.command === "start") {
    const missing = [!parsed.apiUrl ? "--api" : "", !parsed.token ? "--token" : ""].filter(Boolean);
    if (missing.length > 0) {
      return { exitCode: 1, output: `Missing required option(s): ${missing.join(", ")}\n\n${helpText()}` };
    }
    return { exitCode: 0, output: JSON.stringify(createRuntimeStatus("ok", parsed), null, 2) };
  }

  return { exitCode: 1, output: `Unknown command: ${parsed.command}\n\n${helpText()}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const parsed = parseDaemonArgs(process.argv.slice(2));
  const result = runDaemonCli(process.argv.slice(2));
  console.log(result.output);

  if (result.exitCode !== 0 || parsed.command !== "start" || !parsed.apiUrl || !parsed.token) {
    process.exitCode = result.exitCode;
  } else {
    await startDaemonClient({
      apiUrl: parsed.apiUrl,
      token: parsed.token,
      workspaceRoot: parsed.workspaceRoot,
      ...(parsed.daemonId ? { daemonId: parsed.daemonId } : {})
    });
  }
}
