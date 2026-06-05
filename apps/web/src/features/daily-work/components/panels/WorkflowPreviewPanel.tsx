"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Lock,
  Send,
  Workflow
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  workflowActionFilterCount,
  workflowActionFilters,
  workflowActions
} from "../../domain";
import type {
  WorkflowActionFilter,
  WorkflowActionItem,
  WorkflowPreviewPanelState
} from "../../types";
import {
  ArtifactDetailBlock,
  ArtifactDetailRow,
  ConnectorRiskPill,
  WorkflowActionStatusPill
} from "../DailyWorkPrimitives";

interface WorkflowPreviewPanelProps {
  filter: WorkflowActionFilter;
  filteredActions: WorkflowActionItem[];
  previewPanel: WorkflowPreviewPanelState;
  selectedAction: WorkflowActionItem | null;
  onApplyWorkflowActionPrompt: (action: WorkflowActionItem) => void;
  onFilterChange: (filter: WorkflowActionFilter) => void;
  onSelectAction: (actionId: string) => void;
}

export function WorkflowPreviewPanel({
  filter,
  filteredActions,
  previewPanel,
  selectedAction,
  onApplyWorkflowActionPrompt,
  onFilterChange,
  onSelectAction
}: WorkflowPreviewPanelProps) {
  return (
    <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
            <Workflow className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">
              工作流编排预演 / 动作队列
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            daily_work 当前只生成自动化预演：不调用外部系统、不自动发送邮件、不写入日历或文档。
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-white px-2.5 py-1 text-[11px] font-medium text-teal-700">
          <Lock className="size-3.5" aria-hidden="true" />
          预演队列 {filteredActions.length}/{workflowActions.length}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="工作流动作筛选">
        {workflowActionFilters.map((currentFilter) => {
          const isActive = filter === currentFilter;

          return (
            <button
              key={currentFilter}
              type="button"
              aria-pressed={isActive}
              onClick={() => onFilterChange(currentFilter)}
              className={cn(
                "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                isActive
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
              )}
            >
              <span>{currentFilter}</span>
              <span
                className={cn(
                  "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                  isActive ? "bg-white/20 text-white" : "bg-teal-50 text-teal-700"
                )}
              >
                {workflowActionFilterCount(currentFilter)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-2">
          {filteredActions.map((action) => {
            const Icon = action.icon;
            const isSelected = selectedAction?.id === action.id;

            return (
              <button
                key={action.id}
                type="button"
                data-workflow-action={action.apiActionId}
                data-workflow-action-id={action.id}
                data-api-workflow-id={action.apiWorkflowId}
                onClick={() => onSelectAction(action.id)}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                  isSelected
                    ? "border-teal-400 bg-white shadow-sm"
                    : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                )}
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-white text-teal-700 ring-1 ring-teal-100">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-teal-950">
                        {action.title}
                      </span>
                      <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                        {action.actionType} / {action.connector}
                      </span>
                    </span>
                    <WorkflowActionStatusPill status={action.approvalStatus} />
                  </span>
                  <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                    {action.summary}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <ConnectorRiskPill riskLevel={action.riskLevel} />
                    <span className="inline-flex min-w-0 items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">{action.artifact}</span>
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {selectedAction ? (
          <div
            className="rounded-[8px] border border-teal-100 bg-white p-3"
            data-workflow-preview-panel
            data-api-workflow-id={previewPanel.workflowId}
            data-workflow-preview-action={previewPanel.actionId}
            data-workflow-preview-source={previewPanel.source}
            data-workflow-preview-sync-status={previewPanel.syncStatus}
            data-workflow-preview-status={previewPanel.selectedActionStatus}
            data-workflow-preview-only={String(previewPanel.previewOnly)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-teal-700">
                  选中动作
                </div>
                <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                  {selectedAction.title}
                </div>
                <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                  {selectedAction.nextStep}
                </div>
              </div>
              <WorkflowActionStatusPill status={selectedAction.approvalStatus} />
            </div>

            <div className="mt-3 grid gap-2">
              <ArtifactDetailRow
                label="关联连接器"
                value={selectedAction.connector}
              />
              <ArtifactDetailRow label="上下文" value={selectedAction.context} />
              <ArtifactDetailRow label="预期产物" value={selectedAction.artifact} />
            </div>

            <div className="mt-3 rounded-[8px] border border-cyan-100 bg-cyan-50 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-950">
                    <Workflow
                      className="size-4 shrink-0 text-cyan-700"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 break-words">
                      工作流 API 预演契约
                    </span>
                  </div>
                  <div className="mt-1 break-words font-mono text-[11px] text-cyan-700">
                    POST /api/daily/workflows/
                    {previewPanel.workflowId}/preview · {previewPanel.actionId}
                  </div>
                </div>
                <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-cyan-700">
                  {previewPanel.source} / {previewPanel.syncStatus}
                </span>
              </div>

              <div
                className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-900"
                data-workflow-preview-summary
              >
                {previewPanel.summary}
              </div>

              <div className="mt-3 space-y-1">
                {previewPanel.steps.map((step) => (
                  <div
                    key={`${previewPanel.actionId}-${step}`}
                    className="flex items-start gap-2 rounded-[8px] border border-cyan-100 bg-white px-2.5 py-2 text-xs leading-5 text-slate-700"
                    data-workflow-preview-step
                  >
                    <CheckCircle2
                      className="mt-0.5 size-3.5 shrink-0 text-cyan-700"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 break-words">{step}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2">
                <ArtifactDetailRow
                  label="连接器链路"
                  value={previewPanel.connectorLinks.join("、")}
                />
                <ArtifactDetailRow
                  label="上下文链路"
                  value={previewPanel.contextLinks.join("、")}
                />
                <ArtifactDetailRow
                  label="产物链路"
                  value={previewPanel.artifactLinks.join("、")}
                />
                <ArtifactDetailRow
                  label="审批链路"
                  value={previewPanel.approvalLinks.join("、")}
                />
              </div>

              <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                {previewPanel.safetyStatement}
              </div>
              <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-800">
                {previewPanel.notice}
              </div>
            </div>

            <ArtifactDetailBlock
              icon={<AlertCircle className="size-4" aria-hidden="true" />}
              title="风险提示"
            >
              {selectedAction.riskNote}
            </ArtifactDetailBlock>

            <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
              这个按钮只会把所选动作转换为聊天 prompt；发送前仍由你确认，不会触发邮件、日历、文档或外部工具。
            </div>

            <Button
              type="button"
              size="sm"
              className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => onApplyWorkflowActionPrompt(selectedAction)}
            >
              <Send className="size-4" aria-hidden="true" />
              生成预演提示词
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
