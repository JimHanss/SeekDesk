"use client";

import { Activity, AlertCircle, Bot, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  budgetStateLabel,
  budgetStatePercent,
  formatTokenCount,
  modelRouteLabel,
  modelUsageSyncStatusLabel
} from "../../domain";
import type {
  ModelRouteMode,
  ModelUsagePanelState
} from "../../types";
import {
  SessionMetric,
  SnapshotRow
} from "../DailyWorkPrimitives";

interface ModelUsagePanelProps {
  modelRouteMode: ModelRouteMode;
  modelUsagePanel: ModelUsagePanelState;
  onSwitchModelRoute: (mode: ModelRouteMode) => void;
}

export function ModelUsagePanel({
  modelRouteMode,
  modelUsagePanel,
  onSwitchModelRoute
}: ModelUsagePanelProps) {
  const activeModelSnapshot = modelUsagePanel.modelSnapshots[modelRouteMode];
  const activeUsageSnapshot = modelUsagePanel.usageSnapshots[modelRouteMode];
  const usageBudgetPercent = budgetStatePercent(activeUsageSnapshot.budgetLevel);

  return (
    <div
      className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
      data-model-usage-source={modelUsagePanel.source}
      data-model-usage-status={modelUsagePanel.syncStatus}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
            <Bot className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">模型与用量</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            DeepSeek 日常工作模式快照；启动后同步后端 daily_work 模型配置与用量统计。
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-[999px] px-2.5 py-1 text-[11px] font-medium",
            modelUsagePanel.syncStatus === "live"
              ? "bg-emerald-100 text-emerald-800"
              : modelUsagePanel.syncStatus === "syncing"
                ? "bg-sky-100 text-sky-800"
                : "bg-orange-100 text-orange-800"
          )}
        >
          <Activity className="size-3.5" aria-hidden="true" />
          {modelUsageSyncStatusLabel(modelUsagePanel.syncStatus)}
        </span>

        <div
          className="inline-flex w-full rounded-[8px] border border-teal-200 bg-white p-1 md:w-auto"
          aria-label="模型展示切换"
          role="group"
        >
          {(["fast", "pro"] as const).map((mode) => {
            const isActive = modelRouteMode === mode;
            const snapshot = modelUsagePanel.modelSnapshots[mode];

            return (
              <button
                key={mode}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSwitchModelRoute(mode)}
                className={cn(
                  "min-w-0 flex-1 rounded-[6px] px-3 py-2 text-left text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 md:min-w-28",
                  isActive
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-teal-700 hover:bg-teal-50"
                )}
              >
                <span className="block truncate">
                  {mode === "fast" ? "快速" : "深度"}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[10px]",
                    isActive ? "text-teal-50" : "text-teal-500"
                  )}
                >
                  {snapshot.selectedModel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[8px] border border-teal-100 bg-white p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
            <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
            模型快照
          </div>
          <div className="space-y-2">
            <SnapshotRow
              label="当前模式"
              value={activeModelSnapshot.currentMode}
            />
            <SnapshotRow label="服务商" value={activeModelSnapshot.provider} />
            <SnapshotRow label="接口地址" value={activeModelSnapshot.baseUrl} />
            <SnapshotRow label="快速模型" value={activeModelSnapshot.fastModel} />
            <SnapshotRow label="深度模型" value={activeModelSnapshot.proModel} />
            <SnapshotRow
              label="当前使用"
              value={activeModelSnapshot.selectedModel}
            />
            <SnapshotRow
              label="实况路由"
              value={modelRouteLabel(activeModelSnapshot.selectedRoute)}
            />
            <SnapshotRow
              label="思考模式"
              value={
                activeModelSnapshot.thinkingMode === "enabled"
                  ? "已启用 / 后端配置"
                  : "已关闭 / 后端配置"
              }
            />
            <SnapshotRow
              label="流式用量"
              value={
                activeModelSnapshot.streamUsageEnabled ? "已启用" : "已关闭"
              }
            />
            <SnapshotRow
              label="API 密钥"
              value={
                activeModelSnapshot.configured
                  ? "已配置 / 不展示密钥"
                  : "未配置 / 模拟用量"
              }
            />
          </div>
          <p className="mt-3 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2 text-xs leading-5 text-teal-700">
            路由策略：{activeModelSnapshot.routingStrategy}
          </p>
        </div>

        <div className="rounded-[8px] border border-teal-100 bg-white p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
            <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
            用量快照
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <SessionMetric
              label="输入 token"
              value={formatTokenCount(activeUsageSnapshot.inputTokens)}
            />
            <SessionMetric
              label="输出 token"
              value={formatTokenCount(activeUsageSnapshot.outputTokens)}
            />
            <SessionMetric
              label="合计 token"
              value={formatTokenCount(activeUsageSnapshot.totalTokens)}
            />
          </div>

          <div className="mt-3 space-y-2">
            <SnapshotRow label="窗口" value={activeUsageSnapshot.usageWindow} />
            <SnapshotRow label="成本" value={activeUsageSnapshot.estimatedCost} />
            <SnapshotRow label="预算/安全" value={activeUsageSnapshot.budgetState} />
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-teal-700">
              <span>{budgetStateLabel(activeUsageSnapshot.budgetLevel)}</span>
              <span>{usageBudgetPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-[999px] bg-teal-100">
              <div
                className="h-full rounded-[999px] bg-orange-500"
                style={{ width: `${usageBudgetPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="mt-3 grid gap-2 md:grid-cols-4"
        data-model-usage-aggregates={modelUsagePanel.usageAggregates.length}
      >
        {modelUsagePanel.usageAggregates.length > 0 ? (
          modelUsagePanel.usageAggregates.map((aggregate) => (
            <div
              key={aggregate.id}
              className="rounded-[8px] border border-teal-100 bg-white px-3 py-2"
            >
              <div className="truncate text-[11px] font-medium text-teal-700">
                {aggregate.label}
              </div>
              <div className="mt-1 text-sm font-semibold text-teal-950">
                {formatTokenCount(aggregate.totalTokens)}
              </div>
              <div className="mt-1 text-[11px] leading-5 text-slate-600">
                ?? {formatTokenCount(aggregate.promptTokens)} / ?? {formatTokenCount(aggregate.completionTokens)} / {formatTokenCount(aggregate.recordCount)} ?
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 md:col-span-4">
            ???? token ??????????????????????24h?7d ??????
          </div>
        )}
      </div>

      <div
        className="mt-3 overflow-hidden rounded-[8px] border border-slate-200 bg-white"
        data-model-usage-records={modelUsagePanel.usageRecords.length}
      >
        <div className="border-b border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
          ????
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">??</th>
                <th className="px-3 py-2 font-medium">??</th>
                <th className="px-3 py-2 font-medium">??</th>
                <th className="px-3 py-2 font-medium">??</th>
                <th className="px-3 py-2 font-medium">??</th>
                <th className="px-3 py-2 font-medium">??</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {modelUsagePanel.usageRecords.slice(0, 8).map((record) => (
                <tr key={record.id}>
                  <td className="px-3 py-2">{record.createdAt}</td>
                  <td className="px-3 py-2">{record.model}</td>
                  <td className="max-w-40 truncate px-3 py-2">{record.sessionId}</td>
                  <td className="px-3 py-2">{formatTokenCount(record.promptTokens)}</td>
                  <td className="px-3 py-2">{formatTokenCount(record.completionTokens)}</td>
                  <td className="px-3 py-2 font-medium text-teal-800">{formatTokenCount(record.totalTokens)}</td>
                </tr>
              ))}
              {modelUsagePanel.usageRecords.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={6}>
                    ???????
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={cn(
          "mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5",
          modelUsagePanel.syncStatus === "degraded"
            ? "border-orange-200 bg-orange-50 text-orange-800"
            : "border-teal-100 bg-white text-teal-800"
        )}
      >
        {modelUsagePanel.notice}
      </div>

      <div className="mt-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
        边界：当前面板只读取 daily_work 的模型用量；coding_agent 路径仅作为兼容说明，不在此处切换或暴露编码工具状态。
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {[...activeModelSnapshot.notes, ...activeUsageSnapshot.notes].map(
          (note) => (
            <div
              key={note}
              className="flex items-start gap-2 rounded-[8px] border border-orange-200 bg-white px-3 py-2 text-xs leading-5 text-orange-800"
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">{note}</span>
            </div>
          )
        )}
      </div>

      <div className="mt-3 text-[11px] leading-5 text-teal-700">
        更新时间：{activeModelSnapshot.updatedAt} / 用量更新时间：
        {activeUsageSnapshot.updatedAt}
      </div>
    </div>
  );
}
