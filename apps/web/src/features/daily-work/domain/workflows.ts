import { CalendarClock, FileText, Mail, Presentation } from "lucide-react";

import { activeMode } from "./base";
import type {
  DailyWorkflowPreviewApprovalLinkDto,
  DailyWorkflowPreviewArtifactLinkDto,
  DailyWorkflowPreviewConnectorLinkDto,
  DailyWorkflowPreviewContextLinkDto,
  DailyWorkflowPreviewResponseDto,
  WorkflowActionFilter,
  WorkflowActionItem,
  WorkflowActionStatus,
  WorkflowPreviewPanelState
} from "../types";

function nonEmptyText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

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
      "仅预览：当前工作流不会发送邮件、写入文档、创建日历或生成外部任务。",
    notice: "当前展示本地工作流预演；后端可用时会自动同步 API 预演。"
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
      "已从 /api/daily/workflows/:workflowId/preview 同步；后端声明这是仅预览工作流，不会产生外部效果。"
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

export function workflowActionFilterCount(filter: WorkflowActionFilter) {
  if (filter === "全部") {
    return workflowActions.length;
  }

  return workflowActions.filter((item) => item.approvalStatus === filter).length;
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

export function buildWorkflowPreviewPrompt(
  item: WorkflowActionItem,
  preview: WorkflowPreviewPanelState
) {
  return [
    `请基于「${item.title}」继续 daily_work 工作流预演。`,
    "",
    `预演来源：${workflowPreviewSourceText(preview.source)} / ${workflowPreviewSyncText(preview.syncStatus)}`,
    `工作流：${preview.workflowId}`,
    `动作：${preview.actionId}`,
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

function workflowPreviewSourceText(source: WorkflowPreviewPanelState["source"]) {
  if (source === "api") {
    return "后端同步";
  }

  if (source === "degraded") {
    return "本地回退";
  }

  return "本地预演";
}

function workflowPreviewSyncText(status: WorkflowPreviewPanelState["syncStatus"]) {
  if (status === "live") {
    return "已同步";
  }

  if (status === "syncing") {
    return "同步中";
  }

  if (status === "idle") {
    return "待触发";
  }

  return "已降级";
}
