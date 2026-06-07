import { describe, expect, it } from "vitest";

import {
  activeMode,
  connectorItems,
  createLocalConnectorPreviewState,
  mapAgentTraceResponse,
  mapDailyActivitySnapshot,
  mapApprovalDecisionStatus,
  mapTemplatePreviewResponse,
  mapTemplatesResponse,
  templates
} from "./domain";
import type {
  DailyApprovalDecisionResponseDto,
  DailyActivitySnapshotDto,
  DailyWorkTemplateApplyPreviewResponseDto,
  DailyWorkTemplatesResponseDto
} from "./types";

describe("daily-work domain mappers", () => {
  it("maps template API responses into enabled template items", () => {
    const payload = {
      mode: activeMode,
      templates: [
        {
          id: "status-email",
          mode: activeMode,
          category: "writing",
          title: "Status email",
          description: "Draft a concise update",
          prompt: "Write the update",
          artifactType: "email_draft",
          tags: ["email", "", "stakeholder", "weekly", "extra"],
          enabled: true
        }
      ]
    } satisfies DailyWorkTemplatesResponseDto;

    const [template] = mapTemplatesResponse(payload);

    expect(template).toMatchObject({
      id: "status-email",
      category: "writing",
      title: "Status email",
      enabled: true
    });
    expect(template?.tags).toEqual(["email", "stakeholder", "weekly", "extra"]);
  });

  it("rejects template responses for other modes", () => {
    expect(() =>
      mapTemplatesResponse({
        mode: "coding_agent",
        templates: []
      })
    ).toThrow(/daily_work/);
  });

  it("keeps template apply previews preview-only", () => {
    const template = templates[0]!;
    const payload = {
      mode: activeMode,
      preview: {
        id: template.id,
        templateId: template.id,
        previewOnly: true,
        externalEffects: ["none"],
        promptDraft: "Send a careful customer update.",
        safetyBoundary: {
          previewOnly: true,
          externalEffects: ["none"],
          statement: "No external effects."
        },
        generatedAt: "2026-06-05T00:00:00.000Z"
      }
    } satisfies DailyWorkTemplateApplyPreviewResponseDto;

    const preview = mapTemplatePreviewResponse(template, payload);

    expect(preview).toMatchObject({
      templateId: template.id,
      source: "api",
      syncStatus: "live",
      previewOnly: true,
      externalEffects: ["none"],
      promptDraft: "Send a careful customer update."
    });
  });

  it("rejects template previews that would have external effects", () => {
    const template = templates[0]!;

    expect(() =>
      mapTemplatePreviewResponse(template, {
        mode: activeMode,
        preview: {
          templateId: template.id,
          previewOnly: true,
          externalEffects: ["send_email"]
        }
      })
    ).toThrow(/selected template/);
  });

  it("creates local connector previews without external effects", () => {
    const connector = connectorItems[0]!;
    const preview = createLocalConnectorPreviewState(connector);

    expect(preview).toMatchObject({
      connectorId: connector.apiConnectorId,
      action: connector.apiAction,
      source: "local",
      syncStatus: "idle",
      previewOnly: true
    });
    expect(preview.requiredApprovalRequestIds).toEqual(
      connector.requiredApprovalIds
    );
  });

  it("maps agent trace responses into visible tool and usage state", () => {
    const trace = mapAgentTraceResponse(
      {
        mode: activeMode,
        sessionId: "session-1",
        toolCalls: [
          {
            id: "call-1",
            name: "gmail.search_threads",
            status: "completed",
            inputJson: { query: "from:customer" },
            outputJson: { threads: [] },
            previewOnly: true,
            permissionRequired: false,
            createdAt: "2026-06-08T00:00:00.000Z",
            completedAt: "2026-06-08T00:00:01.000Z"
          }
        ],
        modelUsageRecords: [
          {
            id: "usage-1",
            provider: "deepseek",
            model: "deepseek-chat",
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
            createdAt: "2026-06-08T00:00:02.000Z"
          }
        ],
        permissionBoundary: {
          previewOnly: true,
          externalEffects: ["none"],
          statement: "No external effects."
        }
      },
      { sessionId: "fallback-session", provider: "deepseek" }
    );

    expect(trace).toMatchObject({
      sessionId: "session-1",
      provider: "deepseek",
      syncStatus: "live",
      toolCalls: [
        expect.objectContaining({
          name: "gmail.search_threads",
          status: "completed",
          previewOnly: true
        })
      ],
      modelUsageSummary: expect.objectContaining({
        provider: "deepseek",
        totalTokens: 15,
        recordCount: 1
      }),
      permissionBoundary: expect.objectContaining({
        previewOnly: true,
        statement: "No external effects."
      })
    });
  });

  it("maps activity tool audit metadata into visible event state", () => {
    const [event] = mapDailyActivitySnapshot({
      type: "daily.activity.snapshot",
      mode: activeMode,
      events: [
        {
          id: "daily-event-agent-tool-session-call-completed",
          mode: activeMode,
          eventType: "workflow.preview.completed",
          status: "completed",
          timestamp: "2026-06-08T00:00:00.000Z",
          title: "Agent tool completed",
          summary: "Agent persisted local artifact.",
          actor: "daily-work-agent",
          relatedRefs: {
            sessionIds: ["session-1"],
            artifactIds: ["artifact-1"],
            connectorIds: [],
            templateIds: [],
            workflowIds: [],
            actionQueueItemIds: [],
            approvalRequestIds: [],
            contextItemIds: []
          },
          safetyBoundary: {
            previewOnly: true,
            externalEffects: ["none"],
            statement: "Preview-only tool execution."
          },
          nextAction: null,
          metadata: {
            toolName: "daily.persist_artifact",
            toolPhase: "completed",
            provider: "seekdesk",
            inputFields: ["title", "content"],
            externalDataSummary:
              "Local SeekDesk artifact persisted for review; no external provider write.",
            resultCount: 1,
            reference: "artifact:artifact-1"
          }
        }
      ]
    } satisfies DailyActivitySnapshotDto);

    expect(event).toMatchObject({
      relatedLabel: "artifact:artifact-1",
      toolAudit: {
        toolName: "daily.persist_artifact",
        toolPhase: "completed",
        provider: "seekdesk",
        inputFields: ["title", "content"],
        resultCount: 1,
        reference: "artifact:artifact-1",
        previewOnly: true,
        externalEffects: ["none"]
      }
    });
  });

  it("maps approval API decisions into UI ledger states", () => {
    const approved = {
      mode: activeMode,
      request: { id: "approval-1", status: "approved" }
    } satisfies DailyApprovalDecisionResponseDto;
    const denied = {
      mode: activeMode,
      request: { id: "approval-1", status: "denied" }
    } satisfies DailyApprovalDecisionResponseDto;

    expect(mapApprovalDecisionStatus(approved)).toBe("allowed_once");
    expect(mapApprovalDecisionStatus(denied)).toBe("denied");
    expect(mapApprovalDecisionStatus({ mode: activeMode })).toBe("waiting");
  });
});
