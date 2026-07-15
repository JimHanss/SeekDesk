import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  connectorActionPreviewResponseSchema,
  dailyActivityEventResponseSchema,
  dailyActivityEventsResponseSchema,
  dailyActivitySnapshotMessageSchema,
  dailyApprovalDecisionResponseSchema,
  dailyContextUsePreviewResponseSchema,
  dailyWorkTemplateApplyPreviewResponseSchema,
  dailyWorkWorkflowPreviewResponseSchema
} from "@seekdesk/shared";

import { buildServer } from "./server.js";
import { SeedDailyWorkRepository } from "./repositories/daily-work-repository.js";

const deepSeekEnvKeys = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL_FAST",
  "DEEPSEEK_MODEL_PRO",
  "DEEPSEEK_MODEL_ROUTE",
  "DEEPSEEK_THINKING_MODE",
  "DEEPSEEK_STREAM_USAGE",
  "DEEPSEEK_STREAM_USAGE_ENABLED",
  "SEEKDESK_DATA_DIR",
  "DATABASE_URL",
  "coding_agent tools",
] as const;

const originalDeepSeekEnv = new Map(
  deepSeekEnvKeys.map((key) => [key, process.env[key]])
);

describe("api server", () => {
  beforeEach(() => {
    for (const key of deepSeekEnvKeys) {
      delete process.env[key];
    }


  });

  afterEach(() => {
    vi.unstubAllGlobals();

    for (const key of deepSeekEnvKeys) {
      const originalValue = originalDeepSeekEnv.get(key);
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  it("returns health status", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "seekdesk-api",
      version: "0.1.0",
      currentLayer: "seed_mock",
      dataDirConfigured: false,
      jsonLocalReady: false,
      postgresConfigured: false,
      postgresReady: false,
      futureDatabaseReady: false,
      auth: {
        mode: "development",
        configured: true,
        productionCloudRuntimeAllowed: true,
        issuerConfigured: false,
        audienceConfigured: false,
        jwksConfigured: false
      }
    });

    await app.close();
  });

  it("returns configured JSON data layer status from health", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "GET",
          url: "/health"
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          status: "ok",
          service: "seekdesk-api",
          version: "0.1.0",
          currentLayer: "json_local",
          dataDirConfigured: true,
          jsonLocalReady: true,
          postgresConfigured: false,
          postgresReady: false,
          futureDatabaseReady: false,
          auth: {
            mode: "development",
            configured: true,
            productionCloudRuntimeAllowed: true,
            issuerConfigured: false,
            audienceConfigured: false,
            jwksConfigured: false
          }
        });
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("returns the default daily-work templates when no mode is provided", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/templates"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "daily_work",
      templates: expect.arrayContaining([
        expect.objectContaining({
          id: "email-draft",
          mode: "daily_work",
          category: "writing"
        }),
        expect.objectContaining({
          id: "meeting-summary",
          mode: "daily_work",
          artifactType: "meeting_summary"
        })
      ])
    });
    expect(response.json().templates).toHaveLength(6);

    await app.close();
  });

  it("creates, updates, duplicates, and softly archives daily-work templates", async () => {
    const app = await buildServer();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/daily/templates",
      payload: {
        mode: "daily_work",
        category: "planning",
        title: "Quarterly Plan",
        description: "Plan the next quarter.",
        prompt: "Create a quarterly plan.",
        systemPrompt: "Stay in daily_work mode.",
        promptTemplate: "{{input}}",
        defaultModelRoute: "pro",
        allowedToolNames: ["daily.persist_artifact"],
        contextPolicy: {
          maxContextTokens: 8000,
          includeSelectedContext: true,
          includeRecentSession: true,
          includeArtifacts: false
        },
        artifactType: "task_list",
        tags: ["planning"],
        enabled: true
      }
    });
    const created = createResponse.json().template;

    expect(createResponse.statusCode).toBe(200);
    expect(created).toEqual(
      expect.objectContaining({
        mode: "daily_work",
        status: "active",
        version: 1,
        defaultModelRoute: "pro",
        allowedToolNames: ["daily.persist_artifact"]
      })
    );
    expect(created.id).toMatch(/^agent-template-quarterly-plan-/);
    const createdTemplateId = created.id as string;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/daily/templates/${createdTemplateId}`,
      payload: {
        mode: "daily_work",
        description: "Updated plan description.",
        enabled: false
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().template).toEqual(
      expect.objectContaining({
        id: createdTemplateId,
        description: "Updated plan description.",
        status: "disabled",
        enabled: false,
        version: 2
      })
    );

    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/api/daily/templates/${createdTemplateId}/duplicate`,
      payload: {
        mode: "daily_work",
        title: "Quarterly Plan Copy"
      }
    });

    expect(duplicateResponse.statusCode).toBe(200);
    expect(duplicateResponse.json().template).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^agent-template-quarterly-plan-copy-/),
        status: "active",
        enabled: true,
        version: 1
      })
    );

    const archiveResponse = await app.inject({
      method: "DELETE",
      url: `/api/daily/templates/${createdTemplateId}?mode=daily_work`
    });

    expect(archiveResponse.statusCode).toBe(200);
    expect(archiveResponse.json().template).toEqual(
      expect.objectContaining({
        id: createdTemplateId,
        status: "archived",
        enabled: false,
        version: 3
      })
    );

    const activeOnlyResponse = await app.inject({
      method: "GET",
      url: "/api/daily/templates?activeOnly=true"
    });

    expect(activeOnlyResponse.statusCode).toBe(200);
    expect(activeOnlyResponse.json().templates).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ id: createdTemplateId })
      ])
    );
    expect(activeOnlyResponse.json().templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: duplicateResponse.json().template.id })
      ])
    );

    await app.close();
  });

  it("reads daily-work templates from the configured JSON data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;

    await writeFile(
      join(dataDir, "templates.json"),
      JSON.stringify(
        {
          templates: [
            {
              id: "json-template",
              mode: "daily_work",
              category: "planning",
              title: "JSON template",
              description: "Loaded from a local JSON data directory.",
              prompt: "Create a persisted daily plan.",
              artifactType: "task_list",
              tags: ["json", "repository"],
              enabled: true
            }
          ]
        },
        null,
        2
      )
    );

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/daily/templates"
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          mode: "daily_work",
          templates: [
            expect.objectContaining({
              id: "json-template",
              mode: "daily_work",
              category: "planning",
              artifactType: "task_list"
            })
          ]
        });
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("initializes missing daily-work JSON files from seed data", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/daily/templates"
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().templates).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "email-draft",
              mode: "daily_work"
            })
          ])
        );
        expect(response.json().templates).toHaveLength(6);

        const templatesFile = JSON.parse(
          await readFile(join(dataDir, "templates.json"), "utf8")
        );
        expect(templatesFile.templates).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "email-draft",
              mode: "daily_work"
            })
          ])
        );
        expect(templatesFile.templates).toHaveLength(6);
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("returns an explicit error for malformed daily-work JSON without replacing it", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;
    const templatesPath = join(dataDir, "templates.json");
    const malformedJson = "{ not valid json";

    await writeFile(templatesPath, malformedJson);

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/daily/templates"
        });

        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual(
          expect.objectContaining({
            statusCode: 500,
            error: "Internal Server Error",
            message: expect.stringContaining(
              'Invalid daily-work JSON data file for collection "templates"'
            )
          })
        );
        expect(await readFile(templatesPath, "utf8")).toBe(malformedJson);
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("does not overwrite schema-invalid daily-work JSON during writeback", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;
    const approvalsPath = join(dataDir, "approvals.json");
    const invalidApprovals = JSON.stringify(
      {
        approvals: [
          {
            id: "draft-external-reply"
          }
        ]
      },
      null,
      2
    );

    await writeFile(approvalsPath, invalidApprovals);

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/daily/approvals/draft-external-reply/decision",
          payload: {
            decision: "approved"
          }
        });

        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual(
          expect.objectContaining({
            statusCode: 500,
            error: "Internal Server Error",
            message: expect.stringContaining(
              'Invalid daily-work JSON schema for collection "approvals"'
            )
          })
        );
        expect(await readFile(approvalsPath, "utf8")).toBe(invalidApprovals);
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("previews a daily-work template application without external effects", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/templates/email-draft/apply-preview",
      payload: {
        prompt: "Draft a concise customer reply from the latest notes.",
        contextItemIds: ["customer-email", "meeting-notes", "customer-email"]
      }
    });
    const body = dailyWorkTemplateApplyPreviewResponseSchema.parse(
      response.json()
    );

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      preview: expect.objectContaining({
        id: "email-draft:apply-preview",
        mode: "daily_work",
        templateId: "email-draft",
        templateTitle: expect.any(String),
        category: "writing",
        artifactType: "email_draft",
        suggestedArtifactType: "email_draft",
        requestedContextItemIds: ["customer-email", "meeting-notes"],
        requiredApprovalRequestIds: ["draft-external-reply"],
        previewOnly: true,
        externalEffects: ["none"],
        promptDraft: expect.stringContaining("daily_work"),
        safetyBoundary: expect.objectContaining({
          previewOnly: true,
          externalEffects: ["none"],
          prohibitedExternalActions: expect.arrayContaining([
            "create_artifact",
            "send_email",
            "write_document",
            "read_private_external_data"
          ]),
          statement: expect.stringContaining("creates no artifact")
        })
      })
    });
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Template id: email-draft")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Template artifact type: email_draft")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Requested context item ids: customer-email, meeting-notes")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("no external effects")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Draft a concise customer reply from the latest notes.")
    );
    expect(body.preview.steps).toHaveLength(4);
    expect(body.preview.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "email-draft:apply-preview:step-3",
          previewOnly: true,
          externalEffect: "none",
          description: expect.stringContaining("without creating an artifact")
        }),
        expect.objectContaining({
          id: "email-draft:apply-preview:step-4",
          description: expect.stringContaining("draft-external-reply")
        })
      ])
    );
    expect(Date.parse(body.preview.generatedAt)).not.toBeNaN();

    await app.close();
  });

  it("persists daily-work template apply preview activity in the configured JSON data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/daily/templates/email-draft/apply-preview",
          payload: {
            prompt: "Persist this template apply preview.",
            contextItemIds: ["customer-email", "meeting-notes"]
          }
        });
        const body = dailyWorkTemplateApplyPreviewResponseSchema.parse(
          response.json()
        );

        expect(response.statusCode).toBe(200);
        expect(body.preview).toEqual(
          expect.objectContaining({
            templateId: "email-draft",
            previewOnly: true,
            externalEffects: ["none"]
          })
        );

        const eventsResponse = await app.inject({
          method: "GET",
          url: "/api/daily/events"
        });
        const eventsBody = dailyActivityEventsResponseSchema.parse(
          eventsResponse.json()
        );
        const event = findEventByIdPattern(
          eventsBody.events,
          /template.*email-draft.*apply-preview/,
          "template apply preview event"
        );

        expect(event).toEqual(
          expect.objectContaining({
            mode: "daily_work",
            status: "completed",
            relatedRefs: expect.objectContaining({
              templateIds: ["email-draft"],
              approvalRequestIds: ["draft-external-reply"],
              contextItemIds: ["customer-email", "meeting-notes"]
            }),
            safetyBoundary: expect.objectContaining({
              previewOnly: true,
              externalEffects: ["none"]
            }),
            metadata: expect.objectContaining({
              externalEffects: ["none"],
              artifactType: "email_draft"
            })
          })
        );
        expect([
          "workflow.preview.completed",
          "template.applied"
        ]).toContain(event.eventType);

        const eventsFile = JSON.parse(
          await readFile(join(dataDir, "events.json"), "utf8")
        );
        expect(eventsFile.events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: event.id
            })
          ])
        );
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("refuses template apply previews for the reserved coding-agent mode", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/templates/email-draft/apply-preview",
      payload: {
        mode: "coding_agent"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      error: "Template apply previews are only available in daily_work mode."
    });

    await app.close();
  });

  it("returns 404 when a daily-work template apply preview target is missing", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/templates/missing-template/apply-preview",
      payload: {}
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      mode: "daily_work",
      error: "Daily-work template not found."
    });

    await app.close();
  });

  it("returns 400 for an invalid template apply preview request", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/templates/email-draft/apply-preview",
      payload: {
        prompt: "",
        contextItemIds: ["meeting-notes", ""]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Invalid template apply preview request.",
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: "prompt"
        }),
        expect.objectContaining({
          path: "contextItemIds.1"
        })
      ])
    });

    await app.close();
  });

  it("handles CORS preflight for template apply previews", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/templates/email-draft/apply-preview",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("allows configured CORS origins for multi-port browser verification", async () => {
    const originalAllowedOrigins = process.env.SEEKDESK_ALLOWED_ORIGINS;
    process.env.SEEKDESK_ALLOWED_ORIGINS = "http://127.0.0.1:3100";
    const app = await buildServer();

    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/daily/templates/email-draft/apply-preview",
        headers: {
          origin: "http://127.0.0.1:3100"
        }
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:3100"
      );
    } finally {
      await app.close();
      if (originalAllowedOrigins === undefined) {
        delete process.env.SEEKDESK_ALLOWED_ORIGINS;
      } else {
        process.env.SEEKDESK_ALLOWED_ORIGINS = originalAllowedOrigins;
      }
    }
  });

  it("returns the default daily-work context items when no mode is provided", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/context"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "daily_work",
      items: expect.arrayContaining([
        expect.objectContaining({
          id: "meeting-notes",
          mode: "daily_work",
          sourceType: "meeting_notes",
          permissionState: "workspace_shared"
        }),
        expect.objectContaining({
          id: "customer-email",
          mode: "daily_work",
          sourceType: "customer_email",
          permissionState: "requires_review"
        })
      ])
    });
    expect(response.json().items).toHaveLength(5);

    await app.close();
  });

  it("previews daily-work context use without reading real content", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/context/customer-email/use-preview",
      payload: {
        templateId: "email-draft",
        prompt: "Use this customer context to prepare an approval-safe reply."
      }
    });
    const body = dailyContextUsePreviewResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      preview: expect.objectContaining({
        id: "customer-email:use-preview",
        mode: "daily_work",
        contextItemId: "customer-email",
        title: "Customer Email",
        sourceType: "customer_email",
        permissionState: "requires_review",
        tags: ["customer", "email", "private"],
        templateId: "email-draft",
        requiredApprovalRequestIds: ["read-customer-email-context"],
        previewOnly: true,
        externalEffects: ["none"],
        promptDraft: expect.stringContaining("daily_work"),
        safetyBoundary: expect.objectContaining({
          previewOnly: true,
          externalEffects: ["none"],
          prohibitedExternalActions: expect.arrayContaining([
            "read_real_email_content",
            "read_private_external_data",
            "send_email",
            "write_document"
          ]),
          statement: expect.stringContaining("does not read real files")
        }),
        generatedAt: expect.any(String)
      })
    });
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Context item id: customer-email")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Context title: Customer Email")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Source type: customer_email")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Permission state: requires_review")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Template id: email-draft")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("read-customer-email-context")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("no external effects")
    );
    expect(body.preview.promptDraft).toEqual(
      expect.stringContaining("Use this customer context to prepare an approval-safe reply.")
    );
    expect(body.preview.steps).toHaveLength(4);
    expect(body.preview.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "customer-email:use-preview:step-1",
          previewOnly: true,
          externalEffect: "none",
          description: expect.stringContaining("without reading")
        }),
        expect.objectContaining({
          id: "customer-email:use-preview:step-4",
          description: expect.stringContaining("read-customer-email-context")
        })
      ])
    );
    expect(Date.parse(body.preview.generatedAt)).not.toBeNaN();

    await app.close();
  });

  it("persists daily-work context preview activity in the configured JSON data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/daily/context/customer-email/use-preview",
          payload: {
            templateId: "email-draft",
            prompt: "Create a persisted context preview event."
          }
        });
        const body = dailyContextUsePreviewResponseSchema.parse(response.json());

        expect(response.statusCode).toBe(200);
        expect(body.preview.contextItemId).toBe("customer-email");

        const eventsResponse = await app.inject({
          method: "GET",
          url: "/api/daily/events"
        });
        const eventsBody = dailyActivityEventsResponseSchema.parse(
          eventsResponse.json()
        );
        expect(eventsBody.events[0]).toEqual(
          expect.objectContaining({
            id: "daily-event-context-customer-email-use-preview",
            eventType: "workflow.preview.completed",
            status: "completed",
            relatedRefs: expect.objectContaining({
              templateIds: ["email-draft"],
              approvalRequestIds: ["read-customer-email-context"],
              contextItemIds: ["customer-email"]
            }),
            metadata: expect.objectContaining({
              permissionState: "requires_review",
              externalEffects: ["none"]
            })
          })
        );

        const eventsFile = JSON.parse(
          await readFile(join(dataDir, "events.json"), "utf8")
        );
        expect(eventsFile.events[0]).toEqual(
          expect.objectContaining({
            id: "daily-event-context-customer-email-use-preview"
          })
        );
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("refuses context use previews for the reserved coding-agent mode", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/context/customer-email/use-preview",
      payload: {
        mode: "coding_agent"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      error: "Context use previews are only available in daily_work mode."
    });

    await app.close();
  });

  it("returns 404 when a daily-work context use preview target is missing", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/context/missing-context/use-preview",
      payload: {}
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      mode: "daily_work",
      error: "Daily-work context item not found."
    });

    await app.close();
  });

  it("returns 400 for an invalid context use preview request", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/context/customer-email/use-preview",
      payload: {
        prompt: "",
        templateId: ""
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Invalid context use preview request.",
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: "prompt"
        }),
        expect.objectContaining({
          path: "templateId"
        })
      ])
    });

    await app.close();
  });

  it("handles CORS preflight for context use previews", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/context/customer-email/use-preview",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("returns the default daily-work approval requests when no mode is provided", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/approvals"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "daily_work",
      requests: expect.arrayContaining([
        expect.objectContaining({
          id: "read-customer-email-context",
          mode: "daily_work",
          actionType: "read_customer_email_context",
          requiredPermissionMode: "confirm_private_context_and_actions",
          permissionAware: true
        }),
        expect.objectContaining({
          id: "draft-external-reply",
          mode: "daily_work",
          actionType: "draft_external_reply",
          requiredPermissionMode: "confirm_writes_and_commands",
          permissionAware: true
        })
      ])
    });
    expect(response.json().requests).toHaveLength(4);

    await app.close();
  });

  it("previews an approved daily-work approval decision", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/approvals/draft-external-reply/decision",
      payload: {
        decision: "approved",
        reason: "Reviewed the customer-facing draft boundary."
      }
    });
    const body = dailyApprovalDecisionResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      request: expect.objectContaining({
        id: "draft-external-reply",
        status: "approved",
        decision: "allow_once"
      }),
      audit: expect.objectContaining({
        previewOnly: true,
        decision: "allow_once",
        status: "approved",
        reason: "Reviewed the customer-facing draft boundary.",
        externalEffects: ["none"],
        statement: expect.stringContaining("does not perform")
      })
    });
    expect(Date.parse(body.audit.decidedAt)).not.toBeNaN();

    await app.close();
  });

  it("persists daily-work approval decisions to the configured JSON data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;

    try {
      const app = await buildServer();

      try {
        const decisionResponse = await app.inject({
          method: "POST",
          url: "/api/daily/approvals/draft-external-reply/decision",
          payload: {
            decision: "approved",
            reason: "Persist this simulated approval."
          }
        });
        const decisionBody = dailyApprovalDecisionResponseSchema.parse(
          decisionResponse.json()
        );

        expect(decisionResponse.statusCode).toBe(200);
        expect(decisionBody.request).toEqual(
          expect.objectContaining({
            id: "draft-external-reply",
            status: "approved",
            decision: "allow_once"
          })
        );

        const approvalListResponse = await app.inject({
          method: "GET",
          url: "/api/daily/approvals"
        });
        expect(approvalListResponse.json().requests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "draft-external-reply",
              status: "approved",
              decision: "allow_once"
            })
          ])
        );

        const eventsResponse = await app.inject({
          method: "GET",
          url: "/api/daily/events"
        });
        const eventsBody = dailyActivityEventsResponseSchema.parse(
          eventsResponse.json()
        );
        expect(eventsBody.events[0]).toEqual(
          expect.objectContaining({
            id: "daily-event-approval-draft-external-reply-decision",
            eventType: "approval.changed",
            status: "completed",
            relatedRefs: expect.objectContaining({
              approvalRequestIds: ["draft-external-reply"]
            }),
            taskStatus: expect.objectContaining({
              approvalStatus: "approved"
            })
          })
        );

        const approvalsFile = JSON.parse(
          await readFile(join(dataDir, "approvals.json"), "utf8")
        );
        expect(approvalsFile.approvals).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "draft-external-reply",
              status: "approved",
              decision: "allow_once"
            })
          ])
        );
        const eventsFile = JSON.parse(
          await readFile(join(dataDir, "events.json"), "utf8")
        );
        expect(eventsFile.events[0]).toEqual(
          expect.objectContaining({
            id: "daily-event-approval-draft-external-reply-decision"
          })
        );
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("previews a denied daily-work approval decision", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/approvals/read-customer-email-context/decision",
      payload: {
        decision: "deny"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(dailyApprovalDecisionResponseSchema.parse(response.json())).toEqual({
      mode: "daily_work",
      request: expect.objectContaining({
        id: "read-customer-email-context",
        status: "denied",
        decision: "deny"
      }),
      audit: expect.objectContaining({
        previewOnly: true,
        decision: "deny",
        status: "denied",
        externalEffects: ["none"]
      })
    });

    await app.close();
  });

  it("returns 404 when an approval decision target is missing", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/approvals/missing-approval/decision",
      payload: {
        decision: "approved"
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      mode: "daily_work",
      error: "Daily-work approval request not found."
    });

    await app.close();
  });

  it("returns 400 for an invalid approval decision", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/approvals/draft-external-reply/decision",
      payload: {
        decision: "maybe"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Invalid approval decision.",
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: "decision"
        })
      ])
    });

    await app.close();
  });

  it("handles CORS preflight for approval decisions", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/approvals/draft-external-reply/decision",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("returns default daily-work artifacts", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/artifacts"
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      artifacts: expect.arrayContaining([
        expect.objectContaining({
          id: "email-draft-artifact",
          mode: "daily_work",
          artifactType: "email_draft",
          status: "draft",
          owner: expect.objectContaining({
            id: "account-owner",
            displayName: "Account Owner"
          }),
          updatedAt: "2026-06-02T11:20:00.000Z",
          sourceContextIds: ["customer-email", "meeting-notes"],
          approvalRequestIds: [
            "read-customer-email-context",
            "draft-external-reply"
          ],
          version: 1,
          reusable: false,
          nextAction: expect.objectContaining({
            type: "request_review",
            approvalRequestId: "draft-external-reply"
          }),
          permissionState: "requires_review",
          lifecycle: expect.arrayContaining([
            expect.objectContaining({
              type: "created"
            }),
            expect.objectContaining({
              type: "approval_linked"
            })
          ]),
          trace: expect.objectContaining({
            origin: "template",
            createdBy: "account-owner",
            events: expect.arrayContaining([
              expect.objectContaining({
                type: "approval_linked"
              })
            ])
          })
        }),
        expect.objectContaining({
          id: "research-note-artifact",
          status: "reusable",
          sourceContextIds: ["research-links", "project-brief"],
          approvalRequestIds: [],
          version: 3,
          reusable: true,
          permissionState: "public",
          lifecycle: expect.arrayContaining([
            expect.objectContaining({
              type: "marked_reusable"
            })
          ])
        })
      ])
    });
    expect(body.artifacts).toHaveLength(4);

    await app.close();
  });

  it("returns one daily-work artifact by id", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/artifacts/research-note-artifact"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "daily_work",
      artifact: expect.objectContaining({
        id: "research-note-artifact",
        status: "reusable",
        templateId: "research-brief",
        nextAction: expect.objectContaining({
          type: "reuse_in_template"
        })
      })
    });

    await app.close();
  });

  it("returns the default daily-work connector catalog", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/connectors"
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      connectors: expect.arrayContaining([
        expect.objectContaining({
          id: "workspace-documents",
          mode: "daily_work",
          category: "documents",
          provider: "workspace_drive",
          status: "available",
          permissionState: "workspace_shared",
          riskLevel: "medium",
          availableActions: ["search", "read_context", "draft_document"],
          relatedContextItemIds: ["project-brief", "meeting-notes"],
          requiredApprovalRequestIds: ["use-internal-meeting-notes"]
        }),
        expect.objectContaining({
          id: "team-calendar",
          category: "calendar",
          status: "requires_setup",
          permissionState: "requires_review",
          riskLevel: "medium",
          availableActions: [
            "read_context",
            "prepare_calendar_follow_up"
          ],
          relatedContextItemIds: ["meeting-notes"],
          requiredApprovalRequestIds: ["schedule-calendar-follow-up"]
        }),
        expect.objectContaining({
          id: "customer-email",
          category: "email",
          provider: "local_mail_archive",
          status: "preview",
          permissionState: "requires_review",
          riskLevel: "high",
          availableActions: ["read_context", "prepare_email_draft"],
          relatedContextItemIds: ["customer-email", "meeting-notes"],
          requiredApprovalRequestIds: [
            "read-customer-email-context",
            "draft-external-reply"
          ]
        }),
        expect.objectContaining({
          id: "workspace-notes",
          category: "notes",
          provider: "notion",
          permissionState: "workspace_shared",
          riskLevel: "low"
        }),
        expect.objectContaining({
          id: "team-knowledge-base",
          category: "knowledge",
          provider: "confluence",
          permissionState: "public",
          riskLevel: "low"
        })
      ])
    });
    expect(body.connectors).toHaveLength(5);
    expect(body.connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notes: expect.arrayContaining([
            expect.stringContaining("Mock catalog entry only")
          ])
        })
      ])
    );

    await app.close();
  });

  it("returns one daily-work connector by id", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/connectors/customer-email"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "daily_work",
      connector: expect.objectContaining({
        id: "customer-email",
        displayName: "Customer Email",
        status: "preview",
        permissionState: "requires_review",
        riskLevel: "high",
        lastSyncAt: "2026-06-02T09:45:00.000Z",
        availableActions: ["read_context", "prepare_email_draft"],
        relatedContextItemIds: ["customer-email", "meeting-notes"],
        requiredApprovalRequestIds: [
          "read-customer-email-context",
          "draft-external-reply"
        ]
      })
    });

    await app.close();
  });

  it("previews a daily-work connector action without external effects", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/connectors/customer-email/preview",
      payload: {
        action: "prepare_email_draft",
        contextItemIds: ["meeting-notes"],
        prompt: "Draft a concise customer follow-up."
      }
    });
    const body = connectorActionPreviewResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      preview: expect.objectContaining({
        id: "customer-email:prepare_email_draft:preview",
        mode: "daily_work",
        connectorId: "customer-email",
        connectorDisplayName: "Customer Email",
        action: "prepare_email_draft",
        previewOnly: true,
        permissionState: "requires_review",
        riskLevel: "high",
        relatedContextItemIds: ["customer-email", "meeting-notes"],
        requiredApprovalRequestIds: [
          "read-customer-email-context",
          "draft-external-reply"
        ],
        prompt: "Draft a concise customer follow-up.",
        safetyBoundary: expect.objectContaining({
          previewOnly: true,
          externalEffects: ["none"],
          prohibitedExternalActions: expect.arrayContaining([
            "send_email",
            "read_private_external_data"
          ])
        })
      })
    });
    expect(body.preview.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalEffect: "none"
        })
      ])
    );

    await app.close();
  });

  it("persists daily-work connector preview activity in the configured JSON data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/daily/connectors/customer-email/preview",
          payload: {
            action: "prepare_email_draft",
            contextItemIds: ["meeting-notes"],
            prompt: "Persist this connector preview."
          }
        });
        const body = connectorActionPreviewResponseSchema.parse(
          response.json()
        );

        expect(response.statusCode).toBe(200);
        expect(body.preview).toEqual(
          expect.objectContaining({
            connectorId: "customer-email",
            action: "prepare_email_draft",
            previewOnly: true
          })
        );

        const eventsResponse = await app.inject({
          method: "GET",
          url: "/api/daily/events"
        });
        const eventsBody = dailyActivityEventsResponseSchema.parse(
          eventsResponse.json()
        );
        const event = findEventByIdPattern(
          eventsBody.events,
          /connector.*customer-email.*prepare_email_draft.*preview/,
          "connector preview event"
        );

        expect(event).toEqual(
          expect.objectContaining({
            mode: "daily_work",
            eventType: "workflow.preview.completed",
            status: "completed",
            relatedRefs: expect.objectContaining({
              approvalRequestIds: [
                "read-customer-email-context",
                "draft-external-reply"
              ],
              connectorIds: ["customer-email"],
              contextItemIds: ["customer-email", "meeting-notes"]
            }),
            safetyBoundary: expect.objectContaining({
              previewOnly: true,
              externalEffects: ["none"]
            }),
            metadata: expect.objectContaining({
              riskLevel: "high",
              permissionState: "requires_review",
              externalEffects: ["none"]
            })
          })
        );

        const eventsFile = JSON.parse(
          await readFile(join(dataDir, "events.json"), "utf8")
        );
        expect(eventsFile.events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: event.id
            })
          ])
        );
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("returns 400 when a connector preview action is not available", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/connectors/team-calendar/preview",
      payload: {
        action: "prepare_email_draft"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      mode: "daily_work",
      connectorId: "team-calendar",
      action: "prepare_email_draft",
      error: "Connector action is not available for this connector."
    });

    await app.close();
  });

  it("returns 404 when a connector preview target is missing", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/connectors/missing-connector/preview",
      payload: {
        action: "search"
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      mode: "daily_work",
      error: "Daily-work connector not found."
    });

    await app.close();
  });

  it("returns 400 for an invalid connector preview action", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/connectors/customer-email/preview",
      payload: {
        action: "send_email"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Invalid connector action preview request.",
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: "action"
        })
      ])
    });

    await app.close();
  });

  it("returns 404 when a daily-work connector is missing", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/connectors/missing-connector"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      mode: "daily_work",
      error: "Daily-work connector not found."
    });

    await app.close();
  });

  it("keeps the reserved coding-agent compatibility path for daily connectors", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/connectors?mode=coding_agent"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      connectors: []
    });

    await app.close();
  });

  it("handles CORS preflight for daily connectors", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/connectors",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("handles CORS preflight for connector action previews", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/connectors/customer-email/preview",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("returns the default daily-work workflow previews", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/workflows"
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      workflows: expect.arrayContaining([
        expect.objectContaining({
          id: "customer-email-draft-workflow",
          mode: "daily_work",
          status: "waiting_for_approval",
          previewOnly: true,
          safetyBoundary: expect.objectContaining({
            previewOnly: true,
            externalEffects: ["none"],
            prohibitedExternalActions: expect.arrayContaining([
              "send_email",
              "write_document",
              "schedule_calendar_event"
            ])
          }),
          connectorLinks: expect.arrayContaining([
            expect.objectContaining({
              connectorId: "customer-email",
              permissionState: "requires_review",
              riskLevel: "high"
            })
          ]),
          contextLinks: expect.arrayContaining([
            expect.objectContaining({
              contextItemId: "customer-email",
              permissionState: "requires_review"
            })
          ]),
          artifactLinks: expect.arrayContaining([
            expect.objectContaining({
              artifactId: "email-draft-artifact",
              artifactType: "email_draft"
            })
          ]),
          approvalLinks: expect.arrayContaining([
            expect.objectContaining({
              approvalRequestId: "draft-external-reply",
              requiredPermissionMode: "confirm_writes_and_commands"
            })
          ]),
          actionQueue: expect.arrayContaining([
            expect.objectContaining({
              id: "queue-email-draft",
              actionType: "draft_email",
              status: "needs_approval",
              previewOnly: true,
              externalEffects: ["none"],
              riskLevel: "high",
              permissionState: "requires_explicit_approval"
            })
          ])
        }),
        expect.objectContaining({
          id: "meeting-summary-workflow",
          actionQueue: expect.arrayContaining([
            expect.objectContaining({
              actionType: "summarize_meeting",
              riskLevel: "low",
              permissionState: "workspace_shared"
            })
          ])
        }),
        expect.objectContaining({
          id: "calendar-follow-up-workflow",
          actionQueue: expect.arrayContaining([
            expect.objectContaining({
              actionType: "prepare_calendar_follow_up",
              riskLevel: "medium",
              permissionState: "requires_explicit_approval"
            })
          ])
        }),
        expect.objectContaining({
          id: "weekly-report-task-plan-workflow",
          actionQueue: expect.arrayContaining([
            expect.objectContaining({
              actionType: "compile_weekly_report"
            }),
            expect.objectContaining({
              actionType: "create_task_plan"
            })
          ])
        })
      ])
    });
    expect(body.workflows).toHaveLength(4);
    expect(
      body.workflows.flatMap(
        (workflow: { actionQueue: unknown[] }) => workflow.actionQueue
      )
    ).toHaveLength(5);

    await app.close();
  });

  it("returns one daily-work workflow preview by id", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/workflows/weekly-report-task-plan-workflow"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "daily_work",
      workflow: expect.objectContaining({
        id: "weekly-report-task-plan-workflow",
        previewOnly: true,
        safetyBoundary: expect.objectContaining({
          statement: expect.stringContaining("never sends, writes, schedules")
        }),
        actionQueue: expect.arrayContaining([
          expect.objectContaining({
            id: "queue-weekly-report",
            actionType: "compile_weekly_report",
            connectorLinks: expect.arrayContaining([
              expect.objectContaining({
                connectorId: "workspace-documents"
              })
            ]),
            contextLinks: expect.arrayContaining([
              expect.objectContaining({
                contextItemId: "project-brief"
              })
            ]),
            artifactLinks: expect.arrayContaining([
              expect.objectContaining({
                artifactId: "research-note-artifact"
              })
            ])
          }),
          expect.objectContaining({
            id: "queue-task-plan",
            actionType: "create_task_plan",
            previewOnly: true,
            externalEffects: ["none"]
          })
        ])
      })
    });

    await app.close();
  });

  it("previews a daily-work workflow action without external effects", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/workflows/weekly-report-task-plan-workflow/preview",
      payload: {
        actionId: "queue-task-plan",
        prompt: "Turn the weekly report into next-week planning bullets.",
        contextItemIds: ["research-links"]
      }
    });
    const body = dailyWorkWorkflowPreviewResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      preview: expect.objectContaining({
        id: "weekly-report-task-plan-workflow:queue-task-plan:preview",
        mode: "daily_work",
        workflowId: "weekly-report-task-plan-workflow",
        workflowTitle: "Weekly Report and Task Plan",
        selectedActionId: "queue-task-plan",
        selectedActionType: "create_task_plan",
        selectedActionStatus: "queued",
        previewOnly: true,
        externalEffects: ["none"],
        prompt: "Turn the weekly report into next-week planning bullets.",
        requestedContextItemIds: ["research-links"],
        summary: expect.stringContaining("No connector action"),
        safetyBoundary: expect.objectContaining({
          previewOnly: true,
          externalEffects: ["none"],
          prohibitedExternalActions: expect.arrayContaining([
            "send_email",
            "write_document",
            "schedule_calendar_event",
            "create_task"
          ])
        }),
        connectorLinks: expect.arrayContaining([
          expect.objectContaining({
            connectorId: "workspace-documents",
            action: "draft_document"
          })
        ]),
        contextLinks: expect.arrayContaining([
          expect.objectContaining({
            contextItemId: "project-brief",
            usage: "output_basis"
          }),
          expect.objectContaining({
            contextItemId: "research-links",
            usage: "reference",
            permissionState: "public"
          })
        ]),
        artifactLinks: expect.arrayContaining([
          expect.objectContaining({
            artifactId: "task-list-artifact",
            artifactType: "task_list"
          })
        ]),
        approvalLinks: []
      })
    });
    expect(body.preview.steps).toHaveLength(1);
    expect(body.preview.steps[0]).toEqual(
      expect.objectContaining({
        actionId: "queue-task-plan",
        actionType: "create_task_plan",
        previewOnly: true,
        externalEffect: "none",
        connectorLinks: expect.arrayContaining([
          expect.objectContaining({
            connectorId: "workspace-documents"
          })
        ])
      })
    );

    await app.close();
  });

  it("persists daily-work workflow preview activity in the configured JSON data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/daily/workflows/weekly-report-task-plan-workflow/preview",
          payload: {
            actionId: "queue-weekly-report",
            contextItemIds: ["project-brief", "team-notes"],
            prompt: "Persist this workflow preview."
          }
        });
        const body = dailyWorkWorkflowPreviewResponseSchema.parse(
          response.json()
        );

        expect(response.statusCode).toBe(200);
        expect(body.preview).toEqual(
          expect.objectContaining({
            workflowId: "weekly-report-task-plan-workflow",
            selectedActionId: "queue-weekly-report",
            previewOnly: true,
            externalEffects: ["none"]
          })
        );

        const eventsResponse = await app.inject({
          method: "GET",
          url: "/api/daily/events"
        });
        const eventsBody = dailyActivityEventsResponseSchema.parse(
          eventsResponse.json()
        );
        const event = findEventByIdPattern(
          eventsBody.events,
          /workflow.*weekly-report-task-plan-workflow.*queue-weekly-report.*preview/,
          "workflow preview event"
        );

        expect(event).toEqual(
          expect.objectContaining({
            mode: "daily_work",
            eventType: "workflow.preview.completed",
            status: "completed",
            relatedRefs: expect.objectContaining({
              workflowIds: ["weekly-report-task-plan-workflow"],
              actionQueueItemIds: ["queue-weekly-report"],
              connectorIds: ["workspace-documents"],
              contextItemIds: expect.arrayContaining([
                "project-brief",
                "team-notes"
              ])
            }),
            safetyBoundary: expect.objectContaining({
              previewOnly: true,
              externalEffects: ["none"]
            }),
            taskStatus: expect.objectContaining({
              workflowStatus: "preview",
              actionQueueStatus: "preview_ready"
            }),
            metadata: expect.objectContaining({
              externalEffects: ["none"]
            })
          })
        );

        const eventsFile = JSON.parse(
          await readFile(join(dataDir, "events.json"), "utf8")
        );
        expect(eventsFile.events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: event.id
            })
          ])
        );
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("returns 400 when a workflow preview action is not available", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/workflows/weekly-report-task-plan-workflow/preview",
      payload: {
        actionId: "queue-missing-action"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      mode: "daily_work",
      workflowId: "weekly-report-task-plan-workflow",
      actionId: "queue-missing-action",
      error: "Workflow action is not available for this workflow."
    });

    await app.close();
  });

  it("returns 404 when a daily-work workflow is missing", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/workflows/missing-workflow"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      mode: "daily_work",
      error: "Daily-work workflow not found."
    });

    await app.close();
  });

  it("refuses workflow previews for the reserved coding-agent mode", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/workflows/weekly-report-task-plan-workflow/preview",
      payload: {
        mode: "coding_agent"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      error: "Workflow previews are only available in daily_work mode."
    });

    await app.close();
  });

  it("keeps the reserved coding-agent compatibility path for daily workflows", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/workflows?mode=coding_agent"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      workflows: []
    });

    await app.close();
  });

  it("handles CORS preflight for workflow previews", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/workflows/weekly-report-task-plan-workflow/preview",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("handles CORS preflight for daily workflows", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/workflows",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("returns the default daily-work model usage snapshot", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/model-usage"
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      config: expect.objectContaining({
        mode: "daily_work",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        fastModel: "deepseek-v4-flash",
        proModel: "deepseek-v4-pro",
        selectedRoute: "fast",
        selectedModel: "deepseek-v4-flash",
        thinkingMode: "disabled",
        streamUsageEnabled: true,
        configured: false,
        notes: expect.arrayContaining([
          "DEEPSEEK_API_KEY is not configured; mock usage data is shown."
        ])
      }),
      usage: expect.objectContaining({
        window: expect.objectContaining({
          id: "daily-work-rolling-24h",
          label: "Last 24 hours"
        }),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        currency: "USD",
        budgetState: "tracking_only",
        records: [],
        aggregates: expect.arrayContaining([
          expect.objectContaining({
            id: "current_session",
            label: "Current session",
            totalTokens: 0,
            recordCount: 0
          }),
          expect.objectContaining({
            id: "24h",
            label: "Last 24 hours"
          }),
          expect.objectContaining({
            id: "7d",
            label: "Last 7 days"
          }),
          expect.objectContaining({
            id: "all",
            label: "All time"
          })
        ])
      })
    });
    expect(body.usage.records).toHaveLength(0);

    await app.close();
  });

  it("uses DeepSeek env semantics without leaking the API key", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-secret-value";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.example";
    process.env.DEEPSEEK_MODEL_FAST = "deepseek-v4-pro";
    process.env.DEEPSEEK_MODEL_PRO = "deepseek-v4-pro";
    process.env.DEEPSEEK_MODEL_ROUTE = "pro";
    process.env.DEEPSEEK_THINKING_MODE = "enabled";
    process.env.DEEPSEEK_STREAM_USAGE = "false";

    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/model-usage"
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("sk-test-secret-value");
    expect(body.config).toEqual(
      expect.objectContaining({
        configured: true,
        baseUrl: "https://api.deepseek.example",
        fastModel: "deepseek-v4-pro",
        proModel: "deepseek-v4-pro",
        selectedRoute: "pro",
        selectedModel: "deepseek-v4-pro",
        thinkingMode: "enabled",
        streamUsageEnabled: false
      })
    );
    expect(body.usage.budgetState).toBe("within_budget");
    expect(body.usage.records).toEqual([]);
    expect(body.usage.aggregates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "all",
          recordCount: 0,
          totalTokens: 0
        })
      ])
    );

    await app.close();
  });

  it("keeps the reserved coding-agent compatibility path for model usage", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-secret-value";

    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/model-usage?mode=coding_agent"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      config: expect.objectContaining({
        mode: "coding_agent",
        provider: "deepseek",
        configured: false,
        thinkingMode: "disabled",
        streamUsageEnabled: false,
        notes: expect.arrayContaining([
          "coding_agent mode is reserved in this build; model usage is disabled."
        ])
      }),
      usage: expect.objectContaining({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        currency: "USD",
        budgetState: "disabled",
        records: []
      })
    });
    expect(response.body).not.toContain("sk-test-secret-value");

    await app.close();
  });

  it("handles CORS preflight for daily model usage", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/model-usage",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("returns default daily-work session summaries", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/sessions"
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      sessions: expect.arrayContaining([
        expect.objectContaining({
          id: "customer-follow-up-session",
          workspaceId: "workspace-seekdesk",
          appMode: "daily_work",
          status: "waiting_for_approval",
          artifactIds: ["email-draft-artifact"],
          contextItemIds: ["customer-email", "meeting-notes"],
          approvalRequestIds: [
            "read-customer-email-context",
            "draft-external-reply"
          ],
          messageCount: 8,
          tags: ["email", "customer", "approval"],
          lastAction: expect.objectContaining({
            artifactId: "email-draft-artifact",
            approvalRequestId: "draft-external-reply"
          })
        }),
        expect.objectContaining({
          id: "planning-refresh-session",
          status: "active",
          artifactIds: ["task-list-artifact", "research-note-artifact"],
          contextItemIds: ["project-brief", "research-links", "meeting-notes"],
          approvalRequestIds: ["schedule-calendar-follow-up"]
        })
      ])
    });
    expect(body.sessions).toHaveLength(3);
    expect(body.sessions[0]).not.toHaveProperty("recentMessages");

    await app.close();
  });

  it("returns one daily-work session detail by id", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/sessions/customer-follow-up-session"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "daily_work",
      session: expect.objectContaining({
        id: "customer-follow-up-session",
        artifactIds: ["email-draft-artifact"],
        contextItemIds: ["customer-email", "meeting-notes"],
        approvalRequestIds: [
          "read-customer-email-context",
          "draft-external-reply"
        ],
        recentMessages: expect.arrayContaining([
          expect.objectContaining({
            id: "customer-follow-up-message-1",
            contextItemIds: ["customer-email", "meeting-notes"],
            approvalRequestIds: ["read-customer-email-context"]
          }),
          expect.objectContaining({
            id: "customer-follow-up-message-2",
            artifactIds: ["email-draft-artifact"],
            approvalRequestIds: ["draft-external-reply"]
          })
        ])
      })
    });

    await app.close();
  });

  it("persists session rename, pin, archive, delete, and activity events", async () => {
    const app = await buildServer();

    const updateResponse = await app.inject({
      method: "PATCH",
      url: "/api/daily/sessions/customer-follow-up-session",
      payload: {
        mode: "daily_work",
        title: "Renamed customer session",
        pinned: true
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toEqual({
      mode: "daily_work",
      session: expect.objectContaining({
        id: "customer-follow-up-session",
        title: "Renamed customer session",
        pinned: true
      })
    });

    const archiveResponse = await app.inject({
      method: "PATCH",
      url: "/api/daily/sessions/customer-follow-up-session",
      payload: {
        mode: "daily_work",
        status: "archived"
      }
    });

    expect(archiveResponse.statusCode).toBe(200);
    expect(archiveResponse.json().session).toEqual(
      expect.objectContaining({
        id: "customer-follow-up-session",
        status: "archived",
        pinned: true
      })
    );

    const eventsResponse = await app.inject({
      method: "GET",
      url: "/api/daily/events?mode=daily_work"
    });

    expect(eventsResponse.statusCode).toBe(200);
    expect(eventsResponse.json().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "session.updated",
          relatedRefs: expect.objectContaining({
            sessionIds: ["customer-follow-up-session"]
          })
        })
      ])
    );

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: "/api/daily/sessions/customer-follow-up-session?mode=daily_work"
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({
      mode: "daily_work",
      deleted: true,
      sessionId: "customer-follow-up-session"
    });

    const detailResponse = await app.inject({
      method: "GET",
      url: "/api/daily/sessions/customer-follow-up-session?mode=daily_work"
    });

    expect(detailResponse.statusCode).toBe(404);

    const deleteEventsResponse = await app.inject({
      method: "GET",
      url: "/api/daily/events?mode=daily_work"
    });
    expect(deleteEventsResponse.json().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "session.deleted",
          relatedRefs: expect.objectContaining({
            sessionIds: ["customer-follow-up-session"]
          })
        })
      ])
    );

    await app.close();
  });

  it("returns a preview-only daily-work session restore prompt", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/sessions/customer-follow-up-session/restore-preview",
      payload: {
        includeRecentMessages: true,
        prompt: "Resume by preparing the next approval-safe reply step."
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      mode: "daily_work",
      preview: expect.objectContaining({
        id: "customer-follow-up-session:restore-preview",
        mode: "daily_work",
        sessionId: "customer-follow-up-session",
        sessionTitle: "Customer follow-up draft",
        status: "waiting_for_approval",
        previewOnly: true,
        externalEffects: ["none"],
        summary:
          "Drafted a customer-facing reply grounded in meeting notes and protected email context.",
        lastAction: expect.objectContaining({
          label: "Requested review for the external reply draft.",
          artifactId: "email-draft-artifact",
          approvalRequestId: "draft-external-reply"
        }),
        artifactIds: ["email-draft-artifact"],
        contextItemIds: ["customer-email", "meeting-notes"],
        approvalRequestIds: [
          "read-customer-email-context",
          "draft-external-reply"
        ],
        recentMessagesPreview: expect.arrayContaining([
          expect.objectContaining({
            id: "customer-follow-up-message-1",
            role: "user"
          }),
          expect.objectContaining({
            id: "customer-follow-up-message-2",
            role: "assistant"
          })
        ]),
        safetyBoundary: expect.objectContaining({
          previewOnly: true,
          externalEffects: ["none"],
          prohibitedExternalActions: expect.arrayContaining([
            "send_email",
            "write_document",
            "schedule_calendar_event",
            "create_task",
            "read_private_external_data",
            "resume_real_execution"
          ]),
          statement: expect.stringContaining("no external effects")
        }),
        generatedAt: expect.any(String)
      })
    });
    expect(body.preview.restorePrompt).toEqual(
      expect.stringContaining("daily_work")
    );
    expect(body.preview.restorePrompt).toEqual(
      expect.stringContaining("customer-follow-up-session")
    );
    expect(body.preview.restorePrompt).toEqual(
      expect.stringContaining("Customer follow-up draft")
    );
    expect(body.preview.restorePrompt).toEqual(
      expect.stringContaining("Requested review for the external reply draft.")
    );
    expect(body.preview.restorePrompt).toEqual(
      expect.stringContaining("email-draft-artifact")
    );
    expect(body.preview.restorePrompt).toEqual(
      expect.stringContaining("customer-email")
    );
    expect(body.preview.restorePrompt).toEqual(
      expect.stringContaining("draft-external-reply")
    );
    expect(body.preview.restorePrompt).toEqual(
      expect.stringContaining("no external effects")
    );
    expect(body.preview.restorePrompt).toEqual(
      expect.stringContaining("Resume by preparing the next approval-safe reply step.")
    );
    expect(body.preview.recentMessagesPreview).toHaveLength(2);

    await app.close();
  });

  it("persists daily-work session restore previews to the configured JSON data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;

    try {
      const app = await buildServer();

      try {
        const restoreResponse = await app.inject({
          method: "POST",
          url: "/api/daily/sessions/customer-follow-up-session/restore-preview",
          payload: {
            includeRecentMessages: true,
            prompt: "Persist this restore preview."
          }
        });
        const restoreBody = restoreResponse.json();

        expect(restoreResponse.statusCode).toBe(200);
        expect(restoreBody.preview.generatedAt).toEqual(expect.any(String));

        const sessionResponse = await app.inject({
          method: "GET",
          url: "/api/daily/sessions/customer-follow-up-session"
        });
        expect(sessionResponse.statusCode).toBe(200);
        expect(sessionResponse.json().session).toEqual(
          expect.objectContaining({
            id: "customer-follow-up-session",
            updatedAt: restoreBody.preview.generatedAt,
            lastAction: expect.objectContaining({
              at: restoreBody.preview.generatedAt,
              actor: "daily-work-agent",
              label: "Generated restore preview.",
              artifactId: "email-draft-artifact",
              approvalRequestId: "read-customer-email-context"
            })
          })
        );

        const eventsResponse = await app.inject({
          method: "GET",
          url: "/api/daily/events"
        });
        const eventsBody = dailyActivityEventsResponseSchema.parse(
          eventsResponse.json()
        );
        expect(eventsBody.events[0]).toEqual(
          expect.objectContaining({
            id: "daily-event-session-customer-follow-up-session-restore-preview",
            eventType: "session.restored",
            status: "completed",
            relatedRefs: expect.objectContaining({
              sessionIds: ["customer-follow-up-session"],
              artifactIds: ["email-draft-artifact"],
              approvalRequestIds: [
                "read-customer-email-context",
                "draft-external-reply"
              ],
              contextItemIds: ["customer-email", "meeting-notes"]
            })
          })
        );

        const sessionsFile = JSON.parse(
          await readFile(join(dataDir, "sessions.json"), "utf8")
        );
        expect(sessionsFile.sessions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "customer-follow-up-session",
              updatedAt: restoreBody.preview.generatedAt,
              lastAction: expect.objectContaining({
                label: "Generated restore preview."
              })
            })
          ])
        );
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("rejects coding-agent session restore previews as reserved", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/sessions/customer-follow-up-session/restore-preview",
      payload: {
        mode: "coding_agent"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      error: "Session restore previews are only available in daily_work mode."
    });

    await app.close();
  });

  it("returns 404 when a daily-work session restore preview is missing", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/daily/sessions/missing-session/restore-preview",
      payload: {}
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      mode: "daily_work",
      error: "Daily-work session not found."
    });

    await app.close();
  });

  it("keeps the reserved coding-agent compatibility path for daily sessions", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/sessions?mode=coding_agent"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      sessions: []
    });

    await app.close();
  });

  it("returns 404 when a daily-work session is missing", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/sessions/missing-session"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      mode: "daily_work",
      error: "Daily-work session not found."
    });

    await app.close();
  });

  it("handles CORS preflight for session restore previews", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/sessions/customer-follow-up-session/restore-preview",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("handles CORS preflight for daily sessions", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/sessions",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("keeps the reserved coding-agent compatibility path for daily templates", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/templates?mode=coding_agent"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      templates: []
    });

    await app.close();
  });

  it("keeps the reserved coding-agent compatibility path for daily context", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/context?mode=coding_agent"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      items: []
    });

    await app.close();
  });

  it("keeps the reserved coding-agent compatibility path for daily approvals", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/approvals?mode=coding_agent"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      requests: []
    });

    await app.close();
  });

  it("keeps the reserved coding-agent compatibility path for daily artifacts", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/artifacts?mode=coding_agent"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "coding_agent",
      artifacts: []
    });

    await app.close();
  });

  it("returns default daily-work activity events", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/events"
    });
    const body = response.json();
    const parsed = dailyActivityEventsResponseSchema.parse(body);

    expect(response.statusCode).toBe(200);
    expect(parsed.mode).toBe("daily_work");
    expect(
      dailyActivityEventsResponseSchema.parse({ events: parsed.events }).mode
    ).toBe("daily_work");
    expect(body).toEqual({
      mode: "daily_work",
      events: expect.arrayContaining([
        expect.objectContaining({
          id: "daily-event-session-restored",
          mode: "daily_work",
          eventType: "session.restored",
          status: "completed",
          timestamp: "2026-06-02T10:55:00.000Z",
          relatedRefs: expect.objectContaining({
            sessionIds: ["customer-follow-up-session"],
            artifactIds: ["email-draft-artifact"],
            approvalRequestIds: ["read-customer-email-context"],
            connectorIds: ["customer-email"],
            contextItemIds: ["customer-email", "meeting-notes"]
          }),
          safetyBoundary: expect.objectContaining({
            previewOnly: true,
            externalEffects: ["none"],
            prohibitedExternalActions: expect.arrayContaining(["send_email"])
          }),
          nextAction: expect.objectContaining({
            targetType: "approval",
            targetId: "read-customer-email-context"
          })
        }),
        expect.objectContaining({
          id: "daily-event-template-applied",
          eventType: "template.applied"
        }),
        expect.objectContaining({
          id: "daily-event-approval-changed",
          eventType: "approval.changed",
          status: "waiting_for_approval"
        }),
        expect.objectContaining({
          id: "daily-event-workflow-preview-queued",
          eventType: "workflow.preview.queued",
          status: "queued"
        }),
        expect.objectContaining({
          id: "daily-event-workflow-preview-completed",
          eventType: "workflow.preview.completed",
          status: "completed"
        }),
        expect.objectContaining({
          id: "daily-event-artifact-updated",
          eventType: "artifact.updated",
          status: "in_progress"
        }),
        expect.objectContaining({
          id: "daily-event-artifact-ready",
          eventType: "artifact.ready",
          status: "ready"
        })
      ])
    });
    expect(body.events).toHaveLength(7);
    expect(parsed.events[0]).toEqual(
      expect.objectContaining({
        actor: expect.any(String),
        metadata: expect.objectContaining({
          externalEffects: ["none"]
        }),
        relatedRefs: expect.objectContaining({
          sessionIds: expect.any(Array),
          workflowIds: expect.any(Array),
          artifactIds: expect.any(Array)
        })
      })
    );

    await app.close();
  });

  it("returns one daily-work activity event by id", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/events/daily-event-workflow-preview-queued"
    });
    const body = response.json();
    const parsed = dailyActivityEventResponseSchema.parse(body);

    expect(response.statusCode).toBe(200);
    expect(parsed.mode).toBe("daily_work");
    expect(body).toEqual({
      mode: "daily_work",
      event: expect.objectContaining({
        id: "daily-event-workflow-preview-queued",
        eventType: "workflow.preview.queued",
        status: "queued",
        relatedRefs: expect.objectContaining({
          workflowIds: ["weekly-report-task-plan-workflow"],
          actionQueueItemIds: ["queue-task-plan"],
          artifactIds: ["task-list-artifact", "research-note-artifact"]
        }),
        safetyBoundary: expect.objectContaining({
          previewOnly: true
        }),
        taskStatus: expect.objectContaining({
          workflowStatus: "preview",
          actionQueueStatus: "queued",
          artifactStatus: "review"
        })
      })
    });

    await app.close();
  });

  it("returns 404 when a daily-work activity event is missing", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/events/missing-event"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      mode: "daily_work",
      eventId: "missing-event",
      error: "Daily-work activity event not found."
    });

    await app.close();
  });

  it("keeps the reserved coding-agent compatibility path for daily activity events", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/daily/events?mode=coding_agent"
    });
    const body = response.json();
    const parsed = dailyActivityEventsResponseSchema.parse(body);

    expect(response.statusCode).toBe(200);
    expect(parsed).toEqual({
      mode: "coding_agent",
      events: []
    });

    await app.close();
  });

  it("handles CORS preflight for daily activity events", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/daily/events",
      headers: {
        origin: "http://localhost:3000"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,OPTIONS"
    );

    await app.close();
  });

  it("sends a daily-work activity snapshot on WebSocket connect and keeps echo", async () => {
    const app = await buildServer();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    const messages: unknown[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for WebSocket messages."));
      }, 2000);

      socket.addEventListener("message", (event) => {
        messages.push(parseWebSocketMessage(event.data));

        if (messages.length === 2) {
          socket.send("hello-events");
        }

        if (messages.length === 3) {
          clearTimeout(timeout);
          resolve();
        }
      });

      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket connection failed."));
      });
    });

    expect(messages[0]).toEqual(
      expect.objectContaining({
        type: "connection.ready",
        service: "seekdesk-api"
      })
    );
    const snapshot = dailyActivitySnapshotMessageSchema.parse(messages[1]);

    expect(snapshot).toEqual({
      type: "daily.activity.snapshot",
      mode: "daily_work",
      generatedAt: expect.any(String),
      events: expect.arrayContaining([
        expect.objectContaining({
          id: "daily-event-session-restored",
          eventType: "session.restored",
          status: "completed",
          safetyBoundary: expect.objectContaining({
            previewOnly: true
          }),
          relatedRefs: expect.objectContaining({
            sessionIds: ["customer-follow-up-session"]
          })
        })
      ])
    });
    expect(snapshot.events).toHaveLength(7);
    expect(messages[2]).toEqual({
      type: "echo",
      payload: "hello-events"
    });

    socket.close();
    await app.close();
  });

  it("routes coding file reads through a connected local daemon workspace", async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), "seekdesk-daemon-ws-"));
    const app = await buildServer();
    let socket: WebSocket | null = null;

    try {
      await app.listen({ port: 0, host: "127.0.0.1" });
      const address = app.server.address() as AddressInfo;
      socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/daemon`);

      const registered = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for daemon registration."));
        }, 2000);

        socket?.addEventListener("open", () => {
          socket?.send(JSON.stringify({
            type: "daemon.register",
            token: "seekdesk-local-dev",
            status: {
              daemonId: "daemon-test-windows",
              machineName: "windows-workstation",
              platform: "win32",
              workspaceRoot: workspaceDir,
              supportedCapabilities: ["coding.read_file"],
              pid: process.pid
            }
          }));
        });

        socket?.addEventListener("message", (event) => {
          const message = parseWebSocketMessage(event.data) as Record<string, unknown>;
          if (message.type === "daemon.registered") {
            clearTimeout(timeout);
            resolve(message);
          }
        });

        socket?.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error("Daemon WebSocket connection failed."));
        });
      });

      const workspace = registered.workspace as { workspaceId: string; rootPath: string };
      expect(workspace.rootPath).toBe(workspaceDir);

      const requestFromApi = new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for daemon tool request."));
        }, 2000);

        socket?.addEventListener("message", (event) => {
          const message = parseWebSocketMessage(event.data) as Record<string, unknown>;
          if (message.type !== "daemon.request") {
            return;
          }

          clearTimeout(timeout);
          socket?.send(JSON.stringify({
            type: "daemon.response",
            requestId: message.requestId,
            ok: true,
            result: {
              path: "README.md",
              content: "read through local daemon",
              sizeBytes: 25,
              truncated: false,
              previewOnly: false,
              externalEffects: ["none"]
            }
          }));
          resolve(message);
        });
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/coding/files/read",
        payload: {
          workspaceId: workspace.workspaceId,
          path: "README.md",
          maxBytes: 1000
        }
      });
      const request = await requestFromApi;

      expect(response.statusCode).toBe(200);
      expect(request).toEqual(
        expect.objectContaining({
          type: "daemon.request",
          command: "tool.execute",
          payload: expect.objectContaining({
            toolName: "coding.read_file",
            input: expect.objectContaining({ path: "README.md" })
          })
        })
      );
      expect(response.json()).toEqual(
        expect.objectContaining({
          path: "README.md",
          content: "read through local daemon",
          previewOnly: false,
          externalEffects: ["none"]
        })
      );
    } finally {
      socket?.close();
      await app.close();
      await rm(workspaceDir, { force: true, recursive: true });
    }
  });

  it("normalizes Windows daemon workspace names", async () => {
    const app = await buildServer();
    let socket: WebSocket | null = null;

    try {
      await app.listen({ port: 0, host: "127.0.0.1" });
      const address = app.server.address() as AddressInfo;
      socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/daemon`);

      const registered = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for daemon registration."));
        }, 2000);

        socket?.addEventListener("open", () => {
          socket?.send(JSON.stringify({
            type: "daemon.register",
            token: "seekdesk-local-dev",
            status: {
              daemonId: "daemon-test-windows-path",
              machineName: "windows-workstation",
              platform: "win32",
              workspaceRoot: "E:\\Project\\SeekDesk\\.worktrees\\coding-agent-workbench",
              supportedCapabilities: ["coding.read_file"],
              pid: process.pid
            }
          }));
        });

        socket?.addEventListener("message", (event) => {
          const message = parseWebSocketMessage(event.data) as Record<string, unknown>;
          if (message.type === "daemon.registered") {
            clearTimeout(timeout);
            resolve(message);
          }
        });

        socket?.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error("Daemon WebSocket connection failed."));
        });
      });

      expect(registered.workspace).toEqual(
        expect.objectContaining({
          daemonId: "daemon-test-windows-path",
          name: "coding-agent-workbench",
          workspaceId: expect.stringMatching(/^local-coding-agent-workbench-/),
          rootPath: "E:\\Project\\SeekDesk\\.worktrees\\coding-agent-workbench"
        })
      );
    } finally {
      socket?.close();
      await app.close();
    }
  });

  it("rejects daemon registration with an invalid pairing token", async () => {
    const app = await buildServer();
    let socket: WebSocket | null = null;

    try {
      await app.listen({ port: 0, host: "127.0.0.1" });
      const address = app.server.address() as AddressInfo;
      socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/daemon`);

      const errorMessage = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for invalid token error."));
        }, 2000);

        socket?.addEventListener("open", () => {
          socket?.send(JSON.stringify({
            type: "daemon.register",
            token: "wrong-token",
            status: {
              daemonId: "bad-daemon",
              machineName: "windows-workstation",
              platform: "win32",
              workspaceRoot: "/tmp/bad-workspace",
              supportedCapabilities: ["coding.read_file"],
              pid: process.pid
            }
          }));
        });

        socket?.addEventListener("message", (event) => {
          const message = parseWebSocketMessage(event.data) as Record<string, unknown>;
          if (message.type === "daemon.error" && String(message.error).includes("Invalid daemon pairing token")) {
            clearTimeout(timeout);
            resolve(message);
          }
        });

        socket?.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error("Daemon WebSocket connection failed."));
        });
      });

      expect(errorMessage).toEqual(
        expect.objectContaining({
          type: "daemon.error",
          error: expect.stringContaining("Invalid daemon pairing token")
        })
      );

      const workspaces = await app.inject({
        method: "GET",
        url: "/api/coding/workspaces"
      });
      expect(workspaces.json().workspaces).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ daemonId: "bad-daemon" })])
      );
    } finally {
      socket?.close();
      await app.close();
    }
  });

  it("updates daemon workspace on heartbeat and returns runtime_unavailable after disconnect", async () => {
    const firstWorkspaceDir = await mkdtemp(join(tmpdir(), "seekdesk-daemon-first-"));
    const secondWorkspaceDir = await mkdtemp(join(tmpdir(), "seekdesk-daemon-second-"));
    const app = await buildServer();
    let socket: WebSocket | null = null;

    try {
      await app.listen({ port: 0, host: "127.0.0.1" });
      const address = app.server.address() as AddressInfo;
      socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/daemon`);

      const registered = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for daemon registration."));
        }, 2000);

        socket?.addEventListener("open", () => {
          socket?.send(JSON.stringify({
            type: "daemon.register",
            token: "seekdesk-local-dev",
            status: {
              daemonId: "daemon-heartbeat-test",
              machineName: "windows-workstation",
              platform: "win32",
              workspaceRoot: firstWorkspaceDir,
              supportedCapabilities: ["coding.read_file"],
              pid: process.pid
            }
          }));
        });

        socket?.addEventListener("message", (event) => {
          const message = parseWebSocketMessage(event.data) as Record<string, unknown>;
          if (message.type === "daemon.registered") {
            clearTimeout(timeout);
            resolve(message);
          }
        });

        socket?.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error("Daemon WebSocket connection failed."));
        });
      });

      expect((registered.workspace as { rootPath: string }).rootPath).toBe(firstWorkspaceDir);

      socket.send(JSON.stringify({
        type: "daemon.heartbeat",
        status: {
          daemonId: "daemon-heartbeat-test",
          machineName: "windows-workstation",
          platform: "win32",
          workspaceRoot: secondWorkspaceDir,
          supportedCapabilities: ["coding.read_file"],
          pid: process.pid
        }
      }));

      let updatedWorkspace: Record<string, unknown> | undefined;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const response = await app.inject({ method: "GET", url: "/api/coding/workspaces" });
        const workspaces = response.json().workspaces as Record<string, unknown>[];
        updatedWorkspace = workspaces.find((workspace) => workspace.rootPath === secondWorkspaceDir);
        if (updatedWorkspace) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      expect(updatedWorkspace).toEqual(
        expect.objectContaining({
          daemonId: "daemon-heartbeat-test",
          rootPath: secondWorkspaceDir,
          runtimeMode: "local_daemon"
        })
      );

      const updatedWorkspaceId = String(updatedWorkspace?.workspaceId);
      socket.close();

      let removed = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const response = await app.inject({ method: "GET", url: "/api/coding/workspaces" });
        const workspaces = response.json().workspaces as Record<string, unknown>[];
        removed = !workspaces.some((workspace) => workspace.workspaceId === updatedWorkspaceId);
        if (removed) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      expect(removed).toBe(true);

      const unavailable = await app.inject({
        method: "POST",
        url: "/api/coding/files/read",
        payload: {
          workspaceId: updatedWorkspaceId,
          path: "README.md",
          maxBytes: 1000
        }
      });

      expect(unavailable.statusCode).toBe(400);
      expect(unavailable.json()).toEqual(
        expect.objectContaining({
          mode: "coding_agent",
          error: "runtime_unavailable"
        })
      );
    } finally {
      socket?.close();
      await app.close();
      await rm(firstWorkspaceDir, { force: true, recursive: true });
      await rm(secondWorkspaceDir, { force: true, recursive: true });
    }
  });

  it("streams chat text from a messages request", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: {
        origin: "http://localhost:3000"
      },
      payload: {
        mode: "daily_work",
        messages: [{ role: "user", content: "summarize this repository" }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.headers["access-control-expose-headers"]).toContain(
      "X-SeekDesk-Chat-Session-Id"
    );
    expect(response.body).toContain("Mock daily-work AI response");
    expect(response.body).toContain("summarize this repository");
    expect(response.headers["x-seekdesk-chat-mode"]).toBe("daily_work");
    expect(response.headers["x-seekdesk-chat-provider"]).toBe("mock");

    await app.close();
  });

  it("streams fenced code blocks for code prompts", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        mode: "daily_work",
        messages: [{ role: "user", content: "show TypeScript code for a signal" }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.body).toContain("```ts");
    expect(response.body).toContain("type DailyWorkSignal");
    expect(response.body).toContain("```");

    await app.close();
  });

  it("accepts prompt shorthand", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        prompt: "hello"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("hello");

    await app.close();
  });

  it("keeps session and context fields on daily-work chat requests", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        mode: "daily_work",
        sessionId: "customer-follow-up-session",
        prompt: "summarize the linked context",
        context: {
          workspaceId: "workspace-seekdesk",
          contextItemIds: ["customer-email", "meeting-notes"],
          artifactIds: ["email-draft-artifact"],
          approvalRequestIds: ["read-customer-email-context"],
          connectorIds: ["customer-email"],
          extraSignal: {
            safe: true
          }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-seekdesk-chat-mode"]).toBe("daily_work");
    expect(response.headers["x-seekdesk-chat-provider"]).toBe("mock");
    expect(response.body).toContain("Mock daily-work AI response");
    expect(response.body).toContain("summarize the linked context");

    await app.close();
  });

  it("rejects invalid chat requests", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        mode: "daily_work",
        messages: []
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Invalid chat request.",
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: "messages",
          message: "A prompt or at least one chat message is required."
        })
      ])
    });

    await app.close();
  });

  it("uses DeepSeek streaming when an API key is configured", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-secret-value";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.example";
    process.env.DEEPSEEK_MODEL_FAST = "deepseek-v4-pro";

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;

        return createDeepSeekStreamResponse([
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "DeepSeek hello" } }]
        })}\n\n`,
        "data: [DONE]\n\n"
        ]);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        mode: "daily_work",
        sessionId: "deepseek-session",
        prompt: "draft a daily update",
        context: {
          workspaceId: "workspace-seekdesk",
          contextItemIds: ["meeting-notes"]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-seekdesk-chat-provider"]).toBe("deepseek");
    expect(response.body).toContain("DeepSeek hello");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));

    expect(body.model).toBe("deepseek-v4-pro");
    expect(body.messages).toEqual([
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("daily-work mode")
      }),
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("Session id: deepseek-session")
      }),
      {
        role: "user",
        content: "draft a daily update"
      }
    ]);
    expect(body.messages[1].content).toContain("Context item ids: meeting-notes");
    expect(body.messages[1].content).toContain(
      "Daily-work repository context snapshot"
    );
    expect(body.messages[1].content).toContain(
      "Context item meeting-notes: Meeting Notes"
    );
    expect(body.messages[1].content).toContain("Connectors: email and calendar connectors are removed");
    expect(body.messages[1].content).toContain("Approval gates:");
    expect(body.messages[1].content).toMatch(/Current time: \d{4}-\d{2}-\d{2}T/);
    expect(body.messages[1].content).toContain(
      "Temporal planning: preserve explicit dates, times, versions"
    );
    expect(body.messages[1].content).toContain(
      "Tool planning hint: email and calendar connectors are removed in this build."
    );
    expect(body.messages[1].content).toContain("Tool execution boundary: coding_agent writes and commands require same-session authorization");
    expect(body.messages[1].content).toContain("coding_agent tools");
    expect(body.messages[1].content).toContain(
      "must stay inside the workspace root"
    );
    expect(body.messages[1].content).toContain(
      "Recent agent tool trace: none for this session."
    );
    expect(body.messages[1].content).toContain(
      "Model usage in this session: no records yet."
    );

    await app.close();
  });

  it.skip("applies selected daily-work template policy to model routing and tool exposure", async () => {
    const repository = new SeedDailyWorkRepository();
    const now = "2026-06-19T00:00:00.000Z";
    await repository.upsertTemplate({
      id: "runtime-pro-template",
      mode: "daily_work",
      category: "research",
      title: "Runtime Pro Template",
      description: "Template with runtime constraints.",
      prompt: "Use the runtime template.",
      systemPrompt: "Use the runtime template system instruction.",
      promptTemplate: "Answer with a concise brief.",
      defaultModelRoute: "pro",
      allowedToolNames: ["daily.persist_artifact"],
      contextPolicy: {
        maxContextTokens: 4000,
        includeSelectedContext: false,
        includeRecentSession: false,
        includeArtifacts: false
      },
      status: "active",
      artifactType: "brief",
      tags: ["runtime"],
      enabled: true,
      version: 1,
      createdAt: now,
      updatedAt: now
    });
    process.env.DEEPSEEK_API_KEY = "sk-test-secret-value";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.example";
    process.env.DEEPSEEK_MODEL_FAST = "deepseek-v4-flash";
    process.env.DEEPSEEK_MODEL_PRO = "deepseek-v4-pro";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      createDeepSeekStreamResponse([
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "Template runtime acknowledged." } }]
        })}\n\n`,
        "data: [DONE]\n\n"
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = await buildServer({ dailyWorkRepository: repository });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {
          mode: "daily_work",
          templateId: "runtime-pro-template",
          prompt: "Use the selected template."
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("Template runtime acknowledged.");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [, init] = fetchMock.mock.calls[0] ?? [];
      const requestBody = JSON.parse(String(init?.body));
      const contextMessage = requestBody.messages
        .map((message: { content?: string }) => message.content ?? "")
        .join("\n");
      const toolNames = (requestBody.tools ?? []).map(
        (tool: { function?: { name?: string } }) => tool.function?.name
      );

      expect(requestBody.model).toBe("deepseek-v4-pro");
      expect(toolNames).toEqual(["daily_persist_artifact"]);
      expect(contextMessage).toContain(
        "Template system instruction: Use the runtime template system instruction."
      );
      expect(contextMessage).toContain("includeSelectedContext=false");
      expect(contextMessage).toContain(
        "Context items: disabled by selected template context policy."
      );
      expect(contextMessage).toContain(
        "Template tool policy: only these daily_work tools may be called: daily.persist_artifact."
      );
    } finally {
      await app.close();
    }
  });
  it.skip("executes preview-only daily-work tool calls and persists artifacts", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seekdesk-api-data-"));
    process.env.SEEKDESK_DATA_DIR = dataDir;
    process.env.DEEPSEEK_API_KEY = "sk-test-secret-value";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.example";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createDeepSeekStreamResponse([
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call-persist-artifact",
                      type: "function",
                      function: {
                        name: "daily_persist_artifact",
                        arguments:
                          "{\"title\":\"AI work note\",\"artifactType\":\"brief\",\"content\":\"A reviewable work note from the model.\",\"tags\":[\"ai\",\"preview\"]}"
                      }
                    }
                  ]
                },
                finish_reason: "tool_calls"
              }
            ]
          })}\n\n`,
          "data: [DONE]\n\n"
        ])
      )
      .mockResolvedValueOnce(
        createDeepSeekStreamResponse([
          `data: ${JSON.stringify({
            choices: [{ delta: { content: "Artifact saved for review." } }]
          })}\n\n`,
          `data: ${JSON.stringify({
            usage: {
              prompt_tokens: 12,
              completion_tokens: 8,
              total_tokens: 20
            },
            choices: []
          })}\n\n`,
          "data: [DONE]\n\n"
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    try {
      const app = await buildServer();

      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/chat",
          payload: {
            mode: "daily_work",
            prompt: "Create a reviewable work note."
          }
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toContain("Artifact saved for review.");
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const [, secondInit] = fetchMock.mock.calls[1] ?? [];
        const secondBody = JSON.parse(String(secondInit?.body));
        expect(secondBody.messages).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: "tool",
              name: "daily_persist_artifact",
              content: expect.stringContaining("AI work note")
            })
          ])
        );

        const artifactsResponse = await app.inject({
          method: "GET",
          url: "/api/daily/artifacts"
        });

        expect(artifactsResponse.statusCode).toBe(200);
        expect(artifactsResponse.json().artifacts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: "AI work note",
              artifactType: "brief",
              status: "draft"
            })
          ])
        );

        const sessionId = String(response.headers["x-seekdesk-chat-session-id"]);
        const eventsResponse = await app.inject({
          method: "GET",
          url: "/api/daily/events"
        });
        expect(eventsResponse.json().events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              eventType: "workflow.preview.queued",
              status: "queued",
              title: "Agent tool planned",
              summary: expect.stringContaining(
                "Agent planned daily.persist_artifact"
              ),
              relatedRefs: expect.objectContaining({
                sessionIds: [sessionId]
              })
            }),
            expect.objectContaining({
              eventType: "workflow.preview.completed",
              status: "completed",
              title: "Agent tool completed",
              summary: expect.stringContaining(
                "Agent persisted local artifact"
              ),
              relatedRefs: expect.objectContaining({
                sessionIds: [sessionId]
              }),
              metadata: expect.objectContaining({
                toolName: "daily.persist_artifact",
                toolPhase: "completed",
                provider: "seekdesk",
                externalDataSummary:
                  "Local SeekDesk artifact persisted for review; no external provider write.",
                resultCount: 1,
                reference: expect.stringMatching(/^artifact:ai-artifact-/)
              })
            }),
            expect.objectContaining({
              eventType: "artifact.updated",
              summary: expect.stringContaining("AI work note")
            })
          ])
        );

        const traceResponse = await app.inject({
          method: "GET",
          url: `/api/chat/sessions/${sessionId}/trace`
        });

        expect(traceResponse.statusCode).toBe(200);
        expect(traceResponse.json()).toEqual(
          expect.objectContaining({
            mode: "daily_work",
            sessionId,
            toolCalls: expect.arrayContaining([
              expect.objectContaining({
                id: "call-persist-artifact",
                name: "daily.persist_artifact",
                status: "completed",
                previewOnly: true,
                permissionRequired: false
              })
            ]),
            toolActivityEvents: expect.arrayContaining([
              expect.objectContaining({
                id: expect.stringContaining("call-persist-artifact-requested"),
                title: "Agent tool planned",
                metadata: expect.objectContaining({
                  toolName: "daily.persist_artifact",
                  toolPhase: "requested"
                })
              }),
              expect.objectContaining({
                id: expect.stringContaining("call-persist-artifact-completed"),
                title: "Agent tool completed",
                metadata: expect.objectContaining({
                  toolName: "daily.persist_artifact",
                  toolPhase: "completed",
                  reference: expect.stringMatching(/^artifact:ai-artifact-/)
                })
              })
            ]),
            modelUsageRecords: expect.arrayContaining([
              expect.objectContaining({
                provider: "deepseek",
                totalTokens: 20
              })
            ]),
            modelUsageSummary: expect.objectContaining({
              provider: "deepseek",
              totalTokens: 20,
              recordCount: 1
            }),
            permissionGrants: [],
            permissionBoundary: expect.objectContaining({
              previewOnly: false,
              externalEffects: expect.arrayContaining([
                "none",
                "workspace.write_after_session_grant"
              ])
            })
          })
        );
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("runs coding-agent read tools and records trace", async () => {
    const repository = new SeedDailyWorkRepository();
    const app = await buildServer({ dailyWorkRepository: repository });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {
          mode: "coding_agent",
          sessionId: "coding-read-session",
          prompt: "Inspect package.json and explain the npm scripts.",
          context: {
            workspaceId: "server-local-runtime"
          }
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-seekdesk-chat-mode"]).toBe("coding_agent");
      expect(response.body).toContain("I read package.json");

      const traceResponse = await app.inject({
        method: "GET",
        url: "/api/chat/sessions/coding-read-session/trace"
      });

      expect(traceResponse.statusCode).toBe(200);
      expect(traceResponse.json()).toEqual(
        expect.objectContaining({
          mode: "coding_agent",
          sessionId: "coding-read-session",
          toolCalls: expect.arrayContaining([
            expect.objectContaining({
              name: "coding.read_file",
              status: "completed",
              previewOnly: false,
              permissionRequired: false,
              inputJson: expect.objectContaining({
                path: "package.json"
              }),
              outputJson: expect.objectContaining({
                path: "package.json",
                content: expect.stringContaining("seekdesk")
              })
            })
          ]),
          toolActivityEvents: expect.arrayContaining([
            expect.objectContaining({
              metadata: expect.objectContaining({
                toolName: "coding.read_file",
                toolPhase: "completed"
              })
            })
          ]),
          modelUsageSummary: expect.objectContaining({
            provider: "mock",
            totalTokens: 50
          })
        })
      );

      const sessionsResponse = await app.inject({
        method: "GET",
        url: "/api/daily/sessions?mode=coding_agent"
      });

      expect(sessionsResponse.statusCode).toBe(200);
      expect(sessionsResponse.json().sessions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "coding-read-session",
            appMode: "coding_agent",
            workspaceId: "server-local-runtime",
            summary: "AI coding-agent chat session."
          })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("records permission-required coding command plans before execution", async () => {
    const repository = new SeedDailyWorkRepository();
    const app = await buildServer({ dailyWorkRepository: repository });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {
          mode: "coding_agent",
          sessionId: "coding-shell-session",
          prompt: "Run shell command: node -e \"console.log('seekdesk')\""
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("waiting for same-session authorization");

      const traceResponse = await app.inject({
        method: "GET",
        url: "/api/chat/sessions/coding-shell-session/trace"
      });
      const trace = traceResponse.json();
      const pendingTool = trace.toolCalls.find(
        (toolCall: { name: string }) => toolCall.name === "coding.run_shell"
      );

      expect(pendingTool).toEqual(
        expect.objectContaining({
          status: "permission_required",
          previewOnly: false,
          permissionRequired: true,
          inputJson: expect.objectContaining({
            command: "node -e \"console.log('seekdesk')\""
          })
        })
      );

      const blocked = await app.inject({
        method: "POST",
        url: `/api/coding/tool-calls/${pendingTool.id}/execute`,
        payload: {
          sessionId: "coding-shell-session"
        }
      });
      expect(blocked.statusCode).toBe(403);
      expect(blocked.json()).toEqual(
        expect.objectContaining({
          error: "permission_required"
        })
      );

      const grant = await app.inject({
        method: "POST",
        url: "/api/coding/permission-grants",
        payload: {
          sessionId: "coding-shell-session",
          action: "coding.run_shell",
          reason: "test approval"
        }
      });
      expect(grant.statusCode).toBe(200);

      const executed = await app.inject({
        method: "POST",
        url: `/api/coding/tool-calls/${pendingTool.id}/execute`,
        payload: {
          sessionId: "coding-shell-session"
        }
      });

      expect(executed.statusCode).toBe(200);
      expect(executed.json()).toEqual(
        expect.objectContaining({
          mode: "coding_agent",
          toolCall: expect.objectContaining({
            id: pendingTool.id,
            status: "completed"
          }),
          result: expect.objectContaining({
            stdout: expect.stringContaining("seekdesk")
          })
        })
      );

      const completedTrace = await app.inject({
        method: "GET",
        url: "/api/chat/sessions/coding-shell-session/trace"
      });
      expect(completedTrace.json().toolCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: pendingTool.id,
            status: "completed",
            outputJson: expect.objectContaining({
              stdout: expect.stringContaining("seekdesk")
            })
          })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("returns coding workspace status", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/coding/workspace"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        service: "seekdesk-coding-runtime",
        runtimeMode: "server_local"
      })
    );
    await app.close();
  });

  it("browses and selects a coding workspace folder", async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), "seekdesk-workspace-select-"));
    await writeFile(join(workspaceDir, "selected.txt"), "workspace selected", "utf8");

    try {
      const app = await buildServer();
      const browse = await app.inject({
        method: "POST",
        url: "/api/coding/workspace/browse",
        payload: { path: workspaceDir }
      });

      expect(browse.statusCode).toBe(200);
      expect(browse.json()).toEqual(
        expect.objectContaining({
          mode: "coding_agent",
          currentPath: workspaceDir
        })
      );

      const selected = await app.inject({
        method: "POST",
        url: "/api/coding/workspace/select",
        payload: { path: workspaceDir }
      });

      expect(selected.statusCode).toBe(200);
      expect(selected.json().workspace.workspaceRoot).toBe(workspaceDir);

      const workspace = await app.inject({
        method: "GET",
        url: "/api/coding/workspace"
      });
      expect(workspace.json().workspaceRoot).toBe(workspaceDir);

      const file = await app.inject({
        method: "POST",
        url: "/api/coding/files/read",
        payload: { path: "selected.txt", maxBytes: 1000 }
      });

      expect(file.statusCode).toBe(200);
      expect(file.json().content).toBe("workspace selected");
      await app.close();
    } finally {
      await rm(workspaceDir, { force: true, recursive: true });
    }
  });

  it("runs read-only coding file tools through the API", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/coding/files/read",
      payload: {
        path: "package.json",
        maxBytes: 100000
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        path: "package.json",
        previewOnly: false,
        externalEffects: ["none"]
      })
    );
    await app.close();
  });

  it("requires same-session authorization before executing coding write tool calls", async () => {
    const repository = new SeedDailyWorkRepository();
    await repository.recordToolCall({
      id: "tool-call-run-shell",
      sessionId: "coding-session",
      name: "coding.run_shell",
      status: "permission_required",
      inputJson: {
        command: "node -e \"console.log('seekdesk')\"",
        timeoutMs: 30000
      },
      previewOnly: false,
      permissionRequired: true,
      createdAt: "2026-06-19T00:00:00.000Z"
    });
    const app = await buildServer({ dailyWorkRepository: repository });

    const blocked = await app.inject({
      method: "POST",
      url: "/api/coding/tool-calls/tool-call-run-shell/execute",
      payload: {
        sessionId: "coding-session"
      }
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json()).toEqual(
      expect.objectContaining({
        error: "permission_required"
      })
    );

    const grant = await app.inject({
      method: "POST",
      url: "/api/coding/permission-grants",
      payload: {
        sessionId: "coding-session",
        action: "coding.run_shell",
        reason: "test approval"
      }
    });
    expect(grant.statusCode).toBe(200);

    const executed = await app.inject({
      method: "POST",
      url: "/api/coding/tool-calls/tool-call-run-shell/execute",
      payload: {
        sessionId: "coding-session"
      }
    });
    expect(executed.statusCode).toBe(200);
    expect(executed.json()).toEqual(
      expect.objectContaining({
        mode: "coding_agent"
      })
    );

    await app.close();
  });

});

function parseWebSocketMessage(data: unknown) {
  if (typeof data === "string") {
    return JSON.parse(data);
  }

  if (data instanceof ArrayBuffer) {
    return JSON.parse(Buffer.from(data).toString("utf8"));
  }

  if (ArrayBuffer.isView(data)) {
    return JSON.parse(Buffer.from(data.buffer).toString("utf8"));
  }

  throw new Error("Unsupported WebSocket message payload.");
}

function createDeepSeekStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      }
    }),
    {
      headers: {
        "Content-Type": "text/event-stream"
      },
      status: 200
    }
  );
}

function findEventByIdPattern<T extends { id: string }>(
  events: T[],
  pattern: RegExp,
  label: string
) {
  const event = events.find((candidate) => pattern.test(candidate.id));

  expect(event, `Expected ${label} to be visible in /api/daily/events.`).toBeDefined();

  return event as T;
}
