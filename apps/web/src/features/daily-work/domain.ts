import {
  AlertCircle,
  CalendarClock,
  FileText,
  Globe,
  HardDrive,
  Mail,
  MessageSquare,
  Presentation,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
  type LucideIcon
} from "lucide-react";

import type {
  AppMode,
  ChatStatus,
  AssistantResponseMode,
  ChatMessage,
  TemplateItem,
  TemplatePanelSource,
  TemplatePanelSyncStatus,
  TemplatePreviewSource,
  TemplatePreviewSyncStatus,
  DailyWorkTemplateDto,
  DailyWorkTemplatesResponseDto,
  DailyWorkTemplateApplyPreviewResponseDto,
  TemplatePreviewPanelState,
  TemplatePanelState,
  SessionHistoryStatus,
  SessionHistoryFilter,
  SessionHistoryPanelSource,
  SessionHistoryPanelSyncStatus,
  SessionRestorePreviewSource,
  SessionRestorePreviewSyncStatus,
  SessionHistoryMessageItem,
  SessionHistoryItem,
  DailyWorkSessionLastActionDto,
  DailyWorkSessionMessageDto,
  DailyWorkSessionDto,
  DailyWorkSessionsResponseDto,
  DailyWorkSessionResponseDto,
  DailyWorkSessionRestorePreviewResponseDto,
  SessionRestorePreviewPanelState,
  SessionHistoryPanelState,
  ArtifactState,
  ArtifactFilter,
  ArtifactTraceItem,
  ArtifactItem,
  DailyWorkArtifactNextActionDto,
  DailyWorkArtifactDto,
  DailyWorkArtifactsResponseDto,
  DailyWorkArtifactResponseDto,
  ArtifactPanelState,
  ContextItem,
  ContextPanelSource,
  ContextPanelSyncStatus,
  ContextPreviewSource,
  ContextPreviewSyncStatus,
  DailyContextItemDto,
  DailyContextResponseDto,
  DailyContextUsePreviewResponseDto,
  ContextPreviewPanelState,
  ContextPanelState,
  ConnectorFilter,
  ConnectorPermissionState,
  ConnectorRiskLevel,
  ConnectorItem,
  WorkflowActionStatus,
  WorkflowActionFilter,
  WorkflowActionItem,
  ActivityEventType,
  ActivityEventStatus,
  ActivityEventItem,
  ActivityFeedSource,
  ActivityConnectionStatus,
  DailyActivityRelatedRefs,
  DailyActivityNextAction,
  DailyActivityEventDto,
  DailyActivitySnapshotDto,
  ApprovalStatus,
  ApprovalRisk,
  ApprovalPanelSource,
  ApprovalPanelSyncStatus,
  ModelRouteMode,
  ThinkingMode,
  ModelUsageBudgetState,
  ModelUsageSyncStatus,
  PersistenceLayerId,
  PersistenceLayerStatus,
  PersistencePanelSyncStatus,
  ApprovalRequestItem,
  DailyApprovalRequestDto,
  DailyApprovalRequestsResponseDto,
  ApprovalPanelState,
  ModelSnapshotItem,
  UsageSnapshotItem,
  DailyModelUsageWindowDto,
  DailyModelUsageResponseDto,
  ConnectorActionPreviewResponseDto,
  DailyApprovalDecisionResponseDto,
  ConnectorPreviewPanelState,
  DailyWorkflowPreviewConnectorLinkDto,
  DailyWorkflowPreviewContextLinkDto,
  DailyWorkflowPreviewArtifactLinkDto,
  DailyWorkflowPreviewApprovalLinkDto,
  DailyWorkflowPreviewResponseDto,
  WorkflowPreviewPanelState,
  ModelUsagePanelState,
  PersistencePanelState,
  HealthPersistenceSnapshotDto
} from "./types";

export const activeMode: AppMode = "daily_work";

export const defaultApiBaseUrl =
  process.env.NEXT_PUBLIC_SEEKDESK_API_URL ?? "http://127.0.0.1:4000";

export const templates: TemplateItem[] = [
  {
    id: "email-draft",
    category: "writing",
    title: "邮件起草",
    description: "把要点整理成专业、清晰的邮件",
    prompt:
      "帮我起草一封简洁专业的邮件，说明下面的进展、关键决定和下一步行动。\n\n背景：\n- 项目：\n- 收件人：\n- 关键进展：\n- 需要对方行动：\n- 语气：清晰、友好、专业",
    artifactType: "email_draft",
    tags: ["email", "writing", "stakeholder"],
    enabled: true,
    icon: Mail
  },
  {
    id: "meeting-summary",
    category: "review",
    title: "会议纪要",
    description: "从记录中提取决策、待办和风险",
    prompt:
      "请把下面的会议记录整理成可分享的纪要，包含：概览、关键决策、待办事项、负责人、风险和开放问题。\n\n会议记录：\n",
    artifactType: "meeting_summary",
    tags: ["meeting", "summary", "actions"],
    enabled: true,
    icon: Presentation
  },
  {
    id: "research-brief",
    category: "research",
    title: "资料研究",
    description: "把调研素材压缩成一页简报",
    prompt:
      "请生成一份资料研究简报，包含：问题背景、已知信息、仍需验证的内容、可引用依据和建议下一步。\n\n研究主题：\n已收集资料：\n限制条件：\n",
    artifactType: "research_note",
    tags: ["research", "brief", "decision"],
    enabled: true,
    icon: Search
  },
  {
    id: "weekly-report",
    category: "review",
    title: "周报整理",
    description: "总结进展、风险和下周优先级",
    prompt:
      "请把下面的信息整理成一份周报，结构为：本周进展、主要成果、风险/阻塞、下周优先级。\n\n项目背景：\n本周完成：\n风险：\n下周计划：\n",
    artifactType: "weekly_report",
    tags: ["weekly", "status", "review"],
    enabled: true,
    icon: CalendarClock
  },
  {
    id: "task-plan",
    category: "planning",
    title: "任务计划",
    description: "把目标拆解成可执行步骤",
    prompt:
      "请为下面的目标制定任务计划，拆成阶段、列出接下来的 5 个可执行动作，并标注依赖、风险和验收标准。\n\n目标：\n截止时间：\n约束：\n",
    artifactType: "task_list",
    tags: ["planning", "tasks", "execution"],
    enabled: true,
    icon: Target
  },
  {
    id: "knowledge-qa",
    category: "knowledge",
    title: "知识问答",
    description: "基于上下文回答问题并指出缺口",
    prompt:
      "请仅基于我提供的上下文回答问题。如果上下文不足，请说明缺少什么，并只追问最少必要信息。\n\n问题：\n上下文：\n",
    artifactType: "brief",
    tags: ["knowledge", "qa", "context"],
    enabled: true,
    icon: FileText
  }
];

export function createFallbackTemplatePanelState(): TemplatePanelState {
  return {
    items: templates,
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在从 /api/daily/templates?mode=daily_work 同步模板库；连接完成前保留前端 fallback。",
    preview: createLocalTemplatePreviewState(templates[0] ?? null)
  };
}

export function createLocalTemplatePreviewState(
  template: TemplateItem | null,
  syncStatus: TemplatePreviewSyncStatus = "idle",
  notice = "尚未调用 template apply-preview；点击模板后会优先生成 preview-only 输入框草稿。"
): TemplatePreviewPanelState {
  return {
    templateId: template?.id ?? "",
    source: "fallback",
    syncStatus,
    previewOnly: true,
    externalEffects: ["none"],
    safetyStatement:
      "Preview only: 当前模板操作只把草稿填入输入框，不发送邮件、不写入文档、不创建日历或任务，也不触发任何外部工具。",
    promptDraft: template?.prompt ?? "",
    generatedAt: "前端 fallback",
    notice
  };
}

export function mapTemplatesResponse(payload: DailyWorkTemplatesResponseDto): TemplateItem[] {
  if (payload.mode !== activeMode || !Array.isArray(payload.templates)) {
    throw new Error("Templates response did not include daily_work templates.");
  }

  return payload.templates.map(mapTemplateDtoToItem);
}

export function mapTemplateDtoToItem(
  template: DailyWorkTemplateDto,
  index: number
): TemplateItem {
  const artifactType = nonEmptyText(template.artifactType, "brief");
  const category = nonEmptyText(template.category, "knowledge");
  const tags = sanitizeTemplateTags(template.tags);
  const title = nonEmptyText(template.title, `日常模板 ${index + 1}`);

  return {
    id: nonEmptyText(template.id, `daily-template-${index + 1}`),
    category,
    title,
    description: nonEmptyText(
      template.description,
      "后端模板已同步，等待补充说明。"
    ),
    prompt: nonEmptyText(template.prompt, "请基于当前上下文继续完成这项日常工作。"),
    artifactType,
    tags,
    enabled: template.enabled !== false,
    icon: templateIcon({
      category,
      artifactType,
      tags,
      title
    })
  };
}

export function mapTemplatePreviewResponse(
  template: TemplateItem,
  payload: DailyWorkTemplateApplyPreviewResponseDto
): TemplatePreviewPanelState {
  const preview = payload.preview;
  const previewTemplateId = preview?.templateId ?? preview?.id;
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
    !preview ||
    (previewTemplateId && previewTemplateId !== template.id) ||
    previewOnly !== true ||
    normalizedExternalEffects.some((effect) => effect !== "none")
  ) {
    throw new Error("Template apply-preview response did not match the selected template.");
  }

  return {
    templateId: template.id,
    source: "api",
    syncStatus: "live",
    previewOnly: true,
    externalEffects: normalizedExternalEffects,
    safetyStatement: nonEmptyText(
      preview.safetyBoundary?.statement,
      "Preview only: 后端声明模板预演不会产生外部效果。"
    ),
    promptDraft: nonEmptyText(preview.promptDraft, template.prompt),
    generatedAt:
      formatModelUsageTimestamp(preview.generatedAt) ??
      nonEmptyText(preview.generatedAt, "刚刚同步"),
    notice:
      "已从 /api/daily/templates/:templateId/apply-preview 同步；响应声明 previewOnly=true 且 externalEffects=['none']。"
  };
}

export function sanitizeTemplateTags(values: string[] | undefined) {
  return values?.filter((value) => value.trim().length > 0).slice(0, 4) ?? [];
}

