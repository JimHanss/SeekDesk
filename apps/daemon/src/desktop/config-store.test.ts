import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DaemonConfigStore } from "./config-store.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("DaemonConfigStore", () => {
  it("persists only a protected device token", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "seekdesk-daemon-config-"));
    directories.push(directory);
    const filePath = path.join(directory, "daemon-config.json");
    const store = new DaemonConfigStore(filePath, {
      encrypt: (value) => Buffer.from(`protected:${value}`).toString("base64"),
      decrypt: (value) => Buffer.from(value, "base64").toString("utf8").replace(/^protected:/, "")
    });
    const saved = store.save({
      version: 1,
      apiUrl: "https://desk.example.com",
      daemonId: "daemon-a",
      encryptedToken: store.encryptToken("secret-device-token"),
      tokenExpiresAt: "2027-01-01T00:00:00.000Z",
      workspaceRoot: "/workspace/project",
      autoStart: true,
      pairedAt: "2026-07-16T00:00:00.000Z"
    });

    expect(readFileSync(filePath, "utf8")).not.toContain("secret-device-token");
    expect(store.decryptToken(saved)).toBe("secret-device-token");
    expect(store.load()).toEqual(saved);
  });
});
