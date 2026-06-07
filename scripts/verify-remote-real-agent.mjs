#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));

try {
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const host = args.host ?? "jim-mac";
  const repo = args.repo ?? "/Users/jimhuang/project/SeekDesk";
  const port = args.port ?? "45100";
  const script = createRemoteScript({
    repo,
    port,
    skipSecrets: Boolean(args.skipSecrets),
    skipMigrate: Boolean(args.skipMigrate),
    requireGoogle: Boolean(args.requireGoogle),
    requireGoogleConfigured: Boolean(args.requireGoogleConfigured),
    requireGoogleConnected:
      Boolean(args.requireGoogleConnected) || Boolean(args.requireGoogle),
    showAuthorizationUrl: Boolean(args.showAuthorizationUrl),
    keepRunning: Boolean(args.keepRunning)
  });

  console.log(
    JSON.stringify(
      {
        status: "starting",
        host,
        repo,
        port,
        requireGoogle: Boolean(args.requireGoogle),
        skipSecrets: Boolean(args.skipSecrets),
        keepRunning: Boolean(args.keepRunning)
      },
      null,
      2
    )
  );

  const exitCode = await runRemoteScript({ host, script });
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
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

async function runRemoteScript(input) {
  const child = spawn("ssh", [input.host, "/bin/bash -s"], {
    stdio: ["pipe", "inherit", "inherit"],
    windowsHide: true
  });

  child.stdin.end(input.script);

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
}

function createRemoteScript(input) {
  const baseUrl = `http://127.0.0.1:${input.port}`;
  const pidFile = `/tmp/seekdesk-api-real-${input.port}.pid`;
  const logFile = `/tmp/seekdesk-api-real-${input.port}.log`;
  const readinessArgs = [
    "run",
    "verify:google-oauth",
    "--",
    "--base-url",
    baseUrl,
    input.requireGoogleConfigured ? "--require-configured" : null,
    input.requireGoogleConnected ? "--require-connected" : null,
    input.showAuthorizationUrl ? "--show-authorization-url" : null
  ]
    .filter(Boolean)
    .map(shellQuote)
    .join(" ");
  const realAgentArgs = [
    "run",
    "verify:real-agent",
    "--",
    "--base-url",
    baseUrl,
    input.requireGoogle ? "--require-google" : null
  ]
    .filter(Boolean)
    .map(shellQuote)
    .join(" ");
  const cleanupTrap = input.keepRunning
    ? ""
    : `trap 'cleanup_remote_api' EXIT INT TERM`;
  const secretsBlock = input.skipSecrets
    ? `echo '{"step":"secrets","status":"skipped"}'`
    : `npm run verify:secrets`;
  const migrateBlock = input.skipMigrate
    ? `echo '{"step":"db:migrate","status":"skipped"}'`
    : `npm run db:migrate`;
  const keepRunningNote = input.keepRunning
    ? `echo '{"status":"api_kept_running","baseUrl":"${baseUrl}","pidFile":"${pidFile}","logFile":"${logFile}"}'`
    : "";

  return `set -euo pipefail

cleanup_remote_api() {
  if [ -f ${shellQuote(pidFile)} ]; then
    xargs kill < ${shellQuote(pidFile)} 2>/dev/null || true
  fi
  lsof -tiTCP:${input.port} -sTCP:LISTEN | xargs -r kill 2>/dev/null || true
  rm -f ${shellQuote(pidFile)}
}

${cleanupTrap}

cd ${shellQuote(input.repo)}
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH

echo '{"step":"secrets","status":"checking"}'
${secretsBlock}
echo '{"step":"secrets","status":"done"}'

echo '{"step":"db:migrate","status":"starting"}'
${migrateBlock}
echo '{"step":"db:migrate","status":"done"}'

echo '{"step":"api","status":"starting","baseUrl":"${baseUrl}"}'
cleanup_remote_api
set -a
source .env.postgres
source .env.local
set +a
export SEEKDESK_API_PORT=${shellQuote(input.port)}
nohup npm --workspace @seekdesk/api run dev > ${shellQuote(logFile)} 2>&1 &
echo $! > ${shellQuote(pidFile)}

for attempt in $(seq 1 30); do
  if curl -fsS ${shellQuote(`${baseUrl}/health`)} >/tmp/seekdesk-api-health-${input.port}.json 2>/tmp/seekdesk-api-health-${input.port}.err; then
    echo '{"step":"api","status":"ready"}'
    cat /tmp/seekdesk-api-health-${input.port}.json
    echo
    break
  fi

  if [ "$attempt" -eq 30 ]; then
    echo '{"step":"api","status":"failed"}'
    tail -80 ${shellQuote(logFile)} || true
    exit 1
  fi

  sleep 1
done

echo '{"step":"google-oauth","status":"checking"}'
npm ${readinessArgs}

echo '{"step":"real-agent","status":"checking"}'
npm ${realAgentArgs}

${keepRunningNote}
echo '{"status":"passed","baseUrl":"${baseUrl}"}'
`;
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

    if (arg === "--skip-migrate") {
      parsed.skipMigrate = true;
      continue;
    }

    if (arg === "--skip-secrets") {
      parsed.skipSecrets = true;
      continue;
    }

    if (arg === "--require-google") {
      parsed.requireGoogle = true;
      continue;
    }

    if (arg === "--require-google-configured") {
      parsed.requireGoogleConfigured = true;
      continue;
    }

    if (arg === "--require-google-connected") {
      parsed.requireGoogleConnected = true;
      continue;
    }

    if (arg === "--show-authorization-url") {
      parsed.showAuthorizationUrl = true;
      continue;
    }

    if (arg === "--keep-running") {
      parsed.keepRunning = true;
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

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

function printHelp() {
  console.log(`Usage: npm run verify:remote-real-agent -- [options]

Runs the remote SeekDesk real-agent verification flow over SSH:
  1. run npm run verify:secrets unless --skip-secrets is set
  2. optionally run npm run db:migrate
  3. start a temporary API with remote .env.postgres + .env.local
  4. run npm run verify:google-oauth
  5. run npm run verify:real-agent
  6. clean up the temporary API unless --keep-running is set

Options:
  --host <ssh-host>              SSH host. Default: jim-mac
  --repo <path>                  Remote repo path. Default:
                                 /Users/jimhuang/project/SeekDesk
  --port <port>                  Remote API port. Default: 45100
  --skip-secrets                 Skip npm run verify:secrets.
  --skip-migrate                 Skip npm run db:migrate.
  --require-google               Also require Gmail/Calendar real read tools and complete Google scopes.
  --require-google-configured    Fail unless Google OAuth env config is complete.
  --require-google-connected     Fail unless a Google account is connected with all required scopes.
  --show-authorization-url       Print full Google OAuth URL from readiness.
  --keep-running                 Leave the remote API running for browser OAuth.

Remote OAuth note:
  The temporary API uses --port, default 45100. Before browser OAuth, sync the
  remote Google redirect URI to the same port, then forward it locally:
    npm run sync:remote-google-oauth -- --host jim-mac --redirect-uri http://127.0.0.1:45100/api/connectors/google/oauth/callback
    ssh -L 3000:127.0.0.1:3000 -L 45100:127.0.0.1:45100 jim-mac
`);
}
