import { z } from "zod";

import { appModeSchema } from "./app-modes.js";

export const templateCategorySchema = z.enum([
  "triage",
  "planning",
  "execution",
  "review",
  "handoff",
  "writing",
  "research",
  "knowledge"
]);

export const artifactTypeSchema = z.enum([
  "brief",
  "checklist",
  "status_update",
  "handoff_note",
  "decision_log",
  "email_draft",
  "meeting_summary",
  "research_note",
  "task_list",
  "weekly_report"
]);

export const dailyWorkTemplateSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  category: templateCategorySchema,
  title: z.string(),
  description: z.string(),
  prompt: z.string(),
  artifactType: artifactTypeSchema.optional(),
  tags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true)
});

export const dailyWorkArtifactSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  artifactType: artifactTypeSchema,
  title: z.string(),
  description: z.string(),
  templateId: z.string().optional(),
  summary: z.string(),
  tags: z.array(z.string()).default([])
});

export const dailyWorkTemplatesResponseSchema = z.object({
  mode: appModeSchema,
  templates: z.array(dailyWorkTemplateSchema)
});

export const dailyWorkArtifactsResponseSchema = z.object({
  mode: appModeSchema,
  artifacts: z.array(dailyWorkArtifactSchema)
});

export const defaultDailyWorkTemplates: DailyWorkTemplate[] = [
  {
    id: "email-draft",
    mode: "daily_work",
    category: "writing",
    title: "邮件起草",
    description:
      "把项目进展、决策和下一步整理成专业邮件。",
    prompt:
      "帮我起草一封简洁专业的邮件，说明进展、关键决定和下一步行动。",
    artifactType: "email_draft",
    tags: ["email", "writing", "stakeholder"],
    enabled: true
  },
  {
    id: "meeting-summary",
    mode: "daily_work",
    category: "review",
    title: "会议纪要",
    description:
      "从会议记录中提取决策、待办、负责人和风险。",
    prompt:
      "请把会议记录整理成可分享纪要，包含概览、关键决策、待办事项和开放问题。",
    artifactType: "meeting_summary",
    tags: ["meeting", "summary", "actions"],
    enabled: true
  },
  {
    id: "research-brief",
    mode: "daily_work",
    category: "research",
    title: "资料研究",
    description:
      "把调研素材压缩成一页决策导向的简报。",
    prompt:
      "请生成一份资料研究简报，包含问题背景、已知信息、仍需验证的内容和建议下一步。",
    artifactType: "research_note",
    tags: ["research", "brief", "decision"],
    enabled: true
  },
  {
    id: "weekly-report",
    mode: "daily_work",
    category: "review",
    title: "周报整理",
    description:
      "总结进展、成果、风险和下周优先级。",
    prompt:
      "请整理一份周报，结构为本周进展、主要成果、风险/阻塞和下周优先级。",
    artifactType: "weekly_report",
    tags: ["weekly", "status", "review"],
    enabled: true
  },
  {
    id: "task-plan",
    mode: "daily_work",
    category: "planning",
    title: "任务计划",
    description:
      "把目标拆成阶段、下一步动作、依赖和风险。",
    prompt:
      "请为这个目标制定任务计划，列出阶段、接下来 5 个可执行动作、依赖、风险和验收标准。",
    artifactType: "task_list",
    tags: ["planning", "tasks", "execution"],
    enabled: true
  },
  {
    id: "knowledge-qa",
    mode: "daily_work",
    category: "knowledge",
    title: "知识问答",
    description:
      "基于上下文回答问题，并指出信息缺口。",
    prompt:
      "请仅基于我提供的上下文回答问题。如果上下文不足，请说明缺少什么，并只追问最少必要信息。",
    artifactType: "brief",
    tags: ["knowledge", "qa", "context"],
    enabled: true
  }
] as const as DailyWorkTemplate[];

export const defaultDailyWorkArtifacts: DailyWorkArtifact[] = [
  {
    id: "meeting-summary-artifact",
    mode: "daily_work",
    artifactType: "meeting_summary",
    title: "会议摘要",
    description: "关键决策、风险和下一步行动的清晰回顾。",
    templateId: "meeting-summary",
    summary: "适合分享给团队的会议结论与行动项。",
    tags: ["meeting", "summary", "actions"]
  },
  {
    id: "task-list-artifact",
    mode: "daily_work",
    artifactType: "task_list",
    title: "任务清单",
    description: "带负责人、时限和依赖关系的可执行事项。",
    templateId: "task-plan",
    summary: "把目标拆解为可跟进的下一步动作。",
    tags: ["tasks", "planning", "execution"]
  },
  {
    id: "email-draft-artifact",
    mode: "daily_work",
    artifactType: "email_draft",
    title: "邮件草稿",
    description: "可继续润色或复制给利益相关人的更新。",
    templateId: "email-draft",
    summary: "面向客户、团队或管理者的专业邮件初稿。",
    tags: ["email", "writing", "draft"]
  },
  {
    id: "research-note-artifact",
    mode: "daily_work",
    artifactType: "research_note",
    title: "研究笔记",
    description: "浓缩发现、引用方向和待验证问题。",
    templateId: "research-brief",
    summary: "沉淀可复用的调研结论和信息缺口。",
    tags: ["research", "knowledge", "brief"]
  }
] as const as DailyWorkArtifact[];

export type DailyWorkTemplate = z.infer<typeof dailyWorkTemplateSchema>;
export type DailyWorkArtifact = z.infer<typeof dailyWorkArtifactSchema>;
export type DailyWorkTemplatesResponse = z.infer<
  typeof dailyWorkTemplatesResponseSchema
>;
export type DailyWorkArtifactsResponse = z.infer<
  typeof dailyWorkArtifactsResponseSchema
>;
export type TemplateCategory = z.infer<typeof templateCategorySchema>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;
