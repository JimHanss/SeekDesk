#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const protectedEnvFiles = [
  ".env",
  ".env.local",
  ".env.postgres",
  ".env.production",
  ".env.production.local"
];
const requiredGitignoreLines = [".env", ".env.*", "!.env.example"];
const secretPatterns = [
  {
    name: "DeepSeek API key",
    pattern: /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{24,}\b/g,
    allowed: [/sk-test-secret-value/]
  },
  {
    name: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g,
    allowed: []
  },
  {
    name: "OAuth client secret",
    pattern: /\bGOCSPX-[0-9A-Za-z_-]{12,}\b/g,
    allowed: []
  },
  {
    name: "Private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    allowed: []
  }
];
const allowedSecretScanFiles = new Set([
  ".env.example",
  "package-lock.json"
]);

try {
  const gitignore = readFileSync(".gitignore", "utf8");
  const trackedFiles = gitListFiles();
  const issues = [
    ...verifyRequiredGitignoreLines(gitignore),
    ...verifyProtectedEnvFilesIgnored(),
    ...verifyNoTrackedEnvFiles(trackedFiles),
    ...verifyNoTrackedSecretLiterals(trackedFiles)
  ];

  if (issues.length > 0) {
    throw new Error(
      `Secret hygiene check failed:\n${issues
        .map((issue) => `- ${issue}`)
        .join("\n")}`
    );
  }

  console.log(
    JSON.stringify(
      {
        status: "passed",
        protectedEnvFiles,
        trackedFilesScanned: trackedFiles.length,
        secretPatterns: secretPatterns.map((item) => item.name)
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
}

function verifyRequiredGitignoreLines(gitignore) {
  const lines = new Set(
    gitignore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );

  return requiredGitignoreLines
    .filter((line) => !lines.has(line))
    .map((line) => `.gitignore is missing ${line}`);
}

function verifyProtectedEnvFilesIgnored() {
  return protectedEnvFiles.flatMap((file) => {
    const result = runGit(["check-ignore", file], {
      stdio: "pipe",
      allowFailure: true
    });

    return result.status === 0 ? [] : [`${file} is not ignored by git`];
  });
}

function verifyNoTrackedEnvFiles(trackedFiles) {
  return trackedFiles
    .filter((file) => {
      const name = basename(file);
      return name !== ".env.example" && (name === ".env" || name.startsWith(".env."));
    })
    .map((file) => `${file} is tracked but should be ignored`);
}

function verifyNoTrackedSecretLiterals(trackedFiles) {
  const issues = [];

  for (const file of trackedFiles) {
    if (allowedSecretScanFiles.has(file)) {
      continue;
    }

    const content = readFileSync(file, "utf8");
    for (const secretPattern of secretPatterns) {
      const matches = [...content.matchAll(secretPattern.pattern)];
      for (const match of matches) {
        const value = match[0];
        if (secretPattern.allowed.some((allowed) => allowed.test(value))) {
          continue;
        }

        issues.push(
          `${file} contains a value matching ${secretPattern.name} pattern`
        );
      }
    }
  }

  return issues;
}

function gitListFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8"
  });

  return output.split("\0").filter(Boolean);
}

function runGit(args, options = {}) {
  try {
    const stdout = execFileSync("git", args, {
      encoding: "utf8",
      stdio: options.stdio ?? "pipe"
    });

    return {
      status: 0,
      stdout
    };
  } catch (error) {
    if (!options.allowFailure) {
      throw error;
    }

    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? ""
    };
  }
}
