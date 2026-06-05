"use client";

import type { Dispatch, SetStateAction } from "react";

import {
  activeMode,
  buildActivityEventPrompt,
  buildConnectorAccessPrompt,
  buildModelSwitchPrompt,
  buildWorkflowPreviewPrompt,
  createLocalContextPreviewState,
  createLocalSessionRestorePreviewState,
  createLocalTemplatePreviewState,
  mapApprovalDecisionStatus,
  mapContextUsePreviewResponse,
  mapSessionRestorePreviewResponse,
  mapTemplatePreviewResponse
} from "../domain";
import type {
  ActivityEventItem,
  ApprovalPanelState,
  ApprovalStatus,
  ConnectorItem,
  ConnectorPreviewPanelState,
  ContextItem,
  ContextPanelState,
  ContextPreviewPanelState,
  DailyApprovalDecisionResponseDto,
  DailyContextUsePreviewResponseDto,
  DailyWorkSessionRestorePreviewResponseDto,
  DailyWorkTemplateApplyPreviewResponseDto,
  ModelRouteMode,
  ModelUsagePanelState,
  SessionHistoryItem,
  SessionHistoryPanelState,
  SessionRestorePreviewPanelState,
  TemplateItem,
  TemplatePanelState,
  TemplatePreviewPanelState,
  WorkflowActionItem,
  WorkflowPreviewPanelState
} from "../types";

type ConfirmedApprovalStatus = Exclude<ApprovalStatus, "waiting">;
type ApprovalStatusOverrides = Partial<Record<string, ConfirmedApprovalStatus>>;

interface UseDailyWorkActionsOptions {
  apiBaseUrl: string;
  applyPrompt: (prompt: string) => void;
  modelUsagePanel: ModelUsagePanelState;
  refreshActivityFeed: () => Promise<void>;
  refreshApprovalLedger: (options?: {
    statusOverrides?: ApprovalStatusOverrides;
  }) => Promise<void>;
  refreshSessionDetail: (sessionId: string) => Promise<void>;
  refreshSessionHistory: () => Promise<void>;
  setApprovalPanel: Dispatch<SetStateAction<ApprovalPanelState>>;
  setConnectorPreviewPanel: Dispatch<SetStateAction<ConnectorPreviewPanelState>>;
  setContextPanel: Dispatch<SetStateAction<ContextPanelState>>;
  setModelRouteMode: Dispatch<SetStateAction<ModelRouteMode>>;
  setSelectedActivityEventId: Dispatch<SetStateAction<string | null>>;
  setSelectedConnectorId: Dispatch<SetStateAction<string | null>>;
  setSelectedContextId: Dispatch<SetStateAction<string | null>>;
  setSelectedSessionHistoryId: Dispatch<SetStateAction<string | null>>;
  setSelectedWorkflowActionId: Dispatch<SetStateAction<string | null>>;
  setSessionHistoryPanel: Dispatch<SetStateAction<SessionHistoryPanelState>>;
  setTemplatePanel: Dispatch<SetStateAction<TemplatePanelState>>;
  workflowPreviewPanel: WorkflowPreviewPanelState;
}

