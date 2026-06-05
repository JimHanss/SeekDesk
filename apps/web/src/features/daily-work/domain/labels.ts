import { contextItems } from "./context";
import type {
  ApprovalPanelSource,
  ApprovalPanelSyncStatus,
  ArtifactFilter,
  ArtifactItem,
  ArtifactState,
  ContextItem,
  ContextPanelSource,
  ContextPanelSyncStatus,
  ContextPreviewSource,
  ContextPreviewSyncStatus,
  SessionHistoryFilter,
  SessionHistoryItem,
  SessionHistoryPanelSource,
  SessionHistoryPanelSyncStatus,
  SessionHistoryStatus,
  SessionRestorePreviewSource,
  SessionRestorePreviewSyncStatus,
  TemplatePanelSource,
  TemplatePanelSyncStatus,
  TemplatePreviewSource,
  TemplatePreviewSyncStatus
} from "../types";

export function sessionHistoryFilterCount(
  filter: SessionHistoryFilter,
  items: SessionHistoryItem[]
) {
  if (filter === "全部") {
    return items.length;
  }

  return items.filter((item) => item.status === filter).length;
}

export function sessionHistoryStatusClass(status: SessionHistoryStatus) {
  switch (status) {
    case "进行中":
      return "bg-orange-100 text-orange-800";
    case "待审批":
      return "bg-amber-100 text-amber-800";
    case "已完成":
      return "bg-emerald-100 text-emerald-800";
    case "已归档":
      return "bg-slate-100 text-slate-700";
  }
}

export function sessionHistorySourceLabel(source: SessionHistoryPanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Sessions API";
    case "degraded":
      return "降级 fallback";
  }
}

export function sessionHistorySyncStatusLabel(status: SessionHistoryPanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

export function sessionRestorePreviewSourceLabel(source: SessionRestorePreviewSource) {
  switch (source) {
    case "fallback":
      return "本地预演";
    case "api":
      return "Restore API";
    case "degraded":
      return "降级预演";
  }
}

export function sessionRestorePreviewSyncStatusLabel(
  status: SessionRestorePreviewSyncStatus
) {
  switch (status) {
    case "idle":
      return "待触发";
    case "syncing":
      return "生成中";
    case "live":
      return "预演已同步";
    case "degraded":
      return "已回退";
  }
}

export function templatePanelSourceLabel(source: TemplatePanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Templates API";
    case "degraded":
      return "降级 fallback";
  }
}

export function templatePanelSyncStatusLabel(status: TemplatePanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

export function templatePreviewSourceLabel(source: TemplatePreviewSource) {
  switch (source) {
    case "fallback":
      return "本地预演";
    case "api":
      return "Template Preview API";
    case "degraded":
      return "降级预演";
  }
}

export function templatePreviewSyncStatusLabel(status: TemplatePreviewSyncStatus) {
  switch (status) {
    case "idle":
      return "待触发";
    case "syncing":
      return "生成中";
    case "live":
      return "预演已同步";
    case "degraded":
      return "已回退";
  }
}

export function approvalPanelSourceLabel(source: ApprovalPanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Approvals API";
    case "degraded":
      return "降级 fallback";
  }
}

export function approvalPanelSyncStatusLabel(status: ApprovalPanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

export function templateCategoryLabel(value: string) {
  switch (value) {
    case "triage":
      return "分拣";
    case "planning":
      return "计划";
    case "execution":
      return "执行";
    case "review":
      return "复核";
    case "handoff":
      return "交接";
    case "writing":
      return "写作";
    case "research":
      return "研究";
    case "knowledge":
      return "知识";
    default:
      return value;
  }
}

export function templateArtifactTypeLabel(value: string) {
  switch (value) {
    case "email_draft":
      return "邮件草稿";
    case "meeting_summary":
      return "会议纪要";
    case "research_note":
      return "研究笔记";
    case "task_list":
      return "任务清单";
    case "weekly_report":
      return "周报";
    case "status_update":
      return "状态更新";
    case "handoff_note":
      return "交接说明";
    case "decision_log":
      return "决策记录";
    case "checklist":
      return "检查清单";
    case "brief":
      return "简报";
    default:
      return value;
  }
}

export function artifactFilterCount(filter: ArtifactFilter, items: ArtifactItem[]) {
  if (filter === "全部") {
    return items.length;
  }

  return items.filter((artifact) => artifact.state === filter).length;
}

export function artifactStateClass(state: ArtifactState) {
  switch (state) {
    case "计划中":
      return "bg-teal-100 text-teal-800";
    case "排队中":
      return "bg-slate-100 text-slate-700";
    case "草稿":
      return "bg-orange-100 text-orange-800";
    case "可复用":
      return "bg-emerald-100 text-emerald-800";
    case "待复核":
      return "bg-amber-100 text-amber-800";
  }
}

export function contextPanelSourceLabel(source: ContextPanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Context API";
    case "degraded":
      return "降级 fallback";
  }
}

export function contextPanelSyncStatusLabel(status: ContextPanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

export function contextPreviewSourceLabel(source: ContextPreviewSource) {
  switch (source) {
    case "fallback":
      return "本地预演";
    case "api":
      return "Context Preview API";
    case "degraded":
      return "降级预演";
  }
}

export function contextPreviewSyncStatusLabel(status: ContextPreviewSyncStatus) {
  switch (status) {
    case "idle":
      return "待触发";
    case "syncing":
      return "生成中";
    case "live":
      return "预演已同步";
    case "degraded":
      return "已回退";
  }
}

export function selectedContextLabel(contextId: string, items: ContextItem[] = contextItems) {
  const item = items.find((entry) => entry.id === contextId);
  return item ? item.title : "未知上下文";
}
