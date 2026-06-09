import { z } from "zod";

import { appModeSchema } from "./app-modes.js";
import { modelRouteSchema } from "./model-usage.js";

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

export const dailyWorkArtifactStatusSchema = z.enum([
  "draft",
  "review",
  "ready",
  "reusable",
  "archived"
]);

export const dailyWorkArtifactPermissionStateSchema = z.enum([
  "public",
  "workspace_shared",
  "requires_review",
  "restricted"
]);

export const dailyWorkArtifactNextActionTypeSchema = z.enum([
  "continue_draft",
  "request_review",
  "approve_for_use",
  "reuse_in_template",
  "archive"
]);

export const dailyWorkArtifactTraceOriginSchema = z.enum([
  "template",
  "daily_chat",
  "manual"
]);

export const dailyWorkArtifactTraceEventTypeSchema = z.enum([
  "created",
  "context_linked",
  "approval_linked",
  "status_changed",
  "marked_reusable"
]);

export const dailyWorkArtifactOwnerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  team: z.string().optional()
});

export const dailyWorkArtifactNextActionSchema = z.object({
  type: dailyWorkArtifactNextActionTypeSchema,
  label: z.string(),
  description: z.string().optional(),
  approvalRequestId: z.string().optional(),
  dueAt: z.string().datetime().optional()
});

export const dailyWorkArtifactTraceEventSchema = z.object({
  at: z.string().datetime(),
  actor: z.string(),
  type: dailyWorkArtifactTraceEventTypeSchema,
  summary: z.string()
});

export const dailyWorkArtifactLifecycleEventSchema =
  dailyWorkArtifactTraceEventSchema;

export const dailyWorkArtifactTraceSchema = z.object({
  origin: dailyWorkArtifactTraceOriginSchema,
  createdAt: z.string().datetime(),
  createdBy: z.string(),
  events: z.array(dailyWorkArtifactTraceEventSchema).default([])
});

export const dailyWorkTemplateStatusSchema = z.enum([
  "active",
  "disabled",
  "archived"
]);

export const dailyWorkTemplateContextPolicySchema = z.object({
  maxContextTokens: z.number().int().positive().max(50000).default(12000),
  includeSelectedContext: z.boolean().default(true),
  includeRecentSession: z.boolean().default(true),
  includeArtifacts: z.boolean().default(true)
});

export const dailyWorkTemplateSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  category: templateCategorySchema,
  title: z.string(),
  description: z.string(),
  prompt: z.string(),
  systemPrompt: z.string().default(""),
  promptTemplate: z.string().optional(),
  defaultModelRoute: modelRouteSchema.default("fast"),
  allowedToolNames: z.array(z.string()).default(["daily.persist_artifact"]),
  contextPolicy: dailyWorkTemplateContextPolicySchema.default({
    maxContextTokens: 12000,
    includeSelectedContext: true,
    includeRecentSession: true,
    includeArtifacts: true
  }),
  status: dailyWorkTemplateStatusSchema.default("active"),
  artifactType: artifactTypeSchema.optional(),
  tags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  version: z.number().int().positive().default(1),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().default(() => new Date().toISOString())
});

export const dailyWorkArtifactSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  artifactType: artifactTypeSchema,
  title: z.string(),
  description: z.string(),
  templateId: z.string().optional(),
  summary: z.string(),
  status: dailyWorkArtifactStatusSchema,
  owner: dailyWorkArtifactOwnerSchema,
  updatedAt: z.string().datetime(),
  sourceContextIds: z.array(z.string()).default([]),
  approvalRequestIds: z.array(z.string()).default([]),
  version: z.number().int().positive(),
  reusable: z.boolean().default(false),
  nextAction: dailyWorkArtifactNextActionSchema.nullable(),
  permissionState: dailyWorkArtifactPermissionStateSchema,
  trace: dailyWorkArtifactTraceSchema,
  lifecycle: z.array(dailyWorkArtifactLifecycleEventSchema).default([]),
  tags: z.array(z.string()).default([])
});

export const dailyWorkTemplatesResponseSchema = z.object({
  mode: appModeSchema,
  templates: z.array(dailyWorkTemplateSchema)
});

export const dailyWorkTemplateCreateRequestSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  category: templateCategorySchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  prompt: z.string().trim().min(1).max(10000),
  systemPrompt: z.string().trim().max(4000).default(""),
  promptTemplate: z.string().trim().max(10000).optional(),
  defaultModelRoute: modelRouteSchema.default("fast"),
  allowedToolNames: z.array(z.string().trim().min(1)).max(30).default(["daily.persist_artifact"]),
  contextPolicy: dailyWorkTemplateContextPolicySchema.default({
    maxContextTokens: 12000,
    includeSelectedContext: true,
    includeRecentSession: true,
    includeArtifacts: true
  }),
  artifactType: artifactTypeSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  status: dailyWorkTemplateStatusSchema.default("active"),
  enabled: z.boolean().default(true)
});

export const dailyWorkTemplateUpdateRequestSchema = dailyWorkTemplateCreateRequestSchema
  .partial()
  .extend({ mode: appModeSchema.default("daily_work") });

export const dailyWorkTemplateDuplicateRequestSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  title: z.string().trim().min(1).max(120).optional()
});

export const dailyWorkArtifactsResponseSchema = z.object({
  mode: appModeSchema,
  artifacts: z.array(dailyWorkArtifactSchema)
});

export const dailyWorkArtifactResponseSchema = z.object({
  mode: appModeSchema,
  artifact: dailyWorkArtifactSchema
});

export const dailyWorkTemplateApplyPreviewRequestSchema = z.object({
  mode: appModeSchema.default("daily_work"),
  prompt: z.string().trim().min(1).max(2000).optional(),
  contextItemIds: z.array(z.string().trim().min(1)).default([])
});

export const dailyWorkTemplateApplyPreviewStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  previewOnly: z.literal(true).default(true),
  externalEffect: z.literal("none").default("none")
});

export const dailyWorkTemplateApplyPreviewSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  templateId: z.string(),
  templateTitle: z.string(),
  category: templateCategorySchema,
  artifactType: artifactTypeSchema.optional(),
  promptDraft: z.string(),
  requestedContextItemIds: z.array(z.string()).default([]),
  suggestedArtifactType: artifactTypeSchema,
  requiredApprovalRequestIds: z.array(z.string()).default([]),
  steps: z.array(dailyWorkTemplateApplyPreviewStepSchema).default([]),
  previewOnly: z.literal(true).default(true),
  externalEffects: z.array(z.literal("none")).default(["none"]),
  safetyBoundary: z.object({
    previewOnly: z.literal(true).default(true),
    externalEffects: z.array(z.literal("none")).default(["none"]),
    prohibitedExternalActions: z
      .array(
        z.enum([
          "send_email",
          "write_document",
          "schedule_calendar_event",
          "create_task",
          "read_private_external_data",
          "create_artifact"
        ])
      )
      .default([
        "send_email",
        "write_document",
        "schedule_calendar_event",
        "create_task",
        "read_private_external_data",
        "create_artifact"
      ]),
    statement: z.string()
  }),
  generatedAt: z.string().datetime()
});

export const dailyWorkTemplateApplyPreviewResponseSchema = z.object({
  mode: appModeSchema,
  preview: dailyWorkTemplateApplyPreviewSchema
});

export const defaultDailyWorkTemplates: DailyWorkTemplate[] = dailyWorkTemplateSchema.array().parse([
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
]);

