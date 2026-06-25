"use client";

import { Activity, Link2, Lock, Send, ShieldCheck, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  activityConnectionStatusLabel,
  activityFeedSourceLabel
} from "../../domain";
import type {
  ActivityConnectionStatus,
  ActivityEventItem,
  ActivityFeedSource,
  ActivityToolAuditItem
} from "../../types";
import {
  ActivityEventStatusPill,
  ActivityFeedMeta,
  ArtifactDetailBlock,
  ArtifactDetailRow
} from "../DailyWorkPrimitives";

interface ActivityFeedPanelProps {
  connectionStatus: ActivityConnectionStatus;
  events: ActivityEventItem[];
  lastUpdated: string;
  notice: string;
  selectedEvent: ActivityEventItem | null;
  source: ActivityFeedSource;
  onApplyEventPrompt: (event: ActivityEventItem) => void;
  onSelectEvent: (eventId: string) => void;
}

export function ActivityFeedPanel({
  connectionStatus,
  events,
  lastUpdated,
  notice,
  selectedEvent,
  source,
  onApplyEventPrompt,
  onSelectEvent
}: ActivityFeedPanelProps) {
  return (
    <div
      className="rounded-[8px] border border-teal-100 bg-white p-3"
      data-activity-feed
      data-activity-feed-count={events.length}
      data-activity-feed-source={source}
      data-activity-connection-status={connectionStatus}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
            <Activity className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">实时活动流 / 状态事件</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            记录会话、工具计划、审批变化、执行结果和产物复用状态。
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">
          <Lock className="size-3.5" aria-hidden="true" />
          {events.length} 条活动事件
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <ActivityFeedMeta
          label="事件来源"
          value={activityFeedSourceLabel(source)}
        />
        <ActivityFeedMeta
          label="连接状态"
          value={activityConnectionStatusLabel(connectionStatus)}
        />
        <ActivityFeedMeta label="最近更新" value={lastUpdated} />
      </div>

      <div
        className={cn(
          "mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5",
          connectionStatus === "degraded"
            ? "border-orange-200 bg-orange-50 text-orange-800"
            : "border-teal-100 bg-teal-50 text-teal-800"
        )}
      >
        {notice}
      </div>

      <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
        编码模式提示：活动事件会关联当前会话、工具调用和产物，便于回溯执行链路。
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="space-y-2">
          {events.map((event) => {
            const Icon = event.icon;
            const isSelected = selectedEvent?.id === event.id;

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event.id)}
                data-activity-event-id={event.id}
                data-activity-tool-audit-row={event.toolAudit?.toolName}
                data-activity-tool-provider={event.toolAudit?.provider ?? undefined}
                data-activity-tool-phase={event.toolAudit?.toolPhase}
                data-activity-tool-reference={event.toolAudit?.reference ?? undefined}
                data-activity-tool-boundary={
                  event.toolAudit
                    ? event.toolAudit.previewOnly
                      ? "preview-only"
                      : "requires approval"
                    : undefined
                }
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                  isSelected
                    ? "border-teal-400 bg-teal-50 shadow-sm"
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
                        {event.title}
                      </span>
                      <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                        {event.time} / {event.type} / {event.relatedObject}
                      </span>
                    </span>
                    <ActivityEventStatusPill status={event.status} />
                  </span>
                  <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                    {event.summary}
                  </span>
                  {event.toolAudit ? (
                    <span
                      className="mt-2 inline-flex max-w-full items-center gap-1 rounded-[999px] border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] leading-4 text-slate-700"
                      data-activity-tool-chip={event.toolAudit.toolName}
                    >
                      <Wrench className="size-3.5 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 truncate">
                        {event.toolAudit.toolPhase} / {event.toolAudit.toolName}
                      </span>
                    </span>
                  ) : null}
                  <span className="mt-2 block break-words text-[11px] leading-4 text-orange-700">
                    安全边界：{event.safetyBoundary}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {selectedEvent ? (
          <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-teal-700">
                  选中事件
                </div>
                <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                  {selectedEvent.title}
                </div>
                <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                  {selectedEvent.promptFocus}
                </div>
              </div>
              <ActivityEventStatusPill status={selectedEvent.status} />
            </div>

            <div className="mt-3 grid gap-2">
              <ArtifactDetailRow label="事件类型" value={selectedEvent.type} />
              <ArtifactDetailRow label="发生时间" value={selectedEvent.time} />
              <ArtifactDetailRow
                label={`关联对象：${selectedEvent.relatedObject}`}
                value={selectedEvent.relatedLabel}
              />
            </div>

            <ArtifactDetailBlock
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
              title="安全边界"
            >
              {selectedEvent.safetyBoundary}
            </ArtifactDetailBlock>

            {selectedEvent.toolAudit ? (
              <ActivityToolAuditBlock toolAudit={selectedEvent.toolAudit} />
            ) : null}

            <Button
              type="button"
              size="sm"
              className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => onApplyEventPrompt(selectedEvent)}
            >
              <Send className="size-4" aria-hidden="true" />
              将事件转为提示词
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActivityToolAuditBlock({
  toolAudit
}: {
  toolAudit: ActivityToolAuditItem;
}) {
  const inputFields = toolAudit.inputFields.length
    ? toolAudit.inputFields.join(", ")
    : "none";
  const externalEffects = toolAudit.externalEffects.length
    ? toolAudit.externalEffects.join(", ")
    : "none";
  const resultCount =
    toolAudit.resultCount === null ? "not reported" : `${toolAudit.resultCount}`;
  const boundary = toolAudit.previewOnly ? "preview-only" : "requires approval";

  return (
    <div
      className="mt-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2"
      data-activity-tool-audit
      data-activity-tool-name={toolAudit.toolName}
      data-activity-tool-provider={toolAudit.provider ?? ""}
      data-activity-tool-reference={toolAudit.reference ?? ""}
      data-activity-tool-result-count={resultCount}
      data-activity-tool-boundary={boundary}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-slate-950">
        <Wrench className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
        <span className="min-w-0 break-words">工具审计</span>
      </div>

      <div className="mt-2 grid gap-2">
        <ArtifactDetailRow
          label="工具"
          value={`${toolAudit.toolPhase} / ${toolAudit.toolName}`}
        />
        <ArtifactDetailRow
          label="来源"
          value={toolAudit.provider ?? "local preview"}
        />
        <ArtifactDetailRow label="关联对象" value={toolAudit.connectorId ?? "none"} />
        <ArtifactDetailRow label="输入字段" value={inputFields} />
        <ArtifactDetailRow label="结果数量" value={resultCount} />
        <ArtifactDetailRow label="外部影响" value={externalEffects} />
      </div>

      <div className="mt-2 rounded-[8px] border border-teal-100 bg-teal-50 px-2.5 py-2 text-xs leading-5 text-teal-800">
        <span className="font-medium">摘要：</span>
        {toolAudit.externalDataSummary}
      </div>

      {toolAudit.reference ? (
        <div className="mt-2 flex items-start gap-2 rounded-[8px] border border-teal-100 bg-teal-50 px-2.5 py-2 text-xs leading-5 text-teal-800">
          <Link2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{toolAudit.reference}</span>
        </div>
      ) : null}

      <div className="mt-2 rounded-[8px] border border-orange-100 bg-orange-50 px-2.5 py-2 text-xs leading-5 text-orange-800">
        <span className="font-medium">边界：</span>
        {boundary}; 写入、命令和测试执行必须经过会话内审批。
      </div>
    </div>
  );
}
