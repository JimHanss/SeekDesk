import {
  Mail,
  Presentation,
  Search,
  Target,
  Workflow,
  type LucideIcon
} from "lucide-react";

import { activeMode } from "./base";
import type {
  DailyWorkSessionDto,
  DailyWorkSessionLastActionDto,
  DailyWorkSessionMessageDto,
  DailyWorkSessionResponseDto,
  DailyWorkSessionRestorePreviewResponseDto,
  DailyWorkSessionsResponseDto,
  SessionHistoryFilter,
  SessionHistoryItem,
  SessionHistoryMessageItem,
  SessionHistoryPanelState,
  SessionHistoryStatus,
  SessionRestorePreviewPanelState,
  SessionRestorePreviewSyncStatus
} from "../types";
export const sessionHistoryFilters: SessionHistoryFilter[] = [
  "全部",
  "进行中",
  "待审批",
  "已完成",
  "已归档"
];

export const sessionHistoryItems: SessionHistoryItem[] = [];

export function createFallbackSessionHistoryPanelState(): SessionHistoryPanelState {
  const firstSession = sessionHistoryItems[0] ?? null;

  return {
    items: sessionHistoryItems,
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在同步编程会话列表。",
    restorePreview: createLocalSessionRestorePreviewState(firstSession)
  };
}

export function createLocalSessionRestorePreviewState(
  item: SessionHistoryItem | null,
  syncStatus: SessionRestorePreviewSyncStatus = "idle",
  notice = "选择历史会话后可恢复消息和工作区绑定。"
): SessionRestorePreviewPanelState {
  return {
    sessionId: item?.id ?? "",
    source: "fallback",
    syncStatus,
    previewOnly: true,
    externalEffects: ["none"],
    safetyStatement:
      "恢复操作只加载会话内容；工具执行仍遵循当前工作区和审批边界。",
    restorePrompt: item ? buildSessionRestorePrompt(item) : "",
    generatedAt: "本地示例",
    notice
  };
}

export function mapSessionsResponse(payload: DailyWorkSessionsResponseDto) {
  if (payload.mode !== activeMode) {
    throw new Error("Session response did not match the active application mode.");
  }

  return (payload.sessions ?? []).map((session, index) =>
    mapSessionDtoToItem(session, index)
  );
}

export function mapSessionResponse(payload: DailyWorkSessionResponseDto) {
  if (payload.mode !== activeMode || !payload.session) {
    throw new Error("Session response did not include a matching session.");
  }

  return mapSessionDtoToItem(payload.session, 0);
}

export function mapSessionDtoToItem(
  session: DailyWorkSessionDto,
  index: number
): SessionHistoryItem {
  const artifactIds = sanitizeSessionIds(session.artifactIds);
  const approvalRequestIds = sanitizeSessionIds(session.approvalRequestIds);
  const contextItemIds = sanitizeSessionIds(session.contextItemIds);
  const title = nonEmptyText(session.title, `Coding session ${index + 1}`);
  const recentMessages = mapSessionRecentMessages(session.recentMessages);

  return {
    id: nonEmptyText(session.id, `coding-session-${index + 1}`),
    title,
    status: mapSessionHistoryStatus(session.status),
    workspaceId: nonEmptyText(session.workspaceId, "workspace-seekdesk"),
    ...(session.workspaceName ? { workspaceName: session.workspaceName } : {}),
    ...(session.workspaceRoot ? { workspaceRoot: session.workspaceRoot } : {}),
    ...(session.workspaceRuntimeMode ? { workspaceRuntimeMode: session.workspaceRuntimeMode } : {}),
    createdAt: nonEmptyText(session.createdAt, session.updatedAt ?? ""),
    updatedAt: formatSessionHistoryTimestamp(session.updatedAt),
    summary: nonEmptyText(session.summary, "后端返回了会话快照，但暂未提供摘要。"),
    pinned: Boolean(session.pinned),
    artifactCount: artifactIds.length,
    approvalCount: approvalRequestIds.length,
    contextCount: contextItemIds.length,
    artifactIds,
    approvalRequestIds,
    contextItemIds,
    messageCount: nonNegativeNumber(session.messageCount),
    lastAction: formatSessionLastAction(session.lastAction),
    mode: session.appMode === "coding_agent" ? "coding_agent" : "daily_work",
    tags: sanitizeSessionIds(session.tags),
    recentMessages,
    icon: sessionHistoryIcon(title, session.tags)
  };
}

export function mapSessionRestorePreviewResponse(
  item: SessionHistoryItem,
  payload: DailyWorkSessionRestorePreviewResponseDto
): SessionRestorePreviewPanelState {
  const preview = payload.preview;
  const externalEffects =
    preview?.externalEffects ??
    preview?.safetyBoundary?.externalEffects ??
    [];
  const normalizedExternalEffects =
    externalEffects.length > 0 ? externalEffects : ["none"];
  const previewOnly =
    preview?.previewOnly === true || preview?.safetyBoundary?.previewOnly === true;

  if (
    payload.mode !== activeMode ||
    preview?.sessionId !== item.id ||
    previewOnly !== true ||
    normalizedExternalEffects.some((effect) => effect !== "none")
  ) {
    throw new Error("Session restore preview response did not match the selected session.");
  }

  return {
    sessionId: item.id,
    source: "api",
    syncStatus: "live",
    previewOnly: true,
    externalEffects: normalizedExternalEffects,
    safetyStatement: nonEmptyText(
      preview.safetyBoundary?.statement,
      "恢复预演不会执行工具或修改工作区。"
    ),
    restorePrompt: nonEmptyText(preview.restorePrompt, buildSessionRestorePrompt(item)),
    generatedAt: formatSessionHistoryTimestamp(preview.generatedAt),
    notice:
      "会话恢复预演已同步；确认发送前不会执行工具。"
  };
}

