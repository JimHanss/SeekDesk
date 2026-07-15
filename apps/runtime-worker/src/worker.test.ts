import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { promisify } from "node:util";

import type { CodingToolName } from "@seekdesk/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RuntimeWorker,
  handleRuntimeWorkerLine,
  serveRuntimeWorker
} from "./worker.js";

const execFileAsync = promisify(execFile);
const workspaceId = "cloud-test-workspace";
let workspaceRoot = "";

beforeEach(async () => {
  workspaceRoot = await mkdtemp(join(tmpdir(), "seekdesk-runtime-worker-"));
  await mkdir(join(workspaceRoot, "src"), { recursive: true });
  await writeFile(join(workspaceRoot, "README.md"), "SeekDesk worker fixture\n", "utf8");
  await writeFile(join(workspaceRoot, "src", "index.ts"), "export const value = 'before';\n", "utf8");
  await writeFile(
    join(workspaceRoot, "package.json"),
    JSON.stringify({
      name: "runtime-worker-fixture",
      private: true,
      scripts: { test: "node -e \"console.log('fixture-tests-ok')\"" }
    }),
    "utf8"
  );
  await execFileAsync("git", ["init"], { cwd: workspaceRoot });
  await execFileAsync("git", ["config", "user.email", "worker@example.test"], {
    cwd: workspaceRoot
  });
  await execFileAsync("git", ["config", "user.name", "Runtime Worker"], {
    cwd: workspaceRoot
  });
  await execFileAsync("git", ["add", "."], { cwd: workspaceRoot });
  await execFileAsync("git", ["commit", "-m", "fixture"], { cwd: workspaceRoot });
});

afterEach(async () => {
  await rm(workspaceRoot, { force: true, recursive: true });
});

