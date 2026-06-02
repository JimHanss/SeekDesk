import { describe, expect, it } from "vitest";

import { runDaemonCli } from "./cli.js";

describe("daemon cli", () => {
  it("prints health output", () => {
    const result = runDaemonCli(["health", "--workspace", "."]);
    const output = JSON.parse(result.output) as { status: string; service: string };

    expect(result.exitCode).toBe(0);
    expect(output.status).toBe("ok");
    expect(output.service).toBe("seekdesk-daemon");
  });

  it("prints help output", () => {
    const result = runDaemonCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Usage:");
  });
});
