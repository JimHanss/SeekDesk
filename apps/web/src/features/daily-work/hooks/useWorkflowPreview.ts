import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useWorkflowPreview(
  apiBaseUrl: string,
  selectedWorkflowAction: DailyWorkTypes.WorkflowActionItem | null,
  onPreviewSynced?: () => Promise<void> | void
) {
  const [workflowPreviewPanel, setWorkflowPreviewPanel] =
    React.useState<DailyWorkTypes.WorkflowPreviewPanelState>(() =>
      domain.createLocalWorkflowPreviewState(domain.workflowActions[0]!)
    );

  React.useEffect(() => {
    if (!selectedWorkflowAction) {
      return;
    }

    const action = selectedWorkflowAction;
    let isDisposed = false;
    const controller = new AbortController();
    const fallbackState = domain.createLocalWorkflowPreviewState(action);

    setWorkflowPreviewPanel({
      ...fallbackState,
      syncStatus: "syncing",
      notice: `正在从 /api/daily/workflows/${action.apiWorkflowId}/preview 同步工作流预演。`
    });

    async function fetchWorkflowPreview() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/workflows/${action.apiWorkflowId}/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              mode: domain.activeMode,
              actionId: action.apiActionId,
              contextItemIds: action.relatedContextIds,
              prompt: `Preview ${action.title} for daily_work.`
            }),
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Workflow preview request failed: ${response.status}`);
        }

        const payload = (await response.json()) as DailyWorkTypes.DailyWorkflowPreviewResponseDto;

        if (!isDisposed) {
          setWorkflowPreviewPanel(domain.mapWorkflowPreviewResponse(action, payload));
          void onPreviewSynced?.();
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setWorkflowPreviewPanel({
          ...fallbackState,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步工作流预演，已保留本地 preview-only fallback。"
        });
      }
    }

    void fetchWorkflowPreview();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, onPreviewSynced, selectedWorkflowAction])

  return { workflowPreviewPanel, setWorkflowPreviewPanel };
}
