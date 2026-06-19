import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type {
  CodingEditFileInput,
  CodingGitDiffInput,
  CodingGrepInput,
  CodingListFilesInput,
  CodingReadFileInput,
  CodingRunShellInput,
  CodingRunTestsInput,
  CodingToolName,
  CodingWriteFileInput
} from "@seekdesk/shared";

const execFileAsync = promisify(execFile);

const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "node_modules",
  ".turbo",
  ".cache"
]);
const maxCommandOutputBytes = 80_000;

function resolveDefaultWorkspaceRoot() {
  const cwd = process.cwd();
  const monorepoRoot = path.resolve(cwd, "../..");

  if (
    path.basename(cwd) === "api" &&
    path.basename(path.dirname(cwd)) === "apps" &&
    existsSync(path.join(monorepoRoot, "package.json"))
  ) {
    return monorepoRoot;
  }

  return cwd;
}

export class CodingRuntimeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "CodingRuntimeError";
  }
}

export interface CodingRuntimeStatus {
  status: "ok";
  service: "seekdesk-coding-runtime";
  workspaceRoot: string;
  runtimeMode: "local_runtime";
  supportedCapabilities: CodingToolName[];
  safetyBoundary: {
    readsUserFiles: true;
    writesUserFiles: true;
    executesShell: true;
    workspaceRootLocked: true;
    requiresApprovalForWritesAndCommands: true;
  };
}

export class LocalCodingRuntime {
  readonly workspaceRoot: string;

  constructor(workspaceRoot = process.env.SEEKDESK_WORKSPACE_ROOT ?? resolveDefaultWorkspaceRoot()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  status(): CodingRuntimeStatus {
    return {
      status: "ok",
      service: "seekdesk-coding-runtime",
      workspaceRoot: this.workspaceRoot,
      runtimeMode: "local_runtime",
      supportedCapabilities: [
        "coding.read_file",
        "coding.write_file",
        "coding.edit_file",
        "coding.list_files",
        "coding.grep",
        "coding.run_shell",
        "coding.git_diff",
        "coding.git_status",
        "coding.run_tests"
      ],
      safetyBoundary: {
        readsUserFiles: true,
        writesUserFiles: true,
        executesShell: true,
        workspaceRootLocked: true,
        requiresApprovalForWritesAndCommands: true
      }
    };
  }

  async execute(name: CodingToolName, input: unknown) {
    switch (name) {
      case "coding.list_files":
        return this.listFiles(input as CodingListFilesInput);
      case "coding.read_file":
        return this.readFile(input as CodingReadFileInput);
      case "coding.grep":
        return this.grep(input as CodingGrepInput);
      case "coding.git_status":
        return this.gitStatus();
      case "coding.git_diff":
        return this.gitDiff(input as CodingGitDiffInput);
      case "coding.write_file":
        return this.writeFile(input as CodingWriteFileInput);
      case "coding.edit_file":
        return this.editFile(input as CodingEditFileInput);
      case "coding.run_shell":
        return this.runShell(input as CodingRunShellInput);
      case "coding.run_tests":
        return this.runTests(input as CodingRunTestsInput);
    }
  }

  async listFiles(input: CodingListFilesInput) {
    const root = this.resolveWorkspacePath(input.path);
    const entries: Array<{
      path: string;
      type: "file" | "directory";
      size: number;
      depth: number;
    }> = [];

    await this.walk(root.absolutePath, input.maxDepth, input.maxEntries, entries, 0);

    return {
      workspaceRoot: this.workspaceRoot,
      path: root.relativePath,
      entries,
      truncated: entries.length >= input.maxEntries,
      previewOnly: false,
      externalEffects: ["none"]
    };
  }

  async readFile(input: CodingReadFileInput) {
    const resolved = this.resolveWorkspacePath(input.path);
    const fileStat = await stat(resolved.absolutePath);
    if (!fileStat.isFile()) {
      throw new CodingRuntimeError("Path is not a file.", "not_a_file", {
        path: resolved.relativePath
      });
    }
    if (fileStat.size > input.maxBytes) {
      throw new CodingRuntimeError("File exceeds maxBytes.", "file_too_large", {
        path: resolved.relativePath,
        size: fileStat.size,
        maxBytes: input.maxBytes
      });
    }

    const buffer = await readFile(resolved.absolutePath);
    assertTextBuffer(buffer, resolved.relativePath);

    return {
      path: resolved.relativePath,
      size: fileStat.size,
      content: buffer.toString("utf8"),
      previewOnly: false,
      externalEffects: ["none"]
    };
  }

  async writeFile(input: CodingWriteFileInput) {
    const resolved = this.resolveWorkspacePath(input.path);
    if (input.createDirs) {
      await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
    }

    await writeFile(resolved.absolutePath, input.content, "utf8");

    return {
      path: resolved.relativePath,
      bytesWritten: Buffer.byteLength(input.content, "utf8"),
      previewOnly: false,
      externalEffects: ["workspace.file.write"]
    };
  }

  async editFile(input: CodingEditFileInput) {
    const resolved = this.resolveWorkspacePath(input.path);
    const buffer = await readFile(resolved.absolutePath);
    assertTextBuffer(buffer, resolved.relativePath);
    const content = buffer.toString("utf8");
    const occurrences = countOccurrences(content, input.search);

    if (occurrences !== input.expectedReplacements) {
      throw new CodingRuntimeError(
        "Exact replacement count did not match expectedReplacements.",
        "replacement_count_mismatch",
        {
          path: resolved.relativePath,
          occurrences,
          expectedReplacements: input.expectedReplacements
        }
      );
    }

    await writeFile(
      resolved.absolutePath,
      content.split(input.search).join(input.replace),
      "utf8"
    );

    return {
      path: resolved.relativePath,
      replacements: occurrences,
      previewOnly: false,
      externalEffects: ["workspace.file.write"]
    };
  }

  async grep(input: CodingGrepInput) {
    const root = this.resolveWorkspacePath(input.path);
    const matches: Array<{
      path: string;
      line: number;
      text: string;
    }> = [];
    const query = input.query.toLowerCase();
    const includeRegex = input.includeGlob
      ? globToRegExp(input.includeGlob)
      : null;

    await this.walkTextFiles(root.absolutePath, async (filePath) => {
      if (matches.length >= input.maxResults) {
        return;
      }

      const relativePath = toRelativePath(this.workspaceRoot, filePath);
      if (includeRegex && !includeRegex.test(relativePath)) {
        return;
      }

      const buffer = await readFile(filePath);
      if (looksBinary(buffer)) {
        return;
      }

      const lines = buffer.toString("utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (matches.length < input.maxResults && line.toLowerCase().includes(query)) {
          matches.push({
            path: relativePath,
            line: index + 1,
            text: line.slice(0, 500)
          });
        }
      });
    });