describe("RuntimeWorker", () => {
  it("executes the complete coding tool fixture inside one fixed workspace", async () => {
    const worker = createWorker();

    expect(await execute(worker, "coding.list_files", {
      path: ".",
      maxDepth: 3,
      maxEntries: 100
    })).toMatchObject({ ok: true });
    expect(await execute(worker, "coding.read_file", {
      path: "README.md",
      maxBytes: 10_000
    })).toMatchObject({
      ok: true,
      result: { content: expect.stringContaining("SeekDesk worker fixture") }
    });
    expect(await execute(worker, "coding.grep", {
      query: "worker fixture",
      path: ".",
      maxResults: 20
    })).toMatchObject({
      ok: true,
      result: { matches: expect.arrayContaining([expect.objectContaining({ path: "README.md" })]) }
    });
    expect(await execute(worker, "coding.git_status", {})).toMatchObject({ ok: true });

    expect(await execute(worker, "coding.write_file", {
      path: "src/generated.ts",
      content: "export const generated = true;\n",
      createDirs: true
    })).toMatchObject({ ok: true });
    expect(await execute(worker, "coding.edit_file", {
      path: "src/index.ts",
      search: "before",
      replace: "after",
      expectedReplacements: 1
    })).toMatchObject({ ok: true });
    expect(await readFile(join(workspaceRoot, "src", "index.ts"), "utf8")).toContain("after");

    expect(await execute(worker, "coding.git_diff", { staged: false })).toMatchObject({
      ok: true,
      result: { stdout: expect.stringContaining("after") }
    });
    expect(await execute(worker, "coding.run_shell", {
      command: "node -e \"console.log('worker-shell-ok')\"",
      timeoutMs: 10_000
    })).toMatchObject({
      ok: true,
      result: { stdout: expect.stringContaining("worker-shell-ok"), exitCode: 0 }
    });
    expect(await execute(worker, "coding.run_tests", {
      command: "npm test",
      timeoutMs: 30_000
    })).toMatchObject({
      ok: true,
      result: { stdout: expect.stringContaining("fixture-tests-ok"), exitCode: 0 }
    });
  });

  it("rejects invalid JSON, schema violations, unknown tools, and workspace mismatches", async () => {
    const worker = createWorker();

    await expect(handleRuntimeWorkerLine(worker, "{invalid"))
      .resolves.toMatchObject({ ok: false, error: { code: "invalid_json" } });
    await expect(handleRuntimeWorkerLine(worker, JSON.stringify({
      requestId: "bad-tool",
      ownerId: "owner-a",
      workspaceId,
      toolName: "coding.destroy_everything",
      inputJson: {}
    }))).resolves.toMatchObject({
      ok: false,
      requestId: "bad-tool",
      error: { code: "runtime_tool_unsupported" }
    });
    await expect(handleRuntimeWorkerLine(worker, JSON.stringify({
      requestId: "bad-input",
      ownerId: "owner-a",
      workspaceId,
      toolName: "coding.read_file",
      inputJson: { path: "README.md", maxBytes: 0 }
    }))).resolves.toMatchObject({
      ok: false,
      requestId: "bad-input",
      error: { code: "invalid_runtime_request" }
    });
    await expect(handleRuntimeWorkerLine(worker, JSON.stringify({
      requestId: "wrong-workspace",
      ownerId: "owner-a",
      workspaceId: "another-workspace",
      toolName: "coding.read_file",
      inputJson: { path: "README.md", maxBytes: 1000 }
    }))).resolves.toMatchObject({
      ok: false,
      error: { code: "runtime_workspace_mismatch" }
    });
  });

  it("enforces request timeout, cancellation, and transport size limits", async () => {
    const timeoutWorker = new RuntimeWorker({
      workspaceRoot,
      workspaceId,
      requestTimeoutMs: 25
    });
    await expect(execute(timeoutWorker, "coding.run_shell", {
      command: "node -e \"setTimeout(() => {}, 5000)\"",
      timeoutMs: 10_000
    })).resolves.toMatchObject({
      ok: false,
      error: { code: "runtime_request_timeout" }
    });

    const worker = createWorker();
    const running = execute(worker, "coding.run_shell", {
      command: "node -e \"setTimeout(() => {}, 5000)\"",
      timeoutMs: 10_000
    }, "cancel-me");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(worker.cancel("cancel-me")).toBe(true);
    await expect(running).resolves.toMatchObject({
      ok: false,
      error: { code: "runtime_request_cancelled" }
    });

    const inputLimited = new RuntimeWorker({
      workspaceRoot,
      workspaceId,
      maxInputBytes: 20
    });
    await expect(handleRuntimeWorkerLine(inputLimited, JSON.stringify({ value: "x".repeat(100) })))
      .resolves.toMatchObject({ ok: false, error: { code: "runtime_input_too_large" } });

    const outputLimited = new RuntimeWorker({
      workspaceRoot,
      workspaceId,
      maxOutputBytes: 100
    });
    await expect(execute(outputLimited, "coding.read_file", {
      path: "README.md",
      maxBytes: 10_000
    })).resolves.toMatchObject({
      ok: false,
      error: { code: "runtime_output_too_large" }
    });
  });

  it("serves newline-delimited requests with requestId-correlated responses", async () => {
    const output = new PassThrough();
    let content = "";
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      content += chunk;
    });

    await serveRuntimeWorker(
      createWorker(),
      Readable.from([
        `${JSON.stringify({
          requestId: "ndjson-read",
          ownerId: "owner-a",
          workspaceId,
          toolName: "coding.read_file",
          inputJson: { path: "README.md", maxBytes: 10_000 }
        })}\n`
      ]),
      output
    );

    expect(JSON.parse(content.trim())).toMatchObject({
      ok: true,
      requestId: "ndjson-read",
      result: { content: expect.stringContaining("SeekDesk worker fixture") }
    });
  });
});

function createWorker() {
  return new RuntimeWorker({ workspaceRoot, workspaceId });
}

function execute(
  worker: RuntimeWorker,
  toolName: CodingToolName,
  inputJson: unknown,
  requestId = `request-${toolName}`
) {
  return handleRuntimeWorkerLine(worker, JSON.stringify({
    requestId,
    ownerId: "owner-a",
    workspaceId,
    toolName,
    inputJson
  }));
}
