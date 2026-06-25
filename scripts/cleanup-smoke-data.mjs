#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

loadEnvFile(path.join(rootDir, ".env.postgres"));
loadEnvFile(path.join(rootDir, ".env.local"));

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ status: "skipped", reason: "DATABASE_URL not configured" }));
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const sessionPatterns = [
  "%browser smoke%",
  "%Return exactly one%",
  "%daily.persist_artifact%",
  "%daily_persist_artifact%",
  "%Real agent verification%",
  "%Please return Type%"
];

const artifactPatterns = [
  "%Real agent verification%",
  "%Smoke Agent Tool%",
  "%Code Block Smoke%",
  "%Remote Trace Smoke%",
  "%Remote trace UI verification%",
  "%Remote Context Activity Smoke%",
  "%Daily_Work Smoke%",
  "%smoke-test%"
];

await client.connect();

try {
  const hasTables = await hasRequiredTables();
  if (!hasTables) {
    console.log(JSON.stringify({ status: "skipped", reason: "daily-work tables not found" }));
    process.exit(0);
  }

  await client.query("begin");
  try {
    await client.query("create temp table cleanup_sessions(id text primary key) on commit drop");
    await client.query("create temp table cleanup_artifacts(id text primary key) on commit drop");

    const sessionPayloadMatches = sessionPatterns
      .map((_, index) => `s.payload::text ilike $${index + 1}`)
      .join(" or ");
    const messageMatches = sessionPatterns
      .map((_, index) => `m.content ilike $${index + 1}`)
      .join(" or ");
    await client.query(
      `insert into cleanup_sessions(id)
       select s.id
       from daily_work_sessions s
       where s.id like 'remote-%'
          or (
            s.id like 'chat-%'
            and (
              ${sessionPayloadMatches}
              or exists (
                select 1
                from daily_work_messages m
                where m.session_id = s.id
                  and (${messageMatches})
              )
            )
          )`,
      sessionPatterns
    );

    const artifactMatches = artifactPatterns
      .map((_, index) => `a.payload::text ilike $${index + 1}`)
      .join(" or ");
    await client.query(
      `insert into cleanup_artifacts(id)
       select a.id
       from daily_work_artifacts a
       where ${artifactMatches}`,
      artifactPatterns
    );

    const sessions = await client.query(
      `select s.id, s.payload->>'title' as title
       from daily_work_sessions s
       join cleanup_sessions c on c.id = s.id
       order by s.created_at desc`
    );
    const artifacts = await client.query(
      `select a.id, a.payload->>'title' as title
       from daily_work_artifacts a
       join cleanup_artifacts c on c.id = a.id
       order by a.created_at desc`
    );

    const counts = {
      sessions: sessions.rowCount,
      artifacts: artifacts.rowCount,
      activityEvents: 0,
      messages: 0,
      toolCalls: 0,
      modelUsage: 0,
      permissionGrants: 0
    };

    if (!dryRun) {
      counts.activityEvents = (
        await client.query(
          `delete from daily_work_activity_events e
           where exists (select 1 from cleanup_sessions c where e.payload::text like '%' || c.id || '%')
              or exists (select 1 from cleanup_artifacts c where e.payload::text like '%' || c.id || '%')
           returning id`
        )
      ).rowCount;
      counts.messages = (
        await client.query(
          "delete from daily_work_messages where session_id in (select id from cleanup_sessions) returning id"
        )
      ).rowCount;
      counts.toolCalls = (
        await client.query(
          "delete from tool_calls where session_id in (select id from cleanup_sessions) returning id"
        )
      ).rowCount;
      counts.modelUsage = (
        await client.query(
          "delete from model_usage_records where session_id in (select id from cleanup_sessions) returning id"
        )
      ).rowCount;
      counts.permissionGrants = (
        await client.query(
          "delete from daily_work_permission_grants where session_id in (select id from cleanup_sessions) returning id"
        )
      ).rowCount;
      counts.artifacts = (
        await client.query(
          "delete from daily_work_artifacts where id in (select id from cleanup_artifacts) returning id"
        )
      ).rowCount;
      counts.sessions = (
        await client.query(
          "delete from daily_work_sessions where id in (select id from cleanup_sessions) returning id"
        )
      ).rowCount;
    }

    if (dryRun) {
      await client.query("rollback");
    } else {
      await client.query("commit");
    }

    console.log(
      JSON.stringify(
        {
          status: dryRun ? "dry_run" : "cleaned",
          counts,
          sessionSamples: sessions.rows.slice(0, 8),
          artifactSamples: artifacts.rows.slice(0, 8)
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
} finally {
  await client.end();
}

async function hasRequiredTables() {
  const result = await client.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_name = any($1::text[])`,
    [[
      "daily_work_sessions",
      "daily_work_messages",
      "daily_work_artifacts",
      "daily_work_activity_events",
      "tool_calls",
      "model_usage_records",
      "daily_work_permission_grants"
    ]]
  );

  return result.rowCount >= 7;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (process.env[key]) {
      continue;
    }

    process.env[key] = unquoteEnvValue(trimmed.slice(separator + 1).trim());
  }
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
