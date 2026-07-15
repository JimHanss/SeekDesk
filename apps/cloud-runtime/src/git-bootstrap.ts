import { spawn } from "node:child_process";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { CloudRuntimeServiceError, redactSensitiveText } from "./errors.js";
import type { WorkspaceStorageRef } from "./storage.js";

export interface GitBootstrapRequest {
  repositoryUrl: string;
  branch: string;
  storage: WorkspaceStorageRef;
  token?: string;
  timeoutMs: number;
}

export interface GitBootstrapResult {
  revision: string;
}

export interface GitBootstrapper {
  clone(request: GitBootstrapRequest): Promise<GitBootstrapResult>;
}

export class ProcessGitBootstrapper implements GitBootstrapper {
  async clone(request: GitBootstrapRequest) {
    const repositoryUrl = assertHttpsRepositoryUrl(request.repositoryUrl);
    const branch = assertGitRef(request.branch);
    await mkdir(request.storage.tempDirectory, { recursive: true, mode: 0o700 });
    const secretRef = await createAskPassFiles(request.storage.tempDirectory, request.token);
    try {
      const clone = await runGit([
        "clone",
        "--single-branch",
        "--branch",
        branch,
        "--",
        repositoryUrl,
        request.storage.workspaceDirectory
      ], {
        cwd: request.storage.baseDirectory,
        timeoutMs: request.timeoutMs,
        environment: secretRef.environment
      });
      assertGitSuccess(clone, "Repository clone failed.");
      const revision = await runGit(["rev-parse", "HEAD"], {
        cwd: request.storage.workspaceDirectory,
        timeoutMs: 10_000,
        environment: secretRef.environment
      });
      assertGitSuccess(revision, "Repository revision could not be read.");
      const sha = revision.stdout.trim();
      if (!/^[a-f0-9]{40,64}$/i.test(sha)) {
        throw new CloudRuntimeServiceError(
          "Repository returned an invalid revision.",
          "repository_clone_failed"
        );
      }
      return { revision: sha };
    } finally {
      await secretRef.cleanup();
    }
  }
}

interface GitCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function runGit(
  args: string[],
  options: { cwd: string; timeoutMs: number; environment: NodeJS.ProcessEnv }
) {
  return new Promise<GitCommandResult>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: options.cwd,
      env: options.environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    let settled = false;
    const finish = (result: GitCommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => appendLimited(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => appendLimited(stderr, chunk));
    child.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new CloudRuntimeServiceError(
        "Git could not be started.",
        "repository_clone_failed"
      ));
    });
    child.on("close", (code) => finish({
      exitCode: typeof code === "number" ? code : timedOut ? 124 : 1,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: redactSensitiveText(Buffer.concat(stderr).toString("utf8")),
      timedOut
    }));
  });
}

async function createAskPassFiles(tempDirectory: string, token?: string) {
  const environment = createGitEnvironment(process.env);
  if (!token) {
    return { environment, cleanup: async () => undefined };
  }
  const suffix = randomUUID();
  const tokenFile = join(tempDirectory, `.credential-${suffix}`);
  const askPassFile = join(tempDirectory, `.askpass-${suffix}.sh`);
  await writeFile(tokenFile, token, { encoding: "utf8", mode: 0o600 });
  await writeFile(
    askPassFile,
    "#!/bin/sh\ncase \"$1\" in *Username*) printf '%s\\n' oauth2 ;; *) cat \"$SEEKDESK_GIT_TOKEN_FILE\" ;; esac\n",
    { encoding: "utf8", mode: 0o700 }
  );
  await chmod(askPassFile, 0o700);
  return {
    environment: {
      ...environment,
      GIT_ASKPASS: askPassFile,
      SEEKDESK_GIT_TOKEN_FILE: tokenFile
    },
    cleanup: async () => {
      await Promise.allSettled([
        rm(tokenFile, { force: true }),
        rm(askPassFile, { force: true })
      ]);
    }
  };
}

function assertGitSuccess(result: GitCommandResult, message: string) {
  if (result.exitCode !== 0) {
    throw new CloudRuntimeServiceError(
      message,
      result.timedOut ? "runtime_request_timeout" : "repository_clone_failed",
      { exitCode: result.exitCode, timedOut: result.timedOut }
    );
  }
}

function assertHttpsRepositoryUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw invalidRepositoryUrl();
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw invalidRepositoryUrl();
  }
  return parsed.toString();
}

function invalidRepositoryUrl() {
  return new CloudRuntimeServiceError(
    "Repository URL must use HTTPS without embedded credentials.",
    "repository_credentials_invalid",
    {},
    400
  );
}

function assertGitRef(value: string) {
  const forbidden = [" ", "\t", "\n", "~", "^", ":", "?", "*", "[", "\\"];
  if (
    !value ||
    value.startsWith("-") ||
    value.includes("..") ||
    forbidden.some((character) => value.includes(character))
  ) {
    throw new CloudRuntimeServiceError(
      "Repository branch is invalid.",
      "invalid_runtime_request",
      {},
      400
    );
  }
  return value;
}

function createGitEnvironment(env: NodeJS.ProcessEnv) {
  return {
    ...Object.fromEntries(Object.entries(env).filter(([key, value]) => (
      value !== undefined && !/token|secret|password|credential|askpass/i.test(key)
    ))),
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_NOSYSTEM: "1"
  };
}

function appendLimited(target: Buffer[], chunk: Buffer) {
  const current = target.reduce((total, item) => total + item.byteLength, 0);
  const remaining = 256_000 - current;
  if (remaining > 0) target.push(chunk.subarray(0, remaining));
}
