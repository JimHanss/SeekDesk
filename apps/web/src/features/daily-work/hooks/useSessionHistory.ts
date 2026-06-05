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

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchSessionHistory() {
      setSessionHistoryPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/sessions?mode=daily_work 同步会话列表。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Sessions request failed: ${response.status}`);
        }

        const items = domain.mapSessionsResponse(
          (await response.json()) as DailyWorkTypes.DailyWorkSessionsResponseDto
        );

        if (!isDisposed) {
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
                "已从 /api/daily/sessions?mode=daily_work 同步会话列表、状态、关联产物、上下文和审批链路。",
              restorePreview
            };
          });
          setSelectedSessionHistoryId((current) =>
            current && items.some((item) => item.id === current)
              ? current
              : items[0]?.id ?? null
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步会话列表，已保留本地 session history fallback。"
        }));
      }
    }

    void fetchSessionHistory();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  React.useEffect(() => {
    if (!selectedSessionHistoryId) {
      return;
    }

    let isDisposed = false;
    const controller = new AbortController();

    async function fetchSessionDetail() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions/${selectedSessionHistoryId}?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Session detail request failed: ${response.status}`);
        }

        const nextItem = domain.mapSessionResponse(
          (await response.json()) as DailyWorkTypes.DailyWorkSessionResponseDto
        );

        if (!isDisposed) {
          setSessionHistoryPanel((current) => ({
            ...current,
            source: "api",
            syncStatus: "live",
            items: domain.replaceSessionHistoryItem(current.items, nextItem),
            notice: `已从 /api/daily/sessions/${nextItem.id}?mode=daily_work 同步会话详情与最近消息。`,
            restorePreview:
              current.restorePreview.sessionId === nextItem.id
                ? current.restorePreview
                : domain.createLocalSessionRestorePreviewState(nextItem)
          }));
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步选中会话详情，继续展示当前会话快照。"
        }));
      }
    }

    void fetchSessionDetail();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedSessionHistoryId])

  return { sessionHistoryPanel, setSessionHistoryPanel };
}
