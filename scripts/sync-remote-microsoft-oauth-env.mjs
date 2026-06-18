#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const sourceEnvPath = resolve(args.sourceEnv ?? ".env.local");

try {
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const sourceEnv = await readEnvFile(sourceEnvPath);
  const clientId = normalizeSecret(
    process.env.MICROSOFT_CLIENT_ID ?? sourceEnv.MICROSOFT_CLIENT_ID
  );
  const clientSecret = normalizeSecret(
    process.env.MICROSOFT_CLIENT_SECRET ?? sourceEnv.MICROSOFT_CLIENT_SECRET
  );
  const missing = [
    clientId ? null : "MICROSOFT_CLIENT_ID",
    clientSecret ? null : "MICROSOFT_CLIENT_SECRET"
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")} in the current process environment or ${sourceEnvPath}.`
    );
  }

  const host = args.host ?? "jim-mac";
  const repo = args.repo ?? "/Users/jimhuang/project/SeekDesk";
  const targetEnv = args.targetEnv ?? ".env.local";
  const redirectUri =
    args.redirectUri ??
    process.env.MICROSOFT_REDIRECT_URI?.trim() ??
    sourceEnv.MICROSOFT_REDIRECT_URI ??
    "http://127.0.0.1:4000/api/connectors/microsoft/oauth/callback";
  const payload = {
    clientId,
    clientSecret,
    redirectUri,
    targetEnv
  };

  const result = await runRemoteConfigure({
    host,
    repo,
    payload
  });

  console.log(
    JSON.stringify(
      {
        status: "updated",
        host,
        repo,
        sourceEnv: sourceEnvPath,
        targetEnv,
        configuredKeys: [
          "MICROSOFT_CLIENT_ID",
          "MICROSOFT_CLIENT_SECRET",
          "MICROSOFT_REDIRECT_URI",
          "MICROSOFT_TOKEN_ENCRYPTION_KEY",
          "MICROSOFT_OAUTH_STATE_SECRET"
        ],
        redirectUri,
        remote: result
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

async function readEnvFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return parseEnvContent(content);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function parseEnvContent(content) {
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    const value = unquoteEnvValue(line.slice(index + 1).trim());
    if (key) {
      values[key] = value;
    }
  }

  return values;
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function runRemoteConfigure(input) {
  const remoteCommand = [
    `cd ${shellQuote(input.repo)}`,
    "export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH",
    `node --input-type=module -e ${shellQuote(remoteNodeSource)}`
  ].join(" && ");
  const child = spawn("ssh", [input.host, remoteCommand], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  });
  const stdout = [];
  const stderr = [];

  child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
  child.stdin.end(JSON.stringify(input.payload));

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  const stdoutText = Buffer.concat(stdout).toString("utf8").trim();
  const stderrText = Buffer.concat(stderr).toString("utf8").trim();

  if (exitCode !== 0) {
    throw new Error(
      [
        `Remote Microsoft OAuth configuration failed with exit code ${exitCode}.`,
        stderrText ? `stderr: ${stderrText}` : null,
        stdoutText ? `stdout: ${stdoutText}` : null
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  try {
    return JSON.parse(stdoutText);
  } catch {
    return {
      status: "unknown",
      stdout: stdoutText,
      ...(stderrText ? { stderr: stderrText } : {})
    };
  }
}

const remoteNodeSource = `
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(Buffer.from(chunk));
}
const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
process.env.MICROSOFT_CLIENT_ID = payload.clientId;
process.env.MICROSOFT_CLIENT_SECRET = payload.clientSecret;
process.env.MICROSOFT_REDIRECT_URI = payload.redirectUri;
process.argv = [
  process.argv[0],
  "scripts/configure-microsoft-oauth-env.mjs",
  "--target-env",
  payload.targetEnv,
  "--redirect-uri",
  payload.redirectUri
];
await import("./scripts/configure-microsoft-oauth-env.mjs");
`;

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--host") {
      parsed.host = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--repo") {
      parsed.repo = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--target-env") {
      parsed.targetEnv = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--source-env") {
      parsed.sourceEnv = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--redirect-uri") {
      parsed.redirectUri = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function readValue(argv, index, flag) {
  const value = argv[index + 1]?.trim();
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function normalizeSecret(value) {
  const normalized = value?.trim();
  return normalized || null;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

function printHelp() {
  console.log(`Usage: npm run sync:remote-microsoft-oauth -- [options]

Safely writes Microsoft OAuth configuration to an ignored env file on a remote
checkout. Secret values are sent over SSH stdin, not printed and not placed in
git-tracked files. MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET may be supplied
from the current process environment or the local source env file.

Options:
  --host <ssh-host>      SSH host. Default: jim-mac
  --repo <path>          Remote repo path. Default: /Users/jimhuang/project/SeekDesk
  --source-env <path>    Local env file to read. Default: .env.local
  --target-env <path>    Remote env file path relative to repo. Default: .env.local
  --redirect-uri <uri>   OAuth redirect URI. Default:
                         http://127.0.0.1:4000/api/connectors/microsoft/oauth/callback
`);
}
