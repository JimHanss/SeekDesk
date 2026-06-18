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
import { encryptJson } from "./services/google-connector-service.js";

const googleApiMock = vi.hoisted(() => ({
  calendarEventsList: vi.fn(),
  gmailThreadsGet: vi.fn(),
  gmailThreadsList: vi.fn(),
  oauthGenerateAuthUrl: vi.fn((input: unknown) => {
    void input;

    return "https://accounts.google.test/oauth";
  }),
  oauthGetToken: vi.fn<
    (code: string) => Promise<{ tokens: Record<string, string> }>
  >(async (code) => {
    void code;

    return {
      tokens: {
        access_token: "access-token",
        refresh_token: "refresh-token"
      }
    };
  }),
  oauthSetCredentials: vi.fn((tokens: unknown) => {
    void tokens;
  }),
  oauthUserInfoGet: vi.fn()
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class MockOAuth2 {
        generateAuthUrl(input: unknown) {
          return googleApiMock.oauthGenerateAuthUrl(input);
        }

        async getToken(code: string) {
          return googleApiMock.oauthGetToken(code);
        }

        setCredentials(tokens: unknown) {
          googleApiMock.oauthSetCredentials(tokens);
        }
      }
    },
    calendar: vi.fn(() => ({
      events: {
        list: googleApiMock.calendarEventsList
      }
    })),
    gmail: vi.fn(() => ({
      users: {
        threads: {
          get: googleApiMock.gmailThreadsGet,
          list: googleApiMock.gmailThreadsList
        }
      }
    })),
    oauth2: vi.fn(() => ({
      userinfo: {
        get: googleApiMock.oauthUserInfoGet
      }
    }))
  }
}));

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
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "GOOGLE_TOKEN_ENCRYPTION_KEY",
  "GOOGLE_OAUTH_STATE_SECRET",
  "SEEKDESK_OAUTH_STATE_SECRET"
] as const;

const originalDeepSeekEnv = new Map(
  deepSeekEnvKeys.map((key) => [key, process.env[key]])
);

