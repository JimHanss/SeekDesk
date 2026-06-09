#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
let remoteCleanupTarget = null;

try {
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const host = args.host ?? "jim-mac";
  const repo = args.repo ?? "/Users/jimhuang/project/SeekDesk";
  const port = args.port ?? "45100";
  const sourceEnv = resolve(args.sourceEnv ?? ".env.local");
  const targetEnv = args.targetEnv ?? ".env.local";
  const redirectUri =
    args.redirectUri ??
    `http://127.0.0.1:${port}/api/connectors/google/oauth/callback`;

  if (!args.skipSync) {
    await assertLocalGoogleOAuthConfig(sourceEnv);
    await runNodeScript(
      [
        "scripts/sync-remote-google-oauth-env.mjs",
        "--host",
        host,
        "--repo",
        repo,
        "--source-env",
        sourceEnv,
        "--target-env",
        targetEnv,
        "--redirect-uri",
        redirectUri
      ],
      "sync remote Google OAuth env"
    );
  } else {
    console.log(
      JSON.stringify(
        {
          step: "sync",
          status: "skipped",
          reason: "skip-sync flag was provided"
        },
        null,
        2
      )
    );
  }

  console.log(
    JSON.stringify(
      {
        step: "remote-oauth-session",
        status: "starting",
        host,
        repo,
        port,
        redirectUri,
        tunnelCommand: createTunnelCommand({ host, port })
      },
      null,
      2
    )
  );

  remoteCleanupTarget = { host, port };
  await runNodeScript(
    [
      "scripts/verify-remote-real-agent.mjs",
      "--host",
      host,
      "--repo",
      repo,
      "--port",
      port,
      "--require-google-configured",
      "--show-authorization-url",
      "--keep-running",
      ...(args.skipMigrate ? ["--skip-migrate"] : []),
      ...(args.skipSecrets ? ["--skip-secrets"] : [])
    ],
    "start remote OAuth-ready API"
  );
  remoteCleanupTarget = null;

  console.log(
    JSON.stringify(
      {
        status: "ready_for_browser_oauth",
        host,
        repo,
        apiBaseUrl: `http://127.0.0.1:${port}`,
        redirectUri,
        tunnelCommand: createTunnelCommand({ host, port }),
        nextSteps: [
          "Open the SSH tunnel command in a separate terminal and keep it running.",
          "Open the authorizationUrl printed above by verify:google-oauth.",
          "Complete Google consent in the browser.",
          "Run npm run verify:remote-real-agent -- --require-google."
        ]
      },
      null,
      2
    )
  );
} catch (error) {
  let cleanup = null;
  if (remoteCleanupTarget) {
    cleanup = await cleanupRemoteApi(remoteCleanupTarget).catch((cleanupError) => ({
      status: "failed",
      error:
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
    }));
  }

  console.error(
    JSON.stringify(
      {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        ...(cleanup ? { cleanup } : {})
      },
      null,
      2
    )
  );
  process.exit(1);
}

async function assertLocalGoogleOAuthConfig(sourceEnv) {
  const values = await readEnvFile(sourceEnv);
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter(
    (key) => !normalizeSecret(process.env[key] ?? values[key])
  );

  if (missing.length > 0) {
    throw new Error(
      [
        `Missing ${missing.join(", ")} in the current process environment or ${sourceEnv}.`,
        "Add them to the ignored local env file, or pass --skip-sync only if the remote ignored env is already configured."
      ].join(" ")
    );
  }
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

async function runNodeScript(argv, label) {
  const child = spawn(process.execPath, argv, {
    stdio: "inherit",
    windowsHide: true
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}.`);
  }
}

async function cleanupRemoteApi(input) {
  const pidFile = `/tmp/seekdesk-api-real-${input.port}.pid`;
  const script = [
    `if [ -f ${shellQuote(pidFile)} ]; then kill "$(cat ${shellQuote(pidFile)})" 2>/dev/null || true; fi`,
    `if command -v lsof >/dev/null 2>&1; then lsof -tiTCP:${input.port} -sTCP:LISTEN | xargs kill 2>/dev/null || true; fi`,
    `rm -f ${shellQuote(pidFile)}`
  ].join("\n");
  const child = spawn("ssh", [input.host, "zsh", "-lc", shellQuote(script)], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const stdout = [];
  const stderr = [];

  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  return {
    status: exitCode === 0 ? "attempted" : "failed",
    host: input.host,
    port: input.port,
    ...(exitCode !== 0 ? { exitCode } : {}),
    ...(stdout.length > 0
      ? { stdout: Buffer.concat(stdout).toString("utf8").trim() }
      : {}),
    ...(stderr.length > 0
      ? { stderr: Buffer.concat(stderr).toString("utf8").trim() }
      : {})
  };
}

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

    if (arg === "--port") {
      parsed.port = readPort(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--source-env") {
      parsed.sourceEnv = readValue(argv, index, arg);
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

    if (arg === "--skip-sync") {
      parsed.skipSync = true;
      continue;
    }

    if (arg === "--skip-migrate") {
      parsed.skipMigrate = true;
      continue;
    }

    if (arg === "--skip-secrets") {
      parsed.skipSecrets = true;
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

function readPort(argv, index, flag) {
  const value = readValue(argv, index, flag);
  if (!/^\d{2,5}$/.test(value)) {
    throw new Error(`${flag} requires a numeric TCP port.`);
  }

  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new Error(`${flag} must be between 1 and 65535.`);
  }

  return value;
}

function normalizeSecret(value) {
  const normalized = value?.trim();
  return normalized || null;
}

function createTunnelCommand(input) {
  return `ssh -L 3000:127.0.0.1:3000 -L ${input.port}:127.0.0.1:${input.port} ${input.host}`;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function printHelp() {
  console.log(`Usage: npm run prepare:remote-google-oauth -- [options]

Prepares the SSH remote checkout for browser-based Google OAuth without
printing Google client secret values:
  1. verifies local GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET exist
  2. syncs them to the remote ignored env file
  3. starts the remote API with --keep-running
  4. prints the Google authorization URL from the running API
  5. prints the SSH tunnel command needed for the browser callback

If the OAuth-ready remote API fails before the ready message is printed, this
helper attempts to clean up the temporary remote API process and port.

Options:
  --host <ssh-host>      SSH host. Default: jim-mac
  --repo <path>          Remote repo path. Default: /Users/jimhuang/project/SeekDesk
  --port <port>          Remote API port. Default: 45100
  --source-env <path>    Local ignored env file. Default: .env.local
  --target-env <path>    Remote ignored env file. Default: .env.local
  --redirect-uri <uri>   OAuth redirect URI. Default:
                         http://127.0.0.1:<port>/api/connectors/google/oauth/callback
  --skip-sync            Do not sync local Google OAuth env to remote.
  --skip-migrate         Skip remote npm run db:migrate in the temporary session.
  --skip-secrets         Skip remote npm run verify:secrets in the temporary session.

After consent succeeds, run:
  npm run verify:remote-real-agent -- --require-google
`);
}
