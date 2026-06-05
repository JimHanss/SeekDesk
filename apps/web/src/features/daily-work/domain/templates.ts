import {
  CalendarClock,
  FileText,
  Mail,
  Presentation,
  Search,
  Target,
  type LucideIcon
} from "lucide-react";

import { activeMode } from "./base";
import type {
  DailyWorkTemplateApplyPreviewResponseDto,
  DailyWorkTemplateDto,
  DailyWorkTemplatesResponseDto,
  TemplateItem,
  TemplatePanelState,
  TemplatePreviewPanelState,
  TemplatePreviewSyncStatus
} from "../types";
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
      "正在从 /api/daily/templates?mode=daily_work 同步模板库；连接完成前先展示本地示例。",
    preview: createLocalTemplatePreviewState(templates[0] ?? null)
  };
}

export function createLocalTemplatePreviewState(
  template: TemplateItem | null,
  syncStatus: TemplatePreviewSyncStatus = "idle",
  notice = "尚未调用模板预演；点击模板后会优先生成仅预览的输入框草稿。"
): TemplatePreviewPanelState {
  return {
    templateId: template?.id ?? "",
    source: "fallback",
    syncStatus,
    previewOnly: true,
    externalEffects: ["none"],
    safetyStatement:
      "仅预览：当前模板操作只把草稿填入输入框，不发送邮件、不写入文档、不创建日历或任务，也不触发任何外部工具。",
    promptDraft: template?.prompt ?? "",
    generatedAt: "本地示例",
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
      "仅预览：后端声明模板预演不会产生外部效果。"
    ),
    promptDraft: nonEmptyText(preview.promptDraft, template.prompt),
    generatedAt:
      formatModelUsageTimestamp(preview.generatedAt) ??
      nonEmptyText(preview.generatedAt, "刚刚同步"),
    notice:
      "已从 /api/daily/templates/:templateId/apply-preview 同步；后端声明这是仅预览草稿，不会产生外部效果。"
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