describe("api server", () => {
  beforeEach(() => {
    for (const key of deepSeekEnvKeys) {
      delete process.env[key];
    }

    googleApiMock.calendarEventsList.mockReset().mockResolvedValue({
      data: {
        items: []
      }
    });
    googleApiMock.gmailThreadsGet.mockReset().mockResolvedValue({
      data: {
        id: "thread-empty",
        messages: []
      }
    });
    googleApiMock.gmailThreadsList.mockReset().mockResolvedValue({
      data: {
        resultSizeEstimate: 0,
        threads: []
      }
    });
    googleApiMock.oauthGenerateAuthUrl
      .mockReset()
      .mockReturnValue("https://accounts.google.test/oauth");
    googleApiMock.oauthGetToken.mockReset().mockResolvedValue({
      tokens: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        scope:
          "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly"
      }
    });
    googleApiMock.oauthSetCredentials.mockReset();
    googleApiMock.oauthUserInfoGet.mockReset().mockResolvedValue({
      data: {
        email: "person@example.com"
      }
    });
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
      futureDatabaseReady: false
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
          futureDatabaseReady: false
        });
      } finally {
        await app.close();
      }
    } finally {
      await rm(dataDir, { force: true, recursive: true });
    }
  });

  it("reports Google connector setup status when OAuth is not configured", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/connectors/google/status"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      provider: "google",
      connected: false,
      requiresSetup: true,
      scopes: expect.arrayContaining([
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.readonly"
      ]),
      requiredScopes: expect.arrayContaining([
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/calendar.readonly"
      ]),
      missingScopes: expect.arrayContaining([
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/calendar.readonly"
      ]),
      scopesComplete: false,
      missingConfig: [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "GOOGLE_TOKEN_ENCRYPTION_KEY"
      ]
    });

    await app.close();
  });

  it("returns a clear setup error before starting Google OAuth", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/connectors/google/oauth/start"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      provider: "google",
      connected: false,
      requiresSetup: true,
      error: "google_oauth_not_configured",
      missingConfig: [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "GOOGLE_TOKEN_ENCRYPTION_KEY"
      ]
    });

    await app.close();
  });

  it("returns a browser-friendly email authorization callback setup page", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/connectors/google/oauth/callback?code=fake-code",
      headers: {
        accept: "text/html"
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Email Authorization Setup Required");
    expect(response.body).toContain("GOOGLE_CLIENT_ID");
    expect(response.body).toContain("seekdesk.google_oauth_callback");

    await app.close();
  });

  it("starts a user-facing email authorization flow with offline scoped consent", async () => {
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.GOOGLE_REDIRECT_URI =
      "http://127.0.0.1:4000/api/connectors/google/oauth/callback";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-token-encryption-key";

    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/connectors/google/oauth/start?workspaceId=workspace-seekdesk"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        provider: "google",
        authorizationUrl: "https://accounts.google.test/oauth",
        scopes: expect.arrayContaining([
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.compose",
          "https://www.googleapis.com/auth/calendar.readonly"
        ]),
        state: expect.any(String)
      })
    );
    expect(googleApiMock.oauthGenerateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: true,
        scope: expect.arrayContaining([
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.compose",
          "https://www.googleapis.com/auth/calendar.readonly"
        ]),
        state: expect.any(String)
      })
    );

    await app.close();
  });

  it("keeps Google OAuth callback JSON shape for API clients", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/connectors/google/oauth/callback?code=fake-code",
      headers: {
        accept: "application/json"
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({
      provider: "google",
      connected: false,
      requiresSetup: true,
      error: "google_oauth_not_configured",
      missingConfig: [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "GOOGLE_TOKEN_ENCRYPTION_KEY"
      ]
    });

    await app.close();
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
          provider: "google_drive",
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
          provider: "gmail",
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
    expect(body.messages[1].content).toContain("Connector customer-email");
    expect(body.messages[1].content).toContain("Connector team-calendar");
    expect(body.messages[1].content).toContain("Approval gates:");
    expect(body.messages[1].content).toMatch(/Current time: \d{4}-\d{2}-\d{2}T/);
    expect(body.messages[1].content).toContain(
      "Temporal planning: for requests like today"
    );
    expect(body.messages[1].content).toContain(
      "Tool planning hint: use gmail.search_threads before gmail.read_thread"
    );
    expect(body.messages[1].content).toContain("Google authorization: not connected.");
    expect(body.messages[1].content).toContain("GOOGLE_CLIENT_ID");
    expect(body.messages[1].content).toContain(
      "do not claim Gmail or Calendar data was read"
    );
    expect(body.messages[1].content).toContain(
      "Recent agent tool trace: none for this session."
    );
    expect(body.messages[1].content).toContain(
      "Model usage in this session: no records yet."
    );

    await app.close();
  });

  it("adds connected Google authorization state to the daily-work agent context", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-secret-value";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.example";
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.GOOGLE_REDIRECT_URI =
      "http://127.0.0.1:4000/api/connectors/google/oauth/callback";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-token-encryption-key";

    const repository = new SeedDailyWorkRepository();
    await repository.upsertConnectorAccount({
      id: "google:person@example.com",
      provider: "google",
      accountEmail: "person@example.com",
      encryptedTokens: "encrypted-token-payload",
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/calendar.readonly"
      ],
      connectedAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z"
    });
    await repository.recordToolCall({
      id: "tool-call-existing-calendar",
      sessionId: "google-connected-session",
      name: "calendar.list_events",
      status: "completed",
      inputJson: {
        calendarId: "primary",
        timeMin: "2026-06-08T00:00:00.000Z",
        timeMax: "2026-06-09T00:00:00.000Z"
      },
      outputJson: {
        provider: "google_calendar",
        previewOnly: true,
        calendarId: "primary",
        events: [
          {
            id: "calendar-event-ctx",
            summary: "Planning review"
          }
        ]
      },
      previewOnly: true,
      permissionRequired: false,
      createdAt: "2026-06-08T09:00:00.000Z",
      completedAt: "2026-06-08T09:00:01.000Z"
    });
    await repository.recordModelUsage({
      id: "usage-existing-google-context",
      sessionId: "google-connected-session",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      promptTokens: 120,
      completionTokens: 40,
      totalTokens: 160,
      createdAt: "2026-06-08T09:00:02.000Z"
    });

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;

        return createDeepSeekStreamResponse([
          `data: ${JSON.stringify({
            choices: [{ delta: { content: "Connected Google context ready." } }]
          })}\n\n`,
          "data: [DONE]\n\n"
        ]);
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = await buildServer({ dailyWorkRepository: repository });
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        mode: "daily_work",
        sessionId: "google-connected-session",
        prompt: "summarize Google connector availability"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));
    const contextMessage = String(body.messages[1].content);

    expect(contextMessage).toContain(
      "Google authorization: connected as person@example.com"
    );
    expect(contextMessage).toContain("gmail.search_threads");
    expect(contextMessage).toContain("calendar.list_events");
    expect(contextMessage).toContain(
      "Gmail draft and calendar event tools remain local previews only"
    );
    expect(contextMessage).toContain("Recent agent tool trace:");
    expect(contextMessage).toContain(
      "Tool calendar.list_events: status=completed"
    );
    expect(contextMessage).toContain(
      "input=calendarId, timeMin, timeMax"
    );
    expect(contextMessage).toContain("result=1 calendar event result(s)");
    expect(contextMessage).toContain(
      "Model usage in this session: records=1; latest=deepseek/deepseek-v4-flash; totalTokens=160."
    );

    await app.close();
  });

  it("blocks Google read tools when the connected account is missing required scopes", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-secret-value";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.example";
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.GOOGLE_REDIRECT_URI =
      "http://127.0.0.1:4000/api/connectors/google/oauth/callback";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-token-encryption-key";

    const repository = new SeedDailyWorkRepository();
    await repository.upsertConnectorAccount({
      id: "google:person@example.com",
      provider: "google",
      accountEmail: "person@example.com",
      encryptedTokens: "encrypted-token-payload",
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.readonly"
      ],
      connectedAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z"
    });

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
                      id: "call-gmail-missing-scope",
                      type: "function",
                      function: {
                        name: "gmail_search_threads",
                        arguments:
                          "{\"query\":\"newer_than:7d proposal\",\"maxResults\":1}"
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
            choices: [
              {
                delta: {
                  content:
                    "Google authorization needs to be refreshed before I can read Gmail."
                }
              }
            ]
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
          sessionId: "google-missing-scope-session",
          prompt: "Search my recent proposal email.",
          context: {
            workspaceId: "workspace-seekdesk",
            connectorIds: ["google"]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("authorization needs to be refreshed");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(googleApiMock.oauthSetCredentials).not.toHaveBeenCalled();
      expect(googleApiMock.gmailThreadsList).not.toHaveBeenCalled();

      const [, firstInit] = fetchMock.mock.calls[0] ?? [];
      const firstBody = JSON.parse(String(firstInit?.body));
      const contextMessage = String(firstBody.messages[1].content);
      expect(contextMessage).toContain(
        "required scopes are incomplete"
      );
      expect(contextMessage).toContain(
        "https://www.googleapis.com/auth/gmail.compose"
      );
      expect(contextMessage).toContain(
        "do not call Gmail or Calendar read tools until OAuth is refreshed"
      );

      const [, secondInit] = fetchMock.mock.calls[1] ?? [];
      const secondBody = JSON.parse(String(secondInit?.body));
      expect(secondBody.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "tool",
            name: "gmail_search_threads",
            content: expect.stringContaining("connector_missing_scopes")
          })
        ])
      );

      const traceResponse = await app.inject({
        method: "GET",
        url: "/api/chat/sessions/google-missing-scope-session/trace"
      });

      expect(traceResponse.statusCode).toBe(200);
      expect(traceResponse.json()).toEqual(
        expect.objectContaining({
          toolCalls: expect.arrayContaining([
            expect.objectContaining({
              id: "call-gmail-missing-scope",
              name: "gmail.search_threads",
              status: "failed",
              previewOnly: true,
              permissionRequired: false,
              error: "connector_missing_scopes",
              outputJson: expect.objectContaining({
                message: expect.stringContaining("gmail.compose")
              })
            })
          ])
        })
      );

      const eventsResponse = await app.inject({
        method: "GET",
        url: "/api/daily/events"
      });

      expect(eventsResponse.json().events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining("call-gmail-missing-scope-completed"),
            status: "failed",
            title: "Agent tool completed",
            summary: expect.stringContaining("connector_missing_scopes"),
            relatedRefs: expect.objectContaining({
              sessionIds: ["google-missing-scope-session"]
            }),
            metadata: expect.objectContaining({
              toolName: "gmail.search_threads",
              toolPhase: "completed",
              externalDataSummary:
                "Tool failed with connector_missing_scopes; no external write was performed."
            })
          })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("applies selected daily-work template policy to model routing and tool exposure", async () => {
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
  it("executes preview-only daily-work tool calls and persists artifacts", async () => {
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
            permissionBoundary: expect.objectContaining({
              previewOnly: true,
              externalEffects: ["none"]
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

  it("executes autonomous Gmail and Calendar read tool plans and persists the full trace", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-secret-value";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.example";
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.GOOGLE_REDIRECT_URI =
      "http://127.0.0.1:4000/api/connectors/google/oauth/callback";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-token-encryption-key";

    googleApiMock.gmailThreadsList.mockResolvedValueOnce({
      data: {
        resultSizeEstimate: 1,
        threads: [
          {
            id: "thread-1",
            snippet: "Customer is asking for the updated proposal.",
            historyId: "1001"
          }
        ]
      }
    });
    googleApiMock.gmailThreadsGet.mockResolvedValueOnce({
      data: {
        id: "thread-1",
        historyId: "1002",
        messages: [
          {
            id: "message-1",
            threadId: "thread-1",
            snippet: "Can you send the updated proposal today?",
            internalDate: "1780848000000",
            payload: {
              headers: [
                { name: "From", value: "customer@example.com" },
                { name: "To", value: "person@example.com" },
                { name: "Subject", value: "Updated proposal" },
                { name: "Date", value: "Mon, 8 Jun 2026 09:00:00 +0800" }
              ]
            }
          }
        ]
      }
    });
    googleApiMock.calendarEventsList.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "calendar-event-1",
            status: "confirmed",
            summary: "Proposal review",
            start: { dateTime: "2026-06-08T10:00:00+08:00" },
            end: { dateTime: "2026-06-08T10:30:00+08:00" },
            attendees: [
              {
                email: "customer@example.com",
                responseStatus: "accepted"
              }
            ]
          }
        ]
      }
    });

    const repository = new SeedDailyWorkRepository();
    await repository.upsertConnectorAccount({
      id: "google:person@example.com",
      provider: "google",
      accountEmail: "person@example.com",
      encryptedTokens: encryptJson(
        {
          access_token: "access-token",
          refresh_token: "refresh-token",
          scope:
            "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/calendar.readonly"
        },
        process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
      ),
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/calendar.readonly"
      ],
      connectedAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z"
    });

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
                      id: "call-gmail-search",
                      type: "function",
                      function: {
                        name: "gmail_search_threads",
                        arguments:
                          "{\"query\":\"newer_than:7d proposal\",\"maxResults\":1}"
                      }
                    },
                    {
                      index: 1,
                      id: "call-calendar-list",
                      type: "function",
                      function: {
                        name: "calendar_list_events",
                        arguments:
                          "{\"calendarId\":\"primary\",\"timeMin\":\"2026-06-08T00:00:00.000Z\",\"timeMax\":\"2026-06-09T00:00:00.000Z\",\"maxResults\":3}"
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
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call-gmail-read-thread",
                      type: "function",
                      function: {
                        name: "gmail_read_thread",
                        arguments: "{\"threadId\":\"thread-1\"}"
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
            choices: [
              {
                delta: {
                  content:
                    "I found one proposal email thread and one related calendar event. No external changes were made."
                }
              }
            ]
          })}\n\n`,
          `data: ${JSON.stringify({
            usage: {
              prompt_tokens: 120,
              completion_tokens: 30,
              total_tokens: 150
            },
            choices: []
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
          sessionId: "google-read-agent-session",
          prompt:
            "Check recent proposal email and today's calendar, then summarize what I need to do.",
          context: {
            workspaceId: "workspace-seekdesk",
            connectorIds: ["google"],
            timezone: "Asia/Shanghai"
          }
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("one proposal email thread");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(googleApiMock.oauthSetCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh_token: "refresh-token"
        })
      );
      expect(googleApiMock.gmailThreadsList).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "me",
          q: "newer_than:7d proposal",
          maxResults: 1
        })
      );
      expect(googleApiMock.calendarEventsList).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: "primary",
          maxResults: 3,
          singleEvents: true,
          orderBy: "startTime"
        })
      );
      expect(googleApiMock.gmailThreadsGet).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "me",
          id: "thread-1",
          format: "metadata"
        })
      );

      const [, secondInit] = fetchMock.mock.calls[1] ?? [];
      const secondBody = JSON.parse(String(secondInit?.body));
      expect(secondBody.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "tool",
            name: "gmail_search_threads",
            content: expect.stringContaining("thread-1")
          }),
          expect.objectContaining({
            role: "tool",
            name: "calendar_list_events",
            content: expect.stringContaining("Proposal review")
          })
        ])
      );

      const [, thirdInit] = fetchMock.mock.calls[2] ?? [];
      const thirdBody = JSON.parse(String(thirdInit?.body));
      expect(thirdBody.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "tool",
            name: "gmail_read_thread",
            content: expect.stringContaining("Updated proposal")
          })
        ])
      );

      const traceResponse = await app.inject({
        method: "GET",
        url: "/api/chat/sessions/google-read-agent-session/trace"
      });

      expect(traceResponse.statusCode).toBe(200);
      expect(traceResponse.json()).toEqual(
        expect.objectContaining({
          toolCalls: expect.arrayContaining([
            expect.objectContaining({
              id: "call-gmail-search",
              name: "gmail.search_threads",
              status: "completed",
              previewOnly: true,
              permissionRequired: false,
              outputJson: expect.objectContaining({
                provider: "gmail",
                previewOnly: true,
                threads: expect.arrayContaining([
                  expect.objectContaining({
                    id: "thread-1"
                  })
                ])
              })
            }),
            expect.objectContaining({
              id: "call-calendar-list",
              name: "calendar.list_events",
              status: "completed",
              previewOnly: true,
              permissionRequired: false,
              outputJson: expect.objectContaining({
                provider: "google_calendar",
                previewOnly: true,
                events: expect.arrayContaining([
                  expect.objectContaining({
                    id: "calendar-event-1",
                    summary: "Proposal review"
                  })
                ])
              })
            }),
            expect.objectContaining({
              id: "call-gmail-read-thread",
              name: "gmail.read_thread",
              status: "completed",
              previewOnly: true,
              permissionRequired: false,
              outputJson: expect.objectContaining({
                provider: "gmail",
                previewOnly: true,
                threadId: "thread-1",
                messages: expect.arrayContaining([
                  expect.objectContaining({
                    id: "message-1",
                    headers: expect.objectContaining({
                      Subject: "Updated proposal"
                    })
                  })
                ])
              })
            })
          ]),
          modelUsageSummary: expect.objectContaining({
            provider: "deepseek",
            totalTokens: 150,
            recordCount: 1
          }),
          permissionBoundary: expect.objectContaining({
            previewOnly: true,
            externalEffects: ["none"]
          })
        })
      );

      const eventsResponse = await app.inject({
        method: "GET",
        url: "/api/daily/events"
      });
      const events = eventsResponse.json().events;

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining("call-gmail-search-requested"),
            title: "Agent tool planned",
            relatedRefs: expect.objectContaining({
              sessionIds: ["google-read-agent-session"]
            }),
            metadata: expect.objectContaining({
              toolName: "gmail.search_threads",
              toolPhase: "requested",
              connectorId: "customer-email",
              inputFields: ["query", "maxResults"],
              externalDataSummary: "Tool result is pending."
            })
          }),
          expect.objectContaining({
            id: expect.stringContaining("call-calendar-list-completed"),
            title: "Agent tool completed",
            relatedRefs: expect.objectContaining({
              sessionIds: ["google-read-agent-session"]
            }),
            metadata: expect.objectContaining({
              toolName: "calendar.list_events",
              toolPhase: "completed",
              provider: "google_calendar",
              connectorId: "team-calendar",
              externalDataSummary:
                "1 Google Calendar event metadata result(s).",
              resultCount: 1,
              reference: "calendar-event:calendar-event-1"
            })
          }),
          expect.objectContaining({
            id: expect.stringContaining("call-gmail-read-thread-completed"),
            title: "Agent tool completed",
            relatedRefs: expect.objectContaining({
              sessionIds: ["google-read-agent-session"]
            }),
            metadata: expect.objectContaining({
              toolName: "gmail.read_thread",
              toolPhase: "completed",
              provider: "gmail",
              connectorId: "customer-email",
              externalDataSummary:
                "1 Gmail message metadata record(s).",
              resultCount: 1,
              reference: "gmail-thread:thread-1"
            })
          })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("accepts the reserved coding-agent mode without enabling tools", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        mode: "coding_agent",
        prompt: "inspect a repository"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("coding-agent compatibility");

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
