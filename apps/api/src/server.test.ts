import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import {
  dailyActivityEventResponseSchema,
  dailyActivityEventsResponseSchema,
  dailyActivitySnapshotMessageSchema
} from "@seekdesk/shared";

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
