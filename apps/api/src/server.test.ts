import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const deepSeekEnvKeys = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL_FAST",
  "DEEPSEEK_MODEL_PRO",
  "DEEPSEEK_MODEL_ROUTE",
  "DEEPSEEK_THINKING_MODE",
  "DEEPSEEK_STREAM_USAGE",
  "DEEPSEEK_STREAM_USAGE_ENABLED"
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
      version: "0.1.0"
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
        promptTokens: 2240,
        completionTokens: 730,
        totalTokens: 2970,
        estimatedCostUsd: 0.0029,
        currency: "USD",
        budgetState: "tracking_only",
        records: expect.arrayContaining([
          expect.objectContaining({
            id: "daily-model-usage-email-draft",
            provider: "deepseek",
            model: "deepseek-v4-flash",
            inputTokens: 1280,
            outputTokens: 420
          })
        ])
      })
    });
    expect(body.usage.records).toHaveLength(2);

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
    expect(body.usage.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: "deepseek-v4-pro"
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
    expect(response.body).toContain("Mock daily-work AI response");
    expect(response.body).toContain("summarize this repository");

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