export const defaultDailyWorkArtifacts: DailyWorkArtifact[] = [
  {
    id: "meeting-summary-artifact",
    mode: "daily_work",
    artifactType: "meeting_summary",
    title: "会议摘要",
    description: "关键决策、风险和下一步行动的清晰回顾。",
    templateId: "meeting-summary",
    summary: "适合分享给团队的会议结论与行动项。",
    status: "ready",
    owner: {
      id: "daily-work-agent",
      displayName: "SeekDesk Daily Agent",
      team: "daily-work"
    },
    updatedAt: "2026-06-02T09:15:00.000Z",
    sourceContextIds: ["meeting-notes", "team-notes"],
    approvalRequestIds: ["use-internal-meeting-notes"],
    version: 2,
    reusable: true,
    nextAction: {
      type: "reuse_in_template",
      label: "Reuse meeting summary",
      description: "Use this reviewed summary as the base for a handoff or weekly report."
    },
    permissionState: "workspace_shared",
    trace: {
      origin: "template",
      createdAt: "2026-06-01T08:30:00.000Z",
      createdBy: "daily-work-agent",
      events: [
        {
          at: "2026-06-01T08:30:00.000Z",
          actor: "daily-work-agent",
          type: "created",
          summary: "Created from the meeting-summary template."
        },
        {
          at: "2026-06-02T09:15:00.000Z",
          actor: "team-reviewer",
          type: "status_changed",
          summary: "Marked ready after workspace review."
        }
      ]
    },
    lifecycle: [
      {
        at: "2026-06-01T08:30:00.000Z",
        actor: "daily-work-agent",
        type: "created",
        summary: "Created from the meeting-summary template."
      },
      {
        at: "2026-06-02T09:15:00.000Z",
        actor: "team-reviewer",
        type: "status_changed",
        summary: "Marked ready after workspace review."
      }
    ],
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
    status: "review",
    owner: {
      id: "project-owner",
      displayName: "Project Owner",
      team: "operations"
    },
    updatedAt: "2026-06-02T10:45:00.000Z",
    sourceContextIds: ["project-brief", "meeting-notes"],
    approvalRequestIds: ["schedule-calendar-follow-up"],
    version: 1,
    reusable: false,
    nextAction: {
      type: "approve_for_use",
      label: "Approve follow-up plan",
      description: "Confirm the follow-up schedule before the task list is ready.",
      approvalRequestId: "schedule-calendar-follow-up"
    },
    permissionState: "workspace_shared",
    trace: {
      origin: "template",
      createdAt: "2026-06-02T10:30:00.000Z",
      createdBy: "project-owner",
      events: [
        {
          at: "2026-06-02T10:30:00.000Z",
          actor: "project-owner",
          type: "created",
          summary: "Created from the task-plan template."
        },
        {
          at: "2026-06-02T10:45:00.000Z",
          actor: "daily-work-agent",
          type: "approval_linked",
          summary: "Linked calendar follow-up approval request."
        }
      ]
    },
    lifecycle: [
      {
        at: "2026-06-02T10:30:00.000Z",
        actor: "project-owner",
        type: "created",
        summary: "Created from the task-plan template."
      },
      {
        at: "2026-06-02T10:45:00.000Z",
        actor: "daily-work-agent",
        type: "approval_linked",
        summary: "Linked calendar follow-up approval request."
      }
    ],
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
    status: "draft",
    owner: {
      id: "account-owner",
      displayName: "Account Owner",
      team: "customer-success"
    },
    updatedAt: "2026-06-02T11:20:00.000Z",
    sourceContextIds: ["customer-email", "meeting-notes"],
    approvalRequestIds: [
      "read-customer-email-context",
      "draft-external-reply"
    ],
    version: 1,
    reusable: false,
    nextAction: {
      type: "request_review",
      label: "Request external reply review",
      description: "Review the customer-facing draft before it can be shared.",
      approvalRequestId: "draft-external-reply"
    },
    permissionState: "requires_review",
    trace: {
      origin: "template",
      createdAt: "2026-06-02T11:00:00.000Z",
      createdBy: "account-owner",
      events: [
        {
          at: "2026-06-02T11:00:00.000Z",
          actor: "account-owner",
          type: "created",
          summary: "Created from the email-draft template."
        },
        {
          at: "2026-06-02T11:20:00.000Z",
          actor: "daily-work-agent",
          type: "approval_linked",
          summary: "Linked customer-email read and external reply approvals."
        }
      ]
    },
    lifecycle: [
      {
        at: "2026-06-02T11:00:00.000Z",
        actor: "account-owner",
        type: "created",
        summary: "Created from the email-draft template."
      },
      {
        at: "2026-06-02T11:20:00.000Z",
        actor: "daily-work-agent",
        type: "approval_linked",
        summary: "Linked customer-email read and external reply approvals."
      }
    ],
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
    status: "reusable",
    owner: {
      id: "research-owner",
      displayName: "Research Owner",
      team: "strategy"
    },
    updatedAt: "2026-06-02T12:05:00.000Z",
    sourceContextIds: ["research-links", "project-brief"],
    approvalRequestIds: [],
    version: 3,
    reusable: true,
    nextAction: {
      type: "reuse_in_template",
      label: "Reuse research note",
      description: "Attach this reusable note to future briefs or weekly reports."
    },
    permissionState: "public",
    trace: {
      origin: "template",
      createdAt: "2026-05-31T13:00:00.000Z",
      createdBy: "research-owner",
      events: [
        {
          at: "2026-05-31T13:00:00.000Z",
          actor: "research-owner",
          type: "created",
          summary: "Created from the research-brief template."
        },
        {
          at: "2026-06-02T12:05:00.000Z",
          actor: "research-owner",
          type: "marked_reusable",
          summary: "Promoted to a reusable daily-work artifact."
        }
      ]
    },
    lifecycle: [
      {
        at: "2026-05-31T13:00:00.000Z",
        actor: "research-owner",
        type: "created",
        summary: "Created from the research-brief template."
      },
      {
        at: "2026-06-02T12:05:00.000Z",
        actor: "research-owner",
        type: "marked_reusable",
        summary: "Promoted to a reusable daily-work artifact."
      }
    ],
    tags: ["research", "knowledge", "brief"]
  }
] as const as DailyWorkArtifact[];

