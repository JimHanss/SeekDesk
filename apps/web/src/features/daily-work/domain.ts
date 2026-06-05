import {
  CalendarClock,
  FileText,
  Globe,
  HardDrive,
  Mail,
  MessageSquare,
  Presentation,
  Server,
  ShieldCheck,
  Sparkles,
  Workflow
} from "lucide-react";

import type {
  ChatStatus,
  ChatMessage,
  TemplatePanelSource,
  TemplatePanelSyncStatus,
  TemplatePreviewSource,
  TemplatePreviewSyncStatus,
  SessionHistoryStatus,
  SessionHistoryFilter,
  SessionHistoryPanelSource,
  SessionHistoryPanelSyncStatus,
  SessionRestorePreviewSource,
  SessionRestorePreviewSyncStatus,
  SessionHistoryItem,
  ArtifactState,
  ArtifactFilter,
  ArtifactItem,
  ContextItem,
  ContextPanelSource,
  ContextPanelSyncStatus,
  ContextPreviewSource,
  ContextPreviewSyncStatus,
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
  ApprovalPanelSource,
  ApprovalPanelSyncStatus,
  ModelRouteMode,
  ThinkingMode,
  ModelUsageBudgetState,
  ModelUsageSyncStatus,
  PersistenceLayerId,
  PersistenceLayerStatus,
  PersistencePanelSyncStatus,
  ModelSnapshotItem,
  UsageSnapshotItem,
  DailyModelUsageWindowDto,
  DailyModelUsageResponseDto,
  ConnectorActionPreviewResponseDto,
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
import { activeMode } from "./domain/base";
import { contextItems } from "./domain/context";

export * from "./domain/approvals";
export * from "./domain/assistant-stream";
export * from "./domain/artifacts";
export * from "./domain/base";
export * from "./domain/context";
export * from "./domain/runtime";
export * from "./domain/sessions";
export * from "./domain/templates";

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

export const initialMessages: ChatMessage[] = [];

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
