import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useTemplatePanel(apiBaseUrl: string) {
  const [templatePanel, setTemplatePanel] = React.useState<DailyWorkTypes.TemplatePanelState>(() =>
    domain.createFallbackTemplatePanelState()
  );

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchTemplates() {
      setTemplatePanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/templates?mode=daily_work 同步模板库。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/templates?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Templates request failed: ${response.status}`);
        }

        const items = domain.mapTemplatesResponse(
          (await response.json()) as DailyWorkTypes.DailyWorkTemplatesResponseDto
        );

        if (!isDisposed) {
          setTemplatePanel((current) => {
            const preview =
              current.preview.templateId &&
              items.some((item) => item.id === current.preview.templateId)
                ? current.preview
                : domain.createLocalTemplatePreviewState(items[0] ?? null);

            return {
              items,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/templates?mode=daily_work 同步模板、产物类型、标签和启用状态。",
              preview
            };
          });
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setTemplatePanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice: "暂未从后端同步模板库，已保留本地 templates fallback。"
        }));
      }
    }

    void fetchTemplates();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { templatePanel, setTemplatePanel };
}