export function templateIcon({
  artifactType,
  category,
  tags,
  title
}: {
  artifactType: string;
  category: string;
  tags: string[];
  title: string;
}): LucideIcon {
  const searchable = [artifactType, category, title, ...tags]
    .join(" ")
    .toLowerCase();

  if (searchable.includes("email") || searchable.includes("mail") || searchable.includes("邮件")) {
    return Mail;
  }

  if (searchable.includes("meeting") || searchable.includes("summary") || searchable.includes("会议")) {
    return Presentation;
  }

  if (searchable.includes("research") || searchable.includes("brief") || searchable.includes("资料")) {
    return Search;
  }

  if (searchable.includes("weekly") || searchable.includes("status") || searchable.includes("周报")) {
    return CalendarClock;
  }

  if (searchable.includes("task") || searchable.includes("planning") || searchable.includes("计划")) {
    return Target;
  }

  return FileText;
}

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
      "正在从 /api/daily/sessions?mode=daily_work 同步会话列表；连接完成前保留前端 fallback 快照。",
    restorePreview: createLocalSessionRestorePreviewState(firstSession)
  };
}

export function createLocalSessionRestorePreviewState(
  item: SessionHistoryItem | null,
  syncStatus: SessionRestorePreviewSyncStatus = "idle",
  notice = "尚未调用 restore-preview；点击恢复后会先生成 preview-only 输入框提示。"
): SessionRestorePreviewPanelState {
  return {
    sessionId: item?.id ?? "",
    source: "fallback",
    syncStatus,
    previewOnly: true,
    externalEffects: ["none"],
    safetyStatement:
      "Preview only: 当前恢复动作只填入输入框，不发送邮件、不写入文档、不创建日历或任务，也不读取真实外部数据。",
    restorePrompt: item ? buildSessionRestorePrompt(item) : "",
    generatedAt: "前端 fallback",
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
    updatedAt: formatSessionHistoryTimestamp(session.updatedAt),
    summary: nonEmptyText(session.summary, "后端返回了会话快照，但暂未提供摘要。"),
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
      "Preview only: 后端声明恢复预演不会产生外部效果。"
    ),
    restorePrompt: nonEmptyText(preview.restorePrompt, buildSessionRestorePrompt(item)),
    generatedAt: formatSessionHistoryTimestamp(preview.generatedAt),
    notice:
      "已从 /api/daily/sessions/:sessionId/restore-preview 同步；响应声明 previewOnly=true 且 externalEffects=['none']。"
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

export const contextItems: ContextItem[] = [
  {
    id: "project-brief",
    title: "项目简报",
    source: "内部周报 / 产品组",
    sourceType: "Brief",
    status: "已确认",
    summary: "本周目标、里程碑、风险和依赖已经对齐，适合扩展为日常更新。",
    privacy: "仅项目成员可见",
    prompt:
      "请基于「项目简报」帮我整理一版日常工作更新，重点说明本周目标、当前进展、风险和下一步动作。",
    tags: ["项目", "计划", "周报"],
    icon: Target
  },
  {
    id: "meeting-notes",
    title: "会议记录",
    source: "周三例会 / 语音转写",
    sourceType: "Meeting",
    status: "待核验",
    summary: "记录了关键决策、行动项和负责人，适合继续压缩成可分享摘要。",
    privacy: "仅当前会话可用",
    prompt:
      "请基于「会议记录」整理一份可分享的会议摘要，输出关键决策、待办事项、负责人和开放问题。",
    tags: ["会议", "行动项", "待核验"],
    icon: Presentation
  },
  {
    id: "customer-email",
    title: "客户邮件",
    source: "support@customer.com",
    sourceType: "Email",
    status: "需确认",
    summary: "客户询问交付时间、范围变更和验收口径，适合生成克制且专业的回复草稿。",
    privacy: "敏感信息，需确认引用范围",
    prompt:
      "请基于「客户邮件」帮我起草回复，先确认客户关心的交付时间、范围变更和验收口径，再给出专业且克制的回应。",
    tags: ["客户", "邮件", "需审批"],
    icon: Mail
  },
  {
    id: "research-links",
    title: "研究链接",
    source: "公开资料 / 行业报告",
    sourceType: "Links",
    status: "已归档",
    summary: "包含竞品分析、行业报告和参考文章，适合整理成研究简报或引用清单。",
    privacy: "公开来源，可直接引用",
    prompt:
      "请基于「研究链接」整理一份研究简报，概括结论、可引用依据和仍需验证的点。",
    tags: ["研究", "公开资料", "引用"],
    icon: Globe
  },
  {
    id: "team-notes",
    title: "团队备忘",
    source: "团队群 / 个人笔记",
    sourceType: "Notes",
    status: "草稿",
    summary: "散落的讨论点、待同步事项和后续跟进，适合转换成任务清单。",
    privacy: "内部草稿，不可外发",
    prompt:
      "请基于「团队备忘」整理出下一步行动清单，标出优先级、负责人和依赖关系。",
    tags: ["团队", "备忘", "交接"],
    icon: ShieldCheck
  }
];

export function createFallbackContextPanelState(): ContextPanelState {
  return {
    items: contextItems,
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在从 /api/daily/context?mode=daily_work 同步会话知识上下文；连接完成前保留前端 fallback 快照。",
    preview: createLocalContextPreviewState(null)
  };
}

export function createLocalContextPreviewState(
  item: ContextItem | null,
  syncStatus: ContextPreviewSyncStatus = "idle",
  notice = "尚未调用 context use-preview；点击上下文后会生成 preview-only 输入框提示。"
): ContextPreviewPanelState {
  return {
    contextItemId: item?.id ?? "",
    source: "fallback",
    syncStatus,
    previewOnly: true,
    externalEffects: ["none"],
    safetyStatement:
      "Preview only: 当前上下文引用只填入输入框，不读取真实外部文件、不发送邮件、不写入文档或日历。",
    promptDraft: item ? item.prompt : "",
    generatedAt: "前端 fallback",
    notice
  };
}

export function mapContextResponse(payload: DailyContextResponseDto) {
  if (payload.mode !== activeMode) {
    throw new Error("Daily-work context response did not match the active mode.");
  }

  return (payload.items ?? []).map((item, index) =>
    mapContextDtoToItem(item, index)
  );
}

export function mapContextDtoToItem(
  item: DailyContextItemDto,
  index: number
): ContextItem {
  const sourceType = nonEmptyText(item.sourceType, "workspace_shared");
  const title = nonEmptyText(item.title, `会话上下文 ${index + 1}`);
  const tags = sanitizeSessionIds(item.tags);

  return {
    id: nonEmptyText(item.id, `daily-context-${index + 1}`),
    title,
    source: contextSourceLabel(sourceType, tags),
    sourceType: contextSourceTypeLabel(sourceType),
    status: contextPermissionStatusLabel(item.permissionState),
    summary: nonEmptyText(item.summary, "后端返回了上下文条目，但暂未提供摘要。"),
    privacy: contextPrivacyLabel(item.permissionState),
    prompt: buildContextPrompt({
      title,
      sourceType,
      summary: item.summary,
      permissionState: item.permissionState,
      tags
    }),
    tags,
    icon: contextIcon(sourceType, tags)
  };
}

export function mapContextUsePreviewResponse(
  item: ContextItem,
  payload: DailyContextUsePreviewResponseDto
): ContextPreviewPanelState {
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
    preview?.contextItemId !== item.id ||
    previewOnly !== true ||
    normalizedExternalEffects.some((effect) => effect !== "none")
  ) {
    throw new Error("Context use-preview response did not match the selected item.");
  }

  return {
    contextItemId: item.id,
    source: "api",
    syncStatus: "live",
    previewOnly: true,
    externalEffects: normalizedExternalEffects,
    safetyStatement: nonEmptyText(
      preview.safetyBoundary?.statement,
      "Preview only: 后端声明上下文预演不会产生外部效果。"
    ),
    promptDraft: nonEmptyText(preview.promptDraft, item.prompt),
    generatedAt: formatSessionHistoryTimestamp(preview.generatedAt),
    notice:
      "已从 /api/daily/context/:contextItemId/use-preview 同步；响应声明 previewOnly=true 且 externalEffects=['none']。"
  };
}

export function contextSourceLabel(sourceType: string, tags: string[]) {
  const tagText = tags.length > 0 ? ` / ${tags.slice(0, 2).join("、")}` : "";

  switch (sourceType) {
    case "meeting_notes":
      return `会议记录 API${tagText}`;
    case "project_brief":
      return `项目简报 API${tagText}`;
    case "customer_email":
      return `客户邮件 API${tagText}`;
    case "research_links":
      return `公开资料 API${tagText}`;
    case "team_notes":
      return `团队知识 API${tagText}`;
    default:
      return `工作区上下文 API${tagText}`;
  }
}

export function contextSourceTypeLabel(sourceType: string) {
  switch (sourceType) {
    case "meeting_notes":
      return "会议记录";
    case "project_brief":
      return "项目简报";
    case "customer_email":
      return "客户邮件";
    case "research_links":
      return "研究链接";
    case "team_notes":
      return "团队备忘";
    default:
      return sourceType;
  }
}

export function contextPermissionStatusLabel(permissionState: string | undefined) {
  switch (permissionState) {
    case "public":
      return "可引用";
    case "workspace_shared":
      return "工作区共享";
    case "requires_review":
      return "需确认";
    case "restricted":
      return "受限";
    default:
      return "待确认";
  }
}

export function contextPrivacyLabel(permissionState: string | undefined) {
  switch (permissionState) {
    case "public":
      return "公开来源，可直接引用";
    case "workspace_shared":
      return "工作区共享，仅当前项目使用";
    case "requires_review":
      return "敏感上下文，引用前需确认";
    case "restricted":
      return "受限上下文，不可外发";
    default:
      return "权限边界待确认";
  }
}

export function buildContextPrompt(input: {
  title: string;
  sourceType: string;
  summary: string | undefined;
  permissionState: string | undefined;
  tags: string[];
}) {
  return [
    `请在 daily_work 模式下使用「${input.title}」作为会话知识上下文。`,
    `上下文类型：${contextSourceTypeLabel(input.sourceType)}。`,
    `摘要：${nonEmptyText(input.summary, "暂无摘要，请先归纳可用事实。")}`,
    `权限边界：${contextPrivacyLabel(input.permissionState)}。`,
    input.tags.length > 0 ? `标签：${input.tags.join("、")}。` : undefined,
    "请只生成可复核的草稿或建议，不触发外部写入、发送或真实工具调用。"
  ]
    .filter(Boolean)
    .join("\n");
}