    return {
      query: input.query,
      path: root.relativePath,
      matches,
      truncated: matches.length >= input.maxResults,
      previewOnly: false,
      externalEffects: ["none"]
    };
  }

  async gitStatus() {
    const result = await this.runBinary("git", ["status", "--short", "--branch"], 30_000);

    return {
      command: "git status --short --branch",
      ...result,
      previewOnly: false,
      externalEffects: ["none"]
    };
  }

  async gitDiff(input: CodingGitDiffInput) {
    const args = ["diff"];
    if (input.staged) {
      args.push("--staged");
    }
    if (input.path) {
      const resolved = this.resolveWorkspacePath(input.path);
      args.push("--", resolved.relativePath);
    }
    const result = await this.runBinary("git", args, 30_000);

    return {
      command: ["git", ...args].join(" "),
      ...result,
      previewOnly: false,
      externalEffects: ["none"]
    };
  }

  async runShell(input: CodingRunShellInput) {
    rejectDangerousCommand(input.command);
    const result = await this.runBinary("/bin/zsh", ["-lc", input.command], input.timeoutMs);

    return {
      command: input.command,
      ...result,
      previewOnly: false,
      externalEffects: ["workspace.command.run"]
    };
  }

  async runTests(input: CodingRunTestsInput) {
    rejectDangerousCommand(input.command);
    const result = await this.runBinary("/bin/zsh", ["-lc", input.command], input.timeoutMs);

    return {
      command: input.command,
      ...result,
      previewOnly: false,
      externalEffects: ["workspace.command.run"]
    };
  }

  private resolveWorkspacePath(inputPath: string) {
    const absolutePath = path.resolve(this.workspaceRoot, inputPath);
    const relativePath = toRelativePath(this.workspaceRoot, absolutePath);

    if (
      absolutePath !== this.workspaceRoot &&
      !absolutePath.startsWith(this.workspaceRoot + path.sep)
    ) {
      throw new CodingRuntimeError("Path escapes workspace root.", "path_outside_workspace", {
        path: inputPath
      });
    }

    if (relativePath.split(path.sep).some((part) => ignoredDirectoryNames.has(part))) {
      throw new CodingRuntimeError("Path is inside an ignored directory.", "ignored_path", {
        path: relativePath
      });
    }

    return {
      absolutePath,
      relativePath
    };
  }

  private async walk(
    directory: string,
    maxDepth: number,
    maxEntries: number,
    entries: Array<{ path: string; type: "file" | "directory"; size: number; depth: number }>,
    depth: number
  ) {
    if (depth >= maxDepth || entries.length >= maxEntries) {
      return;
    }

    const dirents = await readdir(directory, { withFileTypes: true });
    for (const dirent of dirents.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entries.length >= maxEntries || ignoredDirectoryNames.has(dirent.name)) {
        continue;
      }

      const absolutePath = path.join(directory, dirent.name);
      const fileStat = await stat(absolutePath);
      const type = dirent.isDirectory() ? "directory" : "file";
      entries.push({
        path: toRelativePath(this.workspaceRoot, absolutePath),
        type,
        size: fileStat.size,
        depth
      });

      if (dirent.isDirectory()) {
        await this.walk(absolutePath, maxDepth, maxEntries, entries, depth + 1);
      }
    }
  }

  private async walkTextFiles(directory: string, visit: (filePath: string) => Promise<void>) {
    const fileStat = await stat(directory);
    if (fileStat.isFile()) {
      await visit(directory);
      return;
    }

    const dirents = await readdir(directory, { withFileTypes: true });
    for (const dirent of dirents) {
      if (ignoredDirectoryNames.has(dirent.name)) {
        continue;
      }

      const absolutePath = path.join(directory, dirent.name);
      if (dirent.isDirectory()) {
        await this.walkTextFiles(absolutePath, visit);
      } else if (dirent.isFile()) {
        await visit(absolutePath);
      }
    }
  }

  private async runBinary(file: string, args: string[], timeoutMs: number) {
    try {
      const result = await execFileAsync(file, args, {
        cwd: this.workspaceRoot,
        env: sanitizeEnv(process.env),
        maxBuffer: maxCommandOutputBytes,
        timeout: timeoutMs
      });

      return {
        exitCode: 0,
        stdout: truncateOutput(result.stdout),
        stderr: truncateOutput(result.stderr)
      };
    } catch (error) {
      if (isExecError(error)) {
        return {
          exitCode: typeof error.code === "number" ? error.code : 1,
          stdout: truncateOutput(error.stdout ?? ""),
          stderr: truncateOutput(error.stderr ?? error.message)
        };
      }

      throw error;
    }
  }
}

