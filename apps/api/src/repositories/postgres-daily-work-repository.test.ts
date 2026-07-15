import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { PostgresDailyWorkRepository } from "./postgres-daily-work-repository.js";

const testDatabaseUrl = process.env.SEEKDESK_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)(
  "PostgresDailyWorkRepository integration",
  () => {
    it("checks health and initializes seed-backed collections", async () => {
      const repository = new PostgresDailyWorkRepository(testDatabaseUrl!);

      try {
        await expect(repository.getDataLayerStatus()).resolves.toEqual(
          expect.objectContaining({
            currentLayer: "postgres",
            postgresConfigured: true,
            futureDatabaseReady: false
          })
        );
        await expect(repository.listTemplates()).resolves.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "email-draft",
              mode: "daily_work"
            })
          ])
        );
      } finally {
        await repository.close();
      }
    });

    it("persists owner-scoped workspace, operation, and credential records", async () => {
      const suffix = randomUUID();
      const workspaceId = `integration-workspace-${suffix}`;
      const operationId = `integration-operation-${suffix}`;
      const credentialId = `integration-credential-${suffix}`;
      const ownerId = `integration-owner-${suffix}`;
      const now = new Date().toISOString();
      const repository = new PostgresDailyWorkRepository(testDatabaseUrl!);

      try {
        await repository.upsertCodingWorkspace({
          workspaceId,
          ownerId,
          name: "Integration workspace",
          runtimeMode: "cloud_runtime",
          status: "ready",
          rootPath: "/workspace",
          connected: true,
          repository: {
            url: "https://example.test/integration.git",
            branch: "main"
          },
          imageProfile: "node22",
          supportedCapabilities: [],
          createdAt: now,
          updatedAt: now
        });
        await repository.upsertRuntimeOperation({
          id: operationId,
          ownerId,
          workspaceId,
          type: "provision",
          status: "completed",
          idempotencyKey: `integration-provision-${suffix}`,
          requestPayload: {},
          resultPayload: { ready: true },
          createdAt: now,
          completedAt: now
        });
        const credential = await repository.upsertRepositoryCredential({
          id: credentialId,
          ownerId,
          provider: "https_token",
          label: "Integration token",
          encryptedSecret: "encrypted-integration-token",
          keyVersion: "test-key",
          createdAt: now,
          updatedAt: now
        });

        expect(credential).not.toHaveProperty("encryptedSecret");
        await expect(repository.getCodingWorkspace(ownerId, workspaceId)).resolves.toEqual(
          expect.objectContaining({ workspaceId, ownerId, runtimeMode: "cloud_runtime" })
        );
        await expect(repository.getCodingWorkspace("another-owner", workspaceId)).resolves.toBeNull();
        await expect(repository.getRuntimeOperationByIdempotencyKey(
          ownerId,
          `integration-provision-${suffix}`
        )).resolves.toEqual(expect.objectContaining({ id: operationId, workspaceId }));
        await expect(repository.getRepositoryCredential(ownerId, credentialId)).resolves.toEqual(
          expect.objectContaining({ encryptedSecret: "encrypted-integration-token" })
        );
        await expect(repository.upsertCodingWorkspace({
          workspaceId,
          ownerId: "another-owner",
          name: "Forbidden overwrite",
          runtimeMode: "cloud_runtime",
          status: "ready",
          rootPath: "/workspace",
          connected: true,
          supportedCapabilities: [],
          createdAt: now,
          updatedAt: now
        })).rejects.toMatchObject({ code: "workspace_access_denied" });
      } finally {
        await repository.close();
        const cleanup = new Pool({ connectionString: testDatabaseUrl! });
        try {
          await cleanup.query("delete from workspace_runtime_operations where id = $1", [operationId]);
          await cleanup.query("delete from repository_credentials where id = $1", [credentialId]);
          await cleanup.query("delete from workspaces where id = $1", [workspaceId]);
        } finally {
          await cleanup.end();
        }
      }
    });
  }
);