export function contextIcon(sourceType: string, tags: string[]): LucideIcon {
  const searchable = [sourceType, ...tags].join(" ").toLowerCase();

  if (searchable.includes("email") || searchable.includes("mail") || searchable.includes("客户")) {
    return Mail;
  }

  if (searchable.includes("meeting") || searchable.includes("会议")) {
    return Presentation;
  }

  if (searchable.includes("research") || searchable.includes("links") || searchable.includes("研究")) {
    return Globe;
  }

  if (searchable.includes("project") || searchable.includes("brief") || searchable.includes("计划")) {
    return Target;
  }

  if (searchable.includes("team") || searchable.includes("notes") || searchable.includes("团队")) {
    return ShieldCheck;
  }

  return FileText;
}

export const connectorFilters: ConnectorFilter[] = ["全部", "需审批", "可预览"];

export const connectorItems: ConnectorItem[] = [
  {
    id: "docs-catalog",
    apiConnectorId: "workspace-documents",
    apiAction: "draft_document",
    name: "文档库入口",
    category: "文档",
    provider: "SeekDesk Docs Preview",
    status: "示例未连接",
    permissionState: "需审批",
    description:
      "用于预演从工作文档中选择范围、生成摘要和引用说明的入口，不读取真实文件内容。",
    lastSyncLabel: "未同步，仅目录示例",
    riskLevel: "中",
    availableActions: ["预览授权范围", "生成引用提示", "记录审批原因"],
    relatedContextIds: ["project-brief", "meeting-notes"],
    requiredApprovalIds: ["use-internal-meeting-notes"],
    notes: [
      "当前只展示目录和权限预演，不读取真实文档。",
      "正式接入前需要确认工作区、文件夹范围和最小权限。"
    ],
    icon: FileText
  },
  {
    id: "calendar-catalog",
    apiConnectorId: "team-calendar",
    apiAction: "prepare_calendar_follow_up",
    name: "日历日程入口",
    category: "日历",
    provider: "SeekDesk Calendar Preview",
    status: "权限预演",
    permissionState: "可预览",
    description:
      "用于规划会议准备、日程摘要和待办提醒的字段预览，不连接真实日历账户。",
    lastSyncLabel: "未同步，仅字段预览",
    riskLevel: "中",
    availableActions: ["预览日程字段", "生成会议准备提示", "标记审批点"],
    relatedContextIds: ["meeting-notes"],
    requiredApprovalIds: ["schedule-calendar-follow-up"],
    notes: [
      "当前不会读取真实日程、参会人或会议链接。",
      "正式接入前需要确认可见时间范围和敏感会议处理方式。"
    ],
    icon: CalendarClock
  },
  {
    id: "mail-catalog",
    apiConnectorId: "customer-email",
    apiAction: "prepare_email_draft",
    name: "邮箱收件入口",
    category: "邮箱",
    provider: "SeekDesk Mail Preview",
    status: "示例未连接",
    permissionState: "需审批",
    description:
      "用于预演邮件摘要、回复草稿和外发审批路径，不读取真实邮件或附件。",
    lastSyncLabel: "未同步，仅权限说明",
    riskLevel: "高",
    availableActions: ["预览收件范围", "生成回复草稿提示", "配置外发审批"],
    relatedContextIds: ["customer-email", "meeting-notes"],
    requiredApprovalIds: [
      "read-customer-email-context",
      "draft-external-reply"
    ],
    notes: [
      "当前不会登录邮箱、读取邮件正文或扫描附件。",
      "正式接入前需要明确发件权限、敏感客户信息和拒绝路径。"
    ],
    icon: Mail
  },
  {
    id: "notes-catalog",
    apiConnectorId: "workspace-notes",
    apiAction: "summarize",
    name: "个人笔记入口",
    category: "笔记",
    provider: "SeekDesk Notes Preview",
    status: "权限预演",
    permissionState: "可预览",
    description:
      "用于把用户主动选择的笔记整理成行动清单和周报素材，不读取真实笔记库。",
    lastSyncLabel: "未同步，仅示例卡片",
    riskLevel: "低",
    availableActions: ["预览笔记字段", "生成整理提示", "保留来源说明"],
    relatedContextIds: ["team-notes", "meeting-notes"],
    requiredApprovalIds: ["use-internal-meeting-notes"],
    notes: [
      "当前只使用示例字段，不读取真实笔记或本地文件。",
      "正式接入前需要确认用户手动选择范围和撤销入口。"
    ],
    icon: MessageSquare
  },
  {
    id: "knowledge-catalog",
    apiConnectorId: "team-knowledge-base",
    apiAction: "open_reference",
    name: "团队知识库入口",
    category: "团队知识",
    provider: "SeekDesk Knowledge Preview",
    status: "示例未连接",
    permissionState: "可预览",
    description:
      "用于预演团队知识库索引、引用和权限边界，不访问真实知识库或内部页面。",
    lastSyncLabel: "未同步，仅索引预演",
    riskLevel: "中",
    availableActions: ["预览索引字段", "生成知识库接入提示", "标记引用边界"],
    relatedContextIds: ["research-links", "project-brief", "team-notes"],
    requiredApprovalIds: [],
    notes: [
      "当前不读取真实团队知识库、Wiki 或内部网页。",
      "正式接入前需要确认空间范围、引用策略和成员权限。"
    ],
    icon: Globe
  }
];

export const workflowActionFilters: WorkflowActionFilter[] = [
  "全部",
  "待审批",
  "可预演",
  "需补上下文"
];

export const workflowActions: WorkflowActionItem[] = [
  {
    id: "draft-customer-update",
    apiWorkflowId: "customer-email-draft-workflow",
    apiActionId: "queue-email-draft",
    title: "起草客户进展邮件",
    actionType: "邮件起草",
    connector: "邮箱收件入口 / SeekDesk Mail Preview",
    context: "客户邮件 + 项目简报",
    artifact: "客户更新邮件草稿",
    approvalStatus: "待审批",
    riskLevel: "高",
    riskNote: "涉及外发语气和客户信息，当前只生成草稿，不发送邮件。",
    summary:
      "把客户关心的交付时间、范围变化和验收口径整理成一封可复核邮件，保留外发审批提示。",
    nextStep: "确认收件人、敏感字段和是否允许引用项目简报，再生成邮件草稿。",
    prompt:
      "请预演一个 daily_work 邮件起草工作流，不调用邮箱、不发送邮件。\n\n动作：起草客户进展邮件\n上下文：客户邮件 + 项目简报\n产物：客户更新邮件草稿\n审批状态：待审批\n风险提示：涉及外发语气和客户信息，当前只生成草稿，不发送邮件。\n\n请输出：需要的最小上下文、草稿结构、审批检查点、风险复核项，以及用户确认后才可继续的下一步。",
    relatedContextIds: ["customer-email", "meeting-notes"],
    icon: Mail
  },
  {
    id: "summarize-meeting-notes",
    apiWorkflowId: "meeting-summary-workflow",
    apiActionId: "queue-meeting-summary",
    title: "整理会议纪要",
    actionType: "会议纪要",
    connector: "个人笔记入口 / SeekDesk Notes Preview",
    context: "会议记录 + 团队备忘",
    artifact: "可分享会议纪要",
    approvalStatus: "可预演",
    riskLevel: "中",
    riskNote: "可能包含内部决策和负责人信息，当前只做会话级摘要预演。",
    summary:
      "从会议记录中提取关键决策、待办、负责人、开放问题和风险，生成可复核纪要。",
    nextStep: "先标出缺失负责人或时间点，再生成纪要草稿供用户确认。",
    prompt:
      "请预演一个 daily_work 会议纪要工作流，不读取真实笔记库、不写入文档。\n\n动作：整理会议纪要\n上下文：会议记录 + 团队备忘\n产物：可分享会议纪要\n审批状态：可预演\n风险提示：可能包含内部决策和负责人信息，当前只做会话级摘要预演。\n\n请输出：纪要结构、决策/待办提取规则、需要用户复核的字段、风险提示和下一步确认问题。",
    relatedContextIds: ["meeting-notes", "team-notes"],
    icon: Presentation
  },
  {
    id: "prepare-calendar-follow-up",
    apiWorkflowId: "calendar-follow-up-workflow",
    apiActionId: "queue-calendar-follow-up",
    title: "准备日历跟进",
    actionType: "日历跟进",
    connector: "日历日程入口 / SeekDesk Calendar Preview",
    context: "会议纪要 + 下周优先级",
    artifact: "日历跟进建议",
    approvalStatus: "需补上下文",
    riskLevel: "中",
    riskNote: "当前不读取或写入真实日历，只生成待确认的跟进建议。",
    summary:
      "根据会议结论和优先级整理后续会议、提醒、准备材料和负责人的建议清单。",
    nextStep: "补齐目标日期、参与人范围和提醒粒度，再生成日历跟进建议。",
    prompt:
      "请预演一个 daily_work 日历跟进工作流，不读取真实日历、不创建日程。\n\n动作：准备日历跟进\n上下文：会议纪要 + 下周优先级\n产物：日历跟进建议\n审批状态：需补上下文\n风险提示：当前不读取或写入真实日历，只生成待确认的跟进建议。\n\n请输出：缺失上下文清单、建议跟进项、每项的目的/参与人/时间窗口、审批检查点和用户确认后的下一步。",
    relatedContextIds: ["meeting-notes"],
    icon: CalendarClock
  },
  {
    id: "generate-weekly-plan",
    apiWorkflowId: "weekly-report-task-plan-workflow",
    apiActionId: "queue-weekly-report",
    title: "生成周报与任务计划",
    actionType: "周报 / 任务计划",
    connector: "文档库入口 / SeekDesk Docs Preview",
    context: "项目简报 + 团队备忘 + 会议纪要",
    artifact: "周报草稿和下周任务计划",
    approvalStatus: "可预演",
    riskLevel: "低",
    riskNote: "当前只在输入框生成结构化草稿，不写入文档或同步团队空间。",
    summary:
      "汇总本周进展、成果、风险、依赖和下周优先级，拆解为可执行任务计划。",
    nextStep: "选择周报受众和输出粒度，再生成一版可复制的周报与任务计划。",
    prompt:
      "请预演一个 daily_work 周报与任务计划工作流，不写入文档、不同步团队空间。\n\n动作：生成周报与任务计划\n上下文：项目简报 + 团队备忘 + 会议纪要\n产物：周报草稿和下周任务计划\n审批状态：可预演\n风险提示：当前只在输入框生成结构化草稿，不写入文档或同步团队空间。\n\n请输出：周报结构、任务拆解方式、风险和依赖检查表、需要审批或复核的字段，以及下一步建议。",
    relatedContextIds: ["project-brief", "team-notes", "meeting-notes"],
    icon: FileText
  }
];

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

