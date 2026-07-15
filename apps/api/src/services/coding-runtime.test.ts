import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LocalCodingRuntime } from "./coding-runtime.js";

describe("server-local coding runtime adapter", () => {
  it("returns the same canonical file result as the daemon adapter fixture", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "seekdesk-server-adapter-"));
    try {
      await writeFile(path.join(root, "fixture.txt"), "adapter parity", "utf8");
      const runtime = new LocalCodingRuntime(root);
      await expect(runtime.execute("coding.read_file", { path: "fixture.txt", maxBytes: 100 }))
        .resolves.toMatchObject({ path: "fixture.txt", content: "adapter parity" });
      expect(runtime.status()).toMatchObject({
        workspaceId: "server-local-runtime",
        workspaceRoot: root,
        runtimeMode: "server_local"
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
