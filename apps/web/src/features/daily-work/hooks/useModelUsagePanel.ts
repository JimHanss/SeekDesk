import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useModelUsagePanel(apiBaseUrl: string) {
  const [modelUsagePanel, setModelUsagePanel] = React.useState<DailyWorkTypes.ModelUsagePanelState>(
    () => domain.createFallbackModelUsagePanelState()
  );

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchModelUsage() {
      setModelUsagePanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/model-usage?mode=daily_work 同步 DeepSeek 模型与用量。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/model-usage?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Model usage request failed: ${response.status}`);
        }

        const payload = (await response.json()) as DailyWorkTypes.DailyModelUsageResponseDto;

        if (isDisposed) {
          return;
        }

        setModelUsagePanel(domain.mapDailyModelUsageResponse(payload));
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setModelUsagePanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未取到后端模型与用量，已降级保留前端示例快照；页面可继续用于 daily_work。"
        }));
      }
    }

    void fetchModelUsage();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { modelUsagePanel };
}