export const artifactFilters: ArtifactFilter[] = ["全部", "草稿", "可复用"];

export const artifacts: ArtifactItem[] = [
  {
    id: "meeting-summary-artifact",
    artifactType: "会议纪要",
    title: "会议摘要",
    description: "关键决策、风险和下一步行动的清晰回顾",
    summary:
      "已把周三例会压缩为项目同步版本，保留关键决策、待办负责人和两个开放风险，适合复核后分享。",
    state: "待复核",
    owner: "产品组",
    updatedAt: "今天 10:30",
    source: "会议记录 / 周三例会",
    templateTitle: "会议纪要",
    tags: ["决策", "待办", "风险"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：会议记录" },
      { label: "审批", value: "使用内部会议记录：允许一次" }
    ],
    nextAction: "复核负责人和风险措辞，确认后复制到项目同步渠道。",
    permissionStatus: "允许一次，可在本次会话内复用",
    icon: FileText
  },
  {
    id: "task-list-artifact",
    artifactType: "任务计划",
    title: "任务清单",
    description: "带负责人、时限和依赖关系的可执行事项",
    summary:
      "从团队备忘中拆出 5 个下一步行动，包含优先级、依赖和验收口径，等待补齐负责人。",
    state: "排队中",
    owner: "运营同学",
    updatedAt: "今天 09:45",
    source: "团队备忘 / 个人笔记",
    templateTitle: "任务计划",
    tags: ["行动项", "依赖", "优先级"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：团队备忘" },
      { label: "审批", value: "内部草稿，不用于外发" }
    ],
    nextAction: "补齐负责人后重新生成排序，并把阻塞项标为待确认。",
    permissionStatus: "仅内部草稿，不可外发",
    icon: Workflow
  },
  {
    id: "email-draft-artifact",
    artifactType: "客户沟通",
    title: "邮件草稿",
    description: "可继续润色或复制给利益相关人的更新",
    summary:
      "已形成客户更新邮件的初稿，包含交付时间线、范围变更说明和下一步确认事项。",
    state: "草稿",
    owner: "客户成功",
    updatedAt: "昨天 17:20",
    source: "客户邮件 / support@customer.com",
    templateTitle: "邮件起草",
    tags: ["外部回复", "交付", "需确认"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：客户邮件" },
      { label: "审批", value: "起草外部回复：已阻断" }
    ],
    nextAction: "确认外发授权边界，再把语气调整为更克制的客户版本。",
    permissionStatus: "需审批后外发",
    icon: Mail
  },
  {
    id: "research-notes-artifact",
    artifactType: "资料研究",
    title: "研究笔记",
    description: "浓缩发现、引用方向和待验证问题",
    summary:
      "公开资料已整理成一页研究笔记，列出可引用依据、竞品观察和仍需验证的问题。",
    state: "可复用",
    owner: "研究同学",
    updatedAt: "昨天 15:10",
    source: "公开资料 / 行业报告",
    templateTitle: "资料研究",
    tags: ["公开来源", "引用", "竞品"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：研究链接" },
      { label: "审批", value: "公开来源，可直接引用" }
    ],
    nextAction: "把可引用依据同步到简报，并标注仍需二次验证的结论。",
    permissionStatus: "公开来源，可在工作区复用",
    icon: Search
  },
  {
    id: "weekly-report-artifact",
    artifactType: "工作汇报",
    title: "周报框架",
    description: "围绕进展、风险和下周重点搭好的汇报结构",
    summary:
      "周报结构已经按本周进展、主要成果、风险阻塞和下周优先级搭好，等待填入最新数据。",
    state: "计划中",
    owner: "你",
    updatedAt: "今天 08:40",
    source: "项目简报 / 内部周报",
    templateTitle: "周报整理",
    tags: ["汇报", "里程碑", "下周计划"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：项目简报" },
      { label: "审批", value: "仅项目成员可见" }
    ],
    nextAction: "补充本周完成项和阻塞风险，再生成可发送版本。",
    permissionStatus: "项目成员可见，外发前需复核",
    icon: CalendarClock
  }
];

export function createFallbackArtifactPanelState(): ArtifactPanelState {
  return {
    items: artifacts,
    source: "fallback",
    syncStatus: "syncing",
    notice: "正在从 /api/daily/artifacts?mode=daily_work 同步产物；暂时展示本地 fallback。"
  };
}

export function mapArtifactsResponse(payload: DailyWorkArtifactsResponseDto): ArtifactItem[] {
  if (payload.mode !== activeMode || !Array.isArray(payload.artifacts)) {
    throw new Error("Artifacts response did not include daily_work artifacts.");
  }

  return payload.artifacts.map(mapArtifactDtoToItem);
}

export function mapArtifactResponse(payload: DailyWorkArtifactResponseDto): ArtifactItem {
  if (payload.mode !== activeMode || !payload.artifact) {
    throw new Error("Artifact detail response did not include a daily_work artifact.");
  }

  return mapArtifactDtoToItem(payload.artifact);
}

export function mapArtifactDtoToItem(artifact: DailyWorkArtifactDto): ArtifactItem {
  const artifactType = nonEmptyText(
    artifactTypeLabel(artifact.artifactType),
    "日常产物"
  );
  const ownerName = nonEmptyText(artifact.owner?.displayName, "SeekDesk");
  const sourceContextIds = artifact.sourceContextIds ?? [];
  const approvalRequestIds = artifact.approvalRequestIds ?? [];
  const lifecycle = artifact.lifecycle ?? artifact.trace?.events ?? [];
  const traceItems: ArtifactTraceItem[] = [
    {
      label: "来源",
      value:
        [
          artifact.trace?.origin ? `origin: ${artifact.trace.origin}` : "",
          artifact.trace?.createdBy ? `created by ${artifact.trace.createdBy}` : "",
          formatModelUsageTimestamp(artifact.trace?.createdAt)
        ]
          .filter(Boolean)
          .join(" · ") || "来源追踪待补充"
    },
    {
      label: "上下文",
      value:
        sourceContextIds.length > 0
          ? `来源上下文：${sourceContextIds.join("、")}`
          : "未绑定额外上下文"
    },
    {
      label: "审批",
      value:
        approvalRequestIds.length > 0
          ? `审批请求：${approvalRequestIds.join("、")}`
          : "无审批请求"
    },
    ...lifecycle.slice(0, 3).map((event) => ({
      label: lifecycleEventLabel(event.type),
      value: [
        event.summary,
        event.actor ? `by ${event.actor}` : "",
        formatModelUsageTimestamp(event.at)
      ]
        .filter(Boolean)
        .join(" · ")
    }))
  ];

  return {
    id: nonEmptyText(artifact.id, "unknown-artifact"),
    artifactType,
    title: nonEmptyText(artifact.title, artifactType),
    description: nonEmptyText(
      artifact.description,
      "后端产物记录已同步，等待补充描述。"
    ),
    summary: nonEmptyText(artifact.summary, "暂无摘要。"),
    state: artifactStateFromApi(artifact.status, artifact.reusable),
    owner: artifact.owner?.team
      ? `${ownerName} / ${artifact.owner.team}`
      : ownerName,
    updatedAt:
      formatModelUsageTimestamp(artifact.updatedAt) ??
      nonEmptyText(artifact.updatedAt, "刚刚同步"),
    source:
      sourceContextIds.length > 0
        ? sourceContextIds.join(" / ")
        : "未绑定上下文",
    templateTitle: nonEmptyText(
      artifactTemplateLabel(artifact.templateId),
      artifact.templateId ?? "未绑定模板"
    ),
    tags: artifact.tags && artifact.tags.length > 0 ? artifact.tags : ["daily_work"],
    trace: traceItems,
    nextAction: formatArtifactNextAction(artifact.nextAction),
    permissionStatus: artifactPermissionLabel(
      artifact.permissionState,
      approvalRequestIds
    ),
    icon: artifactIcon(artifact.artifactType)
  };
}

export function artifactTypeLabel(value: string | undefined) {
  switch (value) {
    case "email_draft":
      return "客户沟通";
    case "meeting_summary":
      return "会议纪要";
    case "research_note":
      return "资料研究";
    case "task_list":
      return "任务计划";
    case "weekly_report":
      return "工作汇报";
    case "brief":
      return "简报";
    default:
      return value;
  }
}

export function artifactTemplateLabel(value: string | undefined) {
  const template = templates.find((item) => item.id === value);
  return template?.title;
}

export function artifactStateFromApi(
  status: string | undefined,
  reusable: boolean | undefined
): ArtifactState {
  if (reusable || status === "reusable" || status === "ready") {
    return "可复用";
  }

  if (status === "review") {
    return "待复核";
  }

  if (status === "draft") {
    return "草稿";
  }

  return "计划中";
}

export function artifactPermissionLabel(
  permissionState: string | undefined,
  approvalRequestIds: string[]
) {
  const approvalText =
    approvalRequestIds.length > 0
      ? `；关联审批 ${approvalRequestIds.join("、")}`
      : "；无审批请求";

  switch (permissionState) {
    case "public":
      return `公开来源，可复用${approvalText}`;
    case "workspace_shared":
      return `工作区共享，复用前仍需确认上下文${approvalText}`;
    case "requires_review":
      return `需复核后使用${approvalText}`;
    case "restricted":
      return `受限产物，不可外发${approvalText}`;
    default:
      return `权限状态待确认${approvalText}`;
  }
}

export function formatArtifactNextAction(
  nextAction: DailyWorkArtifactNextActionDto | null | undefined
) {
  if (!nextAction) {
    return "暂无下一步动作。";
  }

  return [nextAction.label, nextAction.description, nextAction.approvalRequestId]
    .filter(Boolean)
    .join(" · ");
}

