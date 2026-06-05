import type { ReactNode } from "react";
import { Activity, Database } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  activityEventStatusClass,
  approvalStatusConfig,
  artifactStateClass,
  connectorPermissionClass,
  connectorRiskClass,
  persistenceLayerStatusClass,
  persistenceLayerStatusLabel,
  persistenceSyncStatusLabel,
  sessionHistoryStatusClass,
  workflowActionStatusClass
} from "../domain";
import type {
  ActivityEventStatus,
  ApprovalStatus,
  ArtifactState,
  ConnectorPermissionState,
  ConnectorRiskLevel,
  PersistencePanelState,
  SessionHistoryStatus,
  WorkflowActionStatus
} from "../types";

export function PanelHeader({
  icon,
  title,
  action
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-teal-100 px-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
        <span className="text-teal-700">{icon}</span>
        {title}
      </div>
      {action}
    </div>
  );
}

export function PromptCard({
  icon,
  title,
  text,
  onClick
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: (prompt: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="min-h-28 rounded-[8px] border border-teal-100 bg-white p-3 text-left text-sm shadow-sm transition-colors duration-200 hover:border-teal-300 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
    >
      <span className="mb-3 flex items-center gap-2 font-medium text-teal-950">
        <span className="grid size-7 place-items-center rounded-[6px] bg-teal-50 text-teal-700">
          {icon}
        </span>
        {title}
      </span>
      <span className="block text-xs leading-5 text-teal-700">{text}</span>
    </button>
  );
}

export function SessionStatusPill({ status }: { status: SessionHistoryStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        sessionHistoryStatusClass(status)
      )}
    >
      {status}
    </span>
  );
}

export function PersistenceStatusPanel({ state }: { state: PersistencePanelState }) {
  return (
    <section
      className="rounded-[8px] border border-slate-200 bg-white p-3"
      data-persistence-panel
      data-persistence-current={state.currentLayer}
      data-persistence-source={state.source}
      data-persistence-status={state.syncStatus}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Database className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">数据层 / 同步状态</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            日常工作数据当前状态从 /health 优先读取；缺少字段时保留安全 fallback。
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-[999px] px-2.5 py-1 text-[11px] font-medium",
            state.syncStatus === "live"
              ? "bg-emerald-100 text-emerald-800"
              : state.syncStatus === "syncing"
                ? "bg-sky-100 text-sky-800"
                : "bg-orange-100 text-orange-800"
          )}
        >
          <Activity className="size-3.5" aria-hidden="true" />
          {persistenceSyncStatusLabel(state.syncStatus)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        {state.layers.map((layer) => {
          const Icon = layer.icon;

          return (
            <div
              key={layer.id}
              className={cn(
                "min-w-0 rounded-[8px] border px-3 py-2",
                persistenceLayerStatusClass(layer.status)
              )}
              data-persistence-layer={layer.id}
              data-persistence-layer-status={layer.status}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-white/75">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">
                      {layer.label}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 opacity-80">
                      {layer.description}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 rounded-[999px] bg-white/80 px-2 py-0.5 text-[10px] font-medium">
                  {persistenceLayerStatusLabel(layer.status)}
                </span>
              </div>
              <div className="mt-2 break-words text-[11px] leading-4 opacity-85">
                {layer.detail}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5",
          state.syncStatus === "degraded"
            ? "border-orange-200 bg-orange-50 text-orange-800"
            : "border-teal-100 bg-teal-50 text-teal-800"
        )}
      >
        <span className="font-medium">最近更新：{state.updatedAt}</span>
        <span className="mx-2 text-slate-300">/</span>
        {state.notice}
      </div>
    </section>
  );
}

export function SessionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-teal-100 bg-teal-50 px-2.5 py-2 text-center">
      <div className="truncate text-[11px] font-medium text-teal-700">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-teal-950">
        {value}
      </div>
    </div>
  );
}

export function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2">
      <span className="shrink-0 text-xs font-medium text-teal-700">{label}</span>
      <span className="min-w-0 break-words text-right text-sm text-teal-950">
        {value}
      </span>
    </div>
  );
}

export function ArtifactStatePill({ state }: { state: ArtifactState }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        artifactStateClass(state)
      )}
    >
      {state}
    </span>
  );
}

export function ConnectorPermissionPill({
  state
}: {
  state: ConnectorPermissionState;
}) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        connectorPermissionClass(state)
      )}
    >
      {state}
    </span>
  );
}

export function ConnectorRiskPill({ riskLevel }: { riskLevel: ConnectorRiskLevel }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        connectorRiskClass(riskLevel)
      )}
    >
      风险 {riskLevel}
    </span>
  );
}

export function WorkflowActionStatusPill({
  status
}: {
  status: WorkflowActionStatus;
}) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        workflowActionStatusClass(status)
      )}
    >
      {status}
    </span>
  );
}

export function ActivityEventStatusPill({ status }: { status: ActivityEventStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        activityEventStatusClass(status)
      )}
    >
      {status}
    </span>
  );
}

export function ArtifactDetailBlock({
  icon,
  title,
  children
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-[8px] border border-teal-100 bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-teal-950">
        <span className="shrink-0 text-teal-700">{icon}</span>
        <span className="min-w-0 break-words">{title}</span>
      </div>
      <div className="mt-1 break-words text-xs leading-5 text-slate-700">
        {children}
      </div>
    </div>
  );
}

export function ArtifactDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-teal-100 bg-white px-3 py-2">
      <div className="text-[11px] font-medium text-teal-700">{label}</div>
      <div className="mt-1 break-words text-xs leading-5 text-teal-950">
        {value}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: ApprovalStatus }) {
  const config = approvalStatusConfig(status);

  return (
    <span
      className={cn(
        "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[8px] border border-amber-100 bg-amber-50 px-2.5 py-2">
      <span className="shrink-0 text-[11px] font-medium text-amber-700">{label}</span>
      <span className="min-w-0 text-right text-[11px] text-slate-700">{value}</span>
    </div>
  );
}

export function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2">
      <span className="text-xs font-medium text-teal-700">{label}</span>
      <span className="truncate text-sm text-teal-950">{value}</span>
    </div>
  );
}

export function ActivityFeedMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-14 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2">
      <div className="text-[11px] font-medium text-teal-700">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-teal-950">
        {value}
      </div>
    </div>
  );
}
