import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useApprovalLedger(apiBaseUrl: string) {
  const [approvalPanel, setApprovalPanel] = React.useState<DailyWorkTypes.ApprovalPanelState>(
    domain.createFallbackApprovalPanelState
  );

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchApprovalRequests() {
      setApprovalPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/approvals?mode=daily_work 同步审批台账。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/approvals?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Approval requests failed: ${response.status}`);
        }

        const items = domain.mapApprovalRequestsResponse(
          (await response.json()) as DailyWorkTypes.DailyApprovalRequestsResponseDto
        );

        if (!isDisposed) {
          setApprovalPanel({
            items,
            source: "api",
            syncStatus: "live",
            notice:
              "已从 /api/daily/approvals?mode=daily_work 同步审批请求、风险等级、权限模式和上下文链路。"
          });
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setApprovalPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步审批台账，已保留本地 approval fallback。"
        }));
      }
    }

    void fetchApprovalRequests();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { approvalPanel, setApprovalPanel };
}