export function lifecycleEventLabel(value: string | undefined) {
  switch (value) {
    case "created":
      return "创建";
    case "context_linked":
      return "上下文";
    case "approval_linked":
      return "审批";
    case "status_changed":
      return "状态";
    case "marked_reusable":
      return "复用";
    default:
      return "追踪";
  }
}

export function artifactIcon(value: string | undefined): LucideIcon {
  switch (value) {
    case "email_draft":
      return Mail;
    case "meeting_summary":
      return Presentation;
    case "research_note":
      return Search;
    case "task_list":
      return Workflow;
    case "weekly_report":
      return CalendarClock;
    default:
      return FileText;
  }
}

export const initialMessages: ChatMessage[] = [];

export const initialApprovalRequests: ApprovalRequestItem[] = [
  {
    id: "read-customer-email-context",
    title: "读取客户邮件上下文",
    requestedAction: "查看客户诉求并提炼回复要点",
    scope: "仅限本次会话中已确认的客户邮件摘要，不扩散到其他联系人。",
    risk: "高",
    status: "waiting",
    detail:
      "涉及外部客户信息，建议先确认范围，再决定是否用于草拟回复。",
    icon: Mail
  },
  {
    id: "use-internal-meeting-notes",
    title: "使用内部会议记录",
    requestedAction: "压缩会议记录为可分享纪要",
    scope: "仅限当前项目会议纪要，不读取其他项目或私人笔记。",
    risk: "中",
    status: "allowed_once",
    detail: "适合一次性整理为工作产物，输出后仍保留可回溯说明。",
    icon: Presentation
  },
  {
    id: "draft-external-reply",
    title: "起草外部回复",
    requestedAction: "生成可发送给客户的专业草稿",
    scope: "仅使用已批准上下文，不触发外部发送或自动化动作。",
    risk: "极高",
    status: "blocked",
    detail: "一旦进入外发语境，需要明确授权边界，避免误发敏感信息。",
    icon: AlertCircle
  },
  {
    id: "schedule-calendar-follow-up",
    title: "安排日历跟进",
    requestedAction: "为后续沟通创建跟进提醒",
    scope: "仅生成日历建议，不直接访问真实日历或联系人列表。",
    risk: "低",
    status: "denied",
    detail: "可以保留为手动执行建议，但当前不做自动排程。",
    icon: CalendarClock
  }
];

export function createFallbackApprovalPanelState(): ApprovalPanelState {
  return {
    items: initialApprovalRequests,
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在从 /api/daily/approvals?mode=daily_work 同步审批台账；连接完成前保留前端 fallback。"
  };
}

export function mapApprovalRequestsResponse(
  payload: DailyApprovalRequestsResponseDto
): ApprovalRequestItem[] {
  if (payload.mode !== activeMode || !Array.isArray(payload.requests)) {
    throw new Error("Approvals response did not include daily_work requests.");
  }

  return payload.requests.map(mapApprovalRequestDtoToItem);
}

export function mapApprovalRequestDtoToItem(
  request: DailyApprovalRequestDto,
  index: number
): ApprovalRequestItem {
  const actionType = nonEmptyText(request.actionType, "daily_work_approval");
  const contextIds = request.contextItemIds ?? [];
  const tags = request.tags ?? [];
  const risk = approvalRiskFromApi(request.riskLevel);
  const status = approvalStatusFromApi(request.status);
  const title = nonEmptyText(request.title, `审批请求 ${index + 1}`);

  return {
    id: nonEmptyText(request.id, `approval-request-${index + 1}`),
    title: approvalTitleLabel(title, actionType),
    requestedAction: nonEmptyText(
      request.description,
      approvalActionDescription(actionType)
    ),
    scope: approvalScopeLabel(request.requiredPermissionMode, contextIds),
    risk,
    status,
    detail: approvalDetailLabel({
      actionType,
      decision: request.decision,
      permissionAware: request.permissionAware,
      status,
      tags
    }),
    icon: approvalIcon(actionType, risk)
  };
}

export function approvalTitleLabel(title: string, actionType: string) {
  if (title.trim().length > 0) {
    return title;
  }

  switch (actionType) {
    case "read_customer_email_context":
      return "读取客户邮件上下文";
    case "use_internal_meeting_notes":
      return "使用内部会议记录";
    case "draft_external_reply":
      return "起草外部回复";
    case "schedule_calendar_follow_up":
      return "安排日历跟进";
    default:
      return "日常工作审批";
  }
}

export function approvalActionDescription(actionType: string) {
  switch (actionType) {
    case "read_customer_email_context":
      return "查看客户诉求并提炼回复要点。";
    case "use_internal_meeting_notes":
      return "压缩会议记录为可分享纪要。";
    case "draft_external_reply":
      return "生成可发送给客户或合作方的专业草稿。";
    case "schedule_calendar_follow_up":
      return "生成后续跟进提醒或日历建议。";
    default:
      return "预演日常工作操作，等待用户确认。";
  }
}

export function approvalScopeLabel(
  requiredPermissionMode: string | undefined,
  contextItemIds: string[]
) {
  const contextText =
    contextItemIds.length > 0
      ? `关联上下文：${contextItemIds.join("、")}`
      : "未绑定额外上下文";

  switch (requiredPermissionMode) {
    case "auto_approve_safe_actions":
      return `${contextText}；低风险只读或会话内处理。`;
    case "confirm_private_context_and_actions":
      return `${contextText}；涉及私有上下文，使用前必须确认范围。`;
    case "confirm_writes_and_commands":
      return `${contextText}；涉及外发、写入或行动建议，仅允许 preview-only 决策。`;
    default:
      return `${contextText}；权限模式待确认。`;
  }
}

export function approvalDetailLabel(input: {
  actionType: string;
  decision: string | undefined;
  permissionAware: boolean | undefined;
  status: ApprovalStatus;
  tags: string[];
}) {
  const decisionText = input.decision ? `后端决策：${input.decision}` : "尚未确认";
  const awarenessText =
    input.permissionAware === false ? "未声明权限感知" : "permission-aware";
  const tagText = input.tags.length > 0 ? `标签：${input.tags.join("、")}` : "";
  const boundary =
    input.status === "allowed_once"
      ? "已允许一次，但仍不会触发真实外部操作。"
      : input.status === "denied"
        ? "已拒绝，后续只保留手动建议。"
        : "等待用户确认，当前只做 preview-only 预演。";

  return [boundary, decisionText, awarenessText, tagText]
    .filter(Boolean)
    .join("；");
}

export function approvalRiskFromApi(value: string | undefined): ApprovalRisk {
  switch (value) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "critical":
      return "极高";
    default:
      return "中";
  }
}

export function approvalStatusFromApi(value: string | undefined): ApprovalStatus {
  switch (value) {
    case "approved":
      return "allowed_once";
    case "denied":
      return "denied";
    case "pending":
      return "waiting";
    default:
      return "waiting";
  }
}

export function approvalIcon(actionType: string, risk: ApprovalRisk): LucideIcon {
  if (risk === "极高") {
    return AlertCircle;
  }

  switch (actionType) {
    case "read_customer_email_context":
      return Mail;
    case "use_internal_meeting_notes":
      return Presentation;
    case "draft_external_reply":
      return FileText;
    case "schedule_calendar_follow_up":
      return CalendarClock;
    default:
      return ShieldCheck;
  }
}

export const modelSnapshots: Record<ModelRouteMode, ModelSnapshotItem> = {
  fast: {
    id: "fast",
    currentMode: "daily_work",
    provider: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    fastModel: "deepseek-v4-flash",
    proModel: "deepseek-v4-pro",
    selectedRoute: "fast",
    selectedModel: "deepseek-v4-flash",
    routingStrategy: "快速：用于邮件草稿、会议压缩、短上下文整理等日常响应。",
    thinkingMode: "disabled",
    streamUsageEnabled: true,
    configured: false,
    updatedAt: "示例：今天 10:40",
    notes: [
      "本地示例快照，未连接真实 model selector。",
      "DeepSeek thinking.type 示例为 disabled，stream_options.include_usage 可返回 usage 块。"
    ]
  },
  pro: {
    id: "pro",
    currentMode: "daily_work",
    provider: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    fastModel: "deepseek-v4-flash",
    proModel: "deepseek-v4-pro",
    selectedRoute: "fast",
    selectedModel: "deepseek-v4-pro",
    routingStrategy: "深度：用于复杂资料归纳、风险复核、长上下文分析等高质量输出。",
    thinkingMode: "enabled",
    streamUsageEnabled: true,
    configured: false,
    updatedAt: "示例：今天 10:40",
    notes: [
      "本地示例快照，未连接真实 model selector。",
      "DeepSeek thinking.type 示例为 enabled，实际调用仍以后端为准。"
    ]
  }
};

export const usageSnapshots: Record<ModelRouteMode, UsageSnapshotItem> = {
  fast: {
    id: "fast",
    usageWindow: "示例：当前会话预估",
    inputTokens: 18420,
    outputTokens: 6110,
    totalTokens: 24530,
    estimatedCost: "估算 $0.04",
    budgetState: "示例预算正常，未接真实余额",
    budgetLevel: "tracking_only",
    updatedAt: "示例：今天 10:40",
    notes: [
      "usage 字段示例包含 prompt、completion、total tokens。",
      "成本仅用于前端占位展示，不作为账单或预算依据。"
    ]
  },
  pro: {
    id: "pro",
    usageWindow: "示例：当前会话预估",
    inputTokens: 23880,
    outputTokens: 9280,
    totalTokens: 33160,
    estimatedCost: "估算 $0.18",
    budgetState: "示例预算关注，未接真实余额",
    budgetLevel: "tracking_only",
    updatedAt: "示例：今天 10:40",
    notes: [
      "深度模式示例会展示更高 token 与成本估算。",
      "余额、安全阈值和实际计费尚未接入。"
    ]
  }
};

export function createFallbackModelUsagePanelState(): ModelUsagePanelState {
  return {
    modelSnapshots,
    usageSnapshots,
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在连接后端模型与用量接口；连接完成前保留前端示例快照，保证页面可用。"
  };
}

