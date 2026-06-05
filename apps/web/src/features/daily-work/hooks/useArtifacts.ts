import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useArtifacts(
  apiBaseUrl: string,
  selectedArtifactId: string | null,
  setSelectedArtifactId: React.Dispatch<React.SetStateAction<string | null>>
) {
  const [artifactPanel, setArtifactPanel] = React.useState<DailyWorkTypes.ArtifactPanelState>(() =>
    domain.createFallbackArtifactPanelState()
  );

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchArtifacts() {
      setArtifactPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/artifacts?mode=daily_work 同步产物列表。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/artifacts?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Artifacts request failed: ${response.status}`);
        }

        const items = domain.mapArtifactsResponse(
          (await response.json()) as DailyWorkTypes.DailyWorkArtifactsResponseDto
        );

        if (!isDisposed) {
          setArtifactPanel({
            items,
            source: "api",
            syncStatus: "live",
            notice:
              "已从 /api/daily/artifacts?mode=daily_work 同步产物、上下文追踪、审批链路和 lifecycle。"
          });
          setSelectedArtifactId((current) =>
            current && items.some((item) => item.id === current)
              ? current
              : items[0]?.id ?? null
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setArtifactPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步产物列表，已保留本地 artifacts fallback。"
        }));
      }
    }

    void fetchArtifacts();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  React.useEffect(() => {
    if (!selectedArtifactId) {
      return;
    }

    let isDisposed = false;
    const controller = new AbortController();

    async function fetchArtifactDetail() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/artifacts/${selectedArtifactId}?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Artifact detail request failed: ${response.status}`);
        }

        const nextItem = domain.mapArtifactResponse(
          (await response.json()) as DailyWorkTypes.DailyWorkArtifactResponseDto
        );

        if (!isDisposed) {
          setArtifactPanel((current) => ({
            ...current,
            source: "api",
            syncStatus: "live",
            items: current.items.map((item) =>
              item.id === nextItem.id ? nextItem : item
            ),
            notice: `已从 /api/daily/artifacts/${nextItem.id}?mode=daily_work 同步产物详情。`
          }));
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setArtifactPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步选中产物详情，继续展示当前产物快照。"
        }));
      }
    }

    void fetchArtifactDetail();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedArtifactId])

  return { artifactPanel, setArtifactPanel };
}
