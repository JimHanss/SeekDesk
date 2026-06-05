import {
  FileText,
  Globe,
  MessageSquare,
  Presentation,
  ShieldCheck,
  Workflow
} from "lucide-react";

import { activeMode } from "./base";
import type {
  ActivityConnectionStatus,
  ActivityEventItem,
  ActivityEventStatus,
  ActivityEventType,
  ActivityFeedSource,
  DailyActivityEventDto,
  DailyActivityNextAction,
  DailyActivityRelatedRefs,
  DailyActivitySnapshotDto
} from "../types";

export const activityEvents: ActivityEventItem[] = [
  {
    id: "event-session-restored",
    type: "session",
    time: "今天 10:42",
    title: "客户更新会话已恢复",
    status: "已恢复",
    relatedObject: "session",
    relatedLabel: "客户更新邮件 + 周报草稿",
    summary:
      "从最近工作流摘要恢复 daily_work 会话，保留产物、审批记录和上下文计数，方便继续日常跟进。",
    safetyBoundary:
      "只使用前端示例快照填入输入框，不读取真实历史记录、文件系统或团队空间。",
    promptFocus: "恢复会话后，请复述当前状态、待补上下文和下一步可执行动作。",
    icon: MessageSquare
  },
  {
    id: "event-template-filled",
    type: "workflow",
    time: "今天 10:39",
    title: "会议纪要模板填入输入框",
    status: "已填入",
    relatedObject: "workflow",
    relatedLabel: "整理会议纪要",
    summary:
      "把日常工作模板转换为可发送 prompt，用于从会议记录中提取决策、待办和风险。",
    safetyBoundary:
      "模板仅在聊天输入框中预填，发送前由用户确认，不读取真实笔记库或写入文档。",
    promptFocus: "基于会议纪要模板，输出结构、字段复核点和缺失上下文清单。",
    icon: Presentation
  },
  {
    id: "event-approval-changed",
    type: "approval",
    time: "今天 10:36",
    title: "邮箱外发审批保持待确认",
    status: "待审批",
    relatedObject: "approval",
    relatedLabel: "客户更新邮件草稿",
    summary:
      "外发相关动作被归入审批台账，当前只允许生成草稿和风险检查点，不触发发送。",
    safetyBoundary:
      "没有真实邮箱授权，不会自动发送邮件；需要用户显式审批后才可进入后续产品流程。",
    promptFocus: "请列出审批前需要确认的收件人、敏感信息和外发语气检查项。",
    icon: ShieldCheck
  },
  {
    id: "event-workflow-preview",
    type: "workflow",
    time: "今天 10:31",
    title: "周报与任务计划预演已生成",
    status: "已预演",
    relatedObject: "workflow",
    relatedLabel: "周报草稿和下周任务计划",
    summary:
      "工作流预演生成结构化周报、任务拆解和依赖检查表，仍停留在 daily_work 草稿阶段。",
    safetyBoundary:
      "不写入文档库、不同步团队空间，也不暴露 coding-agent 命令或仓库工具。",
    promptFocus: "继续完善周报与任务计划，重点补齐风险、依赖和负责人字段。",
    icon: Workflow
  },
  {
    id: "event-artifact-review",
    type: "artifact",
    time: "今天 10:24",
    title: "可复用会议纪要待复核",
    status: "待复核",
    relatedObject: "artifact",
    relatedLabel: "可分享会议纪要",
    summary:
      "产物已具备复用线索，但负责人、开放问题和内部决策字段仍需要人工复核。",
    safetyBoundary:
      "当前只是页面内的示例产物状态，不会发布、共享或同步到真实文档空间。",
    promptFocus: "请把会议纪要改成可复用版本，并列出必须人工复核的字段。",
    icon: FileText
  },
  {
    id: "event-connector-boundary",
    type: "connector",
    time: "今天 10:18",
    title: "连接器边界已标记为可预览",
    status: "可复用",
    relatedObject: "connector",
    relatedLabel: "SeekDesk Docs Preview",
    summary:
      "文档库入口只展示可预览字段、权限状态和风险说明，作为日常工作自动化的接入草案。",
    safetyBoundary:
      "未接真实 OAuth、文档库或内部知识库；这里只能生成接入方案和审批路径。",
    promptFocus: "请为文档库连接器补一版最小权限、撤销路径和可预览字段说明。",
    icon: Globe
  }
];