export function createFallbackPersistencePanelState(): PersistencePanelState {
  return {
    layers: [
      {
        id: "seed_mock",
        label: "Seed / Mock",
        description: "前端可用的启动示例与后端 seed 快照。",
        status: "active",
        detail: "默认展示，等待 /health 暴露真实数据层字段。",
        icon: Sparkles
      },
      {
        id: "json_local",
        label: "JSON / Local",
        description: "轻量本地 JSON 或文件型持久化。",
        status: "unknown",
        detail: "后端未声明；界面保持兼容，不假设已落盘。",
        icon: HardDrive
      },
      {
        id: "future_database",
        label: "Future Database",
        description: "未来数据库持久化通道。",
        status: "planned",
        detail: "仅展示路线，不在前端创建数据库能力。",
        icon: Server
      }
    ],
    source: "fallback",
    syncStatus: "syncing",
    currentLayer: "seed_mock",
    updatedAt: "前端 fallback",
    notice: "正在读取 /health 的数据层状态；字段缺失时保持 seed/mock 快照。"
  };
}

export function createLocalConnectorPreviewState(
  connector: ConnectorItem
): ConnectorPreviewPanelState {
  return {
    connectorId: connector.apiConnectorId,
    action: connector.apiAction,
    source: "local",
    syncStatus: "idle",
    previewOnly: true,
    summary: `本地预览：${connector.name} 只展示目录、权限和审批路径，不触发真实连接器。`,
    relatedContextItemIds: connector.relatedContextIds,
    requiredApprovalRequestIds: connector.requiredApprovalIds,
    steps: [
      `确认 ${connector.name} 的最小授权范围。`,
      "生成用户可见的预览说明与审批检查点。",
      "等待用户明确批准后再进入下一步规划。"
    ],
    safetyStatement:
      "Preview only: 当前界面不会登录、读取、写入、发送或创建任何外部记录。",
    notice: "当前展示本地 preview-only fallback；后端可用时会自动同步 API 预览。"
  };
}

export function mapConnectorPreviewResponse(
  connector: ConnectorItem,
  payload: ConnectorActionPreviewResponseDto
): ConnectorPreviewPanelState {
  const preview = payload.preview;

  if (
    payload.mode !== activeMode ||
    preview?.connectorId !== connector.apiConnectorId ||
    preview.action !== connector.apiAction ||
    preview.previewOnly !== true
  ) {
    throw new Error("Connector preview response did not match the selected connector.");
  }

  const steps =
    preview.steps
      ?.map((step) =>
        [step.title, step.description].filter(Boolean).join(": ")
      )
      .filter((step) => step.trim().length > 0) ?? [];

  return {
    connectorId: connector.apiConnectorId,
    action: connector.apiAction,
    source: "api",
    syncStatus: "live",
    previewOnly: true,
    summary: nonEmptyText(
      preview.summary,
      `已从后端同步 ${connector.name} 的 preview-only 动作计划。`
    ),
    relatedContextItemIds:
      preview.relatedContextItemIds && preview.relatedContextItemIds.length > 0
        ? preview.relatedContextItemIds
        : connector.relatedContextIds,
    requiredApprovalRequestIds:
      preview.requiredApprovalRequestIds &&
      preview.requiredApprovalRequestIds.length > 0
        ? preview.requiredApprovalRequestIds
        : connector.requiredApprovalIds,
    steps:
      steps.length > 0
        ? steps
        : createLocalConnectorPreviewState(connector).steps,
    safetyStatement: nonEmptyText(
      preview.safetyBoundary?.statement,
      createLocalConnectorPreviewState(connector).safetyStatement
    ),
    notice:
      "已从 /api/daily/connectors/:connectorId/preview 同步；响应声明 previewOnly=true 且 externalEffects=['none']。"
  };
}

export function createLocalWorkflowPreviewState(
  action: WorkflowActionItem
): WorkflowPreviewPanelState {
  return {
    workflowId: action.apiWorkflowId,
    actionId: action.apiActionId,
    source: "local",
    syncStatus: "idle",
    previewOnly: true,
    summary: `本地预演：${action.title} 只生成可复核计划，不执行连接器或外部写入。`,
    selectedActionStatus: action.approvalStatus,
    steps: [
      action.summary,
      action.nextStep,
      "等待用户确认后再把预演内容填入聊天输入框。"
    ],
    connectorLinks: [action.connector],
    contextLinks: [action.context],
    artifactLinks: [action.artifact],
    approvalLinks: [action.approvalStatus],
    safetyStatement:
      "Preview only: 当前工作流不会发送邮件、写入文档、创建日历或生成外部任务。",
    notice: "当前展示本地 workflow preview fallback；后端可用时会自动同步 API 预演。"
  };
}

export function mapWorkflowPreviewResponse(
  action: WorkflowActionItem,
  payload: DailyWorkflowPreviewResponseDto
): WorkflowPreviewPanelState {
  const preview = payload.preview;
  const externalEffects = preview?.externalEffects ?? [];

  if (
    payload.mode !== activeMode ||
    preview?.workflowId !== action.apiWorkflowId ||
    preview.selectedActionId !== action.apiActionId ||
    preview.previewOnly !== true ||
    externalEffects.some((effect) => effect !== "none")
  ) {
    throw new Error("Workflow preview response did not match the selected action.");
  }

  const localState = createLocalWorkflowPreviewState(action);
  const steps =
    preview.steps
      ?.map((step) =>
        [
          step.title,
          step.description ?? step.summary,
          step.suggestedNextStep
        ]
          .filter(Boolean)
          .join(" · ")
      )
      .filter((step) => step.trim().length > 0) ?? [];

  return {
    workflowId: action.apiWorkflowId,
    actionId: action.apiActionId,
    source: "api",
    syncStatus: "live",
    previewOnly: true,
    summary: nonEmptyText(preview.summary, localState.summary),
    selectedActionStatus: nonEmptyText(
      preview.selectedActionStatus,
      action.approvalStatus
    ),
    steps: steps.length > 0 ? steps : localState.steps,
    connectorLinks: formatWorkflowConnectorLinks(preview.connectorLinks),
    contextLinks: formatWorkflowContextLinks(preview.contextLinks),
    artifactLinks: formatWorkflowArtifactLinks(preview.artifactLinks),
    approvalLinks: formatWorkflowApprovalLinks(preview.approvalLinks),
    safetyStatement: nonEmptyText(
      preview.safetyBoundary?.statement,
      localState.safetyStatement
    ),
    notice:
      "已从 /api/daily/workflows/:workflowId/preview 同步；响应声明 previewOnly=true 且 externalEffects=['none']。"
  };
}

export function formatWorkflowConnectorLinks(
  links: DailyWorkflowPreviewConnectorLinkDto[] | undefined
) {
  const formatted =
    links
      ?.map((link) =>
        [link.displayName ?? link.connectorId, link.action].filter(Boolean).join(" / ")
      )
      .filter((link) => link.trim().length > 0) ?? [];

  return formatted.length > 0 ? formatted : ["无连接器动作"];
}

export function formatWorkflowContextLinks(
  links: DailyWorkflowPreviewContextLinkDto[] | undefined
) {
  const formatted =
    links
      ?.map((link) =>
        [link.title ?? link.contextItemId, link.usage].filter(Boolean).join(" / ")
      )
      .filter((link) => link.trim().length > 0) ?? [];

  return formatted.length > 0 ? formatted : ["无额外上下文"];
}

export function formatWorkflowArtifactLinks(
  links: DailyWorkflowPreviewArtifactLinkDto[] | undefined
) {
  const formatted =
    links
      ?.map((link) =>
        [link.title ?? link.artifactId, link.artifactType, link.status]
          .filter(Boolean)
          .join(" / ")
      )
      .filter((link) => link.trim().length > 0) ?? [];

  return formatted.length > 0 ? formatted : ["仅生成预演草稿"];
}

export function formatWorkflowApprovalLinks(
  links: DailyWorkflowPreviewApprovalLinkDto[] | undefined
) {
  const formatted =
    links
      ?.map((link) =>
        [link.title ?? link.approvalRequestId, link.status].filter(Boolean).join(" / ")
      )
      .filter((link) => link.trim().length > 0) ?? [];

  return formatted.length > 0 ? formatted : ["无新增审批"];
}

export function mapHealthPersistenceResponse(payload: unknown): PersistencePanelState {
  const snapshot = extractHealthPersistenceSnapshot(payload);
  const currentLayer = normalizePersistenceLayer(
    snapshot?.currentLayer ??
      snapshot?.current ??
      snapshot?.storage ??
      snapshot?.layer ??
      snapshot?.provider ??
      snapshot?.source
  );
  const isJsonLocalAvailable =
    currentLayer === "json_local" ||
    snapshot?.writable === true ||
    Boolean(snapshot?.path || snapshot?.filePath);
  const isDatabaseReady =
    currentLayer === "future_database" ||
    snapshot?.databaseReady === true ||
    snapshot?.futureDatabaseReady === true;
  const statusText = nonEmptyText(snapshot?.status, "");
  const healthSource = snapshot ? "health" : "fallback";
  const updatedAt =
    formatModelUsageTimestamp(snapshot?.updatedAt) ??
    (healthSource === "health" ? "刚刚同步" : "前端 fallback");

  return {
    layers: [
      {
        id: "seed_mock",
        label: "Seed / Mock",
        description: "启动 seed、mock 数据和前端示例快照。",
        status: currentLayer === "seed_mock" ? "active" : "available",
        detail:
          currentLayer === "seed_mock"
            ? "当前工作台仍以 seed/mock 作为日常工作数据来源。"
            : "保留为离线与 smoke fallback，不阻塞主流程。",
        icon: Sparkles
      },
      {
        id: "json_local",
        label: "JSON / Local",
        description: "本地 JSON 或文件型轻量持久化。",
        status:
          currentLayer === "json_local"
            ? "active"
            : isJsonLocalAvailable
              ? "available"
              : "unknown",
        detail: isJsonLocalAvailable
          ? nonEmptyText(snapshot?.path ?? snapshot?.filePath, "后端声明本地持久化可用。")
          : "未从 /health 读到本地 JSON 状态。",
        icon: HardDrive
      },
      {
        id: "future_database",
        label: "Future Database",
        description: "未来数据库持久化入口。",
        status:
          currentLayer === "future_database"
            ? "active"
            : isDatabaseReady
              ? "available"
              : "planned",
        detail: isDatabaseReady
          ? "后端健康检查声明数据库通道可用。"
          : "预留路线；本次不实现数据库后端。",
        icon: Server
      }
    ],
    source: healthSource,
    syncStatus: healthSource === "health" ? "live" : "degraded",
    currentLayer,
    updatedAt,
    notice:
      healthSource === "health"
        ? `已从 /health 同步数据层状态${statusText ? `：${statusText}` : "。"}`
        : "后端 health 暂未暴露数据层字段，界面使用 seed/mock fallback。"
  };
}

