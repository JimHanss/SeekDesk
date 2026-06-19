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
  };
  ipc: {
    transport: string;
    endpoint: string | null;
  };
  webSocket: {
    transport: string;
    endpoint: string | null;
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
    expect(result.output).toContain("local coding runtime boundary");
  });

  it("prints health output with local runtime details", () => {
    const result = runDaemonCli(["health", "--workspace", "."]);
    const output = parseRuntimeStatus(result.output);

    expect(result.exitCode).toBe(0);
    expect(output).toMatchObject({
      status: "ok",
      service: "seekdesk-daemon",
      workspaceRoot: path.resolve("."),
      pid: process.pid,
      runtimeMode: "local-runtime",
      previewOnly: false,
      supportedCapabilities: [
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
      ],
      safetyBoundary: {
        readsUserFiles: true,
        writesUserFiles: true,
        executesShell: true,
        startsLongRunningServices: false,
        opensNetworkListeners: false
      },
      ipc: {
        transport: "api-mediated",
        endpoint: "/api/coding"
      },
      webSocket: {
        transport: "api-mediated",
        endpoint: "/api/coding"
      }
    });
  });

  it("prints start output as a local runtime status", () => {
    const workspace = path.join("fixtures", "daemon workspace");
    const result = runDaemonCli(["start", "--workspace", workspace]);
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
      opensNetworkListeners: false
    });
    expect(output.ipc).toEqual({ transport: "api-mediated", endpoint: "/api/coding" });
    expect(output.webSocket).toEqual({ transport: "api-mediated", endpoint: "/api/coding" });
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