export function useDailyWorkActions({
  apiBaseUrl,
  applyPrompt,
  modelUsagePanel,
  refreshActivityFeed,
  refreshApprovalLedger,
  refreshSessionDetail,
  refreshSessionHistory,
  setApprovalPanel,
  setConnectorPreviewPanel,
  setContextPanel,
  setModelRouteMode,
  setSelectedActivityEventId,
  setSelectedConnectorId,
  setSelectedContextId,
  setSelectedSessionHistoryId,
  setSelectedWorkflowActionId,
  setSessionHistoryPanel,
  setTemplatePanel,
  workflowPreviewPanel
}: UseDailyWorkActionsOptions) {
  async function applyTemplatePrompt(template: TemplateItem) {
    if (!template.enabled) {
      return;
    }

    const pendingPreview = createLocalTemplatePreviewState(
      template,
      "syncing",
      "正在请求 /api/daily/templates/:templateId/apply-preview，成功后会把后端 promptDraft 填入输入框。"
    );

    setTemplatePanel((current) => ({
      ...current,
      preview: pendingPreview
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/templates/${template.id}/apply-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Template apply-preview failed: ${response.status}`);
      }

      const preview = mapTemplatePreviewResponse(
        template,
        (await response.json()) as DailyWorkTemplateApplyPreviewResponseDto
      );

      applyPrompt(preview.promptDraft);
      setTemplatePanel((current) => ({
        ...current,
        preview
      }));
      await refreshActivityFeed();
    } catch {
      const fallbackPreview: TemplatePreviewPanelState = {
        ...createLocalTemplatePreviewState(
          template,
          "degraded",
          "暂未从后端生成 template apply-preview，已回退到本地 preview-only 模板提示。"
        ),
        source: "degraded"
      };

      applyPrompt(fallbackPreview.promptDraft);
      setTemplatePanel((current) => ({
        ...current,
        preview: fallbackPreview
      }));
    }
  }

  function selectSessionHistory(item: SessionHistoryItem) {
    setSelectedSessionHistoryId(item.id);
    setSessionHistoryPanel((current) => ({
      ...current,
      restorePreview: createLocalSessionRestorePreviewState(item)
    }));
  }

  async function restoreSessionHistory(item: SessionHistoryItem) {
    setSelectedSessionHistoryId(item.id);
    setSessionHistoryPanel((current) => ({
      ...current,
      restorePreview: createLocalSessionRestorePreviewState(
        item,
        "syncing",
        "正在请求 /api/daily/sessions/:sessionId/restore-preview，成功后会把后端 restorePrompt 填入输入框。"
      )
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/sessions/${item.id}/restore-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode,
            includeRecentMessages: true
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Session restore preview failed: ${response.status}`);
      }

      const restorePreview = mapSessionRestorePreviewResponse(
        item,
        (await response.json()) as DailyWorkSessionRestorePreviewResponseDto
      );

      applyPrompt(restorePreview.restorePrompt);
      setSessionHistoryPanel((current) => ({
        ...current,
        restorePreview
      }));
      await Promise.all([refreshActivityFeed(), refreshSessionHistory()]);
      await refreshSessionDetail(item.id);
    } catch {
      const fallbackPreview: SessionRestorePreviewPanelState = {
        ...createLocalSessionRestorePreviewState(
          item,
          "degraded",
          "暂未从后端生成 restore-preview，已回退到本地 preview-only 恢复提示。"
        ),
        source: "degraded"
      };

      applyPrompt(fallbackPreview.restorePrompt);
      setSessionHistoryPanel((current) => ({
        ...current,
        restorePreview: fallbackPreview
      }));
    }
  }

  async function useContextItem(item: ContextItem) {
    setSelectedContextId(item.id);
    setContextPanel((current) => ({
      ...current,
      preview: createLocalContextPreviewState(
        item,
        "syncing",
        "正在请求 /api/daily/context/:contextItemId/use-preview，成功后会把后端 promptDraft 填入输入框。"
      )
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/context/${item.id}/use-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Context use-preview failed: ${response.status}`);
      }

      const preview = mapContextUsePreviewResponse(
        item,
        (await response.json()) as DailyContextUsePreviewResponseDto
      );

      applyPrompt(preview.promptDraft);
      setContextPanel((current) => ({
        ...current,
        preview
      }));
      await refreshActivityFeed();
    } catch {
      const fallbackPreview: ContextPreviewPanelState = {
        ...createLocalContextPreviewState(
          item,
          "degraded",
          "暂未从后端生成 context use-preview，已回退到本地 preview-only 上下文提示。"
        ),
        source: "degraded"
      };

      applyPrompt(fallbackPreview.promptDraft);
      setContextPanel((current) => ({
        ...current,
        preview: fallbackPreview
      }));
    }
  }

  function applyConnectorPrompt(item: ConnectorItem) {
    setSelectedConnectorId(item.id);
    applyPrompt(buildConnectorAccessPrompt(item));
  }

  function applyWorkflowActionPrompt(item: WorkflowActionItem) {
    setSelectedWorkflowActionId(item.id);
    const panelMatches =
      workflowPreviewPanel.workflowId === item.apiWorkflowId &&
      workflowPreviewPanel.actionId === item.apiActionId;

    applyPrompt(
      panelMatches
        ? buildWorkflowPreviewPrompt(item, workflowPreviewPanel)
        : item.prompt
    );
  }

  function applyActivityEventPrompt(item: ActivityEventItem) {
    setSelectedActivityEventId(item.id);
    applyPrompt(buildActivityEventPrompt(item));
  }

  function switchModelRoute(nextMode: ModelRouteMode) {
    setModelRouteMode(nextMode);
    applyPrompt(
      buildModelSwitchPrompt(
        modelUsagePanel.modelSnapshots[nextMode],
        modelUsagePanel.usageSnapshots[nextMode]
      )
    );
  }

  async function updateApprovalStatus(
    approvalId: string,
    nextStatus: ConfirmedApprovalStatus
  ) {
    const applyLocalStatus = () => {
      setApprovalPanel((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === approvalId ? { ...item, status: nextStatus } : item
        )
      }));
    };

    applyLocalStatus();
    setApprovalPanel((current) => ({
      ...current,
      syncStatus: "syncing",
      notice:
        "正在向 /api/daily/approvals/:approvalRequestId/decision 写入 preview-only 审批决策。"
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/approvals/${approvalId}/decision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode,
            decision: nextStatus === "denied" ? "deny" : "approved",
            reason: `Preview decision from approval ledger for ${approvalId}.`
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Approval decision failed: ${response.status}`);
      }

      const payload = (await response.json()) as DailyApprovalDecisionResponseDto;
      const confirmedStatus = resolveApprovalDecisionStatus(
        payload,
        nextStatus
      );

      setApprovalPanel((current) => ({
        ...current,
        source: "api",
        syncStatus: "live",
        items: current.items.map((item) =>
          item.id === approvalId
            ? { ...item, status: confirmedStatus }
            : item
        ),
        notice:
          "已从 /api/daily/approvals/:approvalRequestId/decision 返回 preview-only 决策；externalEffects=['none']。"
      }));
      await Promise.all([
        refreshApprovalLedger({
          statusOverrides: {
            [approvalId]: confirmedStatus
          }
        }),
        refreshActivityFeed()
      ]);
    } catch {
      applyLocalStatus();
      setApprovalPanel((current) => ({
        ...current,
        source: "degraded",
        syncStatus: "degraded",
        notice:
          "审批 decision API 暂不可用；已保留本地 preview-only 决策状态。"
      }));
    }
  }

  async function updateConnectorPreviewDecision(
    connector: ConnectorItem,
    nextStatus: ConfirmedApprovalStatus
  ) {
    if (connector.requiredApprovalIds.length === 0) {
      return;
    }

    const applyLocalStatus = () => {
      setApprovalPanel((current) => ({
        ...current,
        items: current.items.map((item) =>
          connector.requiredApprovalIds.includes(item.id)
            ? { ...item, status: nextStatus }
            : item
        )
      }));
    };

    applyLocalStatus();
    setConnectorPreviewPanel((current) =>
      current.connectorId === connector.apiConnectorId
        ? {
            ...current,
            syncStatus: "syncing",
            notice: "正在向审批 decision API 写入 preview-only 决策。"
          }
        : current
    );

    try {
      const decision = nextStatus === "denied" ? "deny" : "approved";
      const responses = await Promise.all(
        connector.requiredApprovalIds.map(async (approvalId) => {
          const response = await fetch(
            `${apiBaseUrl}/api/daily/approvals/${approvalId}/decision`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                mode: activeMode,
                decision,
                reason: `Preview decision from ${connector.name}.`
              })
            }
          );

          if (!response.ok) {
            throw new Error(`Approval decision failed: ${response.status}`);
          }

          return (await response.json()) as DailyApprovalDecisionResponseDto;
        })
      );
      const statusOverrides = connector.requiredApprovalIds.reduce<ApprovalStatusOverrides>(
        (overrides, approvalId) => {
          const response = responses.find(
            (entry) => entry.request?.id === approvalId
          );

          overrides[approvalId] = response
            ? resolveApprovalDecisionStatus(response, nextStatus)
            : nextStatus;

          return overrides;
        },
        {}
      );

      setApprovalPanel((current) => ({
        ...current,
        source: "api",
        syncStatus: "live",
        items: current.items.map((item) => {
          const response = responses.find(
            (entry) => entry.request?.id === item.id
          );

          return response
            ? { ...item, status: resolveApprovalDecisionStatus(response, nextStatus) }
            : item;
        }),
        notice:
          "已从 /api/daily/approvals/:approvalRequestId/decision 同步连接器关联审批结果。"
      }));
      setConnectorPreviewPanel((current) =>
        current.connectorId === connector.apiConnectorId
          ? {
              ...current,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/approvals/:approvalRequestId/decision 返回 preview-only 审批结果。"
            }
          : current
      );
      await Promise.all([
        refreshApprovalLedger({ statusOverrides }),
        refreshActivityFeed()
      ]);
    } catch {
      applyLocalStatus();
      setConnectorPreviewPanel((current) =>
        current.connectorId === connector.apiConnectorId
          ? {
              ...current,
              source: "degraded",
              syncStatus: "degraded",
              notice:
                "审批 decision API 暂不可用；已保留本地 preview-only 决策状态。"
            }
          : current
      );
    }
  }

  return {
    applyActivityEventPrompt,
    applyConnectorPrompt,
    applyTemplatePrompt,
    applyWorkflowActionPrompt,
    restoreSessionHistory,
    selectSessionHistory,
    switchModelRoute,
    updateApprovalStatus,
    updateConnectorPreviewDecision,
    useContextItem
  };
}

function resolveApprovalDecisionStatus(
  payload: DailyApprovalDecisionResponseDto,
  fallbackStatus: ConfirmedApprovalStatus
): ConfirmedApprovalStatus {
  const mappedStatus = mapApprovalDecisionStatus(payload);

  return mappedStatus === "waiting" ? fallbackStatus : mappedStatus;
}