export type DailyWorkTemplateStatus = z.infer<
  typeof dailyWorkTemplateStatusSchema
>;
export type DailyWorkTemplateContextPolicy = z.infer<
  typeof dailyWorkTemplateContextPolicySchema
>;
export type DailyWorkTemplate = z.infer<typeof dailyWorkTemplateSchema>;
export type DailyWorkTemplateCreateRequest = z.infer<
  typeof dailyWorkTemplateCreateRequestSchema
>;
export type DailyWorkTemplateUpdateRequest = z.infer<
  typeof dailyWorkTemplateUpdateRequestSchema
>;
export type DailyWorkTemplateDuplicateRequest = z.infer<
  typeof dailyWorkTemplateDuplicateRequestSchema
>;
export type DailyWorkArtifact = z.infer<typeof dailyWorkArtifactSchema>;
export type DailyWorkTemplatesResponse = z.infer<
  typeof dailyWorkTemplatesResponseSchema
>;
export type DailyWorkArtifactsResponse = z.infer<
  typeof dailyWorkArtifactsResponseSchema
>;
export type DailyWorkArtifactResponse = z.infer<
  typeof dailyWorkArtifactResponseSchema
>;
export type DailyWorkTemplateApplyPreviewRequest = z.infer<
  typeof dailyWorkTemplateApplyPreviewRequestSchema
>;
export type DailyWorkTemplateApplyPreviewStep = z.infer<
  typeof dailyWorkTemplateApplyPreviewStepSchema
>;
export type DailyWorkTemplateApplyPreview = z.infer<
  typeof dailyWorkTemplateApplyPreviewSchema
>;
export type DailyWorkTemplateApplyPreviewResponse = z.infer<
  typeof dailyWorkTemplateApplyPreviewResponseSchema
>;
export type TemplateCategory = z.infer<typeof templateCategorySchema>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export type DailyWorkArtifactStatus = z.infer<
  typeof dailyWorkArtifactStatusSchema
>;
export type DailyWorkArtifactPermissionState = z.infer<
  typeof dailyWorkArtifactPermissionStateSchema
>;
export type DailyWorkArtifactNextActionType = z.infer<
  typeof dailyWorkArtifactNextActionTypeSchema
>;
export type DailyWorkArtifactTraceOrigin = z.infer<
  typeof dailyWorkArtifactTraceOriginSchema
>;
export type DailyWorkArtifactTraceEventType = z.infer<
  typeof dailyWorkArtifactTraceEventTypeSchema
>;
export type DailyWorkArtifactOwner = z.infer<
  typeof dailyWorkArtifactOwnerSchema
>;
export type DailyWorkArtifactNextAction = z.infer<
  typeof dailyWorkArtifactNextActionSchema
>;
export type DailyWorkArtifactTraceEvent = z.infer<
  typeof dailyWorkArtifactTraceEventSchema
>;
export type DailyWorkArtifactLifecycleEvent = z.infer<
  typeof dailyWorkArtifactLifecycleEventSchema
>;
export type DailyWorkArtifactTrace = z.infer<
  typeof dailyWorkArtifactTraceSchema
>;