export function mapDailyModelUsageResponse(
  payload: DailyModelUsageResponseDto
): ModelUsagePanelState {
  if (payload.mode && payload.mode !== activeMode) {
    throw new Error(`Unsupported model usage mode: ${payload.mode}`);
  }

  const config = payload.config;
  const usage = payload.usage;
  const selectedRoute = normalizeModelRoute(config?.selectedRoute);
  const updatedAt = formatModelUsageUpdatedAt(usage?.updatedAt);
  const fastModel = nonEmptyText(config?.fastModel, modelSnapshots.fast.fastModel);
  const proModel = nonEmptyText(config?.proModel, modelSnapshots.pro.proModel);
  const provider = formatProviderLabel(config?.provider);
  const baseUrl = nonEmptyText(config?.baseUrl, modelSnapshots.fast.baseUrl);
  const thinkingMode = normalizeThinkingMode(config?.thinkingMode);
  const streamUsageEnabled = config?.streamUsageEnabled ?? false;
  const configured = config?.configured ?? false;
  const inputTokens = nonNegativeNumber(usage?.promptTokens);
  const outputTokens = nonNegativeNumber(usage?.completionTokens);
  const totalTokens =
    nonNegativeNumber(usage?.totalTokens) || inputTokens + outputTokens;
  const estimatedCost = formatEstimatedCost(
    nonNegativeNumber(usage?.estimatedCostUsd),
    usage?.currency
  );
  const budgetLevel = normalizeBudgetState(usage?.budgetState);
  const usageWindow = formatUsageWindow(usage?.window);
  const routeNote =
    selectedRoute === "fast"
      ? "后端当前 selectedRoute 为 fast；深度 tab 仅展示同一 daily_work 配置边界。"
      : "后端当前 selectedRoute 为 pro；快速 tab 仅展示同一 daily_work 配置边界。";
  const configNotes = [
    ...sanitizeNotes(config?.notes),
    routeNote,
    streamUsageEnabled
      ? "stream_options.include_usage 已开启，流式响应可返回 usage 块。"
      : "stream usage 未开启，流式响应可能不返回 usage 块。"
  ];
  const usageNotes = [
    "后端返回的是 daily_work rolling window 聚合用量，fast/pro 切换不代表独立账单。",
    configured
      ? "DeepSeek API Key 已在后端配置；前端不会展示或接触密钥。"
      : "后端未配置 DeepSeek API Key；当前 usage 仍是 mock/tracking 快照。"
  ];
  const nextModelSnapshots = (["fast", "pro"] as const).reduce(
    (snapshots, route) => {
      snapshots[route] = {
        ...modelSnapshots[route],
        currentMode: activeMode,
        provider,
        baseUrl,
        fastModel,
        proModel,
        selectedRoute,
        selectedModel: route === "pro" ? proModel : fastModel,
        thinkingMode,
        streamUsageEnabled,
        configured,
        updatedAt,
        notes: configNotes
      };

      return snapshots;
    },
    {} as Record<ModelRouteMode, ModelSnapshotItem>
  );
  const nextUsageSnapshots = (["fast", "pro"] as const).reduce(
    (snapshots, route) => {
      snapshots[route] = {
        ...usageSnapshots[route],
        usageWindow,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
        budgetState: budgetStateLabel(budgetLevel),
        budgetLevel,
        updatedAt,
        notes: usageNotes
      };

      return snapshots;
    },
    {} as Record<ModelRouteMode, UsageSnapshotItem>
  );

  return {
    modelSnapshots: nextModelSnapshots,
    usageSnapshots: nextUsageSnapshots,
    source: "api",
    syncStatus: "live",
    notice:
      "已从 /api/daily/model-usage?mode=daily_work 同步 DeepSeek 配置与用量，coding_agent 仅保留为边界说明。"
  };
}

export function getRuntimeApiBaseUrl() {
  if (typeof window === "undefined") {
    return defaultApiBaseUrl;
  }

  const smokeApiUrl = new URLSearchParams(window.location.search).get(
    "seekdeskSmokeApiUrl"
  );

  return smokeApiUrl || defaultApiBaseUrl;
}

export function getRuntimeWebSocketUrl(apiBaseUrl: string) {
  try {
    const url = new URL(
      apiBaseUrl,
      typeof window === "undefined" ? defaultApiBaseUrl : window.location.origin
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

export async function readAssistantResponse(
  response: Response,
  onDelta: (delta: string) => void
) {
  const mode = assistantResponseMode(response.headers.get("content-type") ?? "");

  if (mode === "json" || !response.body) {
    const content = extractAssistantTextPayload(await response.text());
    if (content) {
      onDelta(content);
    }
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  switch (mode) {
    case "sse":
      return readAssistantSseStream(reader, decoder, onDelta);
    case "ndjson":
      return readAssistantNdjsonStream(reader, decoder, onDelta);
    case "text":
      return readAssistantTextStream(reader, decoder, onDelta);
  }
}

async function readAssistantTextStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  onDelta: (delta: string) => void
) {
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const delta = decoder.decode(value, { stream: true });
    content += delta;
    onDelta(delta);
  }

  const finalChunk = decoder.decode();
  if (finalChunk) {
    content += finalChunk;
    onDelta(finalChunk);
  }

  return content;
}

async function readAssistantSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  onDelta: (delta: string) => void
) {
  let buffer = "";
  let dataLines: string[] = [];
  let content = "";

  const flushEvent = () => {
    if (!dataLines.length) {
      return;
    }

    const delta = extractAssistantTextPayload(dataLines.join("\n"));
    dataLines = [];

    if (!delta) {
      return;
    }

    content += delta;
    onDelta(delta);
  };

  const processLine = (line: string) => {
    if (!line.trim()) {
      flushEvent();
      return;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach(processLine);
  }

  buffer += decoder.decode();
  if (buffer) {
    buffer.split(/\r?\n/).forEach(processLine);
  }
  flushEvent();

  return content;
}

async function readAssistantNdjsonStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  onDelta: (delta: string) => void
) {
  let buffer = "";
  let content = "";

  const processLine = (line: string) => {
    const delta = extractAssistantTextPayload(line);
    if (!delta) {
      return;
    }

    content += delta;
    onDelta(delta);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach(processLine);
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    processLine(buffer);
  }

  return content;
}

export function assistantResponseMode(contentType: string): AssistantResponseMode {
  const normalized = contentType.toLowerCase();

  if (normalized.includes("text/event-stream")) {
    return "sse";
  }

  if (
    normalized.includes("application/x-ndjson") ||
    normalized.includes("application/jsonl") ||
    normalized.includes("ndjson")
  ) {
    return "ndjson";
  }

  if (normalized.includes("application/json")) {
    return "json";
  }

  return "text";
}

export async function formatChatError(response: Response) {
  const fallback = `请求失败：${response.status}`;

  try {
    const detail = extractAssistantTextPayload(await response.text());
    return detail ? `${fallback}：${detail}` : fallback;
  } catch {
    return fallback;
  }
}

export function extractAssistantTextPayload(payload: string): string {
  const trimmed = payload.trim();

  if (!trimmed || trimmed === "[DONE]") {
    return "";
  }

  if (!isJsonLike(trimmed)) {
    return payload;
  }

  try {
    return extractAssistantTextFromJson(JSON.parse(trimmed)) ?? "";
  } catch {
    return payload;
  }
}

export function extractAssistantTextFromJson(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return joinAssistantText(value.map(extractAssistantTextFromJson));
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of [
    "delta",
    "content",
    "text",
    "response",
    "message",
    "output_text",
    "error"
  ]) {
    if (typeof value[key] === "string") {
      return value[key];
    }
  }

  if (Array.isArray(value.choices)) {
    return joinAssistantText(
      value.choices.map((choice) => {
        if (!isRecord(choice)) {
          return null;
        }

        return (
          extractAssistantTextFromJson(choice.delta) ??
          extractAssistantTextFromJson(choice.message) ??
          extractAssistantTextFromJson(choice.text)
        );
      })
    );
  }

  return (
    extractAssistantTextFromJson(value.message) ??
    extractAssistantTextFromJson(value.delta) ??
    extractAssistantTextFromJson(value.output) ??
    extractAssistantTextFromJson(value.content)
  );
}

export function joinAssistantText(parts: Array<string | null>) {
  const content = parts.filter((part): part is string => Boolean(part)).join("");
  return content || null;
}

export function isJsonLike(value: string) {
  return (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  );
}

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

