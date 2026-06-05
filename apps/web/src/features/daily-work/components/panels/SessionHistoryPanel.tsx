"use client";

import { Database, Loader2, MessageSquare, Play, Target, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  formatSessionLinkList,
  formatSessionRecentMessagePreview,
  sessionHistoryFilterCount,
  sessionHistoryFilters,
  sessionHistorySourceLabel,
  sessionHistorySyncStatusLabel,
  sessionRestorePreviewSourceLabel,
  sessionRestorePreviewSyncStatusLabel
} from "../../domain";
import type {
  SessionHistoryFilter,
  SessionHistoryItem,
  SessionHistoryPanelState
} from "../../types";
import {
  ArtifactDetailBlock,
  InfoRow,
  SessionMetric,
  SessionStatusPill
} from "../DailyWorkPrimitives";

interface SessionHistoryPanelProps {
  filteredItems: SessionHistoryItem[];
  filter: SessionHistoryFilter;
  panel: SessionHistoryPanelState;
  panelItems: SessionHistoryItem[];
  selectedItem: SessionHistoryItem | null;
  onFilterChange: (filter: SessionHistoryFilter) => void;
  onRestoreItem: (item: SessionHistoryItem) => void;
  onSelectItem: (item: SessionHistoryItem) => void;
}

export function SessionHistoryPanel({
  filteredItems,
  filter,
  panel,
  panelItems,
  selectedItem,
  onFilterChange,
  onRestoreItem,
  onSelectItem
}: SessionHistoryPanelProps) {
  return (
    <div
      className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
      data-session-history-panel
      data-session-history-source={panel.source}
      data-session-history-sync-status={panel.syncStatus}
      data-session-history-count={panelItems.length}
      data-session-restore-source={panel.restorePreview.source}
      data-session-restore-sync-status={panel.restorePreview.syncStatus}
      data-session-restore-preview-only={panel.restorePreview.previewOnly}
      data-session-restore-external-effects={panel.restorePreview.externalEffects.join(
        ","
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
            <Workflow className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">最近工作流 / 会话历史</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            从 daily_work sessions API 同步会话快照，并通过恢复预演把继续工作的提示填入输入框。
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2" aria-label="会话历史筛选">
          {sessionHistoryFilters.map((currentFilter) => {
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
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-teal-50 text-teal-700"
                  )}
                >
                  {sessionHistoryFilterCount(currentFilter, panelItems)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <InfoRow
          label="会话同步"
          value={`${sessionHistorySourceLabel(panel.source)} / ${sessionHistorySyncStatusLabel(
            panel.syncStatus
          )}`}
        />
        <InfoRow
          label="恢复预演"
          value={`${sessionRestorePreviewSourceLabel(
            panel.restorePreview.source
          )} / ${sessionRestorePreviewSyncStatusLabel(
            panel.restorePreview.syncStatus
          )} / previewOnly=${
            panel.restorePreview.previewOnly ? "true" : "false"
          } / externalEffects=${panel.restorePreview.externalEffects.join(",")}`}
        />
      </div>

      <div
        className="mt-2 rounded-[8px] border border-teal-100 bg-white px-3 py-2 text-[11px] leading-5 text-teal-800"
        data-session-history-notice
      >
        {panel.notice}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedItem?.id === item.id;

            return (
              <button
                key={item.id}
                type="button"
                data-session-card={item.id}
                onClick={() => onSelectItem(item)}
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
                        {item.title}
                      </span>
                      <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                        {item.updatedAt} / {item.mode}
                      </span>
                    </span>
                    <SessionStatusPill status={item.status} />
                  </span>
                  <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                    {item.summary}
                  </span>
                  <span className="mt-2 block break-words text-[11px] leading-4 text-orange-700">
                    上次动作：{item.lastAction}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {selectedItem ? (
          <div
            className="rounded-[8px] border border-teal-100 bg-white p-3"
            data-session-detail={selectedItem.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-teal-700">
                  可恢复会话
                </div>
                <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                  {selectedItem.title}
                </div>
                <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                  {selectedItem.summary}
                </div>
              </div>
              <SessionStatusPill status={selectedItem.status} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SessionMetric label="产物" value={`${selectedItem.artifactCount}`} />
              <SessionMetric label="审批" value={`${selectedItem.approvalCount}`} />
              <SessionMetric label="上下文" value={`${selectedItem.contextCount}`} />
              <SessionMetric label="消息" value={`${selectedItem.messageCount}`} />
            </div>

            <ArtifactDetailBlock
              icon={<Target className="size-4" aria-hidden="true" />}
              title="上次动作"
            >
              {selectedItem.lastAction}
            </ArtifactDetailBlock>

            <ArtifactDetailBlock
              icon={<Database className="size-4" aria-hidden="true" />}
              title="关联链路"
            >
              {formatSessionLinkList("产物", selectedItem.artifactIds)}
              {" / "}
              {formatSessionLinkList("上下文", selectedItem.contextItemIds)}
              {" / "}
              {formatSessionLinkList("审批", selectedItem.approvalRequestIds)}
            </ArtifactDetailBlock>

            <ArtifactDetailBlock
              icon={<MessageSquare className="size-4" aria-hidden="true" />}
              title="最近消息"
            >
              {formatSessionRecentMessagePreview(selectedItem)}
            </ArtifactDetailBlock>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedItem.tags.map((tag) => (
                <span
                  key={`${selectedItem.id}-${tag}`}
                  className="max-w-full rounded-[999px] bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700"
                >
                  <span className="break-words">{tag}</span>
                </span>
              ))}
            </div>

            <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
              恢复会先请求后端预演，成功后把恢复提示填入输入框；当前预演由你确认后再发送，不执行外部效果。
              <span className="mt-1 block text-[11px]">
                {panel.restorePreview.notice}
              </span>
              <span className="mt-1 block text-[11px] text-orange-700">
                {panel.restorePreview.safetyStatement}
              </span>
            </div>

            <Button
              type="button"
              size="sm"
              className="mt-3 w-full cursor-pointer bg-orange-500 hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
              disabled={panel.restorePreview.syncStatus === "syncing"}
              onClick={() => onRestoreItem(selectedItem)}
            >
              {panel.restorePreview.syncStatus === "syncing" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              恢复到输入框
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
