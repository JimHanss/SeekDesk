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
  }
);