export function parseDailyActivitySnapshot(data: unknown): DailyActivitySnapshotDto | null {
  if (typeof data !== "string") {
    return null;
  }

  try {
    const payload = JSON.parse(data) as unknown;

    return isDailyActivitySnapshot(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function mapDailyActivitySnapshot(payload: DailyActivitySnapshotDto) {
  if (!isDailyActivitySnapshot(payload)) {
    return [];
  }

  return (payload.events ?? [])
    .filter((event) => event.mode === undefined || event.mode === activeMode)
    .map(mapDailyActivityEvent);
}

export function mapDailyActivityEvent(event: DailyActivityEventDto): ActivityEventItem {
  const type = backendEventTypeToActivityType(event.eventType, event.nextAction);
  const relatedObject = event.nextAction?.targetType ?? type;
  const relatedLabel =
    event.nextAction?.label ??
    firstRelatedRefLabel(event.relatedRefs) ??
    event.actor ??
    "daily_work";
  const safetyBoundary =
    event.safetyBoundary?.statement ??
    "后端未提供安全边界说明，前端按 daily_work 只读状态事件处理。";
  const promptFocus =
    event.nextAction?.description ??
    `根据“${event.title}”继续 daily_work，先复述状态、风险边界和下一步建议。`;

  return {
    id: event.id,
    type,
    time: formatActivityTimestamp(event.timestamp),
    title: event.title,
    status: backendActivityStatusLabel(event.status),
    relatedObject,
    relatedLabel,
    summary: `${event.summary} 来源：${event.actor}`,
    safetyBoundary,
    promptFocus,
    icon: backendActivityIcon(event.eventType, type)
  };
}

export function isDailyActivitySnapshot(value: unknown): value is DailyActivitySnapshotDto {
  if (!isRecord(value) || !Array.isArray(value.events)) {
    return false;
  }

  return value.events.every(isDailyActivityEvent);
}

export function isDailyActivityEvent(value: unknown): value is DailyActivityEventDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.eventType === "string" &&
    typeof value.status === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.actor === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function backendEventTypeToActivityType(
  eventType: string,
  nextAction?: DailyActivityNextAction | null
): ActivityEventType {
  if (nextAction?.targetType && isActivityEventType(nextAction.targetType)) {
    return nextAction.targetType;
  }

  if (eventType.startsWith("session.")) {
    return "session";
  }

  if (eventType.startsWith("approval.")) {
    return "approval";
  }

  if (eventType.startsWith("artifact.")) {
    return "artifact";
  }

  if (eventType.startsWith("workflow.") || eventType.startsWith("template.")) {
    return "workflow";
  }

  return "connector";
}

export function isActivityEventType(value: string): value is ActivityEventType {
  return (
    value === "session" ||
    value === "workflow" ||
    value === "artifact" ||
    value === "approval" ||
    value === "connector"
  );
}

export function backendActivityStatusLabel(status: string): ActivityEventStatus {
  switch (status) {
    case "queued":
      return "排队中";
    case "in_progress":
      return "进行中";
    case "waiting_for_approval":
      return "待审批";
    case "completed":
      return "已完成";
    case "ready":
      return "可复用";
    case "blocked":
      return "已阻断";
    case "failed":
      return "失败";
    case "info":
    default:
      return "已恢复";
  }
}

export function backendActivityIcon(eventType: string, type: ActivityEventType) {
  if (eventType.startsWith("template.")) {
    return Presentation;
  }

  switch (type) {
    case "session":
      return MessageSquare;
    case "workflow":
      return Workflow;
    case "artifact":
      return FileText;
    case "approval":
      return ShieldCheck;
    case "connector":
      return Globe;
  }
}

export function firstRelatedRefLabel(relatedRefs?: DailyActivityRelatedRefs) {
  if (!relatedRefs) {
    return null;
  }

  const refGroups: Array<[string, string[] | undefined]> = [
    ["session", relatedRefs.sessionIds],
    ["template", relatedRefs.templateIds],
    ["workflow", relatedRefs.workflowIds],
    ["artifact", relatedRefs.artifactIds],
    ["approval", relatedRefs.approvalRequestIds],
    ["connector", relatedRefs.connectorIds],
    ["context", relatedRefs.contextItemIds],
    ["queue", relatedRefs.actionQueueItemIds]
  ];

  const firstGroup = refGroups.find(([, values]) => values && values.length > 0);

  if (!firstGroup) {
    return null;
  }

  const [label, values] = firstGroup;

  return `${label}: ${(values ?? []).slice(0, 2).join(" / ")}`;
}

export function formatActivityTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatActivityUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export function activityEventStatusClass(status: ActivityEventStatus) {
  switch (status) {
    case "已恢复":
      return "bg-teal-100 text-teal-800";
    case "已填入":
      return "bg-sky-100 text-sky-800";
    case "待审批":
      return "bg-orange-100 text-orange-800";
    case "已预演":
      return "bg-emerald-100 text-emerald-800";
    case "待复核":
      return "bg-amber-100 text-amber-800";
    case "可复用":
      return "bg-emerald-100 text-emerald-800";
    case "排队中":
      return "bg-slate-100 text-slate-700";
    case "进行中":
      return "bg-sky-100 text-sky-800";
    case "已完成":
      return "bg-emerald-100 text-emerald-800";
    case "已阻断":
      return "bg-red-100 text-red-800";
    case "失败":
      return "bg-red-100 text-red-800";
  }
}

export function activityFeedSourceLabel(source: ActivityFeedSource) {
  switch (source) {
    case "fallback":
      return "本地示例";
    case "api":
      return "HTTP API";
    case "websocket":
      return "WebSocket 快照";
  }
}

export function activityConnectionStatusLabel(status: ActivityConnectionStatus) {
  switch (status) {
    case "connecting":
      return "连接中";
    case "live":
      return "实时连接";
    case "degraded":
      return "降级保留快照";
    case "closed":
      return "连接已关闭";
  }
}

export function buildActivityEventPrompt(item: ActivityEventItem) {
  return [
    `请基于实时活动流事件「${item.title}」继续 daily_work。`,
    "",
    `事件类型：${item.type}`,
    `发生时间：${item.time}`,
    `当前状态：${item.status}`,
    `关联对象：${item.relatedObject} / ${item.relatedLabel}`,
    `事件摘要：${item.summary}`,
    `安全边界：${item.safetyBoundary}`,
    "",
    "模式边界：保持 daily_work，不调用 coding-agent 工具，不访问真实连接器，不写入外部系统。",
    `请输出：${item.promptFocus}`
  ].join("\n");
}