function toRelativePath(root: string, absolutePath: string) {
  const relative = path.relative(root, absolutePath);
  return relative || ".";
}

function assertTextBuffer(buffer: Buffer, filePath: string) {
  if (looksBinary(buffer)) {
    throw new CodingRuntimeError("Binary files are not readable through coding tools.", "binary_file", {
      path: filePath
    });
  }
}

function looksBinary(buffer: Buffer) {
  return buffer.subarray(0, Math.min(buffer.length, 8000)).some((byte) => byte === 0);
}

function countOccurrences(content: string, search: string) {
  if (!search) {
    return 0;
  }

  return content.split(search).length - 1;
}

function globToRegExp(glob: string) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  return new RegExp("^" + escaped + "$");
}

function rejectDangerousCommand(command: string) {
  const normalized = command.toLowerCase();
  const blockedPatterns = [
    /\brm\s+-rf\s+\//,
    /\bsudo\b/,
    /\bmkfs\b/,
    /\bdd\s+if=/,
    /:\(\)\s*\{\s*:\|:/,
    /\bshutdown\b/,
    /\breboot\b/
  ];

  if (blockedPatterns.some((pattern) => pattern.test(normalized))) {
    throw new CodingRuntimeError("Command is blocked by the safety policy.", "dangerous_command", {
      command
    });
  }
}

function sanitizeEnv(env: NodeJS.ProcessEnv) {
  const sanitized: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (/key|token|secret|password|credential/i.test(key)) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function truncateOutput(value: string) {
  if (value.length <= maxCommandOutputBytes) {
    return value;
  }

  return value.slice(0, maxCommandOutputBytes) + "\n[seekdesk: output truncated]";
}

function isExecError(error: unknown): error is Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
} {
  return error instanceof Error;
}