export function isRecord(value: unknown): value is Record<string, unknown> {
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

export function statusLabel(status: ChatStatus) {
  switch (status) {
    case "idle":
      return "空闲";
    case "submitting":
      return "连接中";
    case "streaming":
      return "接收中";
    case "error":
      return "出错";
  }
}

export function approvalStatusLabel(status: ApprovalStatus) {
  switch (status) {
    case "waiting":
      return "等待审批";
    case "allowed_once":
      return "允许一次";
    case "denied":
      return "拒绝";
    case "blocked":
      return "阻断";
  }
}

export function connectorPreviewApprovalStatus(
  connector: ConnectorItem | null,
  approvalRequestsForConnector: ApprovalRequestItem[]
): ApprovalStatus {
  if (!connector) {
    return "waiting";
  }

  if (connector.requiredApprovalIds.length === 0) {
    return "allowed_once";
  }

  if (approvalRequestsForConnector.some((request) => request.status === "blocked")) {
    return "blocked";
  }

  if (approvalRequestsForConnector.some((request) => request.status === "denied")) {
    return "denied";
  }

  if (
    approvalRequestsForConnector.length === connector.requiredApprovalIds.length &&
    approvalRequestsForConnector.every(
      (request) => request.status === "allowed_once"
    )
  ) {
    return "allowed_once";
  }

  return "waiting";
}

export function mapApprovalDecisionStatus(
  payload: DailyApprovalDecisionResponseDto
): ApprovalStatus {
  if (payload.request?.status === "approved") {
    return "allowed_once";
  }

  if (payload.request?.status === "denied") {
    return "denied";
  }

  return "waiting";
}

export function approvalStatusConfig(status: ApprovalStatus) {
  switch (status) {
    case "waiting":
      return {
        label: "等待中",
        className: "bg-amber-100 text-amber-800"
      };
    case "allowed_once":
      return {
        label: "允许一次",
        className: "bg-emerald-100 text-emerald-800"
      };
    case "denied":
      return {
        label: "已拒绝",
        className: "bg-slate-100 text-slate-700"
      };
    case "blocked":
      return {
        label: "已阻断",
        className: "bg-red-100 text-red-800"
      };
  }
}

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

export function artifactFilterCount(filter: ArtifactFilter, items: ArtifactItem[]) {
  if (filter === "全部") {
    return items.length;
  }

  return items.filter((artifact) => artifact.state === filter).length;
}

export function connectorFilterCount(filter: ConnectorFilter) {
  if (filter === "全部") {
    return connectorItems.length;
  }

  return connectorItems.filter((item) => connectorMatchesFilter(item, filter)).length;
}

export function workflowActionFilterCount(filter: WorkflowActionFilter) {
  if (filter === "全部") {
    return workflowActions.length;
  }

  return workflowActions.filter((item) => item.approvalStatus === filter).length;
}

export function connectorMatchesFilter(item: ConnectorItem, filter: ConnectorFilter) {
  switch (filter) {
    case "全部":
      return true;
    case "需审批":
      return item.permissionState === "需审批";
    case "可预览":
      return item.permissionState === "可预览";
  }
}

export function workflowActionStatusClass(status: WorkflowActionStatus) {
  switch (status) {
    case "待审批":
      return "bg-orange-100 text-orange-800";
    case "可预演":
      return "bg-emerald-100 text-emerald-800";
    case "需补上下文":
      return "bg-amber-100 text-amber-800";
  }
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
      return "前端 fallback";
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

export function connectorPermissionClass(state: ConnectorPermissionState) {
  switch (state) {
    case "未连接":
      return "bg-slate-100 text-slate-700";
    case "需审批":
      return "bg-orange-100 text-orange-800";
    case "可预览":
      return "bg-emerald-100 text-emerald-800";
  }
}

export function connectorRiskClass(riskLevel: ConnectorRiskLevel) {
  switch (riskLevel) {
    case "低":
      return "bg-emerald-100 text-emerald-800";
    case "中":
      return "bg-amber-100 text-amber-800";
    case "高":
      return "bg-red-100 text-red-800";
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

export function modelRouteLabel(mode: ModelRouteMode) {
  return mode === "fast" ? "快速" : "深度";
}

export function modelUsageSyncStatusLabel(status: ModelUsageSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 实况";
    case "degraded":
      return "降级快照";
  }
}

export function persistenceSyncStatusLabel(status: PersistencePanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "Health 已同步";
    case "degraded":
      return "Fallback";
  }
}

export function persistenceLayerStatusLabel(status: PersistenceLayerStatus) {
  switch (status) {
    case "active":
      return "当前";
    case "available":
      return "可用";
    case "planned":
      return "预留";
    case "unknown":
      return "未声明";
  }
}

export function persistenceLayerStatusClass(status: PersistenceLayerStatus) {
  switch (status) {
    case "active":
      return "border-teal-300 bg-teal-50 text-teal-900";
    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "planned":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "unknown":
      return "border-orange-200 bg-orange-50 text-orange-800";
  }
}

export function normalizePersistenceLayer(value: string | undefined): PersistenceLayerId {
  const normalized = value?.trim().toLowerCase().replace(/[-\s]/g, "_");

  if (
    normalized === "json" ||
    normalized === "local" ||
    normalized === "json_local" ||
    normalized === "local_json" ||
    normalized === "file" ||
    normalized === "filesystem"
  ) {
    return "json_local";
  }

  if (
    normalized === "database" ||
    normalized === "db" ||
    normalized === "future_database" ||
    normalized === "postgres" ||
    normalized === "postgresql" ||
    normalized === "sqlite"
  ) {
    return "future_database";
  }

  return "seed_mock";
}

export function extractHealthPersistenceSnapshot(
  payload: unknown
): HealthPersistenceSnapshotDto | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const nested =
    readRecord(payload.persistence) ??
    readRecord(payload.dataLayer) ??
    readRecord(payload.storage) ??
    readRecord(payload.dailyWorkPersistence);
  const candidate = nested ?? payload;

  if (!hasPersistenceSignal(candidate)) {
    return undefined;
  }

  return candidate as HealthPersistenceSnapshotDto;
}

export function hasPersistenceSignal(value: Record<string, unknown>) {
  return [
    "current",
    "currentLayer",
    "storage",
    "layer",
    "provider",
    "source",
    "writable",
    "path",
    "filePath",
    "databaseReady",
    "futureDatabaseReady"
  ].some((key) => key in value);
}

export function readRecord(value: unknown) {
  return isRecord(value) && !Array.isArray(value) ? value : undefined;
}

export function normalizeModelRoute(value: ModelRouteMode | undefined): ModelRouteMode {
  return value === "pro" ? "pro" : "fast";
}

export function normalizeThinkingMode(value: ThinkingMode | undefined): ThinkingMode {
  return value === "enabled" ? "enabled" : "disabled";
}

export function normalizeBudgetState(
  value: ModelUsageBudgetState | undefined
): ModelUsageBudgetState {
  return value ?? "tracking_only";
}

export function budgetStateLabel(state: ModelUsageBudgetState) {
  switch (state) {
    case "disabled":
      return "用量关闭";
    case "tracking_only":
      return "仅追踪 / 示例";
    case "within_budget":
      return "预算正常";
    case "approaching_limit":
      return "接近阈值";
    case "over_budget":
      return "超出预算";
  }
}

export function budgetStatePercent(state: ModelUsageBudgetState) {
  switch (state) {
    case "disabled":
      return 0;
    case "tracking_only":
      return 32;
    case "within_budget":
      return 48;
    case "approaching_limit":
      return 78;
    case "over_budget":
      return 100;
  }
}

export function nonEmptyText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function nonNegativeNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function sanitizeNotes(notes: string[] | undefined) {
  return notes?.filter((note) => note.trim().length > 0) ?? [];
}

export function formatProviderLabel(provider: string | undefined) {
  return provider?.toLowerCase() === "deepseek" ? "DeepSeek" : nonEmptyText(provider, "DeepSeek");
}

export function formatEstimatedCost(value: number, currency: string | undefined) {
  const currencyLabel = currency === "USD" || !currency ? "$" : `${currency} `;
  return `估算 ${currencyLabel}${value.toFixed(4)}`;
}

export function formatUsageWindow(window: DailyModelUsageWindowDto | undefined) {
  if (!window) {
    return "daily_work rolling window";
  }

  const label = nonEmptyText(window.label, "daily_work rolling window");
  const startedAt = formatModelUsageTimestamp(window.startedAt);
  const endedAt = formatModelUsageTimestamp(window.endedAt);

  if (!startedAt || !endedAt) {
    return label;
  }

  return `${label} / ${startedAt} - ${endedAt}`;
}

export function formatModelUsageUpdatedAt(value: string | undefined) {
  return formatModelUsageTimestamp(value) ?? "刚刚同步";
}

export function formatModelUsageTimestamp(value: string | undefined) {
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

export function formatTokenCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function buildModelSwitchPrompt(
  modelSnapshot: ModelSnapshotItem,
  usageSnapshot: UsageSnapshotItem
) {
  return [
    `请按“${modelRouteLabel(modelSnapshot.id)}”示例模式继续这个 daily_work 会话。`,
    "",
    `模型快照：Provider ${modelSnapshot.provider}，当前展示模型 ${modelSnapshot.selectedModel}，后端路由 ${modelRouteLabel(
      modelSnapshot.selectedRoute
    )}，thinking ${modelSnapshot.thinkingMode}，stream usage ${
      modelSnapshot.streamUsageEnabled ? "enabled" : "disabled"
    }。`,
    `用量快照：${usageSnapshot.usageWindow}，输入 ${formatTokenCount(
      usageSnapshot.inputTokens
    )} tokens，输出 ${formatTokenCount(
      usageSnapshot.outputTokens
    )} tokens，合计 ${formatTokenCount(usageSnapshot.totalTokens)} tokens，${
      usageSnapshot.estimatedCost
    }。`,
    "说明：当前页面固定消费 daily_work；coding_agent 仅作为兼容边界，不在这里切换。"
  ].join("\n");
}

export function buildConnectorAccessPrompt(item: ConnectorItem) {
  return [
    `请为「${item.name}」设计 daily_work 连接器接入方案。`,
    "",
    "重要边界：当前 SeekDesk 只做连接器目录和权限预演，未接真实授权、登录或外部服务；不要读取真实文档、日历、邮件、笔记或团队知识库。",
    "",
    `类别：${item.category}`,
    `Provider：${item.provider}`,
    `当前状态：${item.status}`,
    `权限状态：${item.permissionState}`,
    `风险等级：${item.riskLevel}`,
    `最近同步：${item.lastSyncLabel}`,
    `可用动作：${item.availableActions.join("、")}`,
    `说明：${item.description}`,
    `注意事项：${item.notes.join("；")}`,
    "",
    "请输出：最小权限范围、用户审批点、可预览字段、拒绝/撤销路径，以及接入前需要补齐的产品文案。"
  ].join("\n");
}

export function buildWorkflowPreviewPrompt(
  item: WorkflowActionItem,
  preview: WorkflowPreviewPanelState
) {
  return [
    `请基于「${item.title}」继续 daily_work 工作流预演。`,
    "",
    `后端来源：${preview.source} / ${preview.syncStatus}`,
    `Workflow：${preview.workflowId}`,
    `Action：${preview.actionId}`,
    `当前状态：${preview.selectedActionStatus}`,
    `预演摘要：${preview.summary}`,
    "",
    `连接器链路：${preview.connectorLinks.join("；")}`,
    `上下文链路：${preview.contextLinks.join("；")}`,
    `产物链路：${preview.artifactLinks.join("；")}`,
    `审批链路：${preview.approvalLinks.join("；")}`,
    "",
    "预演步骤：",
    ...preview.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    `安全边界：${preview.safetyStatement}`,
    "模式边界：保持 daily_work，不调用 coding_agent 工具，不发送邮件、不写入文档、不创建日历或任务。",
    "",
    "请输出：最小上下文、可复核草稿结构、审批检查点、风险项，以及用户确认后才可继续的下一步。"
  ].join("\n");
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
