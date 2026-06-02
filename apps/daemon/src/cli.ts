#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export interface DaemonCliResult {
  exitCode: number;
  output: string;
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
    "The daemon is currently a scaffold. File and shell tools will be added after review."
  ].join("\n");
}

function readOption(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function resolveWorkspace(args: string[]) {
  const provided = readOption(args, "--workspace");
  return path.resolve(provided ?? process.cwd());
}

export function runDaemonCli(args: string[]): DaemonCliResult {
  const command = args.find((arg) => !arg.startsWith("--")) ?? "--help";

  if (command === "--help" || command === "help") {
    return {
      exitCode: 0,
      output: helpText()
    };
  }

  if (command === "health") {
    return {
      exitCode: 0,
      output: JSON.stringify(
        {
          status: "ok",
          service: "seekdesk-daemon",
          workspaceRoot: resolveWorkspace(args)
        },
        null,
        2
      )
    };
  }

  if (command === "start") {
    return {
      exitCode: 0,
      output: JSON.stringify(
        {
          status: "planned",
          service: "seekdesk-daemon",
          workspaceRoot: resolveWorkspace(args),
          message: "WebSocket daemon runtime will be implemented in Milestone 1."
        },
        null,
        2
      )
    };
  }

  return {
    exitCode: 1,
    output: `Unknown command: ${command}\n\n${helpText()}`
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDaemonCli(process.argv.slice(2));
  console.log(result.output);
  process.exitCode = result.exitCode;
}
