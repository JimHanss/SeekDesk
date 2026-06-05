"use client";

import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  approvalPanelSourceLabel,
  approvalPanelSyncStatusLabel,
  approvalStatusLabel
} from "../../domain";
import type {
  ApprovalPanelState,
  ApprovalRequestItem,
  ApprovalStatus
} from "../../types";
import {
  InfoRow,
  StatusPill
} from "../DailyWorkPrimitives";

interface ApprovalLedgerPanelProps {
  approvalPanel: ApprovalPanelState;
  approvalRequests: ApprovalRequestItem[];
  onUpdateApprovalStatus: (
    approvalId: string,
    nextStatus: Exclude<ApprovalStatus, "waiting">
  ) => void;
}

export function ApprovalLedgerPanel({
  approvalPanel,
  approvalRequests,
  onUpdateApprovalStatus
}: ApprovalLedgerPanelProps) {
  return (
    <div
      className="rounded-[8px] border border-amber-200 bg-amber-50 p-3"
      data-approval-ledger-panel
      data-approval-ledger-source={approvalPanel.source}
      data-approval-ledger-sync-status={approvalPanel.syncStatus}
      data-approval-ledger-count={approvalRequests.length}
      data-approval-ledger-notice={approvalPanel.notice}
    >
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-amber-950">
            <ShieldCheck
              className="size-4 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <span className="min-w-0 break-words">许可审批台账</span>
          </div>
          <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
            {approvalRequests.length}
          </span>
        </div>
        <div className="rounded-[8px] border border-amber-100 bg-white/80 px-2.5 py-2 text-[11px] leading-5 text-amber-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-[999px] bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
              {approvalPanelSourceLabel(approvalPanel.source)}
            </span>
            <span className="rounded-[999px] bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              {approvalPanelSyncStatusLabel(approvalPanel.syncStatus)}
            </span>
          </div>
          <p className="mt-1 break-words">{approvalPanel.notice}</p>
        </div>
      </div>
      <div className="space-y-2">
        {approvalRequests.map((request) => {
          const Icon = request.icon;

          return (
            <div
              key={request.id}
              data-approval-request={request.id}
              data-approval-status={request.status}
              className="rounded-[8px] border border-amber-100 bg-white px-3 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-amber-50 text-amber-700">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-teal-950">
                        {request.title}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-teal-700">
                        {request.requestedAction}
                      </div>
                    </div>
                    <StatusPill status={request.status} />
                  </div>

                  <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-700">
                    <InfoRow label="风险等级" value={request.risk} />
                    <InfoRow label="范围边界" value={request.scope} />
                    <InfoRow
                      label="当前状态"
                      value={approvalStatusLabel(request.status)}
                    />
                  </div>

                  <p className="mt-2 text-xs leading-5 text-amber-800">
                    {request.detail}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      data-approval-decision-action="allow_once"
                      data-approval-decision-target={request.id}
                      className="h-8 rounded-[8px] border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                      onClick={() =>
                        onUpdateApprovalStatus(request.id, "allowed_once")
                      }
                    >
                      允许一次
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      data-approval-decision-action="deny"
                      data-approval-decision-target={request.id}
                      className="h-8 rounded-[8px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      onClick={() => onUpdateApprovalStatus(request.id, "denied")}
                    >
                      拒绝
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-amber-800">
        审批按钮只写入后端的仅预览决策回执；不会触发真实邮件、日历或外部系统操作。
      </p>
    </div>
  );
}
