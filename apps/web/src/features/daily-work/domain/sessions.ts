import {
  CalendarClock,
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

export const sessionHistoryItems: SessionHistoryItem[] = [
  {
    id: "daily-weekly-report-risk",
    title: "周报与风险同步",
    status: "进行中",
    workspaceId: "workspace-seekdesk",
    workspaceName: "SeekDesk",
    workspaceRoot: "SeekDesk",
    workspaceRuntimeMode: "server_local",
    createdAt: "2026-06-03T11:20:00.000Z",
    updatedAt: "今天 11:20",
    summary: "已把项目简报、会议记录和团队备忘合并成周报骨架，风险段落还需要补齐负责人和截止时间。",
    artifactCount: 2,
    approvalCount: 1,
    contextCount: 3,
    artifactIds: ["weekly-report-artifact", "task-list-artifact"],
    approvalRequestIds: ["review-weekly-report-risk"],
    contextItemIds: ["project-brief", "meeting-notes", "team-notes"],
    messageCount: 7,
    lastAction: "继续补齐风险说明，并把待复核会议结论标记为需要确认。",
    mode: "daily_work",
    tags: ["周报", "风险", "待复核"],
    recentMessages: [
      {
        id: "daily-weekly-report-risk-message-1",
        role: "assistant",
        content: "已生成周报骨架，并把风险段落标记为待复核。",
        createdAt: "今天 11:20",
        artifactIds: ["weekly-report-artifact"],
        contextItemIds: ["project-brief", "meeting-notes"],
        approvalRequestIds: ["review-weekly-report-risk"]
      }
    ],
    icon: CalendarClock
  },
  {
    id: "daily-customer-email",
    title: "客户更新邮件",
    status: "进行中",
    workspaceId: "workspace-seekdesk",
    workspaceName: "SeekDesk",
    workspaceRoot: "SeekDesk",
    workspaceRuntimeMode: "server_local",
    createdAt: "2026-06-03T09:55:00.000Z",
    updatedAt: "今天 09:55",
    summary: "已根据客户邮件整理交付时间线和范围变化说明，外发语气仍需审批后再润色。",
    artifactCount: 1,
    approvalCount: 2,
    contextCount: 2,
    artifactIds: ["email-draft-artifact"],
    approvalRequestIds: ["read-customer-email-context", "draft-external-reply"],
    contextItemIds: ["customer-email", "meeting-notes"],
    messageCount: 8,
    lastAction: "确认外发授权边界，再生成克制专业的客户版回复。",
    mode: "daily_work",
    tags: ["客户沟通", "审批", "邮件"],
    recentMessages: [
      {
        id: "daily-customer-email-message-1",
        role: "assistant",
        content: "已整理客户回复草稿，等待外发前审批。",
        createdAt: "今天 09:55",
        artifactIds: ["email-draft-artifact"],
        contextItemIds: ["customer-email"],
        approvalRequestIds: ["draft-external-reply"]
      }
    ],
    icon: Mail
  },
  {
    id: "daily-meeting-summary",
    title: "例会纪要压缩",
    status: "已完成",
    workspaceId: "workspace-seekdesk",
    workspaceName: "SeekDesk",
    workspaceRoot: "SeekDesk",
    workspaceRuntimeMode: "server_local",
    createdAt: "2026-06-02T18:10:00.000Z",
    updatedAt: "昨天 18:10",
    summary: "会议记录已压缩为可分享摘要，保留关键决策、负责人、开放问题和审批追踪。",
    artifactCount: 3,
    approvalCount: 1,
    contextCount: 2,
    artifactIds: ["meeting-summary-artifact", "task-list-artifact"],
    approvalRequestIds: ["use-internal-meeting-notes"],
    contextItemIds: ["meeting-notes", "team-notes"],
    messageCount: 6,
    lastAction: "将最终纪要复制到项目同步渠道，并保留上下文来源说明。",
    mode: "daily_work",
    tags: ["会议纪要", "可复用", "决策"],
    recentMessages: [
      {
        id: "daily-meeting-summary-message-1",
        role: "assistant",
        content: "会议摘要已整理完成，包含决策、风险、负责人和开放问题。",
        createdAt: "昨天 18:10",
        artifactIds: ["meeting-summary-artifact"],
        contextItemIds: ["meeting-notes", "team-notes"],
        approvalRequestIds: []
      }
    ],
    icon: Presentation
  },
  {
    id: "daily-research-brief",
    title: "资料研究简报",
    status: "已完成",
    workspaceId: "workspace-seekdesk",
    workspaceName: "SeekDesk",
    workspaceRoot: "SeekDesk",
    workspaceRuntimeMode: "server_local",
    createdAt: "2026-06-01T16:40:00.000Z",
    updatedAt: "周一 16:40",
    summary: "公开资料已整理为研究简报，结论、引用依据和仍需验证的问题已经分组。",
    artifactCount: 2,
    approvalCount: 0,
    contextCount: 1,
    artifactIds: ["research-note-artifact", "research-brief-artifact"],
    approvalRequestIds: [],
    contextItemIds: ["research-links"],
    messageCount: 5,
    lastAction: "把可引用依据同步到简报，并在下一轮补充二次验证结论。",
    mode: "daily_work",
    tags: ["研究", "公开资料", "引用"],
    recentMessages: [
      {
        id: "daily-research-brief-message-1",
        role: "assistant",
        content: "已把公开资料整理为研究简报，并列出仍需验证的问题。",
        createdAt: "周一 16:40",
        artifactIds: ["research-note-artifact"],
        contextItemIds: ["research-links"],
        approvalRequestIds: []
      }
    ],
    icon: Search
  }
];

export function createFallbackSessionHistoryPanelState(): SessionHistoryPanelState {
  const firstSession = sessionHistoryItems[0] ?? null;

  return {
    items: sessionHistoryItems,
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在从 /api/daily/sessions?mode=daily_work 同步会话列表；连接完成前先展示本地快照。",
    restorePreview: createLocalSessionRestorePreviewState(firstSession)
  };
}

export function createLocalSessionRestorePreviewState(
  item: SessionHistoryItem | null,
  syncStatus: SessionRestorePreviewSyncStatus = "idle",
  notice = "尚未调用恢复预演；点击恢复后会先生成仅预览的输入框提示。"
): SessionRestorePreviewPanelState {
  return {
    sessionId: item?.id ?? "",
    source: "fallback",
    syncStatus,
    previewOnly: true,
    externalEffects: ["none"],
    safetyStatement:
      "仅预览：当前恢复动作只填入输入框，不发送邮件、不写入文档、不创建日历或任务，也不读取真实外部数据。",
    restorePrompt: item ? buildSessionRestorePrompt(item) : "",
    generatedAt: "本地示例",
    notice
  };
}

export function mapSessionsResponse(payload: DailyWorkSessionsResponseDto) {
  if (payload.mode !== activeMode) {
    throw new Error("Daily-work sessions response did not match the active mode.");
  }

  return (payload.sessions ?? []).map((session, index) =>
    mapSessionDtoToItem(session, index)
  );
}

export function mapSessionResponse(payload: DailyWorkSessionResponseDto) {
  if (payload.mode !== activeMode || !payload.session) {
    throw new Error("Daily-work session response did not include a matching session.");
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
  const title = nonEmptyText(session.title, `Daily work session ${index + 1}`);
  const recentMessages = mapSessionRecentMessages(session.recentMessages);

  return {
    id: nonEmptyText(session.id, `daily-work-session-${index + 1}`),
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
      "仅预览：后端声明恢复预演不会产生外部效果。"
    ),
    restorePrompt: nonEmptyText(preview.restorePrompt, buildSessionRestorePrompt(item)),
    generatedAt: formatSessionHistoryTimestamp(preview.generatedAt),
    notice:
      "已从 /api/daily/sessions/:sessionId/restore-preview 同步；后端声明这是仅预览恢复提示，不会产生外部效果。"
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
    "边界：这是 daily_work restore-preview，只填入输入框等待我确认；不要发送邮件、写入文档、创建日历或任务，也不要读取真实外部数据。",
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
