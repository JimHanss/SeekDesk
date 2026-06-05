import {
  AlertCircle,
  CalendarClock,
  FileText,
  Mail,
  Presentation,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";

import { activeMode } from "./base";
import type {
  ApprovalPanelState,
  ApprovalRequestItem,
  ApprovalRisk,
  ApprovalStatus,
  ConnectorItem,
  DailyApprovalDecisionResponseDto,
  DailyApprovalRequestDto,
  DailyApprovalRequestsResponseDto
} from "../types";

function nonEmptyText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

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
