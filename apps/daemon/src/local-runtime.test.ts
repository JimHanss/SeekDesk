import { describe, expect, it } from "vitest";

import { createShellCommandInvocation } from "./local-runtime.js";

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
});
