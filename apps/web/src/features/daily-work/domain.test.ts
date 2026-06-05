import { describe, expect, it } from "vitest";

import {
  activeMode,
  connectorItems,
  createLocalConnectorPreviewState,
  mapApprovalDecisionStatus,
  mapTemplatePreviewResponse,
  mapTemplatesResponse,
  templates
} from "./domain";
import type {
  DailyApprovalDecisionResponseDto,
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
