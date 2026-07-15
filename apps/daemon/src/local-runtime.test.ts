import { describe, expect, it } from "vitest";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { DaemonLocalRuntime, createShellCommandInvocation } from "./local-runtime.js";

describe("daemon local runtime", () => {
  it("uses Windows cmd without /s so quoted shell commands survive", () => {
    const command = "node -e \"console.log('seekdesk approval ok')\"";
    const invocation = createShellCommandInvocation(command, "win32");

    expect(invocation).toEqual({
      file: "cmd.exe",
      args: ["/d", "/c", command],
      windowsVerbatimArguments: true
    });
    expect(invocation.args).not.toContain("/s");
  });

  it("delegates file execution to the shared runtime core", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "seekdesk-daemon-adapter-"));
    try {
      await writeFile(path.join(root, "fixture.txt"), "adapter parity", "utf8");
      const runtime = new DaemonLocalRuntime(root, "daemon-test");
      await expect(runtime.execute("coding.read_file", { path: "fixture.txt", maxBytes: 100 }))
        .resolves.toMatchObject({ path: "fixture.txt", content: "adapter parity" });
      expect(runtime.status()).toMatchObject({
        daemonId: "daemon-test",
        workspaceRoot: root,
        protocolVersion: 1
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
