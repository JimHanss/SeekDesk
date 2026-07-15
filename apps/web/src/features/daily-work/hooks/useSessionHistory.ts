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
          "正在刷新编程会话列表。"
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
              "编程会话列表、工作区绑定和运行记录已刷新。",
            restorePreview
          };
        });
        setSelectedSessionHistoryId((current) =>
          current && items.some((item) => item.id === current) ? current : null
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
          notice: `会话 ${nextItem.id} 的消息和运行记录已刷新。`,
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

  const updateSessionMetadata = React.useCallback(
    async (
      sessionId: string,
      input: {
        title?: string;
        pinned?: boolean;
        status?: "active" | "waiting_for_approval" | "completed" | "archived";
      }
    ) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions/${encodeURIComponent(sessionId)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              mode: domain.activeMode,
              ...input
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Session update request failed: ${response.status}`);
        }

        const nextItem = domain.mapSessionResponse(
          (await response.json()) as DailyWorkTypes.DailyWorkSessionResponseDto
        );

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "api",
          syncStatus: "live",
          items: domain.replaceSessionHistoryItem(current.items, nextItem),
          notice: "会话操作已写入后端持久化。",
          restorePreview:
            current.restorePreview.sessionId === nextItem.id
              ? current.restorePreview
              : domain.createLocalSessionRestorePreviewState(nextItem)
        }));

        return nextItem;
      } catch (error) {
        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "会话操作写入失败：" +
            (error instanceof Error ? error.message : String(error))
        }));
        throw error;
      }
    },
    [apiBaseUrl]
  );

  const deleteSession = React.useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions/${encodeURIComponent(sessionId)}?mode=${domain.activeMode}`,
          {
            method: "DELETE"
          }
        );

        if (!response.ok) {
          throw new Error(`Session delete request failed: ${response.status}`);
        }

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "api",
          syncStatus: "live",
          items: current.items.filter((item) => item.id !== sessionId),
          notice: "会话已从后端删除。",
          restorePreview:
            current.restorePreview.sessionId === sessionId
              ? domain.createLocalSessionRestorePreviewState(null)
              : current.restorePreview
        }));
        setSelectedSessionHistoryId((current) =>
          current === sessionId ? null : current
        );
      } catch (error) {
        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "会话删除失败：" +
            (error instanceof Error ? error.message : String(error))
        }));
        throw error;
      }
    },
    [apiBaseUrl, setSelectedSessionHistoryId]
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
    deleteSession,
    refreshSessionDetail,
    refreshSessionHistory,
    sessionHistoryPanel,
    setSessionHistoryPanel,
    updateSessionMetadata
  };
}
