import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useSessionHistory(
  apiBaseUrl: string,
  selectedSessionHistoryId: string | null,
  setSelectedSessionHistoryId: React.Dispatch<React.SetStateAction<string | null>>
) {
  const [sessionHistoryPanel, setSessionHistoryPanel] =
    React.useState<DailyWorkTypes.SessionHistoryPanelState>(() =>
      domain.createFallbackSessionHistoryPanelState()
    );

  const refreshSessionHistory = React.useCallback(
    async (signal?: AbortSignal) => {
      setSessionHistoryPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice:
          "正在从 /api/daily/sessions?mode=daily_work 刷新会话列表与摘要。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions?mode=${domain.activeMode}`,
          signal ? { signal } : undefined
        );

        if (!response.ok) {
          throw new Error(`Sessions request failed: ${response.status}`);
        }

        const items = domain.mapSessionsResponse(
          (await response.json()) as DailyWorkTypes.DailyWorkSessionsResponseDto
        );

        setSessionHistoryPanel((current) => {
          const restorePreview =
            current.restorePreview.sessionId &&
            items.some((item) => item.id === current.restorePreview.sessionId)
              ? current.restorePreview
              : domain.createLocalSessionRestorePreviewState(items[0] ?? null);

          return {
            items,
            source: "api",
            syncStatus: "live",
            notice:
              "已从 /api/daily/sessions?mode=daily_work 刷新会话列表、状态、关联产物、上下文和审批链路。",
            restorePreview
          };
        });
        setSelectedSessionHistoryId((current) =>
          current && items.some((item) => item.id === current)
            ? current
            : items[0]?.id ?? null
        );
      } catch {
        if (signal?.aborted) {
          return;
        }

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端刷新会话列表，页面保留当前 session history 快照。"
        }));
      }
    },
    [apiBaseUrl, setSelectedSessionHistoryId]
  );

  const refreshSessionDetail = React.useCallback(
    async (sessionId: string, signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions/${sessionId}?mode=${domain.activeMode}`,
          signal ? { signal } : undefined
        );

        if (!response.ok) {
          throw new Error(`Session detail request failed: ${response.status}`);
        }

        const nextItem = domain.mapSessionResponse(
          (await response.json()) as DailyWorkTypes.DailyWorkSessionResponseDto
        );

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "api",
          syncStatus: "live",
          items: domain.replaceSessionHistoryItem(current.items, nextItem),
          notice: `已从 /api/daily/sessions/${nextItem.id}?mode=daily_work 刷新会话详情、摘要和最近消息。`,
          restorePreview:
            current.restorePreview.sessionId === nextItem.id
              ? current.restorePreview
              : domain.createLocalSessionRestorePreviewState(nextItem)
        }));
      } catch {
        if (signal?.aborted) {
          return;
        }

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端刷新选中会话详情，继续展示当前会话快照。"
        }));
      }
    },
    [apiBaseUrl]
  );

  React.useEffect(() => {
    const controller = new AbortController();

    void refreshSessionHistory(controller.signal);

    return () => {
      controller.abort();
    };
  }, [refreshSessionHistory]);

  React.useEffect(() => {
    if (!selectedSessionHistoryId) {
      return;
    }

    const controller = new AbortController();

    void refreshSessionDetail(selectedSessionHistoryId, controller.signal);

    return () => {
      controller.abort();
    };
  }, [refreshSessionDetail, selectedSessionHistoryId]);

  return {
    refreshSessionDetail,
    refreshSessionHistory,
    sessionHistoryPanel,
    setSessionHistoryPanel
  };
}
