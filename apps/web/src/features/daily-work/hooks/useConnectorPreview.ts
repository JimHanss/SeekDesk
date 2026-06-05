import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useConnectorPreview(
  apiBaseUrl: string,
  selectedConnector: DailyWorkTypes.ConnectorItem | null
) {
  const [connectorPreviewPanel, setConnectorPreviewPanel] =
    React.useState<DailyWorkTypes.ConnectorPreviewPanelState>(() =>
      domain.createLocalConnectorPreviewState(domain.connectorItems[0]!)
    );

  React.useEffect(() => {
    if (!selectedConnector) {
      return;
    }

    const connector = selectedConnector;
    let isDisposed = false;
    const controller = new AbortController();
    const fallbackState = domain.createLocalConnectorPreviewState(connector);

    setConnectorPreviewPanel({
      ...fallbackState,
      syncStatus: "syncing",
      notice: `正在从 /api/daily/connectors/${connector.apiConnectorId}/preview 同步预览。`
    });

    async function fetchConnectorPreview() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/connectors/${connector.apiConnectorId}/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              mode: domain.activeMode,
              action: connector.apiAction,
              contextItemIds: connector.relatedContextIds,
              prompt: `Preview ${connector.name} for daily_work.`
            }),
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Connector preview request failed: ${response.status}`);
        }

        const payload = (await response.json()) as DailyWorkTypes.ConnectorActionPreviewResponseDto;

        if (!isDisposed) {
          setConnectorPreviewPanel(
            domain.mapConnectorPreviewResponse(connector, payload)
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setConnectorPreviewPanel({
          ...fallbackState,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步连接器预览，已保留本地 preview-only fallback。"
        });
      }
    }

    void fetchConnectorPreview();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedConnector])

  return { connectorPreviewPanel, setConnectorPreviewPanel };
}
