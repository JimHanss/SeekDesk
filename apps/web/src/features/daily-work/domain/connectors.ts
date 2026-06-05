import {
  CalendarClock,
  FileText,
  Globe,
  Mail,
  MessageSquare
} from "lucide-react";

import { activeMode } from "./base";
import type {
  ConnectorActionPreviewResponseDto,
  ConnectorFilter,
  ConnectorItem,
  ConnectorPermissionState,
  ConnectorPreviewPanelState,
  ConnectorRiskLevel
} from "../types";

function nonEmptyText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
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
      "仅预览：当前界面不会登录、读取、写入、发送或创建任何外部记录。",
    notice: "当前展示本地仅预览方案；后端可用时会自动同步 API 预览。"
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
      `已从后端同步 ${connector.name} 的仅预览动作计划。`
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
      "已从 /api/daily/connectors/:connectorId/preview 同步；后端声明这是仅预览动作计划，不会产生外部效果。"
  };
}

export function connectorFilterCount(filter: ConnectorFilter) {
  if (filter === "全部") {
    return connectorItems.length;
  }

  return connectorItems.filter((item) => connectorMatchesFilter(item, filter)).length;
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

export function buildConnectorAccessPrompt(item: ConnectorItem) {
  return [
    `请为「${item.name}」设计 daily_work 连接器接入方案。`,
    "",
    "重要边界：当前 SeekDesk 只做连接器目录和权限预演，未接真实授权、登录或外部服务；不要读取真实文档、日历、邮件、笔记或团队知识库。",
    "",
    `类别：${item.category}`,
    `服务商：${item.provider}`,
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
