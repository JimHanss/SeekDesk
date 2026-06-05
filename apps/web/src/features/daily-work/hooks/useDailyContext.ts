import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useDailyContext(
  apiBaseUrl: string,
  setSelectedContextId: React.Dispatch<React.SetStateAction<string | null>>
) {
  const [contextPanel, setContextPanel] = React.useState<DailyWorkTypes.ContextPanelState>(() =>
    domain.createFallbackContextPanelState()
  );

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchContextItems() {
      setContextPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/context?mode=daily_work 同步会话知识上下文。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/context?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Context request failed: ${response.status}`);
        }

        const items = domain.mapContextResponse(
          (await response.json()) as DailyWorkTypes.DailyContextResponseDto
        );

        if (!isDisposed) {
          setContextPanel((current) => {
            const preview =
              current.preview.contextItemId &&
              items.some((item) => item.id === current.preview.contextItemId)
                ? current.preview
                : domain.createLocalContextPreviewState(null);

            return {
              items,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/context?mode=daily_work 同步上下文来源、权限、标签和摘要。",
              preview
            };
          });
          setSelectedContextId((current) =>
            current && items.some((item) => item.id === current) ? current : null
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setContextPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步会话知识上下文，已保留本地 context fallback。"
        }));
      }
    }

    void fetchContextItems();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { contextPanel, setContextPanel };
}
