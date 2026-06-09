import {
  FileText,
  Globe,
  Mail,
  Presentation,
  ShieldCheck,
  Target,
  type LucideIcon
} from "lucide-react";

import { activeMode } from "./base";
import { formatSessionHistoryTimestamp, sanitizeSessionIds } from "./sessions";
import type {
  ContextItem,
  ContextPanelState,
  ContextPreviewPanelState,
  ContextPreviewSyncStatus,
  DailyContextItemDto,
  DailyContextResponseDto,
  DailyContextUsePreviewResponseDto
} from "../types";
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
      "正在从 /api/daily/context?mode=daily_work 同步会话知识上下文；连接完成前先展示本地快照。",
    preview: createLocalContextPreviewState(null)
  };
}

export function createLocalContextPreviewState(
  item: ContextItem | null,
  syncStatus: ContextPreviewSyncStatus = "idle",
  notice = "尚未调用上下文预演；点击上下文后会生成仅预览的输入框提示。"
): ContextPreviewPanelState {
  return {
    contextItemId: item?.id ?? "",
    source: "fallback",
    syncStatus,
    previewOnly: true,
    externalEffects: ["none"],
    safetyStatement:
      "仅预览：当前上下文引用只填入输入框，不读取真实外部文件、不发送邮件、不写入文档或日历。",
    promptDraft: item ? item.prompt : "",
    generatedAt: "本地示例",
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
      "仅预览：后端声明上下文预演不会产生外部效果。"
    ),
    promptDraft: nonEmptyText(preview.promptDraft, item.prompt),
    generatedAt: formatSessionHistoryTimestamp(preview.generatedAt),
    notice:
      "已从 /api/daily/context/:contextItemId/use-preview 同步；后端声明这是仅预览提示，不会产生外部效果。"
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
    case "uploaded_document":
      return `Uploaded document API${tagText}`;
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
    case "uploaded_document":
      return "Uploaded document";
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

function nonEmptyText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}
