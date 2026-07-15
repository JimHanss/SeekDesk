import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createShellCommandInvocation,
  NodeWorkspaceRuntime,
  RuntimeError,
  sanitizeEnv
} from "./index.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("NodeWorkspaceRuntime", () => {
  it("supports files, search, exact edits, and read-only Git operations", async () => {
    const root = await createFixture();
    const runtime = new NodeWorkspaceRuntime(root);

    const tree = await runtime.execute("coding.list_files", {
      path: ".",
      maxDepth: 3,
      maxEntries: 20
    });
    expect(tree).toMatchObject({ path: ".", truncated: false });

    const search = await runtime.execute("coding.grep", {
      query: "hello",
      path: ".",
      includeGlob: "*.txt",
      maxResults: 10
    });
    expect(search).toMatchObject({
      matches: [{ path: "notes.txt", line: 1, text: "hello runtime" }]
    });

    await runtime.execute("coding.edit_file", {
      path: "notes.txt",
      search: "runtime",
      replace: "workspace",
      expectedReplacements: 1
    });
    expect(await runtime.execute("coding.read_file", { path: "notes.txt", maxBytes: 200 })).toMatchObject({
      content: "hello workspace\n"
    });

    const status = await runtime.execute("coding.git_status", {});
    expect(status).toMatchObject({ exitCode: 0, timedOut: false, truncated: false });
    const diff = await runtime.execute("coding.git_diff", { staged: false });
    expect(diff).toMatchObject({ exitCode: 0, timedOut: false });
  });

  it("blocks traversal, ignored directories, and symlinks leaving the root", async () => {
    const root = await createFixture();
    const outside = await createTemporaryRoot("seekdesk-outside-");
    await writeFile(path.join(outside, "secret.txt"), "outside", "utf8");
    await symlink(path.join(outside, "secret.txt"), path.join(root, "outside-link.txt"));
    await mkdir(path.join(root, "node_modules"));
    await writeFile(path.join(root, "node_modules", "hidden.txt"), "hidden", "utf8");
    const runtime = new NodeWorkspaceRuntime(root);

    await expect(runtime.execute("coding.read_file", { path: "../secret.txt", maxBytes: 100 }))
      .rejects.toMatchObject({ code: "path_outside_workspace" });
    await expect(runtime.execute("coding.read_file", { path: "node_modules/hidden.txt", maxBytes: 100 }))
      .rejects.toMatchObject({ code: "ignored_path" });
    await expect(runtime.execute("coding.read_file", { path: "outside-link.txt", maxBytes: 100 }))
      .rejects.toMatchObject({ code: "symlink_outside_workspace" });
  });

  it("rejects binary and oversized reads", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "binary.bin"), Buffer.from([1, 0, 2]));
    await writeFile(path.join(root, "large.txt"), "x".repeat(200), "utf8");
    const runtime = new NodeWorkspaceRuntime(root);

    await expect(runtime.execute("coding.read_file", { path: "binary.bin", maxBytes: 100 }))
      .rejects.toMatchObject({ code: "binary_file" });
    await expect(runtime.execute("coding.read_file", { path: "large.txt", maxBytes: 20 }))
      .rejects.toMatchObject({ code: "file_too_large" });
  });

  it("requires an exact replacement count", async () => {
    const root = await createFixture();
    const runtime = new NodeWorkspaceRuntime(root);
    await expect(runtime.execute("coding.edit_file", {
      path: "notes.txt",
      search: "missing",
      replace: "value",
      expectedReplacements: 1
    })).rejects.toMatchObject({ code: "replacement_count_mismatch" });
  });

  it("blocks destructive commands and reports timeout and truncation", async () => {
    const root = await createFixture();
    const runtime = new NodeWorkspaceRuntime(root, { maxCommandOutputBytes: 100 });

    await expect(runtime.execute("coding.run_shell", { command: "sudo reboot", timeoutMs: 1000 }))
      .rejects.toMatchObject({ code: "dangerous_command" });

    const timedOut = await runtime.execute("coding.run_shell", {
      command: "node -e \"setTimeout(() => {}, 5000)\"",
      timeoutMs: 1000
    });
    expect(timedOut).toMatchObject({ timedOut: true, exitCode: 124 });

    const truncated = await runtime.execute("coding.run_shell", {
      command: "node -e \"console.log('x'.repeat(1000))\"",
      timeoutMs: 5000
    });
    expect(truncated).toMatchObject({ truncated: true });
  });

  it("sanitizes secret environment names and keeps Windows quoting stable", () => {
    expect(sanitizeEnv({ PATH: "bin", API_TOKEN: "secret", DATABASE_URL: "db" })).toEqual({
      PATH: "bin",
      DATABASE_URL: "db"
    });
    expect(createShellCommandInvocation("node -e \"console.log('ok')\"", "win32")).toEqual({
      file: "cmd.exe",
      args: ["/d", "/c", "node -e \"console.log('ok')\""],
      windowsVerbatimArguments: true
    });
  });

  it("returns a stable runtime error type", () => {
    expect(new RuntimeError("failed", "runtime_execution_failed", { requestId: "r1" }))
      .toMatchObject({ name: "RuntimeError", code: "runtime_execution_failed" });
  });
});

async function createFixture() {
  const root = await createTemporaryRoot("seekdesk-runtime-");
  await writeFile(path.join(root, "notes.txt"), "hello runtime\n", "utf8");
  await runGit(root, ["init"]);
  await runGit(root, ["config", "user.email", "runtime@example.invalid"]);
  await runGit(root, ["config", "user.name", "SeekDesk Runtime"]);
  await runGit(root, ["add", "notes.txt"]);
  await runGit(root, ["commit", "-m", "fixture"]);
  return root;
}

async function createTemporaryRoot(prefix: string) {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function runGit(cwd: string, args: string[]) {
  const { execFile } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    execFile("git", args, { cwd }, (error) => error ? reject(error) : resolve());
  });
}
