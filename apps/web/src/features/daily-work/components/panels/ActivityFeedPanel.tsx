"use client";

import { Activity, Lock, Send, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  activityConnectionStatusLabel,
  activityFeedSourceLabel
} from "../../domain";
import type {
  ActivityConnectionStatus,
  ActivityEventItem,
  ActivityFeedSource
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
            daily_work 的任务状态轨迹：记录会话恢复、模板填入、审批变化、工作流预演和产物复用状态。
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
        编码模式兼容提示：这些事件只描述 daily_work 日常工作自动化状态，不暴露 coding_agent 命令、仓库操作或脚本工具。
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

            <Button
              type="button"
              size="sm"
              className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => onApplyEventPrompt(selectedEvent)}
            >
              <Send className="size-4" aria-hidden="true" />
              将事件转为 Prompt
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
