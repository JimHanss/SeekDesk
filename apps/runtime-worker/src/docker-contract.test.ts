import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("runtime worker container contract", () => {
  it("builds on Node.js 22 and runs as the dedicated non-root user", async () => {
    const dockerfile = await readFile(
      new URL("../../../docker/runtime-worker.Dockerfile", import.meta.url),
      "utf8"
    );

    expect(dockerfile).toMatch(/FROM node:22-bookworm-slim/);
    expect(dockerfile).toContain("USER 10001:10001");
    expect(dockerfile).toContain('VOLUME ["/workspace"]');
    expect(dockerfile).toContain('CMD ["idle"]');
    expect(dockerfile).not.toMatch(/docker\.sock|--privileged/i);
  });

  it("documents the mandatory read-only and resource-limited run options", async () => {
    const securityContract = await readFile(
      new URL("../../../docker/runtime-worker-security.md", import.meta.url),
      "utf8"
    );

    for (const requiredOption of [
      "--read-only",
      "--tmpfs /tmp:rw,noexec,nosuid,size=256m",
      "--network none",
      "--cap-drop ALL",
      "--security-opt no-new-privileges=true",
      "--pids-limit 256",
      "--cpus 2",
      "--memory 4g",
      "--user 10001:10001"
    ]) {
      expect(securityContract).toContain(requiredOption);
    }
    expect(securityContract).toMatch(/不挂载 Docker socket/);
    expect(securityContract).toMatch(/不使用 `--privileged`/);
  });
});
