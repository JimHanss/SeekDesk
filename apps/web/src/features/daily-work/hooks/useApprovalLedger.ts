import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useApprovalLedger(apiBaseUrl: string) {
  const [approvalPanel, setApprovalPanel] = React.useState<DailyWorkTypes.ApprovalPanelState>(
    domain.createFallbackApprovalPanelState
  );

  const refreshApprovalLedger = React.useCallback(
    async (signal?: AbortSignal) => {
      setApprovalPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice:
          "正在从 /api/daily/approvals?mode=daily_work 刷新审批台账，确认最新持久化决策。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/approvals?mode=${domain.activeMode}`,
          signal ? { signal } : undefined
        );

        if (!response.ok) {
          throw new Error(`Approval requests failed: ${response.status}`);
        }

        const items = domain.mapApprovalRequestsResponse(
          (await response.json()) as DailyWorkTypes.DailyApprovalRequestsResponseDto
        );

        setApprovalPanel({
          items,
          source: "api",
          syncStatus: "live",
          notice:
            "已从 /api/daily/approvals?mode=daily_work 刷新审批请求、风险等级、权限模式和上下文链路。"
        });
      } catch {
        if (signal?.aborted) {
          return;
        }

        setApprovalPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端刷新审批台账，页面保留当前 approval 快照。"
        }));
      }
    },
    [apiBaseUrl]
  );

  React.useEffect(() => {
    const controller = new AbortController();

    void refreshApprovalLedger(controller.signal);

    return () => {
      controller.abort();
    };
  }, [refreshApprovalLedger]);

  return { approvalPanel, refreshApprovalLedger, setApprovalPanel };
}
