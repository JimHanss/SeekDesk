import { execFile } from "node:child_process";
import { access, lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import {
  codingEditFileInputSchema,
  codingGitDiffInputSchema,
  codingGitStatusInputSchema,
  codingGrepInputSchema,
  codingListFilesInputSchema,
  codingReadFileInputSchema,
  codingRunShellInputSchema,
  codingRunTestsInputSchema,
  codingWriteFileInputSchema,
  type CodingEditFileInput,
  type CodingGitDiffInput,
  type CodingGrepInput,
  type CodingListFilesInput,
  type CodingReadFileInput,
  type CodingRunShellInput,
  type CodingRunTestsInput,
  type CodingToolName,
  type CodingWorkspaceBrowseInput,
  type CodingWorkspaceSelectInput,
  type CodingWriteFileInput
} from "@seekdesk/shared";

const execFileAsync = promisify(execFile);

export const defaultIgnoredDirectoryNames = new Set([
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "node_modules",
  ".turbo",
  ".cache"
]);

export interface RuntimeExecutionContext {
  requestId?: string;
  signal?: AbortSignal;
}

export interface RuntimeCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
}

export interface WorkspaceRuntime {
  readonly workspaceRoot: string;
  execute(name: CodingToolName, input: unknown, context?: RuntimeExecutionContext): Promise<unknown>;
  browseWorkspaceDirectories(input: CodingWorkspaceBrowseInput): Promise<unknown>;
  selectWorkspace(input: CodingWorkspaceSelectInput): Promise<unknown>;
  listFiles(input: CodingListFilesInput): Promise<unknown>;
  readFile(input: CodingReadFileInput): Promise<unknown>;
  grep(input: CodingGrepInput): Promise<unknown>;
  gitStatus(context?: RuntimeExecutionContext): Promise<unknown>;
  gitDiff(input: CodingGitDiffInput, context?: RuntimeExecutionContext): Promise<unknown>;
}

export interface NodeWorkspaceRuntimeOptions {
  ignoredDirectoryNames?: Iterable<string>;
  maxCommandOutputBytes?: number;
  maxSearchFiles?: number;
}

export class RuntimeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "RuntimeError";
  }
}

export class NodeWorkspaceRuntime implements WorkspaceRuntime {
  private root: string;
  private readonly ignoredDirectoryNames: Set<string>;
  private readonly maxCommandOutputBytes: number;
  private readonly maxSearchFiles: number;

  constructor(workspaceRoot = process.cwd(), options: NodeWorkspaceRuntimeOptions = {}) {
    this.root = path.resolve(workspaceRoot);
    this.ignoredDirectoryNames = new Set(
      options.ignoredDirectoryNames ?? defaultIgnoredDirectoryNames
    );
    this.maxCommandOutputBytes = options.maxCommandOutputBytes ?? 80_000;
    this.maxSearchFiles = options.maxSearchFiles ?? 10_000;
  }

  get workspaceRoot() {
    return this.root;
  }

  async execute(name: CodingToolName, input: unknown, context: RuntimeExecutionContext = {}) {
    switch (name) {
      case "coding.list_files":
        return this.listFiles(codingListFilesInputSchema.parse(input));
      case "coding.read_file":
        return this.readFile(codingReadFileInputSchema.parse(input));
      case "coding.grep":
        return this.grep(codingGrepInputSchema.parse(input));
      case "coding.git_status":
        codingGitStatusInputSchema.parse(input);
        return this.gitStatus(context);
      case "coding.git_diff":
        return this.gitDiff(codingGitDiffInputSchema.parse(input), context);
      case "coding.write_file":
        return this.writeFile(codingWriteFileInputSchema.parse(input));
      case "coding.edit_file":
        return this.editFile(codingEditFileInputSchema.parse(input));
      case "coding.run_shell":
        return this.runShell(codingRunShellInputSchema.parse(input), context);
      case "coding.run_tests":
        return this.runTests(codingRunTestsInputSchema.parse(input), context);
    }
  }

  async browseWorkspaceDirectories(input: CodingWorkspaceBrowseInput) {
    const currentPath = await this.resolveLocalDirectory(input.path ?? this.root);
    const parentPath = path.dirname(currentPath) === currentPath ? null : path.dirname(currentPath);
    const dirents = await readdir(currentPath, { withFileTypes: true });
    const entries: Array<{ name: string; path: string; selectable: true }> = [];

    for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!dirent.isDirectory() || dirent.isSymbolicLink() || this.ignoredDirectoryNames.has(dirent.name)) {
        continue;
      }

