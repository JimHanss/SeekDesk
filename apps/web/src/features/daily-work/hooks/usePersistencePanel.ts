import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function usePersistencePanel(apiBaseUrl: string) {
  const [persistencePanel, setPersistencePanel] =
    React.useState<DailyWorkTypes.PersistencePanelState>(() => domain.createFallbackPersistencePanelState());

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchPersistenceStatus() {
      setPersistencePanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在读取 /health 的数据层状态。"
      }));

      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Health request failed: ${response.status}`);
        }

        const nextState = domain.mapHealthPersistenceResponse(await response.json());

        if (!isDisposed) {
          setPersistencePanel(nextState);
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setPersistencePanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从 /health 读取到数据层状态；工作台继续使用 seed/mock fallback。"
        }));
      }
    }

    void fetchPersistenceStatus();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { persistencePanel };
}
