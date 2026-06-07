#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));

try {
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const clientId = normalizeSecret(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = normalizeSecret(process.env.GOOGLE_CLIENT_SECRET);
  const missing = [
    clientId ? null : "GOOGLE_CLIENT_ID",
    clientSecret ? null : "GOOGLE_CLIENT_SECRET"
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")} in the current process environment.`
    );
  }

  const host = args.host ?? "jim-mac";
  const repo = args.repo ?? "/Users/jimhuang/project/SeekDesk";
  const targetEnv = args.targetEnv ?? ".env.local";
  const redirectUri =
    args.redirectUri ??
    process.env.GOOGLE_REDIRECT_URI?.trim() ??
    "http://127.0.0.1:4000/api/connectors/google/oauth/callback";
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
        targetEnv,
        configuredKeys: [
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET",
          "GOOGLE_REDIRECT_URI",
          "GOOGLE_TOKEN_ENCRYPTION_KEY",
          "GOOGLE_OAUTH_STATE_SECRET"
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
        `Remote Google OAuth configuration failed with exit code ${exitCode}.`,
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
process.env.GOOGLE_CLIENT_ID = payload.clientId;
process.env.GOOGLE_CLIENT_SECRET = payload.clientSecret;
process.env.GOOGLE_REDIRECT_URI = payload.redirectUri;
process.argv = [
  process.argv[0],
  "scripts/configure-google-oauth-env.mjs",
  "--target-env",
  payload.targetEnv,
  "--redirect-uri",
  payload.redirectUri
];
await import("./scripts/configure-google-oauth-env.mjs");
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
  console.log(`Usage: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run sync:remote-google-oauth -- [options]

Safely writes Google OAuth configuration to an ignored env file on a remote
checkout. Secret values are sent over SSH stdin, not printed and not placed in
git-tracked files.

Options:
  --host <ssh-host>      SSH host. Default: jim-mac
  --repo <path>          Remote repo path. Default: /Users/jimhuang/project/SeekDesk
  --target-env <path>    Remote env file path relative to repo. Default: .env.local
  --redirect-uri <uri>   OAuth redirect URI. Default:
                         http://127.0.0.1:4000/api/connectors/google/oauth/callback
`);
}