      const absolutePath = path.join(currentPath, dirent.name);
      try {
        if ((await stat(absolutePath)).isDirectory()) {
          entries.push({ name: dirent.name, path: absolutePath, selectable: true });
        }
      } catch {
        // Entries can disappear or become inaccessible during enumeration.
      }
    }

    return {
      mode: "coding_agent",
      workspaceRoot: this.root,
      currentPath,
      parentPath,
      homePath: homedir(),
      suggestedRoots: uniquePaths([
        this.root,
        process.cwd(),
        homedir(),
        path.join(homedir(), "project"),
        path.join(homedir(), "Projects")
      ]),
      entries,
      previewOnly: false,
      externalEffects: ["none"]
    };
  }

  async selectWorkspace(input: CodingWorkspaceSelectInput) {
    this.root = await this.resolveLocalDirectory(input.path);
    return {
      mode: "coding_agent",
      selected: true,
      workspaceRoot: this.root,
      previewOnly: false,
      externalEffects: ["workspace.runtime.select_root"]
    };
  }

  async listFiles(input: CodingListFilesInput) {
    const root = await this.resolveWorkspacePath(input.path);
    const entries: Array<{ path: string; type: "file" | "directory"; size: number; depth: number }> = [];
    await this.walk(root.absolutePath, input.maxDepth, input.maxEntries, entries, 0);

    return {
      workspaceRoot: this.root,
      path: root.relativePath,
      entries,
      truncated: entries.length >= input.maxEntries,
      previewOnly: false,
      externalEffects: ["none"]
    };
  }

  async readFile(input: CodingReadFileInput) {
    const resolved = await this.resolveWorkspacePath(input.path);
    const fileStat = await stat(resolved.absolutePath);
    if (!fileStat.isFile()) {
      throw new RuntimeError("Path is not a file.", "not_a_file", { path: resolved.relativePath });
    }
    if (fileStat.size > input.maxBytes) {
      throw new RuntimeError("File exceeds maxBytes.", "file_too_large", {
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
    const resolved = await this.resolveWorkspacePath(input.path, true);
    if (input.createDirs) {
      await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
      await this.assertCanonicalInsideRoot(path.dirname(resolved.absolutePath), input.path);
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
    const resolved = await this.resolveWorkspacePath(input.path);
    const buffer = await readFile(resolved.absolutePath);
    assertTextBuffer(buffer, resolved.relativePath);
    const content = buffer.toString("utf8");
    const occurrences = countOccurrences(content, input.search);

    if (occurrences !== input.expectedReplacements) {
      throw new RuntimeError(
        "Exact replacement count did not match expectedReplacements.",
        "replacement_count_mismatch",
        { path: resolved.relativePath, occurrences, expectedReplacements: input.expectedReplacements }
      );
    }

    await writeFile(resolved.absolutePath, content.split(input.search).join(input.replace), "utf8");
    return {
      path: resolved.relativePath,
      replacements: occurrences,
      previewOnly: false,
      externalEffects: ["workspace.file.write"]
    };
  }

  async grep(input: CodingGrepInput) {
    const root = await this.resolveWorkspacePath(input.path);
    const matches: Array<{ path: string; line: number; text: string }> = [];
    const query = input.query.toLowerCase();
    const includeRegex = input.includeGlob ? globToRegExp(input.includeGlob) : null;
    let visitedFiles = 0;
    let traversalTruncated = false;

    await this.walkTextFiles(root.absolutePath, async (filePath) => {
      if (matches.length >= input.maxResults || visitedFiles >= this.maxSearchFiles) {
        traversalTruncated = true;
        return;
      }
      visitedFiles += 1;
      const relativePath = toRelativePath(this.root, filePath);
      if (includeRegex && !includeRegex.test(relativePath)) {
        return;
      }
      const buffer = await readFile(filePath);
      if (looksBinary(buffer)) {
        return;
      }
      for (const [index, line] of buffer.toString("utf8").split(/\r?\n/).entries()) {
        if (matches.length >= input.maxResults) {
          traversalTruncated = true;
          break;
        }
        if (line.toLowerCase().includes(query)) {
          matches.push({ path: relativePath, line: index + 1, text: line.slice(0, 500) });
        }
      }
    });

    return {
      query: input.query,
      path: root.relativePath,
      matches,
      truncated: traversalTruncated || matches.length >= input.maxResults,
      visitedFiles,
      previewOnly: false,
      externalEffects: ["none"]
    };
  }

  async gitStatus(context: RuntimeExecutionContext = {}) {
    const result = await this.runBinary("git", ["status", "--short", "--branch"], 30_000, context);
    assertGitRepository(result);
    return { command: "git status --short --branch", ...result, previewOnly: false, externalEffects: ["none"] };
  }

  async gitDiff(input: CodingGitDiffInput, context: RuntimeExecutionContext = {}) {
    const args = ["diff"];
    if (input.staged) {
      args.push("--staged");
    }
    if (input.path) {
      const resolved = await this.resolveWorkspacePath(input.path, true);
      args.push("--", resolved.relativePath);
    }
    const result = await this.runBinary("git", args, 30_000, context);
    assertGitRepository(result);
    return { command: ["git", ...args].join(" "), ...result, previewOnly: false, externalEffects: ["none"] };
  }

  async runShell(input: CodingRunShellInput, context: RuntimeExecutionContext = {}) {
    rejectDangerousCommand(input.command);
    const invocation = createShellCommandInvocation(input.command);
    const result = await this.runBinary(invocation.file, invocation.args, input.timeoutMs, context, invocation.windowsVerbatimArguments);
    return { command: input.command, cwd: this.root, ...result, previewOnly: false, externalEffects: ["workspace.command.run"] };
  }

  async runTests(input: CodingRunTestsInput, context: RuntimeExecutionContext = {}) {
    rejectDangerousCommand(input.command);
    const invocation = createShellCommandInvocation(input.command);
    const result = await this.runBinary(invocation.file, invocation.args, input.timeoutMs, context, invocation.windowsVerbatimArguments);
    return { command: input.command, cwd: this.root, ...result, previewOnly: false, externalEffects: ["workspace.command.run"] };
  }

  private async resolveLocalDirectory(inputPath: string) {
    const expandedPath = expandHomePath(inputPath);
    const absolutePath = path.resolve(path.isAbsolute(expandedPath) ? expandedPath : path.join(this.root, expandedPath));
    const canonicalPath = await realpath(absolutePath);
    if (!(await stat(canonicalPath)).isDirectory()) {
      throw new RuntimeError("Path is not a directory.", "not_a_directory", { path: inputPath });
    }
    return absolutePath;
  }

  private async resolveWorkspacePath(inputPath: string, allowMissing = false) {
    const absolutePath = path.resolve(this.root, inputPath);
    const relativePath = toRelativePath(this.root, absolutePath);
    this.assertLexicalInsideRoot(absolutePath, relativePath, inputPath);

    if (allowMissing && !(await pathExists(absolutePath))) {
      const existingParent = await findExistingParent(path.dirname(absolutePath));
      await this.assertCanonicalInsideRoot(existingParent, inputPath);
    } else {
      await this.assertCanonicalInsideRoot(absolutePath, inputPath);
    }
    return { absolutePath, relativePath };
  }

  private assertLexicalInsideRoot(absolutePath: string, relativePath: string, inputPath: string) {
    if (absolutePath !== this.root && !absolutePath.startsWith(this.root + path.sep)) {
      throw new RuntimeError("Path escapes workspace root.", "path_outside_workspace", { path: inputPath });
    }
    if (relativePath.split(/[\\/]/).some((part) => this.ignoredDirectoryNames.has(part))) {
      throw new RuntimeError("Path is inside an ignored directory.", "ignored_path", { path: relativePath });
    }
  }

  private async assertCanonicalInsideRoot(targetPath: string, inputPath: string) {
    const [canonicalRoot, canonicalTarget] = await Promise.all([realpath(this.root), realpath(targetPath)]);
    if (canonicalTarget !== canonicalRoot && !canonicalTarget.startsWith(canonicalRoot + path.sep)) {
      throw new RuntimeError("Path resolves outside workspace root.", "symlink_outside_workspace", { path: inputPath });
    }
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
    for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entries.length >= maxEntries || dirent.isSymbolicLink() || this.ignoredDirectoryNames.has(dirent.name)) {
        continue;
      }
      const absolutePath = path.join(directory, dirent.name);
      const fileStat = await lstat(absolutePath);
      const type = dirent.isDirectory() ? "directory" : "file";
      entries.push({ path: toRelativePath(this.root, absolutePath), type, size: fileStat.size, depth });
      if (dirent.isDirectory()) {
        await this.walk(absolutePath, maxDepth, maxEntries, entries, depth + 1);
      }
    }
  }

  private async walkTextFiles(directory: string, visit: (filePath: string) => Promise<void>) {
    const fileStat = await lstat(directory);
    if (fileStat.isSymbolicLink()) {
      return;
    }
    if (fileStat.isFile()) {
      await visit(directory);
      return;
    }
    const dirents = await readdir(directory, { withFileTypes: true });
    for (const dirent of dirents) {
      if (dirent.isSymbolicLink() || this.ignoredDirectoryNames.has(dirent.name)) {
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

  private async runBinary(
    file: string,
    args: string[],
    timeoutMs: number,
    context: RuntimeExecutionContext,
    windowsVerbatimArguments = false
  ): Promise<RuntimeCommandResult> {
    try {
      const result = await execFileAsync(file, args, {
        cwd: this.root,
        env: sanitizeEnv(process.env),
        maxBuffer: this.maxCommandOutputBytes,
        timeout: timeoutMs,
        signal: context.signal,
        windowsHide: true,
        windowsVerbatimArguments
      });
      const stdout = truncateOutput(result.stdout, this.maxCommandOutputBytes);
      const stderr = truncateOutput(result.stderr, this.maxCommandOutputBytes);
      return { exitCode: 0, stdout: stdout.value, stderr: stderr.value, timedOut: false, truncated: stdout.truncated || stderr.truncated };
    } catch (error) {
      if (isAbortError(error)) {
        throw new RuntimeError("Runtime request was cancelled.", "runtime_request_cancelled", { requestId: context.requestId });
      }
      if (isExecError(error)) {
        const stdout = truncateOutput(error.stdout ?? "", this.maxCommandOutputBytes);
        const stderr = truncateOutput(error.stderr ?? error.message, this.maxCommandOutputBytes);
        const timedOut = Boolean(error.killed) || /timed out|timeout/i.test(error.message);
        return {
          exitCode: typeof error.code === "number" ? error.code : timedOut ? 124 : 1,
          stdout: stdout.value,
          stderr: stderr.value,
          timedOut,
          truncated: stdout.truncated || stderr.truncated || error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
        };
      }
      throw error;
    }
  }
}

export function createShellCommandInvocation(command: string, platformName: NodeJS.Platform = process.platform) {
  if (platformName === "win32") {
    return { file: "cmd.exe", args: ["/d", "/c", command], windowsVerbatimArguments: true };
  }
  return { file: process.env.SHELL ?? "/bin/sh", args: ["-lc", command], windowsVerbatimArguments: false };
}

export function rejectDangerousCommand(command: string) {
  const normalized = command.toLowerCase();
  const blockedPatterns = [
    /\brm\s+-rf\s+\//,
    /\bsudo\b/,
    /\bmkfs\b/,
    /\bdd\s+if=/,
    /:\(\)\s*\{\s*:\|:/,
    /\bshutdown\b/,
    /\breboot\b/,
    /\bformat\s+[a-z]:/i,
    /\bdel\s+\/f\s+\/s\s+\/q\s+[a-z]:/i
  ];
  if (blockedPatterns.some((pattern) => pattern.test(normalized))) {
    throw new RuntimeError("Command is blocked by the safety policy.", "dangerous_command", { command });
  }
}

export function sanitizeEnv(env: NodeJS.ProcessEnv) {
  const sanitized: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (/key|token|secret|password|credential/i.test(key)) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function assertGitRepository(result: RuntimeCommandResult) {
  if (result.exitCode !== 0 && /not a git repository/i.test(result.stderr)) {
    throw new RuntimeError("Workspace is not a Git repository.", "git_repository_unavailable");
  }
}

function expandHomePath(inputPath: string) {
  if (inputPath === "~") {
    return homedir();
  }
  if (inputPath.startsWith("~/") || inputPath.startsWith("~\\")) {
    return path.join(homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function uniquePaths(paths: string[]) {
  return [...new Set(paths.map((item) => path.resolve(expandHomePath(item))))];
}

function toRelativePath(root: string, absolutePath: string) {
  const relative = path.relative(root, absolutePath);
  return (relative || ".").replace(/\\/g, "/");
}

function assertTextBuffer(buffer: Buffer, filePath: string) {
  if (looksBinary(buffer)) {
    throw new RuntimeError("Binary files are not readable through coding tools.", "binary_file", { path: filePath });
  }
}

function looksBinary(buffer: Buffer) {
  return buffer.subarray(0, Math.min(buffer.length, 8000)).some((byte) => byte === 0);
}

function countOccurrences(content: string, search: string) {
  return search ? content.split(search).length - 1 : 0;
}

function globToRegExp(glob: string) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp("^" + escaped + "$");
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findExistingParent(targetPath: string): Promise<string> {
  if (await pathExists(targetPath)) {
    return targetPath;
  }
  const parent = path.dirname(targetPath);
  if (parent === targetPath) {
    throw new RuntimeError("No existing parent directory was found.", "parent_directory_missing", { path: targetPath });
  }
  return findExistingParent(parent);
}

function truncateOutput(value: string, maxBytes: number) {
  const encoded = Buffer.from(value, "utf8");
  if (encoded.byteLength <= maxBytes) {
    return { value, truncated: false };
  }
  return { value: encoded.subarray(0, maxBytes).toString("utf8") + "\n[seekdesk: output truncated]", truncated: true };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isExecError(error: unknown): error is Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
  killed?: boolean;
} {
  return error instanceof Error;
}
