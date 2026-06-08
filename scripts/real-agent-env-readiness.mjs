#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const defaultEnvFiles = [".env.local", ".env.postgres", ".env"];
const requiredKeys = [
  "DEEPSEEK_API_KEY",
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "GOOGLE_TOKEN_ENCRYPTION_KEY",
  "GOOGLE_OAUTH_STATE_SECRET"
];
const args = parseArgs(process.argv.slice(2));

try {
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.host && !args.localOnly) {
    const exitCode = await runRemote(args);
    process.exit(exitCode);
  }

  const summary = await checkLocalReadiness(args);
  console.log(JSON.stringify(summary, null, 2));

  if (shouldFail(summary, args)) {
    process.exit(1);
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

async function checkLocalReadiness(input) {
  const envFiles = input.envFiles?.length ? input.envFiles : defaultEnvFiles;
  const fileReports = await Promise.all(
    envFiles.map(async (filePath) => readEnvFileReport(filePath))
  );
  const merged = mergeEnvValues(fileReports.map((report) => report.values));
  const has = (key) => Boolean((process.env[key] ?? merged[key] ?? "").trim());
  const requirements = {
    deepseekApiKey: has("DEEPSEEK_API_KEY"),
    postgresDatabaseUrl: has("DATABASE_URL"),
    googleClientId: has("GOOGLE_CLIENT_ID"),
    googleClientSecret: has("GOOGLE_CLIENT_SECRET"),
    googleRedirectUri: has("GOOGLE_REDIRECT_URI"),
    googleTokenEncryptionKey: has("GOOGLE_TOKEN_ENCRYPTION_KEY"),
    googleOAuthStateSecret: has("GOOGLE_OAUTH_STATE_SECRET")
  };
  const artifactChainReady =
    requirements.deepseekApiKey && requirements.postgresDatabaseUrl;
  const googleClientReady =
    requirements.googleClientId && requirements.googleClientSecret;
  const googleOAuthEnvReady =
    googleClientReady &&
    requirements.googleRedirectUri &&
    requirements.googleTokenEncryptionKey &&
    requirements.googleOAuthStateSecret;

  return {
    status: allRequirementsReady({
      artifactChainReady,
      googleOAuthEnvReady
    })
      ? "ready"
      : "incomplete",
    scope: input.localOnly ? "remote-local-check" : "local",
    envFiles: fileReports.map(({ values, ...report }) => {
      void values;
      return report;
    }),
    requirements: {
      ...requirements,
      artifactChainReady,
      googleClientReady,
      googleOAuthEnvReady,
      googleRealReadVerificationReady: googleOAuthEnvReady,
      note:
        "This checks env readiness only. A connected Google account with complete scopes is still verified by verify:google-oauth or verify:remote-real-agent -- --require-google."
    },
    nextStep: createNextStep({
      artifactChainReady,
      googleClientReady,
      googleOAuthEnvReady,
      requirements,
      focusGoogle: input.requireGoogleConfigured
    })
  };
}

async function readEnvFileReport(filePath) {
  const absolutePath = resolve(filePath);
  let content = "";
  let exists = true;

  try {
    content = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      exists = false;
    } else {
      throw error;
    }
  }

  const values = exists ? parseEnvContent(content) : {};

  return {
    path: filePath,
    exists,
    keys: Object.fromEntries(
      requiredKeys.map((key) => [key, Boolean(values[key]?.trim())])
    ),
    values
  };
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

function mergeEnvValues(valuesList) {
  return Object.assign({}, ...valuesList.reverse());
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

function allRequirementsReady(input) {
  return input.artifactChainReady && input.googleOAuthEnvReady;
}

function shouldFail(summary, input) {
  if (input.requireDeepSeek && !summary.requirements.deepseekApiKey) {
    return true;
  }

  if (input.requirePostgres && !summary.requirements.postgresDatabaseUrl) {
    return true;
  }

  if (input.requireArtifactChain && !summary.requirements.artifactChainReady) {
    return true;
  }

  if (input.requireGoogleConfigured && !summary.requirements.googleOAuthEnvReady) {
    return true;
  }

  return false;
}

function createNextStep(input) {
  if (input.focusGoogle && !input.googleClientReady) {
    return "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to ignored .env.local, then run npm run prepare:remote-google-oauth -- --host jim-mac.";
  }

  if (input.focusGoogle && !input.googleOAuthEnvReady) {
    return "Run npm run configure:google-oauth to generate redirect/encryption/state settings without printing secrets.";
  }

  if (!input.artifactChainReady) {
    const missing = [
      input.requirements.deepseekApiKey ? null : "DEEPSEEK_API_KEY",
      input.requirements.postgresDatabaseUrl ? null : "DATABASE_URL"
    ].filter(Boolean);

    return `Add ${missing.join(", ")} to ignored env files before running remote real-agent verification.`;
  }

  if (!input.googleClientReady) {
    return "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to ignored .env.local, then run npm run prepare:remote-google-oauth -- --host jim-mac.";
  }

  if (!input.googleOAuthEnvReady) {
    return "Run npm run configure:google-oauth to generate redirect/encryption/state settings without printing secrets.";
  }

  return "Run npm run prepare:remote-google-oauth -- --host jim-mac, complete browser consent, then run npm run verify:remote-real-agent -- --require-google.";
}

async function runRemote(input) {
  const repo = input.repo ?? "/Users/jimhuang/project/SeekDesk";
  const remoteArgs = [
    "--local-only",
    ...(input.requireDeepSeek ? ["--require-deepseek"] : []),
    ...(input.requirePostgres ? ["--require-postgres"] : []),
    ...(input.requireArtifactChain ? ["--require-artifact-chain"] : []),
    ...(input.requireGoogleConfigured ? ["--require-google-configured"] : [])
  ];
  const remoteCommand = [
    `cd ${shellQuote(repo)}`,
    "export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH",
    `node scripts/real-agent-env-readiness.mjs ${remoteArgs.join(" ")}`
  ].join(" && ");
  const child = spawn("ssh", [input.host, remoteCommand], {
    stdio: "inherit",
    windowsHide: true
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
}

function parseArgs(argv) {
  const parsed = {
    envFiles: []
  };

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

    if (arg === "--env-file") {
      parsed.envFiles.push(readValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--local-only") {
      parsed.localOnly = true;
      continue;
    }

    if (arg === "--require-deepseek") {
      parsed.requireDeepSeek = true;
      continue;
    }

    if (arg === "--require-postgres") {
      parsed.requirePostgres = true;
      continue;
    }

    if (arg === "--require-artifact-chain") {
      parsed.requireArtifactChain = true;
      continue;
    }

    if (arg === "--require-google-configured") {
      parsed.requireGoogleConfigured = true;
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

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

function printHelp() {
  console.log(`Usage: npm run verify:real-agent-env -- [options]

Checks whether ignored env files contain the variables needed for the real
DeepSeek/Postgres/Google daily-work agent. It prints only booleans and next
steps, never secret values.

Options:
  --host <ssh-host>              Check a remote checkout over SSH.
  --repo <path>                  Remote repo path. Default: /Users/jimhuang/project/SeekDesk
  --env-file <path>              Env file to inspect. Can be repeated.
  --local-only                   Do not recurse over SSH. Used by remote checks.
  --require-deepseek             Exit non-zero if DEEPSEEK_API_KEY is missing.
  --require-postgres             Exit non-zero if DATABASE_URL is missing.
  --require-artifact-chain       Exit non-zero unless DeepSeek + Postgres env are ready.
  --require-google-configured    Exit non-zero unless Google OAuth env is ready.
`);
}
