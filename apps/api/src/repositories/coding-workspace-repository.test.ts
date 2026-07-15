import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  JsonDailyWorkRepository,
  SeedDailyWorkRepository
} from "./daily-work-repository.js";

const now = "2026-07-15T00:00:00.000Z";
const workspaces = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...workspaces].map((directory) => rm(directory, { force: true, recursive: true }))
  );
  workspaces.clear();
});

describe("coding workspace repositories", () => {
  it("keeps workspace, operation, and credential access owner-scoped", async () => {
    const repository = new SeedDailyWorkRepository();
    await repository.upsertCodingWorkspace(createWorkspace("owner-a", "workspace-a"));
    await repository.upsertRuntimeOperation({
      id: "operation-a",
      ownerId: "owner-a",
      workspaceId: "workspace-a",
      type: "provision",
      status: "queued",
      idempotencyKey: "provision-a",
      requestPayload: { repositoryUrl: "https://example.test/repository.git" },
      createdAt: now
    });
    const credential = await repository.upsertRepositoryCredential({
      id: "credential-a",
      ownerId: "owner-a",
      provider: "https_token",
      label: "Test token",
      encryptedSecret: "encrypted-value",
      keyVersion: "key-v1",
      createdAt: now,
      updatedAt: now
    });

    expect(credential).not.toHaveProperty("encryptedSecret");
    await expect(repository.upsertCodingWorkspace(createWorkspace("owner-b", "workspace-a")))
      .rejects.toMatchObject({ code: "workspace_access_denied", statusCode: 403 });
    await expect(repository.upsertRuntimeOperation({
      id: "operation-a",
      ownerId: "owner-b",
      workspaceId: "workspace-a",
      type: "provision",
      status: "queued",
      idempotencyKey: "owner-b-provision-a",
      requestPayload: {},
      createdAt: now
    })).rejects.toMatchObject({ code: "workspace_access_denied" });
    await expect(repository.upsertRepositoryCredential({
      id: "credential-a",
      ownerId: "owner-b",
      provider: "https_token",
      label: "Cross-owner overwrite",
      encryptedSecret: "different-secret",
      keyVersion: "key-v1",
      createdAt: now,
      updatedAt: now
    })).rejects.toMatchObject({ code: "workspace_access_denied" });
    await expect(repository.getCodingWorkspace("owner-b", "workspace-a")).resolves.toBeNull();
    await expect(repository.listCodingWorkspaces({ ownerId: "owner-b" })).resolves.toEqual([]);
    await expect(repository.getRuntimeOperationByIdempotencyKey("owner-b", "provision-a"))
      .resolves.toBeNull();
    await expect(repository.getRepositoryCredential("owner-b", "credential-a"))
      .resolves.toBeNull();
    await expect(repository.getRepositoryCredential("owner-a", "credential-a"))
      .resolves.toEqual(expect.objectContaining({ encryptedSecret: "encrypted-value" }));
  });

  it("persists fallback workspace metadata but never writes repository credentials", async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "seekdesk-coding-repository-"));
    workspaces.add(dataDirectory);
    const repository = new JsonDailyWorkRepository(dataDirectory);

    await repository.upsertCodingWorkspace(createWorkspace("owner-a", "workspace-json"));
    await repository.upsertRuntimeOperation({
      id: "operation-json",
      ownerId: "owner-a",
      workspaceId: "workspace-json",
      type: "provision",
      status: "completed",
      idempotencyKey: "provision-json",
      requestPayload: {},
      resultPayload: { ready: true },
      createdAt: now,
      completedAt: now
    });
    await repository.upsertRepositoryCredential({
      id: "credential-json",
      ownerId: "owner-a",
      provider: "https_token",
      label: "Memory only",
      encryptedSecret: "must-not-touch-disk",
      keyVersion: "key-v1",
      createdAt: now,
      updatedAt: now
    });

    const files = await readdir(dataDirectory);
    expect(files).toEqual(expect.arrayContaining([
      "coding-workspaces.json",
      "runtime-operations.json"
    ]));
    expect(files.join("\n")).not.toMatch(/credential/i);
    await expect(access(join(dataDirectory, "repository-credentials.json"))).rejects.toThrow();
    expect(await readFile(join(dataDirectory, "coding-workspaces.json"), "utf8"))
      .not.toContain("must-not-touch-disk");
    await expect(repository.upsertCodingWorkspace(createWorkspace("owner-b", "workspace-json")))
      .rejects.toMatchObject({ code: "workspace_access_denied" });

    const reloaded = new JsonDailyWorkRepository(dataDirectory);
    await expect(reloaded.getCodingWorkspace("owner-a", "workspace-json"))
      .resolves.toEqual(expect.objectContaining({ workspaceId: "workspace-json" }));
    await expect(reloaded.listRepositoryCredentials("owner-a")).resolves.toEqual([]);
  });
});

describe("dual-runtime migration", () => {
  it("backfills legacy scope before applying non-null constraints and indexes", async () => {
    const migrationUrl = new URL(
      "../../drizzle/0003_massive_natasha_romanoff.sql",
      import.meta.url
    );
    const sql = await readFile(migrationUrl, "utf8");

    const nullableColumn = sql.indexOf(
      'ALTER TABLE "daily_work_sessions" ADD COLUMN "owner_id" text;'
    );
    const backfill = sql.indexOf('UPDATE "daily_work_sessions"');
    const constraint = sql.indexOf(
      'ALTER TABLE "daily_work_sessions" ALTER COLUMN "owner_id" SET NOT NULL;'
    );
    const index = sql.indexOf('CREATE INDEX "daily_work_sessions_owner_workspace_idx"');

    expect(nullableColumn).toBeGreaterThanOrEqual(0);
    expect(backfill).toBeGreaterThan(nullableColumn);
    expect(constraint).toBeGreaterThan(backfill);
    expect(index).toBeGreaterThan(constraint);
    expect(sql).toContain('"payload"->>\'workspaceId\'');
    expect(sql).toContain('"payload"->>\'runtimeMode\'');
    expect(sql).not.toMatch(/ADD COLUMN "owner_id" text DEFAULT .* NOT NULL/);
  });
});

function createWorkspace(ownerId: string, workspaceId: string) {
  return {
    workspaceId,
    ownerId,
    name: workspaceId,
    runtimeMode: "cloud_runtime" as const,
    status: "ready" as const,
    rootPath: "/workspace",
    connected: true,
    repository: {
      url: "https://example.test/repository.git",
      branch: "main"
    },
    imageProfile: "node22" as const,
    supportedCapabilities: [],
    createdAt: now,
    updatedAt: now
  };
}
