import { describe, expect, it } from "vitest";
import path from "node:path";

import { runDaemonCli } from "./cli.js";

interface RuntimeStatus {
  status: string;
  service: string;
  workspaceRoot: string;
  pid: number;
  runtimeMode: string;
  previewOnly: boolean;
  supportedCapabilities: string[];
  safetyBoundary: {
    readsUserFiles: boolean;
    writesUserFiles: boolean;
    executesShell: boolean;
    startsLongRunningServices: boolean;
    opensNetworkListeners: boolean;
    workspaceRootLocked: boolean;
    requiresApprovalForWritesAndCommands: boolean;
  };
  pairing: {
    transport: string;
    apiUrl: string | null;
    tokenConfigured: boolean;
    port: number | null;
  };
}

function parseRuntimeStatus(output: string) {
  return JSON.parse(output) as RuntimeStatus;
}

describe("daemon cli", () => {
  it("prints help output", () => {
    const result = runDaemonCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Usage:");
    expect(result.output).toContain("seekdesk-daemon health [--workspace <path>]");
    expect(result.output).toContain("seekdesk-daemon start --api <url> --token <pairing-token>");
    expect(result.output).toContain("connects this machine to SeekDesk");
  });

  it("prints health output with local daemon details", () => {
    const result = runDaemonCli(["health", "--workspace", "."]);
    const output = parseRuntimeStatus(result.output);

    expect(result.exitCode).toBe(0);
    expect(output).toMatchObject({
      status: "ok",
      service: "seekdesk-daemon",
      workspaceRoot: path.resolve("."),
      pid: process.pid,
      runtimeMode: "local-daemon",
      previewOnly: false,
      supportedCapabilities: [
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
      ],
      safetyBoundary: {
        readsUserFiles: true,
        writesUserFiles: true,
        executesShell: true,
        startsLongRunningServices: false,
        opensNetworkListeners: false,
        workspaceRootLocked: true,
        requiresApprovalForWritesAndCommands: true
      },
      pairing: {
        transport: "websocket",
        apiUrl: null,
        tokenConfigured: false,
        port: null
      }
    });
  });

  it("prints start output as a paired local daemon status", () => {
    const workspace = path.join("fixtures", "daemon workspace");
    const result = runDaemonCli([
      "start",
      "--workspace",
      workspace,
      "--api",
      "http://127.0.0.1:3001",
      "--token",
      "seekdesk-local-dev",
      "--port",
      "4817"
    ]);
    const output = parseRuntimeStatus(result.output);

    expect(result.exitCode).toBe(0);
    expect(output.status).toBe("ok");
    expect(output.workspaceRoot).toBe(path.resolve(workspace));
    expect(output.previewOnly).toBe(false);
    expect(output.safetyBoundary).toMatchObject({
      readsUserFiles: true,
      writesUserFiles: true,
      executesShell: true,
      startsLongRunningServices: false,
      opensNetworkListeners: false,
      workspaceRootLocked: true,
      requiresApprovalForWritesAndCommands: true
    });
    expect(output.pairing).toEqual({
      transport: "websocket",
      apiUrl: "http://127.0.0.1:3001",
      tokenConfigured: true,
      port: 4817
    });
  });

  it("requires api and token for start", () => {
    const result = runDaemonCli(["start"]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Missing required option(s): --api, --token");
    expect(result.output).toContain("seekdesk-daemon start --api <url> --token <pairing-token>");
  });

  it("resolves workspace paths before the command", () => {
    const workspace = path.join("..", "preview-target");
    const result = runDaemonCli(["--workspace", workspace, "health"]);
    const output = parseRuntimeStatus(result.output);

    expect(result.exitCode).toBe(0);
    expect(output.workspaceRoot).toBe(path.resolve(workspace));
  });

  it("returns an error for unknown commands", () => {
    const result = runDaemonCli(["launch"]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Unknown command: launch");
    expect(result.output).toContain("Usage:");
  });
});
