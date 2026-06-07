#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const envPath = resolve(args.targetEnv ?? ".env.local");
const redirectUri =
  args.redirectUri ??
  process.env.GOOGLE_REDIRECT_URI ??
  "http://127.0.0.1:4000/api/connectors/google/oauth/callback";

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

  const existing = await readEnvFile(envPath);
  const next = upsertEnvValues(existing, {
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    GOOGLE_REDIRECT_URI: redirectUri,
    GOOGLE_TOKEN_ENCRYPTION_KEY:
      existing.values.GOOGLE_TOKEN_ENCRYPTION_KEY ?? createSecret(),
    GOOGLE_OAUTH_STATE_SECRET:
      existing.values.GOOGLE_OAUTH_STATE_SECRET ?? createSecret()
  });

  await mkdir(dirname(envPath), { recursive: true });
  await writeFile(envPath, next, "utf8");

  console.log(
    JSON.stringify(
      {
        status: "updated",
        envFile: envPath,
        configuredKeys: [
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET",
          "GOOGLE_REDIRECT_URI",
          "GOOGLE_TOKEN_ENCRYPTION_KEY",
          "GOOGLE_OAUTH_STATE_SECRET"
        ],
        redirectUri
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
      return parseEnvContent("");
    }

    throw error;
  }
}

function parseEnvContent(content) {
  const lines = content.split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key) {
      values[key] = value;
    }
  }

  return {
    lines,
    values
  };
}

function upsertEnvValues(existing, updates) {
  const remainingUpdates = { ...updates };
  const lines = existing.lines.map((line) => {
    const index = line.indexOf("=");
    if (index === -1) {
      return line;
    }

    const key = line.slice(0, index).trim();
    if (!(key in remainingUpdates)) {
      return line;
    }

    const value = remainingUpdates[key];
    delete remainingUpdates[key];
    return `${key}=${value}`;
  });

  const additions = Object.entries(remainingUpdates).map(
    ([key, value]) => `${key}=${value}`
  );
  const normalizedLines = trimTrailingBlankLines(lines);

  if (additions.length > 0 && normalizedLines.length > 0) {
    normalizedLines.push("");
  }

  return [...normalizedLines, ...additions, ""].join("\n");
}

function trimTrailingBlankLines(lines) {
  const next = [...lines];

  while (next.length > 0 && !next.at(-1)?.trim()) {
    next.pop();
  }

  return next;
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
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

function createSecret() {
  return randomBytes(48).toString("base64url");
}

function printHelp() {
  console.log(`Usage: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run configure:google-oauth -- [options]

Writes Google OAuth configuration to an ignored env file without printing
secret values.

Options:
  --target-env <path>    Target env file. Default: .env.local
  --redirect-uri <uri>   OAuth redirect URI. Default:
                         http://127.0.0.1:4000/api/connectors/google/oauth/callback
`);
}