export function mapSessionRecentMessages(
  messages: DailyWorkSessionMessageDto[] | undefined
): SessionHistoryMessageItem[] {
  return (
    messages
      ?.map((message, index) => ({
        id: nonEmptyText(message.id, `recent-message-${index + 1}`),
        role: nonEmptyText(message.role, "assistant"),
        content: nonEmptyText(message.content, "最近消息暂无内容。"),
        createdAt: formatSessionHistoryTimestamp(message.createdAt),
        artifactIds: sanitizeSessionIds(message.artifactIds),
        contextItemIds: sanitizeSessionIds(message.contextItemIds),
        approvalRequestIds: sanitizeSessionIds(message.approvalRequestIds)
      }))
      .filter((message) => message.content.trim().length > 0)
      .slice(-3) ?? []
  );
}

export function sanitizeSessionIds(values: string[] | undefined) {
  return values?.filter((value) => value.trim().length > 0) ?? [];
}

export function mapSessionHistoryStatus(value: string | undefined): SessionHistoryStatus {
  switch (value) {
    case "waiting_for_approval":
      return "待审批";
    case "completed":
      return "已完成";
    case "archived":
      return "已归档";
    case "active":
    default:
      return "进行中";
  }
}

export function formatSessionHistoryTimestamp(value: string | undefined) {
  return formatModelUsageTimestamp(value) ?? nonEmptyText(value, "刚刚同步");
}

export function formatSessionLastAction(
  lastAction: DailyWorkSessionLastActionDto | null | undefined
) {
  if (!lastAction) {
    return "等待你选择下一步继续处理。";
  }

  return [
    nonEmptyText(lastAction.label, "等待你选择下一步继续处理。"),
    lastAction.actor ? `actor: ${lastAction.actor}` : undefined,
    formatModelUsageTimestamp(lastAction.at),
    lastAction.artifactId ? `artifact: ${lastAction.artifactId}` : undefined,
    lastAction.approvalRequestId ? `approval: ${lastAction.approvalRequestId}` : undefined
  ]
    .filter(Boolean)
    .join(" / ");
}

export function sessionHistoryIcon(title: string, tags: string[] | undefined): LucideIcon {
  const searchable = [title, ...(tags ?? [])].join(" ").toLowerCase();

  if (searchable.includes("email") || searchable.includes("mail") || searchable.includes("客户")) {
    return Mail;
  }

  if (searchable.includes("meeting") || searchable.includes("会议")) {
    return Presentation;
  }

  if (searchable.includes("research") || searchable.includes("研究")) {
    return Search;
  }

  if (searchable.includes("planning") || searchable.includes("task") || searchable.includes("计划")) {
    return Target;
  }

  return Workflow;
}

export function replaceSessionHistoryItem(
  items: SessionHistoryItem[],
  nextItem: SessionHistoryItem
) {
  const found = items.some((item) => item.id === nextItem.id);

  return found
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [nextItem, ...items];
}

export function formatSessionLinkList(label: string, values: string[]) {
  return `${label}: ${values.length > 0 ? values.join("、") : "无"}`;
}

export function formatSessionRecentMessagePreview(item: SessionHistoryItem) {
  if (item.recentMessages.length === 0) {
    return "后端详情暂未提供 recentMessages；恢复预演仍会基于会话摘要和关联链路生成输入框提示。";
  }

  return item.recentMessages
    .map(
      (message) =>
        `${message.role} ${message.createdAt}: ${message.content}`
    )
    .join(" / ");
}

export function buildSessionRestorePrompt(item: SessionHistoryItem) {
  return [
    `请帮我恢复「${item.title}」这个日常工作会话。`,
    "",
    `Session id：${item.id}`,
    `状态：${item.status} / ${item.updatedAt}`,
    `会话摘要：${item.summary}`,
    `上次动作：${item.lastAction}`,
    `关联产物：${formatSessionLinkList("artifactIds", item.artifactIds)}`,
    `审批记录：${formatSessionLinkList("approvalRequestIds", item.approvalRequestIds)}`,
    `上下文数量：${formatSessionLinkList("contextItemIds", item.contextItemIds)}`,
    `消息数量：${item.messageCount} 条`,
    `最近消息：${formatSessionRecentMessagePreview(item)}`,
    `标签：${item.tags.join("、")}`,
    "",
    "边界：只恢复会话提示并等待确认，不执行文件写入、命令或测试。",
    "请先复述当前可继续的工作状态，再建议下一步行动。"
  ].join("\n");
}

function nonEmptyText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function nonNegativeNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function formatModelUsageTimestamp(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
