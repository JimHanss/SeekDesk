import {
  CalendarClock,
  FileText,
  Mail,
  Presentation,
  Search,
  Workflow,
  type LucideIcon
} from "lucide-react";

import { activeMode } from "./base";
import { templates } from "./templates";
import type {
  ArtifactFilter,
  ArtifactItem,
  ArtifactPanelState,
  ArtifactState,
  ArtifactTraceItem,
  DailyWorkArtifactDto,
  DailyWorkArtifactNextActionDto,
  DailyWorkArtifactResponseDto,
  DailyWorkArtifactsResponseDto
} from "../types";
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

function nonEmptyText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
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