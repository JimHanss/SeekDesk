"use client";

import type { FormEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Code2,
  Database,
  FileText,
  Globe,
  HardDrive,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  PanelLeft,
  Play,
  Presentation,
  Search,
  Send,
  Server,
  ShieldCheck,
  Square,
  Sparkles,
  Target,
  User,
  Wand2,
  Workflow,
  type LucideIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppMode = "daily_work" | "coding_agent";
type ChatRole = "user" | "assistant";
type ChatStatus = "idle" | "submitting" | "streaming" | "error";
type AssistantResponseMode = "text" | "json" | "sse" | "ndjson";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

type MessageSegment =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "code";
      content: string;
      language: string;
    };

type SyntaxTokenKind =
  | "comment"
  | "keyword"
  | "number"
  | "property"
  | "punctuation"
  | "string"
  | "text";

interface SyntaxToken {
  kind: SyntaxTokenKind;
  value: string;
}

interface TemplateItem {
  id: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
  artifactType: string;
  tags: string[];
  enabled: boolean;
  icon: LucideIcon;
}

type TemplatePanelSource = "fallback" | "api" | "degraded";
type TemplatePanelSyncStatus = "syncing" | "live" | "degraded";
type TemplatePreviewSource = "fallback" | "api" | "degraded";
type TemplatePreviewSyncStatus = "idle" | "syncing" | "live" | "degraded";

interface DailyWorkTemplateDto {
  id?: string;
  mode?: AppMode;
  category?: string;
  title?: string;
  description?: string;
  prompt?: string;
  artifactType?: string;
  tags?: string[];
  enabled?: boolean;
}

interface DailyWorkTemplatesResponseDto {
  mode?: AppMode;
  templates?: DailyWorkTemplateDto[];
}

interface DailyWorkTemplateApplyPreviewDto {
  id?: string;
  mode?: AppMode;
  templateId?: string;
  templateTitle?: string;
  category?: string;
  artifactType?: string;
  promptDraft?: string;
  tags?: string[];
  previewOnly?: boolean;
  externalEffects?: string[];
  safetyBoundary?: {
    previewOnly?: boolean;
    externalEffects?: string[];
    statement?: string;
  };
  generatedAt?: string;
}

interface DailyWorkTemplateApplyPreviewResponseDto {
  mode?: AppMode;
  preview?: DailyWorkTemplateApplyPreviewDto;
}

interface TemplatePreviewPanelState {
  templateId: string;
  source: TemplatePreviewSource;
  syncStatus: TemplatePreviewSyncStatus;
  previewOnly: boolean;
  externalEffects: string[];
  safetyStatement: string;
  promptDraft: string;
  generatedAt: string;
  notice: string;
}

interface TemplatePanelState {
  items: TemplateItem[];
  source: TemplatePanelSource;
  syncStatus: TemplatePanelSyncStatus;
  notice: string;
  preview: TemplatePreviewPanelState;
}

type SessionHistoryStatus = "进行中" | "待审批" | "已完成" | "已归档";
type SessionHistoryFilter = "全部" | SessionHistoryStatus;
type SessionHistoryPanelSource = "fallback" | "api" | "degraded";
type SessionHistoryPanelSyncStatus = "syncing" | "live" | "degraded";
type SessionRestorePreviewSource = "fallback" | "api" | "degraded";
type SessionRestorePreviewSyncStatus = "idle" | "syncing" | "live" | "degraded";

interface SessionHistoryMessageItem {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  artifactIds: string[];
  contextItemIds: string[];
  approvalRequestIds: string[];
}

interface WorkflowSnapshotItem {
  id: string;
  title: string;
  status: SessionHistoryStatus;
  updatedAt: string;
  summary: string;
  artifactCount: number;
  approvalCount: number;
  contextCount: number;
  artifactIds: string[];
  approvalRequestIds: string[];
  contextItemIds: string[];
  messageCount: number;
  lastAction: string;
  mode: AppMode;
  tags: string[];
  recentMessages: SessionHistoryMessageItem[];
  icon: LucideIcon;
}

type SessionHistoryItem = WorkflowSnapshotItem;

interface DailyWorkSessionLastActionDto {
  at?: string;
  actor?: string;
  label?: string;
  artifactId?: string;
  approvalRequestId?: string;
}

interface DailyWorkSessionMessageDto {
  id?: string;
  role?: string;
  content?: string;
  createdAt?: string;
  artifactIds?: string[];
  contextItemIds?: string[];
  approvalRequestIds?: string[];
}

interface DailyWorkSessionDto {
  id?: string;
  workspaceId?: string;
  appMode?: AppMode;
  title?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  summary?: string;
  lastAction?: DailyWorkSessionLastActionDto | null;
  artifactIds?: string[];
  contextItemIds?: string[];
  approvalRequestIds?: string[];
  messageCount?: number;
  tags?: string[];
  recentMessages?: DailyWorkSessionMessageDto[];
}

interface DailyWorkSessionsResponseDto {
  mode?: AppMode;
  sessions?: DailyWorkSessionDto[];
}

interface DailyWorkSessionResponseDto {
  mode?: AppMode;
  session?: DailyWorkSessionDto;
}

interface DailyWorkSessionRestorePreviewDto {
  id?: string;
  mode?: AppMode;
  sessionId?: string;
  sessionTitle?: string;
  status?: string;
  summary?: string;
  lastAction?: DailyWorkSessionLastActionDto | null;
  restorePrompt?: string;
  artifactIds?: string[];
  contextItemIds?: string[];
  approvalRequestIds?: string[];
  recentMessagesPreview?: DailyWorkSessionMessageDto[];
  previewOnly?: boolean;
  externalEffects?: string[];
  safetyBoundary?: {
    previewOnly?: boolean;
    externalEffects?: string[];
    statement?: string;
  };
  generatedAt?: string;
}

interface DailyWorkSessionRestorePreviewResponseDto {
  mode?: AppMode;
  preview?: DailyWorkSessionRestorePreviewDto;
}

interface SessionRestorePreviewPanelState {
  sessionId: string;
  source: SessionRestorePreviewSource;
  syncStatus: SessionRestorePreviewSyncStatus;
  previewOnly: boolean;
  externalEffects: string[];
  safetyStatement: string;
  restorePrompt: string;
  generatedAt: string;
  notice: string;
}

interface SessionHistoryPanelState {
  items: SessionHistoryItem[];
  source: SessionHistoryPanelSource;
  syncStatus: SessionHistoryPanelSyncStatus;
  notice: string;
  restorePreview: SessionRestorePreviewPanelState;
}

type ArtifactState = "计划中" | "排队中" | "草稿" | "可复用" | "待复核";
type ArtifactFilter = "全部" | "草稿" | "可复用";
type ArtifactPanelSource = "fallback" | "api" | "degraded";
type ArtifactPanelSyncStatus = "syncing" | "live" | "degraded";

interface ArtifactTraceItem {
  label: string;
  value: string;
}

interface ArtifactItem {
  id: string;
  artifactType: string;
  title: string;
  description: string;
  summary: string;
  state: ArtifactState;
  owner: string;
  updatedAt: string;
  source: string;
  templateTitle: string;
  tags: string[];
  trace: ArtifactTraceItem[];
  nextAction: string;
  permissionStatus: string;
  icon: LucideIcon;
}

interface DailyWorkArtifactOwnerDto {
  displayName?: string;
  team?: string;
}

interface DailyWorkArtifactNextActionDto {
  label?: string;
  description?: string;
  approvalRequestId?: string;
}

interface DailyWorkArtifactTraceEventDto {
  actor?: string;
  type?: string;
  summary?: string;
  at?: string;
}

interface DailyWorkArtifactTraceDto {
  origin?: string;
  createdBy?: string;
  createdAt?: string;
  events?: DailyWorkArtifactTraceEventDto[];
}

interface DailyWorkArtifactDto {
  id?: string;
  mode?: AppMode;
  artifactType?: string;
  title?: string;
  description?: string;
  templateId?: string;
  summary?: string;
  status?: string;
  owner?: DailyWorkArtifactOwnerDto;
  updatedAt?: string;
  sourceContextIds?: string[];
  approvalRequestIds?: string[];
  version?: number;
  reusable?: boolean;
  nextAction?: DailyWorkArtifactNextActionDto | null;
  permissionState?: string;
  trace?: DailyWorkArtifactTraceDto;
  lifecycle?: DailyWorkArtifactTraceEventDto[];
  tags?: string[];
}

interface DailyWorkArtifactsResponseDto {
  mode?: AppMode;
  artifacts?: DailyWorkArtifactDto[];
}

interface DailyWorkArtifactResponseDto {
  mode?: AppMode;
  artifact?: DailyWorkArtifactDto;
}

interface ArtifactPanelState {
  items: ArtifactItem[];
  source: ArtifactPanelSource;
  syncStatus: ArtifactPanelSyncStatus;
  notice: string;
}

interface ContextItem {
  id: string;
  title: string;
  source: string;
  sourceType: string;
  status: string;
  summary: string;
  privacy: string;
  prompt: string;
  icon: LucideIcon;
}

type ConnectorCategory = "文档" | "日历" | "邮箱" | "笔记" | "团队知识";
type ConnectorFilter = "全部" | "需审批" | "可预览";
type ConnectorPermissionState = "未连接" | "需审批" | "可预览";
type ConnectorRiskLevel = "低" | "中" | "高";

interface ConnectorItem {
  id: string;
  apiConnectorId: string;
  apiAction: string;
  name: string;
  category: ConnectorCategory;
  provider: string;
  status: string;
  permissionState: ConnectorPermissionState;
  description: string;
  lastSyncLabel: string;
  riskLevel: ConnectorRiskLevel;
  availableActions: string[];
  relatedContextIds: string[];
  requiredApprovalIds: string[];
  notes: string[];
  icon: LucideIcon;
}

type WorkflowActionStatus = "待审批" | "可预演" | "需补上下文";
type WorkflowActionFilter = "全部" | WorkflowActionStatus;

interface WorkflowActionItem {
  id: string;
  apiWorkflowId: string;
  apiActionId: string;
  title: string;
  actionType: string;
  connector: string;
  context: string;
  artifact: string;
  approvalStatus: WorkflowActionStatus;
  riskLevel: ConnectorRiskLevel;
  riskNote: string;
  summary: string;
  nextStep: string;
  prompt: string;
  relatedContextIds: string[];
  icon: LucideIcon;
}

type ActivityEventType = "session" | "workflow" | "artifact" | "approval" | "connector";
type ActivityEventStatus =
  | "已恢复"
  | "已填入"
  | "待审批"
  | "已预演"
  | "待复核"
  | "可复用"
  | "排队中"
  | "进行中"
  | "已完成"
  | "已阻断"
  | "失败";

interface ActivityEventItem {
  id: string;
  type: ActivityEventType;
  time: string;
  title: string;
  status: ActivityEventStatus;
  relatedObject: string;
  relatedLabel: string;
  summary: string;
  safetyBoundary: string;
  promptFocus: string;
  icon: LucideIcon;
}

type ActivityFeedSource = "fallback" | "api" | "websocket";
type ActivityConnectionStatus =
  | "connecting"
  | "live"
  | "degraded"
  | "closed";

interface DailyActivityRelatedRefs {
  sessionIds?: string[];
  templateIds?: string[];
  workflowIds?: string[];
  actionQueueItemIds?: string[];
  artifactIds?: string[];
  approvalRequestIds?: string[];
  connectorIds?: string[];
  contextItemIds?: string[];
}

interface DailyActivitySafetyBoundary {
  previewOnly?: boolean;
  externalEffects?: string[];
  prohibitedExternalActions?: string[];
  statement?: string;
}

interface DailyActivityNextAction {
  label: string;
  description?: string;
  targetType: ActivityEventType | "template" | "context";
  targetId: string;
  requiredStatus?: string;
  dueAt?: string;
}

interface DailyActivityEventDto {
  id: string;
  mode?: AppMode;
  eventType: string;
  status: string;
  timestamp: string;
  title: string;
  summary: string;
  actor: string;
  relatedRefs?: DailyActivityRelatedRefs;
  safetyBoundary?: DailyActivitySafetyBoundary;
  nextAction?: DailyActivityNextAction | null;
}

interface DailyActivitySnapshotDto {
  type?: string;
  mode?: AppMode;
  events?: DailyActivityEventDto[];
}

type ApprovalStatus = "waiting" | "allowed_once" | "denied" | "blocked";
type ApprovalRisk = "低" | "中" | "高" | "极高";
type ModelRouteMode = "fast" | "pro";
type ThinkingMode = "enabled" | "disabled";
type ModelUsageBudgetState =
  | "disabled"
  | "tracking_only"
  | "within_budget"
  | "approaching_limit"
  | "over_budget";
type ModelUsagePanelSource = "fallback" | "api" | "degraded";
type ModelUsageSyncStatus = "syncing" | "live" | "degraded";
type PersistenceLayerId = "seed_mock" | "json_local" | "future_database";
type PersistenceLayerStatus = "active" | "available" | "planned" | "unknown";
type PersistencePanelSource = "fallback" | "health" | "degraded";
type PersistencePanelSyncStatus = "syncing" | "live" | "degraded";

interface ApprovalRequestItem {
  id: string;
  title: string;
  requestedAction: string;
  scope: string;
  risk: ApprovalRisk;
  status: ApprovalStatus;
  detail: string;
  icon: LucideIcon;
}

interface ModelSnapshotItem {
  id: ModelRouteMode;
  currentMode: AppMode;
  provider: string;
  baseUrl: string;
  fastModel: string;
  proModel: string;
  selectedRoute: ModelRouteMode;
  selectedModel: string;
  routingStrategy: string;
  thinkingMode: ThinkingMode;
  streamUsageEnabled: boolean;
  configured: boolean;
  updatedAt: string;
  notes: string[];
}

interface UsageSnapshotItem {
  id: ModelRouteMode;
  usageWindow: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: string;
  budgetState: string;
  budgetLevel: ModelUsageBudgetState;
  updatedAt: string;
  notes: string[];
}

interface DailyModelConfigSnapshotDto {
  mode?: AppMode;
  provider?: string;
  baseUrl?: string;
  fastModel?: string;
  proModel?: string;
  selectedRoute?: ModelRouteMode;
  selectedModel?: string;
  thinkingMode?: ThinkingMode;
  streamUsageEnabled?: boolean;
  configured?: boolean;
  notes?: string[];
}

interface DailyModelUsageWindowDto {
  id?: string;
  label?: string;
  startedAt?: string;
  endedAt?: string;
}

interface DailyModelUsageSnapshotDto {
  window?: DailyModelUsageWindowDto;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  currency?: string;
  budgetState?: ModelUsageBudgetState;
  updatedAt?: string;
  records?: unknown[];
}

interface DailyModelUsageResponseDto {
  mode?: AppMode;
  config?: DailyModelConfigSnapshotDto;
  usage?: DailyModelUsageSnapshotDto;
}

type ConnectorPreviewPanelSource = "local" | "api" | "degraded";
type ConnectorPreviewPanelSyncStatus = "idle" | "syncing" | "live" | "degraded";

interface ConnectorActionPreviewStepDto {
  title?: string;
  description?: string;
  externalEffect?: string;
}

interface ConnectorActionPreviewDto {
  connectorId?: string;
  action?: string;
  previewOnly?: boolean;
  relatedContextItemIds?: string[];
  requiredApprovalRequestIds?: string[];
  summary?: string;
  steps?: ConnectorActionPreviewStepDto[];
  safetyBoundary?: {
    externalEffects?: string[];
    statement?: string;
  };
}

interface ConnectorActionPreviewResponseDto {
  mode?: AppMode;
  preview?: ConnectorActionPreviewDto;
}

interface DailyApprovalDecisionResponseDto {
  mode?: AppMode;
  request?: {
    id?: string;
    status?: string;
    decision?: string;
  };
  audit?: {
    previewOnly?: boolean;
    externalEffects?: string[];
    statement?: string;
  };
}

interface ConnectorPreviewPanelState {
  connectorId: string;
  action: string;
  source: ConnectorPreviewPanelSource;
  syncStatus: ConnectorPreviewPanelSyncStatus;
  previewOnly: boolean;
  summary: string;
  relatedContextItemIds: string[];
  requiredApprovalRequestIds: string[];
  steps: string[];
  safetyStatement: string;
  notice: string;
}

type WorkflowPreviewPanelSource = "local" | "api" | "degraded";
type WorkflowPreviewPanelSyncStatus = "idle" | "syncing" | "live" | "degraded";

interface DailyWorkflowPreviewConnectorLinkDto {
  connectorId?: string;
  displayName?: string;
  action?: string;
}

interface DailyWorkflowPreviewContextLinkDto {
  contextItemId?: string;
  title?: string;
  usage?: string;
}

interface DailyWorkflowPreviewArtifactLinkDto {
  artifactId?: string;
  title?: string;
  artifactType?: string;
  status?: string;
}

interface DailyWorkflowPreviewApprovalLinkDto {
  approvalRequestId?: string;
  title?: string;
  status?: string;
}

interface DailyWorkflowPreviewStepDto {
  actionId?: string;
  title?: string;
  description?: string;
  status?: string;
  externalEffect?: string;
  summary?: string;
  suggestedNextStep?: string;
  userVisibleDraft?: string;
}

interface DailyWorkflowPreviewDto {
  workflowId?: string;
  workflowTitle?: string;
  selectedActionId?: string;
  selectedActionStatus?: string;
  previewOnly?: boolean;
  externalEffects?: string[];
  requestedContextItemIds?: string[];
  summary?: string;
  steps?: DailyWorkflowPreviewStepDto[];
  connectorLinks?: DailyWorkflowPreviewConnectorLinkDto[];
  contextLinks?: DailyWorkflowPreviewContextLinkDto[];
  artifactLinks?: DailyWorkflowPreviewArtifactLinkDto[];
  approvalLinks?: DailyWorkflowPreviewApprovalLinkDto[];
  safetyBoundary?: {
    previewOnly?: boolean;
    externalEffects?: string[];
    statement?: string;
  };
}

interface DailyWorkflowPreviewResponseDto {
  mode?: AppMode;
  preview?: DailyWorkflowPreviewDto;
}

interface WorkflowPreviewPanelState {
  workflowId: string;
  actionId: string;
  source: WorkflowPreviewPanelSource;
  syncStatus: WorkflowPreviewPanelSyncStatus;
  previewOnly: boolean;
  summary: string;
  selectedActionStatus: string;
  steps: string[];
  connectorLinks: string[];
  contextLinks: string[];
  artifactLinks: string[];
  approvalLinks: string[];
  safetyStatement: string;
  notice: string;
}

interface ModelUsagePanelState {
  modelSnapshots: Record<ModelRouteMode, ModelSnapshotItem>;
  usageSnapshots: Record<ModelRouteMode, UsageSnapshotItem>;
  source: ModelUsagePanelSource;
  syncStatus: ModelUsageSyncStatus;
  notice: string;
}

interface PersistenceLayerItem {
  id: PersistenceLayerId;
  label: string;
  description: string;
  status: PersistenceLayerStatus;
  detail: string;
  icon: LucideIcon;
}

interface PersistencePanelState {
  layers: PersistenceLayerItem[];
  source: PersistencePanelSource;
  syncStatus: PersistencePanelSyncStatus;
  currentLayer: PersistenceLayerId;
  updatedAt: string;
  notice: string;
}

interface HealthPersistenceSnapshotDto {
  mode?: AppMode;
  current?: string;
  currentLayer?: string;
  storage?: string;
  layer?: string;
  provider?: string;
  source?: string;
  status?: string;
  writable?: boolean;
  path?: string;
  filePath?: string;
  databaseReady?: boolean;
  futureDatabaseReady?: boolean;
  updatedAt?: string;
  notes?: string[];
}

const activeMode: AppMode = "daily_work";
const defaultApiBaseUrl =
  process.env.NEXT_PUBLIC_SEEKDESK_API_URL ?? "http://127.0.0.1:4000";

const templates: TemplateItem[] = [
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

function createFallbackTemplatePanelState(): TemplatePanelState {
  return {
    items: templates,
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在从 /api/daily/templates?mode=daily_work 同步模板库；连接完成前保留前端 fallback。",
    preview: createLocalTemplatePreviewState(templates[0] ?? null)
  };
}

function createLocalTemplatePreviewState(
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

function mapTemplatesResponse(payload: DailyWorkTemplatesResponseDto): TemplateItem[] {
  if (payload.mode !== activeMode || !Array.isArray(payload.templates)) {
    throw new Error("Templates response did not include daily_work templates.");
  }

  return payload.templates.map(mapTemplateDtoToItem);
}

function mapTemplateDtoToItem(
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

function mapTemplatePreviewResponse(
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

function sanitizeTemplateTags(values: string[] | undefined) {
  return values?.filter((value) => value.trim().length > 0).slice(0, 4) ?? [];
}

function templateIcon({
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

const sessionHistoryFilters: SessionHistoryFilter[] = [
  "全部",
  "进行中",
  "待审批",
  "已完成",
  "已归档"
];

const sessionHistoryItems: SessionHistoryItem[] = [
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

function createFallbackSessionHistoryPanelState(): SessionHistoryPanelState {
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

function createLocalSessionRestorePreviewState(
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

function mapSessionsResponse(payload: DailyWorkSessionsResponseDto) {
  if (payload.mode !== activeMode) {
    throw new Error("Daily-work sessions response did not match the active mode.");
  }

  return (payload.sessions ?? []).map((session, index) =>
    mapSessionDtoToItem(session, index)
  );
}

function mapSessionResponse(payload: DailyWorkSessionResponseDto) {
  if (payload.mode !== activeMode || !payload.session) {
    throw new Error("Daily-work session response did not include a matching session.");
  }

  return mapSessionDtoToItem(payload.session, 0);
}

function mapSessionDtoToItem(
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

function mapSessionRestorePreviewResponse(
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

function mapSessionRecentMessages(
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

function sanitizeSessionIds(values: string[] | undefined) {
  return values?.filter((value) => value.trim().length > 0) ?? [];
}

function mapSessionHistoryStatus(value: string | undefined): SessionHistoryStatus {
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

function formatSessionHistoryTimestamp(value: string | undefined) {
  return formatModelUsageTimestamp(value) ?? nonEmptyText(value, "刚刚同步");
}

function formatSessionLastAction(
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

function sessionHistoryIcon(title: string, tags: string[] | undefined): LucideIcon {
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

function replaceSessionHistoryItem(
  items: SessionHistoryItem[],
  nextItem: SessionHistoryItem
) {
  const found = items.some((item) => item.id === nextItem.id);

  return found
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [nextItem, ...items];
}

const contextItems: ContextItem[] = [
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
    icon: ShieldCheck
  }
];

const connectorFilters: ConnectorFilter[] = ["全部", "需审批", "可预览"];

const connectorItems: ConnectorItem[] = [
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

const workflowActionFilters: WorkflowActionFilter[] = [
  "全部",
  "待审批",
  "可预演",
  "需补上下文"
];

const workflowActions: WorkflowActionItem[] = [
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

const activityEvents: ActivityEventItem[] = [
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

const artifactFilters: ArtifactFilter[] = ["全部", "草稿", "可复用"];

const artifacts: ArtifactItem[] = [
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

function createFallbackArtifactPanelState(): ArtifactPanelState {
  return {
    items: artifacts,
    source: "fallback",
    syncStatus: "syncing",
    notice: "正在从 /api/daily/artifacts?mode=daily_work 同步产物；暂时展示本地 fallback。"
  };
}

function mapArtifactsResponse(payload: DailyWorkArtifactsResponseDto): ArtifactItem[] {
  if (payload.mode !== activeMode || !Array.isArray(payload.artifacts)) {
    throw new Error("Artifacts response did not include daily_work artifacts.");
  }

  return payload.artifacts.map(mapArtifactDtoToItem);
}

function mapArtifactResponse(payload: DailyWorkArtifactResponseDto): ArtifactItem {
  if (payload.mode !== activeMode || !payload.artifact) {
    throw new Error("Artifact detail response did not include a daily_work artifact.");
  }

  return mapArtifactDtoToItem(payload.artifact);
}

function mapArtifactDtoToItem(artifact: DailyWorkArtifactDto): ArtifactItem {
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

function artifactTypeLabel(value: string | undefined) {
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

function artifactTemplateLabel(value: string | undefined) {
  const template = templates.find((item) => item.id === value);
  return template?.title;
}

function artifactStateFromApi(
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

function artifactPermissionLabel(
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

function formatArtifactNextAction(
  nextAction: DailyWorkArtifactNextActionDto | null | undefined
) {
  if (!nextAction) {
    return "暂无下一步动作。";
  }

  return [nextAction.label, nextAction.description, nextAction.approvalRequestId]
    .filter(Boolean)
    .join(" · ");
}

function lifecycleEventLabel(value: string | undefined) {
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

function artifactIcon(value: string | undefined): LucideIcon {
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

const initialMessages: ChatMessage[] = [];

const initialApprovalRequests: ApprovalRequestItem[] = [
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

const modelSnapshots: Record<ModelRouteMode, ModelSnapshotItem> = {
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

const usageSnapshots: Record<ModelRouteMode, UsageSnapshotItem> = {
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

function createFallbackModelUsagePanelState(): ModelUsagePanelState {
  return {
    modelSnapshots,
    usageSnapshots,
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在连接后端模型与用量接口；连接完成前保留前端示例快照，保证页面可用。"
  };
}

function createFallbackPersistencePanelState(): PersistencePanelState {
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

function createLocalConnectorPreviewState(
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

function mapConnectorPreviewResponse(
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

function createLocalWorkflowPreviewState(
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

function mapWorkflowPreviewResponse(
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

function formatWorkflowConnectorLinks(
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

function formatWorkflowContextLinks(
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

function formatWorkflowArtifactLinks(
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

function formatWorkflowApprovalLinks(
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

function mapHealthPersistenceResponse(payload: unknown): PersistencePanelState {
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

function mapDailyModelUsageResponse(
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

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState<string | null>(
    null
  );
  const [templatePanel, setTemplatePanel] = useState<TemplatePanelState>(() =>
    createFallbackTemplatePanelState()
  );
  const [sessionHistoryFilter, setSessionHistoryFilter] =
    useState<SessionHistoryFilter>("全部");
  const [selectedSessionHistoryId, setSelectedSessionHistoryId] = useState<
    string | null
  >(sessionHistoryItems[0]?.id ?? null);
  const [sessionHistoryPanel, setSessionHistoryPanel] =
    useState<SessionHistoryPanelState>(() => createFallbackSessionHistoryPanelState());
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [connectorFilter, setConnectorFilter] = useState<ConnectorFilter>("全部");
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    connectorItems[0]?.id ?? null
  );
  const [workflowActionFilter, setWorkflowActionFilter] =
    useState<WorkflowActionFilter>("全部");
  const [selectedWorkflowActionId, setSelectedWorkflowActionId] = useState<
    string | null
  >(workflowActions[0]?.id ?? null);
  const [selectedActivityEventId, setSelectedActivityEventId] = useState<
    string | null
  >(activityEvents[0]?.id ?? null);
  const [activityFeedEvents, setActivityFeedEvents] =
    useState<ActivityEventItem[]>(activityEvents);
  const [activityFeedSource, setActivityFeedSource] =
    useState<ActivityFeedSource>("fallback");
  const [activityConnectionStatus, setActivityConnectionStatus] =
    useState<ActivityConnectionStatus>("connecting");
  const [activityLastUpdated, setActivityLastUpdated] =
    useState("前端 fallback 示例");
  const [activityFeedNotice, setActivityFeedNotice] = useState(
    "正在连接后端活动源，暂时展示前端 fallback 示例。"
  );
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    artifacts[0]?.id ?? null
  );
  const [artifactFilter, setArtifactFilter] = useState<ArtifactFilter>("全部");
  const [artifactPanel, setArtifactPanel] = useState<ArtifactPanelState>(() =>
    createFallbackArtifactPanelState()
  );
  const [modelRouteMode, setModelRouteMode] = useState<ModelRouteMode>("fast");
  const [modelUsagePanel, setModelUsagePanel] = useState<ModelUsagePanelState>(
    () => createFallbackModelUsagePanelState()
  );
  const [persistencePanel, setPersistencePanel] =
    useState<PersistencePanelState>(() => createFallbackPersistencePanelState());
  const [connectorPreviewPanel, setConnectorPreviewPanel] =
    useState<ConnectorPreviewPanelState>(() =>
      createLocalConnectorPreviewState(connectorItems[0]!)
    );
  const [workflowPreviewPanel, setWorkflowPreviewPanel] =
    useState<WorkflowPreviewPanelState>(() =>
      createLocalWorkflowPreviewState(workflowActions[0]!)
    );
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequestItem[]>(
    initialApprovalRequests
  );
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isBusy = status === "submitting" || status === "streaming";
  const apiBaseUrl = useMemo(() => getRuntimeApiBaseUrl().replace(/\/$/, ""), []);
  const endpoint = useMemo(
    () => `${apiBaseUrl}/api/chat`,
    [apiBaseUrl]
  );
  const activeModelSnapshot = modelUsagePanel.modelSnapshots[modelRouteMode];
  const activeUsageSnapshot = modelUsagePanel.usageSnapshots[modelRouteMode];
  const usageTotalTokens = activeUsageSnapshot.totalTokens;
  const usageBudgetPercent = budgetStatePercent(activeUsageSnapshot.budgetLevel);
  const modelInputPlaceholder =
    modelRouteMode === "fast"
      ? "快速模式示例：适合写客户更新、整理会议纪要、把笔记转成任务计划"
      : "深度模式示例：适合复杂资料归纳、风险复核和长上下文分析";
  const templateItems = templatePanel.items;
  const filteredConnectors = useMemo(
    () =>
      connectorFilter === "全部"
        ? connectorItems
        : connectorItems.filter((item) =>
            connectorMatchesFilter(item, connectorFilter)
          ),
    [connectorFilter]
  );
  const selectedConnector = useMemo(() => {
    const selectedInFilter = filteredConnectors.find(
      (connector) => connector.id === selectedConnectorId
    );

    return selectedInFilter ?? filteredConnectors[0] ?? connectorItems[0] ?? null;
  }, [filteredConnectors, selectedConnectorId]);
  const selectedConnectorApprovalRequests = useMemo(() => {
    if (!selectedConnector) {
      return [];
    }

    return approvalRequests.filter((request) =>
      selectedConnector.requiredApprovalIds.includes(request.id)
    );
  }, [approvalRequests, selectedConnector]);
  const selectedConnectorPreviewStatus = useMemo(
    () =>
      connectorPreviewApprovalStatus(
        selectedConnector,
        selectedConnectorApprovalRequests
      ),
    [selectedConnector, selectedConnectorApprovalRequests]
  );
  const filteredWorkflowActions = useMemo(
    () =>
      workflowActionFilter === "全部"
        ? workflowActions
        : workflowActions.filter(
            (item) => item.approvalStatus === workflowActionFilter
          ),
    [workflowActionFilter]
  );
  const selectedWorkflowAction = useMemo(() => {
    const selectedInFilter = filteredWorkflowActions.find(
      (item) => item.id === selectedWorkflowActionId
    );

    return selectedInFilter ?? filteredWorkflowActions[0] ?? workflowActions[0] ?? null;
  }, [filteredWorkflowActions, selectedWorkflowActionId]);
  const selectedActivityEvent = useMemo(
    () =>
      activityFeedEvents.find((event) => event.id === selectedActivityEventId) ??
      activityFeedEvents[0] ??
      null,
    [activityFeedEvents, selectedActivityEventId]
  );
  const artifactItems = artifactPanel.items;
  const filteredArtifacts = useMemo(
    () =>
      artifactFilter === "全部"
        ? artifactItems
        : artifactItems.filter((artifact) => artifact.state === artifactFilter),
    [artifactFilter, artifactItems]
  );
  const selectedArtifact = useMemo(() => {
    const selectedInFilter = filteredArtifacts.find(
      (artifact) => artifact.id === selectedArtifactId
    );

    return selectedInFilter ?? filteredArtifacts[0] ?? artifactItems[0] ?? null;
  }, [artifactItems, filteredArtifacts, selectedArtifactId]);
  const sessionHistoryPanelItems = sessionHistoryPanel.items;
  const filteredSessionHistory = useMemo(
    () =>
      sessionHistoryFilter === "全部"
        ? sessionHistoryPanelItems
        : sessionHistoryPanelItems.filter(
            (item) => item.status === sessionHistoryFilter
          ),
    [sessionHistoryFilter, sessionHistoryPanelItems]
  );
  const selectedSessionHistory = useMemo(() => {
    const selectedInFilter = filteredSessionHistory.find(
      (item) => item.id === selectedSessionHistoryId
    );

    return selectedInFilter ?? filteredSessionHistory[0] ?? sessionHistoryPanelItems[0] ?? null;
  }, [filteredSessionHistory, selectedSessionHistoryId, sessionHistoryPanelItems]);

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchTemplates() {
      setTemplatePanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/templates?mode=daily_work 同步模板库。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/templates?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Templates request failed: ${response.status}`);
        }

        const items = mapTemplatesResponse(
          (await response.json()) as DailyWorkTemplatesResponseDto
        );

        if (!isDisposed) {
          setTemplatePanel((current) => {
            const preview =
              current.preview.templateId &&
              items.some((item) => item.id === current.preview.templateId)
                ? current.preview
                : createLocalTemplatePreviewState(items[0] ?? null);

            return {
              items,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/templates?mode=daily_work 同步模板、产物类型、标签和启用状态。",
              preview
            };
          });
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setTemplatePanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice: "暂未从后端同步模板库，已保留本地 templates fallback。"
        }));
      }
    }

    void fetchTemplates();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!selectedConnector) {
      return;
    }

    const connector = selectedConnector;
    let isDisposed = false;
    const controller = new AbortController();
    const fallbackState = createLocalConnectorPreviewState(connector);

    setConnectorPreviewPanel({
      ...fallbackState,
      syncStatus: "syncing",
      notice: `正在从 /api/daily/connectors/${connector.apiConnectorId}/preview 同步预览。`
    });

    async function fetchConnectorPreview() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/connectors/${connector.apiConnectorId}/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              mode: activeMode,
              action: connector.apiAction,
              contextItemIds: connector.relatedContextIds,
              prompt: `Preview ${connector.name} for daily_work.`
            }),
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Connector preview request failed: ${response.status}`);
        }

        const payload = (await response.json()) as ConnectorActionPreviewResponseDto;

        if (!isDisposed) {
          setConnectorPreviewPanel(
            mapConnectorPreviewResponse(connector, payload)
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setConnectorPreviewPanel({
          ...fallbackState,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步连接器预览，已保留本地 preview-only fallback。"
        });
      }
    }

    void fetchConnectorPreview();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedConnector]);

  useEffect(() => {
    if (!selectedWorkflowAction) {
      return;
    }

    const action = selectedWorkflowAction;
    let isDisposed = false;
    const controller = new AbortController();
    const fallbackState = createLocalWorkflowPreviewState(action);

    setWorkflowPreviewPanel({
      ...fallbackState,
      syncStatus: "syncing",
      notice: `正在从 /api/daily/workflows/${action.apiWorkflowId}/preview 同步工作流预演。`
    });

    async function fetchWorkflowPreview() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/workflows/${action.apiWorkflowId}/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              mode: activeMode,
              actionId: action.apiActionId,
              contextItemIds: action.relatedContextIds,
              prompt: `Preview ${action.title} for daily_work.`
            }),
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Workflow preview request failed: ${response.status}`);
        }

        const payload = (await response.json()) as DailyWorkflowPreviewResponseDto;

        if (!isDisposed) {
          setWorkflowPreviewPanel(mapWorkflowPreviewResponse(action, payload));
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setWorkflowPreviewPanel({
          ...fallbackState,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步工作流预演，已保留本地 preview-only fallback。"
        });
      }
    }

    void fetchWorkflowPreview();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedWorkflowAction]);

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchSessionHistory() {
      setSessionHistoryPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/sessions?mode=daily_work 同步会话列表。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Sessions request failed: ${response.status}`);
        }

        const items = mapSessionsResponse(
          (await response.json()) as DailyWorkSessionsResponseDto
        );

        if (!isDisposed) {
          setSessionHistoryPanel((current) => {
            const restorePreview =
              current.restorePreview.sessionId &&
              items.some((item) => item.id === current.restorePreview.sessionId)
                ? current.restorePreview
                : createLocalSessionRestorePreviewState(items[0] ?? null);

            return {
              items,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/sessions?mode=daily_work 同步会话列表、状态、关联产物、上下文和审批链路。",
              restorePreview
            };
          });
          setSelectedSessionHistoryId((current) =>
            current && items.some((item) => item.id === current)
              ? current
              : items[0]?.id ?? null
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步会话列表，已保留本地 session history fallback。"
        }));
      }
    }

    void fetchSessionHistory();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!selectedSessionHistoryId) {
      return;
    }

    let isDisposed = false;
    const controller = new AbortController();

    async function fetchSessionDetail() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions/${selectedSessionHistoryId}?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Session detail request failed: ${response.status}`);
        }

        const nextItem = mapSessionResponse(
          (await response.json()) as DailyWorkSessionResponseDto
        );

        if (!isDisposed) {
          setSessionHistoryPanel((current) => ({
            ...current,
            source: "api",
            syncStatus: "live",
            items: replaceSessionHistoryItem(current.items, nextItem),
            notice: `已从 /api/daily/sessions/${nextItem.id}?mode=daily_work 同步会话详情与最近消息。`,
            restorePreview:
              current.restorePreview.sessionId === nextItem.id
                ? current.restorePreview
                : createLocalSessionRestorePreviewState(nextItem)
          }));
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步选中会话详情，继续展示当前会话快照。"
        }));
      }
    }

    void fetchSessionDetail();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedSessionHistoryId]);

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchArtifacts() {
      setArtifactPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/artifacts?mode=daily_work 同步产物列表。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/artifacts?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Artifacts request failed: ${response.status}`);
        }

        const items = mapArtifactsResponse(
          (await response.json()) as DailyWorkArtifactsResponseDto
        );

        if (!isDisposed) {
          setArtifactPanel({
            items,
            source: "api",
            syncStatus: "live",
            notice:
              "已从 /api/daily/artifacts?mode=daily_work 同步产物、上下文追踪、审批链路和 lifecycle。"
          });
          setSelectedArtifactId((current) =>
            current && items.some((item) => item.id === current)
              ? current
              : items[0]?.id ?? null
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setArtifactPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步产物列表，已保留本地 artifacts fallback。"
        }));
      }
    }

    void fetchArtifacts();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!selectedArtifactId) {
      return;
    }

    let isDisposed = false;
    const controller = new AbortController();

    async function fetchArtifactDetail() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/artifacts/${selectedArtifactId}?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Artifact detail request failed: ${response.status}`);
        }

        const nextItem = mapArtifactResponse(
          (await response.json()) as DailyWorkArtifactResponseDto
        );

        if (!isDisposed) {
          setArtifactPanel((current) => ({
            ...current,
            source: "api",
            syncStatus: "live",
            items: current.items.map((item) =>
              item.id === nextItem.id ? nextItem : item
            ),
            notice: `已从 /api/daily/artifacts/${nextItem.id}?mode=daily_work 同步产物详情。`
          }));
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setArtifactPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步选中产物详情，继续展示当前产物快照。"
        }));
      }
    }

    void fetchArtifactDetail();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedArtifactId]);

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchPersistenceStatus() {
      setPersistencePanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在读取 /health 的数据层状态。"
      }));

      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Health request failed: ${response.status}`);
        }

        const nextState = mapHealthPersistenceResponse(await response.json());

        if (!isDisposed) {
          setPersistencePanel(nextState);
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setPersistencePanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从 /health 读取到数据层状态；工作台继续使用 seed/mock fallback。"
        }));
      }
    }

    void fetchPersistenceStatus();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchModelUsage() {
      setModelUsagePanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/model-usage?mode=daily_work 同步 DeepSeek 模型与用量。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/model-usage?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Model usage request failed: ${response.status}`);
        }

        const payload = (await response.json()) as DailyModelUsageResponseDto;

        if (isDisposed) {
          return;
        }

        setModelUsagePanel(mapDailyModelUsageResponse(payload));
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setModelUsagePanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未取到后端模型与用量，已降级保留前端示例快照；页面可继续用于 daily_work。"
        }));
      }
    }

    void fetchModelUsage();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    const applySnapshot = (
      payload: DailyActivitySnapshotDto,
      source: Exclude<ActivityFeedSource, "fallback">
    ) => {
      const nextEvents = mapDailyActivitySnapshot(payload);

      if (isDisposed || nextEvents.length === 0) {
        return;
      }

      setActivityFeedEvents(nextEvents);
      setActivityFeedSource(source);
      setActivityLastUpdated(formatActivityUpdatedAt(new Date()));
      setActivityFeedNotice(
        source === "websocket"
          ? "已从 WebSocket 收到 daily.activity.snapshot，活动流保持实时同步。"
          : "已从 /api/daily/events?mode=daily_work 同步活动流。"
      );
      setSelectedActivityEventId((currentId) =>
        nextEvents.some((event) => event.id === currentId)
          ? currentId
          : nextEvents[0]?.id ?? null
      );
    };

    async function fetchActivityEvents() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/events?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Activity events request failed: ${response.status}`);
        }

        applySnapshot((await response.json()) as DailyActivitySnapshotDto, "api");
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setActivityConnectionStatus("degraded");
        setActivityFeedNotice(
          "暂未取到后端活动列表，页面会继续保留前端 fallback 示例。"
        );
      }
    }

    function connectActivitySocket() {
      const socketUrl = getRuntimeWebSocketUrl(apiBaseUrl);

      if (!socketUrl) {
        setActivityConnectionStatus("degraded");
        setActivityFeedNotice("WebSocket 地址不可用，活动流继续使用当前快照。");
        return undefined;
      }

      const socket = new WebSocket(socketUrl);

      socket.addEventListener("open", () => {
        if (!isDisposed) {
          setActivityConnectionStatus("live");
        }
      });

      socket.addEventListener("message", (event) => {
        const payload = parseDailyActivitySnapshot(event.data);

        if (payload?.type === "daily.activity.snapshot") {
          applySnapshot(payload, "websocket");
        }
      });

      socket.addEventListener("error", () => {
        if (!isDisposed) {
          setActivityConnectionStatus("degraded");
          setActivityFeedNotice("WebSocket 连接失败，活动流继续使用当前快照。");
        }
      });

      socket.addEventListener("close", () => {
        if (!isDisposed) {
          setActivityConnectionStatus((currentStatus) =>
            currentStatus === "live" ? "closed" : "degraded"
          );
        }
      });

      return socket;
    }

    setActivityConnectionStatus("connecting");
    void fetchActivityEvents();
    const socket = connectActivitySocket();

    return () => {
      isDisposed = true;
      controller.abort();
      socket?.close();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = input.trim();
    if (!prompt) {
      return;
    }

    await submitPrompt(prompt);
  }

  async function submitPrompt(prompt: string) {
    if (!prompt || isBusy) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: ""
    };
    const controller = new AbortController();
    const nextMessages = [...messages, userMessage];
    let receivedContent = "";

    abortRef.current = controller;
    setInput("");
    setError(null);
    setLastSubmittedPrompt(prompt);
    setStatus("submitting");
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: activeMode,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(await formatChatError(response));
      }

      setStatus("streaming");
      await readAssistantResponse(response, (delta) => {
        receivedContent += delta;
        appendAssistantDelta(assistantMessage.id, delta);
      });

      if (!receivedContent.trim()) {
        setAssistantMessageContent(
          assistantMessage.id,
          "后端返回了空响应。请补充上下文后重试，或检查当前模型服务是否可用。"
        );
      }

      setStatus("idle");
    } catch (requestError) {
      if (controller.signal.aborted) {
        appendAssistantDelta(
          assistantMessage.id,
          receivedContent.trim() ? "\n\n已停止生成。" : "已停止生成。"
        );
        setStatus("idle");
      } else {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "发送请求时出现未知错误。";

        setError(message);
        setStatus("error");
        if (receivedContent.trim()) {
          appendAssistantDelta(assistantMessage.id, `\n\n请求中断：${message}`);
        } else {
          setAssistantMessageContent(
            assistantMessage.id,
            `请求没有完成。\n\n${message}`
          );
        }
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  function appendAssistantDelta(messageId: string, delta: string) {
    if (!delta) {
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, content: `${message.content}${delta}` }
          : message
      )
    );
  }

  function setAssistantMessageContent(messageId: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, content } : message
      )
    );
  }

  function cancelRequest() {
    abortRef.current?.abort();
  }

  function applyPrompt(prompt: string) {
    setError(null);
    setInput(prompt);
    inputRef.current?.focus();
  }

  async function applyTemplatePrompt(template: TemplateItem) {
    if (!template.enabled) {
      return;
    }

    const pendingPreview = createLocalTemplatePreviewState(
      template,
      "syncing",
      "正在请求 /api/daily/templates/:templateId/apply-preview，成功后会把后端 promptDraft 填入输入框。"
    );

    setTemplatePanel((current) => ({
      ...current,
      preview: pendingPreview
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/templates/${template.id}/apply-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Template apply-preview failed: ${response.status}`);
      }

      const preview = mapTemplatePreviewResponse(
        template,
        (await response.json()) as DailyWorkTemplateApplyPreviewResponseDto
      );

      applyPrompt(preview.promptDraft);
      setTemplatePanel((current) => ({
        ...current,
        preview
      }));
    } catch {
      const fallbackPreview: TemplatePreviewPanelState = {
        ...createLocalTemplatePreviewState(
          template,
          "degraded",
          "暂未从后端生成 template apply-preview，已回退到本地 preview-only 模板提示。"
        ),
        source: "degraded"
      };

      applyPrompt(fallbackPreview.promptDraft);
      setTemplatePanel((current) => ({
        ...current,
        preview: fallbackPreview
      }));
    }
  }

  function retryLastPrompt() {
    if (!lastSubmittedPrompt || isBusy) {
      return;
    }

    void submitPrompt(lastSubmittedPrompt);
  }

  async function restoreSessionHistory(item: SessionHistoryItem) {
    setSelectedSessionHistoryId(item.id);
    setSessionHistoryPanel((current) => ({
      ...current,
      restorePreview: createLocalSessionRestorePreviewState(
        item,
        "syncing",
        "正在请求 /api/daily/sessions/:sessionId/restore-preview，成功后会把后端 restorePrompt 填入输入框。"
      )
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/sessions/${item.id}/restore-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode,
            includeRecentMessages: true
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Session restore preview failed: ${response.status}`);
      }

      const restorePreview = mapSessionRestorePreviewResponse(
        item,
        (await response.json()) as DailyWorkSessionRestorePreviewResponseDto
      );

      applyPrompt(restorePreview.restorePrompt);
      setSessionHistoryPanel((current) => ({
        ...current,
        restorePreview
      }));
    } catch {
      const fallbackPreview: SessionRestorePreviewPanelState = {
        ...createLocalSessionRestorePreviewState(
          item,
          "degraded",
          "暂未从后端生成 restore-preview，已回退到本地 preview-only 恢复提示。"
        ),
        source: "degraded"
      };

      applyPrompt(fallbackPreview.restorePrompt);
      setSessionHistoryPanel((current) => ({
        ...current,
        restorePreview: fallbackPreview
      }));
    }
  }

  function useContextItem(item: ContextItem) {
    setSelectedContextId(item.id);
    applyPrompt(item.prompt);
  }

  function applyConnectorPrompt(item: ConnectorItem) {
    setSelectedConnectorId(item.id);
    applyPrompt(buildConnectorAccessPrompt(item));
  }

  function applyWorkflowActionPrompt(item: WorkflowActionItem) {
    setSelectedWorkflowActionId(item.id);
    const panelMatches =
      workflowPreviewPanel.workflowId === item.apiWorkflowId &&
      workflowPreviewPanel.actionId === item.apiActionId;

    applyPrompt(
      panelMatches
        ? buildWorkflowPreviewPrompt(item, workflowPreviewPanel)
        : item.prompt
    );
  }

  function applyActivityEventPrompt(item: ActivityEventItem) {
    setSelectedActivityEventId(item.id);
    applyPrompt(buildActivityEventPrompt(item));
  }

  function switchModelRoute(nextMode: ModelRouteMode) {
    setModelRouteMode(nextMode);
    applyPrompt(
      buildModelSwitchPrompt(
        modelUsagePanel.modelSnapshots[nextMode],
        modelUsagePanel.usageSnapshots[nextMode]
      )
    );
  }

  function updateApprovalStatus(
    approvalId: string,
    nextStatus: Exclude<ApprovalStatus, "waiting">
  ) {
    setApprovalRequests((current) =>
      current.map((item) =>
        item.id === approvalId ? { ...item, status: nextStatus } : item
      )
    );
  }

  async function updateConnectorPreviewDecision(
    connector: ConnectorItem,
    nextStatus: Exclude<ApprovalStatus, "waiting">
  ) {
    if (connector.requiredApprovalIds.length === 0) {
      return;
    }

    const applyLocalStatus = () => {
      setApprovalRequests((current) =>
        current.map((item) =>
          connector.requiredApprovalIds.includes(item.id)
            ? { ...item, status: nextStatus }
            : item
        )
      );
    };

    applyLocalStatus();
    setConnectorPreviewPanel((current) =>
      current.connectorId === connector.apiConnectorId
        ? {
            ...current,
            syncStatus: "syncing",
            notice: "正在向审批 decision API 写入 preview-only 决策。"
          }
        : current
    );

    try {
      const decision = nextStatus === "denied" ? "deny" : "approved";
      const responses = await Promise.all(
        connector.requiredApprovalIds.map(async (approvalId) => {
          const response = await fetch(
            `${apiBaseUrl}/api/daily/approvals/${approvalId}/decision`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                mode: activeMode,
                decision,
                reason: `Preview decision from ${connector.name}.`
              })
            }
          );

          if (!response.ok) {
            throw new Error(`Approval decision failed: ${response.status}`);
          }

          return (await response.json()) as DailyApprovalDecisionResponseDto;
        })
      );

      setApprovalRequests((current) =>
        current.map((item) => {
          const response = responses.find(
            (entry) => entry.request?.id === item.id
          );

          return response
            ? { ...item, status: mapApprovalDecisionStatus(response) }
            : item;
        })
      );
      setConnectorPreviewPanel((current) =>
        current.connectorId === connector.apiConnectorId
          ? {
              ...current,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/approvals/:approvalRequestId/decision 返回 preview-only 审批结果。"
            }
          : current
      );
    } catch {
      applyLocalStatus();
      setConnectorPreviewPanel((current) =>
        current.connectorId === connector.apiConnectorId
          ? {
              ...current,
              source: "degraded",
              syncStatus: "degraded",
              notice:
                "审批 decision API 暂不可用；已保留本地 preview-only 决策状态。"
            }
          : current
      );
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-4 text-teal-950 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[8px] border border-teal-100 bg-white shadow-[0_18px_70px_rgba(15,118,110,0.12)]">
        <header className="flex flex-col gap-4 border-b border-teal-100 bg-white/95 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-teal-600 text-white shadow-sm">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-xl font-semibold tracking-normal text-teal-950">
                SeekDesk
              </h1>
              <p className="truncate text-sm text-teal-700">
                日常工作模板、会话知识上下文与流式 AI 对话
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm">
              <Search className="size-4" aria-hidden="true" />
              搜索
            </Button>
            <Button variant="secondary" size="sm">
              <PanelLeft className="size-4" aria-hidden="true" />
              模板
            </Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
              <Play className="size-4" aria-hidden="true" />
              新建工作流
            </Button>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 bg-teal-50/40 lg:grid-cols-[304px_minmax(0,1fr)_336px]">
          <aside className="border-b border-teal-100 bg-white lg:border-b-0 lg:border-r">
            <PanelHeader
              icon={<Wand2 className="size-4" aria-hidden="true" />}
              title="模板库"
            />
            <div
              className="space-y-3 px-3 pb-4 pt-3"
              data-template-panel
              data-template-source={templatePanel.source}
              data-template-sync-status={templatePanel.syncStatus}
              data-template-count={templateItems.length}
              data-template-preview-source={templatePanel.preview.source}
              data-template-preview-only={
                templatePanel.preview.previewOnly ? "true" : "false"
              }
              data-template-preview-status={templatePanel.preview.syncStatus}
              data-template-preview-external-effects={templatePanel.preview.externalEffects.join(
                ","
              )}
            >
              <div className="rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-3 text-sm text-teal-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="break-words font-medium text-teal-950">
                      日常工作模式
                    </div>
                    <div className="mt-1 text-xs leading-5 text-teal-700">
                      选择模板会先生成 preview-only 草稿，你可以继续补充上下文后再发送。
                    </div>
                  </div>
                  <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
                    {templateItems.length}
                  </span>
                </div>

                <div
                  className="mt-3 rounded-[8px] border border-teal-100 bg-white px-2.5 py-2 text-xs leading-5 text-teal-700"
                  data-template-panel-notice={templatePanel.notice}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="font-medium text-teal-950">
                      {templatePanelSourceLabel(templatePanel.source)}
                    </span>
                    <span>/</span>
                    <span>{templatePanelSyncStatusLabel(templatePanel.syncStatus)}</span>
                  </div>
                  <div className="mt-1 break-words">{templatePanel.notice}</div>
                </div>

                <div
                  className="mt-2 rounded-[8px] border border-orange-100 bg-orange-50 px-2.5 py-2 text-xs leading-5 text-orange-800"
                  data-template-preview-notice={templatePanel.preview.notice}
                  data-template-preview-boundary={
                    templatePanel.preview.safetyStatement
                  }
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {templatePanel.preview.syncStatus === "syncing" ? (
                      <Loader2
                        className="size-3.5 shrink-0 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ShieldCheck
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="font-medium">
                      {templatePreviewSourceLabel(templatePanel.preview.source)}
                    </span>
                    <span>/</span>
                    <span>
                      {templatePreviewSyncStatusLabel(
                        templatePanel.preview.syncStatus
                      )}
                    </span>
                    <span>/ previewOnly=
                      {templatePanel.preview.previewOnly ? "true" : "false"}
                    </span>
                  </div>
                  <div className="mt-1 break-words">
                    {templatePanel.preview.safetyStatement}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {templateItems.map((template) => {
                  const Icon = template.icon;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => void applyTemplatePrompt(template)}
                      disabled={!template.enabled}
                      data-template-card={template.id}
                      data-template-enabled={template.enabled ? "true" : "false"}
                      className={cn(
                        "flex min-h-16 w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60",
                        template.enabled
                          ? "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                          : "border-slate-200 bg-slate-50"
                      )}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-teal-950">
                              {template.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] leading-4 text-teal-700">
                              {templateCategoryLabel(template.category)} /{" "}
                              {templateArtifactTypeLabel(template.artifactType)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-[999px] px-1.5 py-0.5 text-[10px] font-medium",
                              template.enabled
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {template.enabled ? "可用" : "停用"}
                          </span>
                        </span>
                        <span className="mt-1 block max-h-10 overflow-hidden text-xs leading-5 text-teal-700">
                          {template.description}
                        </span>
                        {template.tags.length > 0 ? (
                          <span className="mt-2 flex min-w-0 flex-wrap gap-1">
                            {template.tags.slice(0, 2).map((tag) => (
                              <span
                                key={`${template.id}-${tag}`}
                                className="max-w-full truncate rounded-[999px] bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <Code2 className="size-4" aria-hidden="true" />
                  编码模式兼容
                </div>
                <p className="text-xs leading-5">
                  架构保留 Coding Agent 能力位，当前页面只开放日常工作模式，不暴露编码工具。
                </p>
              </div>
            </div>
          </aside>

          <section className="flex min-h-[680px] min-w-0 flex-col bg-white">
            <PanelHeader
              icon={<MessageSquare className="size-4" aria-hidden="true" />}
              title="日常工作对话"
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="取消任务"
                  disabled={!isBusy}
                  onClick={cancelRequest}
                >
                  <Square className="size-4" aria-hidden="true" />
                </Button>
              }
            />

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-4">
              <div className="grid gap-3 md:grid-cols-3">
                <PromptCard
                  icon={<Mail className="size-4" aria-hidden="true" />}
                  title="邮件起草"
                  text="帮我写一封给客户的更新邮件，包含结果、时间线和下一步。"
                  onClick={applyPrompt}
                />
                <PromptCard
                  icon={<Presentation className="size-4" aria-hidden="true" />}
                  title="会议纪要"
                  text="把这些会议记录整理成可分享纪要，包含决策、负责人和风险。"
                  onClick={applyPrompt}
                />
                <PromptCard
                  icon={<Search className="size-4" aria-hidden="true" />}
                  title="研究简报"
                  text="把最新资料整理成简报，指出已知信息、缺口和建议下一步。"
                  onClick={applyPrompt}
                />
              </div>

              <PersistenceStatusPanel state={persistencePanel} />

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
                data-model-usage-source={modelUsagePanel.source}
                data-model-usage-status={modelUsagePanel.syncStatus}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Bot className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">模型与用量</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      DeepSeek 日常工作模式快照，启动后同步后端 daily_work 模型配置与 usage 统计。
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-[999px] px-2.5 py-1 text-[11px] font-medium",
                      modelUsagePanel.syncStatus === "live"
                        ? "bg-emerald-100 text-emerald-800"
                        : modelUsagePanel.syncStatus === "syncing"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-orange-100 text-orange-800"
                    )}
                  >
                    <Activity className="size-3.5" aria-hidden="true" />
                    {modelUsageSyncStatusLabel(modelUsagePanel.syncStatus)}
                  </span>

                  <div
                    className="inline-flex w-full rounded-[8px] border border-teal-200 bg-white p-1 md:w-auto"
                    aria-label="模型展示切换"
                    role="group"
                  >
                    {(["fast", "pro"] as const).map((mode) => {
                      const isActive = modelRouteMode === mode;
                      const snapshot = modelUsagePanel.modelSnapshots[mode];

                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => switchModelRoute(mode)}
                          className={cn(
                            "min-w-0 flex-1 rounded-[6px] px-3 py-2 text-left text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 md:min-w-28",
                            isActive
                              ? "bg-teal-600 text-white shadow-sm"
                              : "text-teal-700 hover:bg-teal-50"
                          )}
                        >
                          <span className="block truncate">
                            {mode === "fast" ? "快速" : "深度"}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block truncate text-[10px]",
                              isActive ? "text-teal-50" : "text-teal-500"
                            )}
                          >
                            {snapshot.selectedModel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
                      模型快照
                    </div>
                    <div className="space-y-2">
                      <SnapshotRow
                        label="当前模式"
                        value={activeModelSnapshot.currentMode}
                      />
                      <SnapshotRow
                        label="Provider"
                        value={activeModelSnapshot.provider}
                      />
                      <SnapshotRow
                        label="Base URL"
                        value={activeModelSnapshot.baseUrl}
                      />
                      <SnapshotRow
                        label="快速模型"
                        value={activeModelSnapshot.fastModel}
                      />
                      <SnapshotRow
                        label="深度模型"
                        value={activeModelSnapshot.proModel}
                      />
                      <SnapshotRow
                        label="当前使用"
                        value={activeModelSnapshot.selectedModel}
                      />
                      <SnapshotRow
                        label="实况路由"
                        value={modelRouteLabel(activeModelSnapshot.selectedRoute)}
                      />
                      <SnapshotRow
                        label="Thinking"
                        value={
                          activeModelSnapshot.thinkingMode === "enabled"
                            ? "enabled / 后端配置"
                            : "disabled / 后端配置"
                        }
                      />
                      <SnapshotRow
                        label="Stream Usage"
                        value={activeModelSnapshot.streamUsageEnabled ? "enabled" : "disabled"}
                      />
                      <SnapshotRow
                        label="API Key"
                        value={activeModelSnapshot.configured ? "已配置 / 不展示密钥" : "未配置 / mock usage"}
                      />
                    </div>
                    <p className="mt-3 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2 text-xs leading-5 text-teal-700">
                      路由策略：{activeModelSnapshot.routingStrategy}
                    </p>
                  </div>

                  <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                      用量快照
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <SessionMetric
                        label="输入 token"
                        value={formatTokenCount(activeUsageSnapshot.inputTokens)}
                      />
                      <SessionMetric
                        label="输出 token"
                        value={formatTokenCount(activeUsageSnapshot.outputTokens)}
                      />
                      <SessionMetric
                        label="合计 token"
                        value={formatTokenCount(usageTotalTokens)}
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      <SnapshotRow
                        label="窗口"
                        value={activeUsageSnapshot.usageWindow}
                      />
                      <SnapshotRow
                        label="成本"
                        value={activeUsageSnapshot.estimatedCost}
                      />
                      <SnapshotRow
                        label="预算/安全"
                        value={activeUsageSnapshot.budgetState}
                      />
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-teal-700">
                        <span>{budgetStateLabel(activeUsageSnapshot.budgetLevel)}</span>
                        <span>{usageBudgetPercent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-[999px] bg-teal-100">
                        <div
                          className="h-full rounded-[999px] bg-orange-500"
                          style={{ width: `${usageBudgetPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5",
                    modelUsagePanel.syncStatus === "degraded"
                      ? "border-orange-200 bg-orange-50 text-orange-800"
                      : "border-teal-100 bg-white text-teal-800"
                  )}
                >
                  {modelUsagePanel.notice}
                </div>

                <div className="mt-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                  边界：当前面板只消费 daily_work；coding_agent 的模型用量路径保留为兼容说明，不在此处切换或暴露编码工具状态。
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {[...activeModelSnapshot.notes, ...activeUsageSnapshot.notes].map(
                    (note) => (
                      <div
                        key={note}
                        className="flex items-start gap-2 rounded-[8px] border border-orange-200 bg-white px-3 py-2 text-xs leading-5 text-orange-800"
                      >
                        <AlertCircle
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 break-words">{note}</span>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-3 text-[11px] leading-5 text-teal-700">
                  更新时间：{activeModelSnapshot.updatedAt} / 用量更新时间：
                  {activeUsageSnapshot.updatedAt}
                </div>
              </div>

              <ChatThread
                endpoint={endpoint}
                error={error}
                lastSubmittedPrompt={lastSubmittedPrompt}
                messages={messages}
                messagesEndRef={messagesEndRef}
                modelName={activeModelSnapshot.selectedModel}
                onDismissError={() => setError(null)}
                onRetry={retryLastPrompt}
                status={status}
              />

              <div
                className="rounded-[8px] border border-teal-100 bg-white p-3"
                data-activity-feed
                data-activity-feed-count={activityFeedEvents.length}
                data-activity-feed-source={activityFeedSource}
                data-activity-connection-status={activityConnectionStatus}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Activity className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">实时活动流 / 状态事件</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      daily_work 的任务状态轨迹：记录会话恢复、模板填入、审批变化、工作流预演和产物复用状态。
                    </p>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">
                    <Lock className="size-3.5" aria-hidden="true" />
                    {activityFeedEvents.length} 条活动事件
                  </span>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <ActivityFeedMeta
                    label="事件来源"
                    value={activityFeedSourceLabel(activityFeedSource)}
                  />
                  <ActivityFeedMeta
                    label="连接状态"
                    value={activityConnectionStatusLabel(activityConnectionStatus)}
                  />
                  <ActivityFeedMeta label="最近更新" value={activityLastUpdated} />
                </div>

                <div
                  className={cn(
                    "mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5",
                    activityConnectionStatus === "degraded"
                      ? "border-orange-200 bg-orange-50 text-orange-800"
                      : "border-teal-100 bg-teal-50 text-teal-800"
                  )}
                >
                  {activityFeedNotice}
                </div>

                <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
                  编码模式兼容提示：这些事件只描述 daily_work 日常工作自动化状态，不暴露 coding_agent 命令、仓库操作或脚本工具。
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                  <div className="space-y-2">
                    {activityFeedEvents.map((event) => {
                      const Icon = event.icon;
                      const isSelected = selectedActivityEvent?.id === event.id;

                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedActivityEventId(event.id)}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isSelected
                              ? "border-teal-400 bg-teal-50 shadow-sm"
                              : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-white text-teal-700 ring-1 ring-teal-100">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-medium text-teal-950">
                                  {event.title}
                                </span>
                                <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                  {event.time} / {event.type} / {event.relatedObject}
                                </span>
                              </span>
                              <ActivityEventStatusPill status={event.status} />
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {event.summary}
                            </span>
                            <span className="mt-2 block break-words text-[11px] leading-4 text-orange-700">
                              安全边界：{event.safetyBoundary}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedActivityEvent ? (
                    <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-teal-700">
                            选中事件
                          </div>
                          <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                            {selectedActivityEvent.title}
                          </div>
                          <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                            {selectedActivityEvent.promptFocus}
                          </div>
                        </div>
                        <ActivityEventStatusPill status={selectedActivityEvent.status} />
                      </div>

                      <div className="mt-3 grid gap-2">
                        <ArtifactDetailRow
                          label="事件类型"
                          value={selectedActivityEvent.type}
                        />
                        <ArtifactDetailRow
                          label="发生时间"
                          value={selectedActivityEvent.time}
                        />
                        <ArtifactDetailRow
                          label={`关联对象：${selectedActivityEvent.relatedObject}`}
                          value={selectedActivityEvent.relatedLabel}
                        />
                      </div>

                      <ArtifactDetailBlock
                        icon={<ShieldCheck className="size-4" aria-hidden="true" />}
                        title="安全边界"
                      >
                        {selectedActivityEvent.safetyBoundary}
                      </ArtifactDetailBlock>

                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
                        onClick={() => applyActivityEventPrompt(selectedActivityEvent)}
                      >
                        <Send className="size-4" aria-hidden="true" />
                        将事件转为 Prompt
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Workflow className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">工作流编排预演 / Action Queue</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      daily_work 当前只做自动化预演：不调用外部系统、不自动发送邮件、不写入日历或文档。
                    </p>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-white px-2.5 py-1 text-[11px] font-medium text-teal-700">
                    <Lock className="size-3.5" aria-hidden="true" />
                    预演队列 {filteredWorkflowActions.length}/{workflowActions.length}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2" aria-label="工作流动作筛选">
                  {workflowActionFilters.map((filter) => {
                    const isActive = workflowActionFilter === filter;

                    return (
                      <button
                        key={filter}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setWorkflowActionFilter(filter)}
                        className={cn(
                          "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                          isActive
                            ? "border-teal-600 bg-teal-600 text-white"
                            : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                        )}
                      >
                        <span>{filter}</span>
                        <span
                          className={cn(
                            "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                            isActive ? "bg-white/20 text-white" : "bg-teal-50 text-teal-700"
                          )}
                        >
                          {workflowActionFilterCount(filter)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="space-y-2">
                    {filteredWorkflowActions.map((action) => {
                      const Icon = action.icon;
                      const isSelected = selectedWorkflowAction?.id === action.id;

                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => setSelectedWorkflowActionId(action.id)}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isSelected
                              ? "border-teal-400 bg-white shadow-sm"
                              : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-white text-teal-700 ring-1 ring-teal-100">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-medium text-teal-950">
                                  {action.title}
                                </span>
                                <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                  {action.actionType} / {action.connector}
                                </span>
                              </span>
                              <WorkflowActionStatusPill status={action.approvalStatus} />
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {action.summary}
                            </span>
                            <span className="mt-2 flex flex-wrap items-center gap-2">
                              <ConnectorRiskPill riskLevel={action.riskLevel} />
                              <span className="inline-flex min-w-0 items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">{action.artifact}</span>
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedWorkflowAction ? (
                    <div
                      className="rounded-[8px] border border-teal-100 bg-white p-3"
                      data-workflow-preview-panel
                      data-api-workflow-id={workflowPreviewPanel.workflowId}
                      data-workflow-preview-action={workflowPreviewPanel.actionId}
                      data-workflow-preview-source={workflowPreviewPanel.source}
                      data-workflow-preview-sync-status={
                        workflowPreviewPanel.syncStatus
                      }
                      data-workflow-preview-status={
                        workflowPreviewPanel.selectedActionStatus
                      }
                      data-workflow-preview-only={String(
                        workflowPreviewPanel.previewOnly
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-teal-700">
                            选中动作
                          </div>
                          <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                            {selectedWorkflowAction.title}
                          </div>
                          <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                            {selectedWorkflowAction.nextStep}
                          </div>
                        </div>
                        <WorkflowActionStatusPill
                          status={selectedWorkflowAction.approvalStatus}
                        />
                      </div>

                      <div className="mt-3 grid gap-2">
                        <ArtifactDetailRow
                          label="关联连接器"
                          value={selectedWorkflowAction.connector}
                        />
                        <ArtifactDetailRow
                          label="上下文"
                          value={selectedWorkflowAction.context}
                        />
                        <ArtifactDetailRow
                          label="预期产物"
                          value={selectedWorkflowAction.artifact}
                        />
                      </div>

                      <div className="mt-3 rounded-[8px] border border-cyan-100 bg-cyan-50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-950">
                              <Workflow
                                className="size-4 shrink-0 text-cyan-700"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 break-words">
                                工作流 API 预演合同
                              </span>
                            </div>
                            <div className="mt-1 break-words font-mono text-[11px] text-cyan-700">
                              POST /api/daily/workflows/
                              {workflowPreviewPanel.workflowId}/preview ·{" "}
                              {workflowPreviewPanel.actionId}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-cyan-700">
                            {workflowPreviewPanel.source} /{" "}
                            {workflowPreviewPanel.syncStatus}
                          </span>
                        </div>

                        <div
                          className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-900"
                          data-workflow-preview-summary
                        >
                          {workflowPreviewPanel.summary}
                        </div>

                        <div className="mt-3 space-y-1">
                          {workflowPreviewPanel.steps.map((step) => (
                            <div
                              key={`${workflowPreviewPanel.actionId}-${step}`}
                              className="flex items-start gap-2 rounded-[8px] border border-cyan-100 bg-white px-2.5 py-2 text-xs leading-5 text-slate-700"
                              data-workflow-preview-step
                            >
                              <CheckCircle2
                                className="mt-0.5 size-3.5 shrink-0 text-cyan-700"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 break-words">{step}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 grid gap-2">
                          <ArtifactDetailRow
                            label="连接器链路"
                            value={workflowPreviewPanel.connectorLinks.join("、")}
                          />
                          <ArtifactDetailRow
                            label="上下文链路"
                            value={workflowPreviewPanel.contextLinks.join("、")}
                          />
                          <ArtifactDetailRow
                            label="产物链路"
                            value={workflowPreviewPanel.artifactLinks.join("、")}
                          />
                          <ArtifactDetailRow
                            label="审批链路"
                            value={workflowPreviewPanel.approvalLinks.join("、")}
                          />
                        </div>

                        <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                          {workflowPreviewPanel.safetyStatement}
                        </div>
                        <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-800">
                          {workflowPreviewPanel.notice}
                        </div>
                      </div>

                      <ArtifactDetailBlock
                        icon={<AlertCircle className="size-4" aria-hidden="true" />}
                        title="风险提示"
                      >
                        {selectedWorkflowAction.riskNote}
                      </ArtifactDetailBlock>

                      <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
                        这个按钮只会把所选动作转换为聊天 prompt；发送前仍由你确认，不会触发邮件、日历、文档或外部工具。
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
                        onClick={() => applyWorkflowActionPrompt(selectedWorkflowAction)}
                      >
                        <Send className="size-4" aria-hidden="true" />
                        生成预演 Prompt
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
                data-session-history-panel
                data-session-history-source={sessionHistoryPanel.source}
                data-session-history-sync-status={sessionHistoryPanel.syncStatus}
                data-session-history-count={sessionHistoryPanelItems.length}
                data-session-restore-source={sessionHistoryPanel.restorePreview.source}
                data-session-restore-sync-status={
                  sessionHistoryPanel.restorePreview.syncStatus
                }
                data-session-restore-preview-only={
                  sessionHistoryPanel.restorePreview.previewOnly
                }
                data-session-restore-external-effects={sessionHistoryPanel.restorePreview.externalEffects.join(
                  ","
                )}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Workflow className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">最近工作流 / 会话历史</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      从 daily_work sessions API 同步会话快照，并通过 restore-preview 预演把可继续工作的提示填入输入框。
                    </p>
                  </div>

                  <div
                    className="flex shrink-0 flex-wrap gap-2"
                    aria-label="会话历史筛选"
                  >
                    {sessionHistoryFilters.map((filter) => {
                      const isActive = sessionHistoryFilter === filter;

                      return (
                        <button
                          key={filter}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSessionHistoryFilter(filter)}
                          className={cn(
                            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isActive
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span>{filter}</span>
                          <span
                            className={cn(
                              "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-teal-50 text-teal-700"
                            )}
                          >
                            {sessionHistoryFilterCount(filter, sessionHistoryPanelItems)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  <InfoRow
                    label="会话同步"
                    value={`${sessionHistorySourceLabel(
                      sessionHistoryPanel.source
                    )} / ${sessionHistorySyncStatusLabel(
                      sessionHistoryPanel.syncStatus
                    )}`}
                  />
                  <InfoRow
                    label="恢复预演"
                    value={`${sessionRestorePreviewSourceLabel(
                      sessionHistoryPanel.restorePreview.source
                    )} / ${sessionRestorePreviewSyncStatusLabel(
                      sessionHistoryPanel.restorePreview.syncStatus
                    )} / previewOnly=${
                      sessionHistoryPanel.restorePreview.previewOnly ? "true" : "false"
                    } / externalEffects=${sessionHistoryPanel.restorePreview.externalEffects.join(
                      ","
                    )}`}
                  />
                </div>

                <div
                  className="mt-2 rounded-[8px] border border-teal-100 bg-white px-3 py-2 text-[11px] leading-5 text-teal-800"
                  data-session-history-notice
                >
                  {sessionHistoryPanel.notice}
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-2">
                    {filteredSessionHistory.map((item) => {
                      const Icon = item.icon;
                      const isSelected = selectedSessionHistory?.id === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-session-card={item.id}
                          onClick={() => {
                            setSelectedSessionHistoryId(item.id);
                            setSessionHistoryPanel((current) => ({
                              ...current,
                              restorePreview: createLocalSessionRestorePreviewState(item)
                            }));
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isSelected
                              ? "border-teal-400 bg-white shadow-sm"
                              : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-white text-teal-700 ring-1 ring-teal-100">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-medium text-teal-950">
                                  {item.title}
                                </span>
                                <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                  {item.updatedAt} / {item.mode}
                                </span>
                              </span>
                              <SessionStatusPill status={item.status} />
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {item.summary}
                            </span>
                            <span className="mt-2 block break-words text-[11px] leading-4 text-orange-700">
                              上次动作：{item.lastAction}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedSessionHistory ? (
                    <div
                      className="rounded-[8px] border border-teal-100 bg-white p-3"
                      data-session-detail={selectedSessionHistory.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-teal-700">
                            可恢复会话
                          </div>
                          <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                            {selectedSessionHistory.title}
                          </div>
                          <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                            {selectedSessionHistory.summary}
                          </div>
                        </div>
                        <SessionStatusPill status={selectedSessionHistory.status} />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <SessionMetric
                          label="产物"
                          value={`${selectedSessionHistory.artifactCount}`}
                        />
                        <SessionMetric
                          label="审批"
                          value={`${selectedSessionHistory.approvalCount}`}
                        />
                        <SessionMetric
                          label="上下文"
                          value={`${selectedSessionHistory.contextCount}`}
                        />
                        <SessionMetric
                          label="消息"
                          value={`${selectedSessionHistory.messageCount}`}
                        />
                      </div>

                      <ArtifactDetailBlock
                        icon={<Target className="size-4" aria-hidden="true" />}
                        title="上次动作"
                      >
                        {selectedSessionHistory.lastAction}
                      </ArtifactDetailBlock>

                      <ArtifactDetailBlock
                        icon={<Database className="size-4" aria-hidden="true" />}
                        title="关联链路"
                      >
                        {formatSessionLinkList("产物", selectedSessionHistory.artifactIds)}
                        {" / "}
                        {formatSessionLinkList(
                          "上下文",
                          selectedSessionHistory.contextItemIds
                        )}
                        {" / "}
                        {formatSessionLinkList(
                          "审批",
                          selectedSessionHistory.approvalRequestIds
                        )}
                      </ArtifactDetailBlock>

                      <ArtifactDetailBlock
                        icon={<MessageSquare className="size-4" aria-hidden="true" />}
                        title="最近消息"
                      >
                        {formatSessionRecentMessagePreview(selectedSessionHistory)}
                      </ArtifactDetailBlock>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedSessionHistory.tags.map((tag) => (
                          <span
                            key={`${selectedSessionHistory.id}-${tag}`}
                            className="max-w-full rounded-[999px] bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700"
                          >
                            <span className="break-words">{tag}</span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
                        恢复会先请求后端 restore-preview，成功后填入 API 返回的 restorePrompt；当前预演只进入输入框，由你确认后再发送，不执行外部效果。
                        <span className="mt-1 block text-[11px]">
                          {sessionHistoryPanel.restorePreview.notice}
                        </span>
                        <span className="mt-1 block text-[11px] text-orange-700">
                          {sessionHistoryPanel.restorePreview.safetyStatement}
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full cursor-pointer bg-orange-500 hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
                        disabled={
                          sessionHistoryPanel.restorePreview.syncStatus === "syncing"
                        }
                        onClick={() => void restoreSessionHistory(selectedSessionHistory)}
                      >
                        {sessionHistoryPanel.restorePreview.syncStatus === "syncing" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Play className="size-4" aria-hidden="true" />
                        )}
                        恢复到输入框
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

            </div>

            <form className="border-t border-teal-100 bg-white p-4" onSubmit={handleSubmit}>
              <div className="flex min-h-16 items-end gap-3 rounded-[8px] border border-teal-200 bg-white px-3 py-2 shadow-inner focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                <textarea
                  ref={inputRef}
                  className="max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-teal-950 outline-none placeholder:text-teal-500"
                  placeholder={modelInputPlaceholder}
                  aria-label="日常工作输入"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={isBusy}
                  rows={1}
                />
                <Button
                  size="sm"
                  type="submit"
                  disabled={!input.trim() || isBusy}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {isBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  {status === "submitting"
                    ? "连接中"
                    : status === "streaming"
                      ? "接收中"
                      : "发送"}
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-teal-600">
                <span>Endpoint: {endpoint}</span>
                <span>模式: daily_work</span>
                <span>状态: {statusLabel(status)}</span>
                {selectedContextId ? (
                  <span>上下文: {selectedContextLabel(selectedContextId)}</span>
                ) : null}
              </div>
            </form>
          </section>

          <aside className="border-t border-teal-100 bg-white lg:border-l lg:border-t-0">
            <PanelHeader
              icon={<Workflow className="size-4" aria-hidden="true" />}
              title="审批 / 上下文 / 产物"
            />
            <div className="space-y-4 px-3 pb-4 pt-3">
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-950">
                  <ShieldCheck className="size-4 text-amber-700" aria-hidden="true" />
                  许可审批台账
                </div>
                <div className="space-y-2">
                  {approvalRequests.map((request) => {
                    const Icon = request.icon;

                    return (
                      <div
                        key={request.id}
                        data-approval-request={request.id}
                        data-approval-status={request.status}
                        className="rounded-[8px] border border-amber-100 bg-white px-3 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-amber-50 text-amber-700">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-teal-950">
                                  {request.title}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-teal-700">
                                  {request.requestedAction}
                                </div>
                              </div>
                              <StatusPill status={request.status} />
                            </div>

                            <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-700">
                              <InfoRow label="风险等级" value={request.risk} />
                              <InfoRow label="范围边界" value={request.scope} />
                              <InfoRow label="当前状态" value={approvalStatusLabel(request.status)} />
                            </div>

                            <p className="mt-2 text-xs leading-5 text-amber-800">
                              {request.detail}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                data-approval-decision-action="allow_once"
                                data-approval-decision-target={request.id}
                                className="h-8 rounded-[8px] border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                                onClick={() =>
                                  updateApprovalStatus(request.id, "allowed_once")
                                }
                              >
                                允许一次
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                data-approval-decision-action="deny"
                                data-approval-decision-target={request.id}
                                className="h-8 rounded-[8px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                onClick={() => updateApprovalStatus(request.id, "denied")}
                              >
                                拒绝
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-5 text-amber-800">
                  这里只做本地状态流转，不会触发真实邮件、日历或外部系统操作。
                </p>
              </div>

              <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                  <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                  会话知识上下文
                </div>
                <div className="space-y-2">
                  {contextItems.map((item) => {
                    const Icon = item.icon;
                    const isSelected = selectedContextId === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => useContextItem(item)}
                        className={cn(
                          "w-full rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                          isSelected
                            ? "border-teal-300 bg-white shadow-sm"
                            : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-teal-950">
                                {item.title}
                              </span>
                              <span className="shrink-0 rounded-[999px] bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                                {item.status}
                              </span>
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-teal-700">
                              {item.source} / {item.sourceType}
                            </span>
                            <span className="mt-2 block text-xs leading-5 text-slate-700">
                              {item.summary}
                            </span>
                            <span className="mt-2 inline-flex items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              <Lock className="size-3.5" aria-hidden="true" />
                              {item.privacy}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-5 text-teal-700">
                  点击任一上下文会把它带入输入框。当前版本只做会话级示意，不读取真实文件或文档内容。
                </p>
              </div>

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
              >
                <div className="mb-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <Globe className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">连接器目录</span>
                    </div>
                    <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
                      {filteredConnectors.length}/{connectorItems.length}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-teal-700">
                    当前只做目录和权限预演，不读取真实文档、日历、邮件、笔记或团队知识库。
                  </p>
                  <div className="flex flex-wrap gap-2" aria-label="连接器筛选">
                    {connectorFilters.map((filter) => {
                      const isActive = connectorFilter === filter;

                      return (
                        <button
                          key={filter}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setConnectorFilter(filter)}
                          className={cn(
                            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isActive
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-teal-200 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span>{filter}</span>
                          <span
                            className={cn(
                              "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                              isActive ? "bg-white/20 text-white" : "bg-teal-100 text-teal-700"
                            )}
                          >
                            {connectorFilterCount(filter)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredConnectors.map((connector) => {
                    const Icon = connector.icon;
                    const isSelected = selectedConnector?.id === connector.id;

                    return (
                      <button
                        key={connector.id}
                        type="button"
                        onClick={() => setSelectedConnectorId(connector.id)}
                        className={cn(
                          "w-full cursor-pointer rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                          isSelected
                            ? "border-teal-300 bg-white shadow-sm"
                            : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                        )}
                      >
                        <span className="flex items-start gap-3">
                          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-medium text-teal-950">
                                  {connector.name}
                                </span>
                                <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                  {connector.category} / {connector.provider}
                                </span>
                              </span>
                              <ConnectorPermissionPill state={connector.permissionState} />
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {connector.description}
                            </span>
                            <span className="mt-2 flex flex-wrap items-center gap-2">
                              <ConnectorRiskPill riskLevel={connector.riskLevel} />
                              <span className="inline-flex min-w-0 items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">{connector.status}</span>
                              </span>
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedConnector ? (
                  <div className="mt-3 border-t border-teal-100 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-teal-700">
                          {selectedConnector.category} 连接器
                        </div>
                        <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                          {selectedConnector.name}
                        </div>
                        <div className="mt-1 break-words text-xs leading-5 text-teal-700">
                          {selectedConnector.lastSyncLabel}
                        </div>
                      </div>
                      <ConnectorRiskPill riskLevel={selectedConnector.riskLevel} />
                    </div>

                    <div className="mt-3 grid gap-2">
                      <StatusRow label="权限状态" value={selectedConnector.permissionState} />
                      <StatusRow label="Provider" value={selectedConnector.provider} />
                      <StatusRow label="目录状态" value={selectedConnector.status} />
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
                        <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                        可用动作
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedConnector.availableActions.map((action) => (
                          <span
                            key={`${selectedConnector.id}-${action}`}
                            className="max-w-full rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700"
                          >
                            <span className="break-words">{action}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div
                      className="mt-3 rounded-[8px] border border-cyan-200 bg-cyan-50 px-3 py-3"
                      data-approval-preview-panel
                      data-api-connector-id={connectorPreviewPanel.connectorId}
                      data-connector-action-preview={connectorPreviewPanel.action}
                      data-connector-preview-source={connectorPreviewPanel.source}
                      data-connector-preview-sync-status={
                        connectorPreviewPanel.syncStatus
                      }
                      data-connector-preview-status={selectedConnectorPreviewStatus}
                      data-connector-preview-only={String(
                        connectorPreviewPanel.previewOnly
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-950">
                            <ShieldCheck
                              className="size-4 shrink-0 text-cyan-700"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">
                              工具调用预览 / preview-only
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-cyan-800">
                            POST /api/daily/connectors/
                            {connectorPreviewPanel.connectorId}/preview ·{" "}
                            {connectorPreviewPanel.action}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-cyan-700">
                            Source: {connectorPreviewPanel.source} · Status:{" "}
                            {connectorPreviewPanel.syncStatus}
                          </p>
                        </div>
                        <StatusPill status={selectedConnectorPreviewStatus} />
                      </div>

                      <div className="mt-3 grid gap-2">
                        <StatusRow
                          label="关联上下文"
                          value={
                            connectorPreviewPanel.relatedContextItemIds.length > 0
                              ? connectorPreviewPanel.relatedContextItemIds.join("、")
                              : "无需上下文"
                          }
                        />
                        <StatusRow
                          label="审批请求"
                          value={
                            connectorPreviewPanel.requiredApprovalRequestIds.length > 0
                              ? connectorPreviewPanel.requiredApprovalRequestIds.join("、")
                              : "无需审批"
                          }
                        />
                      </div>

                      <div
                        className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-900"
                        data-connector-preview-summary
                      >
                        {connectorPreviewPanel.summary}
                      </div>

                      <div className="mt-3 space-y-1">
                        {connectorPreviewPanel.steps.map((step) => (
                          <div
                            key={`${connectorPreviewPanel.connectorId}-${step}`}
                            className="flex items-start gap-2 rounded-[8px] border border-cyan-100 bg-white px-2.5 py-2 text-xs leading-5 text-slate-700"
                            data-connector-preview-step
                          >
                            <CheckCircle2
                              className="mt-0.5 size-3.5 shrink-0 text-cyan-700"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">{step}</span>
                          </div>
                        ))}
                      </div>

                      {selectedConnectorApprovalRequests.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {selectedConnectorApprovalRequests.map((request) => (
                            <div
                              key={`${selectedConnector.id}-${request.id}`}
                              className="flex items-center justify-between gap-3 rounded-[8px] border border-cyan-100 bg-white px-2.5 py-2"
                              data-approval-preview-request={request.id}
                              data-approval-preview-status={request.status}
                            >
                              <span className="min-w-0 break-words text-xs font-medium text-cyan-950">
                                {request.title}
                              </span>
                              <StatusPill status={request.status} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-800">
                          该连接器当前仅开放公开引用预览，不需要审批即可生成接入提示。
                        </p>
                      )}

                      <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                        {connectorPreviewPanel.safetyStatement}
                      </div>

                      <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-800">
                        {connectorPreviewPanel.notice}
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={selectedConnector.requiredApprovalIds.length === 0}
                          data-approval-decision-action="allow_once"
                          data-approval-decision-target={selectedConnector.id}
                          className="h-8 rounded-[8px] border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50"
                          onClick={() => {
                            void updateConnectorPreviewDecision(
                              selectedConnector,
                              "allowed_once"
                            );
                          }}
                        >
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          批准预览
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={selectedConnector.requiredApprovalIds.length === 0}
                          data-approval-decision-action="deny"
                          data-approval-decision-target={selectedConnector.id}
                          className="h-8 rounded-[8px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            void updateConnectorPreviewDecision(
                              selectedConnector,
                              "denied"
                            );
                          }}
                        >
                          <Square className="size-4" aria-hidden="true" />
                          拒绝预览
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-[8px] border border-teal-100 bg-white px-3 py-2">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
                        <AlertCircle className="size-4 text-orange-600" aria-hidden="true" />
                        下一步接入提示
                      </div>
                      <ul className="space-y-1">
                        {selectedConnector.notes.map((note) => (
                          <li
                            key={`${selectedConnector.id}-${note}`}
                            className="flex items-start gap-2 text-xs leading-5 text-slate-700"
                          >
                            <CheckCircle2
                              className="mt-0.5 size-3.5 shrink-0 text-teal-700"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
                      onClick={() => applyConnectorPrompt(selectedConnector)}
                    >
                      <Send className="size-4" aria-hidden="true" />
                      填入接入提示
                    </Button>
                    <p className="mt-2 text-xs leading-5 text-teal-700">
                      该操作只填充输入框，不接真实授权、登录或外部服务。
                    </p>
                  </div>
                ) : null}
              </div>

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
                data-artifact-panel
                data-artifact-panel-source={artifactPanel.source}
                data-artifact-panel-sync-status={artifactPanel.syncStatus}
                data-artifact-panel-notice={artifactPanel.notice}
                data-artifact-panel-count={artifactItems.length}
                data-artifacts-panel
                data-artifacts-source={artifactPanel.source}
                data-artifacts-sync-status={artifactPanel.syncStatus}
                data-artifacts-count={artifactItems.length}
                data-selected-artifact-id={selectedArtifact?.id ?? ""}
              >
                <div className="mb-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <CheckCircle2
                        className="size-4 shrink-0 text-teal-700"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 break-words">日常工作产物</span>
                    </div>
                    <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
                      {filteredArtifacts.length}/{artifactItems.length}
                    </span>
                  </div>

                  <div className="rounded-[8px] border border-teal-100 bg-white px-3 py-2 text-xs leading-5 text-teal-700">
                    <span className="font-medium text-teal-950">
                      {artifactPanel.source} / {artifactPanel.syncStatus}
                    </span>
                    <span className="ml-2">{artifactPanel.notice}</span>
                  </div>

                  <div className="flex flex-wrap gap-2" aria-label="产物筛选">
                    {artifactFilters.map((filter) => {
                      const isActive = artifactFilter === filter;

                      return (
                        <button
                          key={filter}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setArtifactFilter(filter)}
                          className={cn(
                            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isActive
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span>{filter}</span>
                          <span
                            className={cn(
                              "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-teal-50 text-teal-700"
                            )}
                          >
                            {artifactFilterCount(filter, artifactItems)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredArtifacts.map((artifact) => {
                    const Icon = artifact.icon;
                    const isSelected = selectedArtifact?.id === artifact.id;

                    return (
                      <button
                        key={artifact.id}
                        type="button"
                        onClick={() => setSelectedArtifactId(artifact.id)}
                        data-artifact-card={artifact.id}
                        data-artifact-state={artifact.state}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                          isSelected
                            ? "border-teal-400 bg-white shadow-sm"
                            : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                        )}
                      >
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block break-words text-sm font-medium text-teal-950">
                                {artifact.title}
                              </span>
                              <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                {artifact.artifactType} / {artifact.owner}
                              </span>
                            </span>
                            <ArtifactStatePill state={artifact.state} />
                          </span>
                          <span className="mt-2 block break-words text-xs leading-5 text-teal-700">
                            {artifact.description}
                          </span>
                          <span className="mt-2 block break-words text-[11px] leading-4 text-slate-500">
                            更新：{artifact.updatedAt}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedArtifact ? (
                  <div
                    className="mt-3 border-t border-teal-100 pt-3"
                    data-artifact-detail={selectedArtifact.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-teal-700">
                          {selectedArtifact.artifactType}
                        </div>
                        <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                          {selectedArtifact.title}
                        </div>
                        <div className="mt-1 break-words text-xs leading-5 text-teal-700">
                          {selectedArtifact.description}
                        </div>
                      </div>
                      <ArtifactStatePill state={selectedArtifact.state} />
                    </div>

                    <ArtifactDetailBlock
                      icon={<FileText className="size-4" aria-hidden="true" />}
                      title="摘要"
                    >
                      {selectedArtifact.summary}
                    </ArtifactDetailBlock>

                    <div className="mt-3 grid gap-2">
                      <ArtifactDetailRow label="来源模板" value={selectedArtifact.templateTitle} />
                      <ArtifactDetailRow label="来源上下文" value={selectedArtifact.source} />
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
                        <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                        上下文 / 审批追踪
                      </div>
                      <div className="space-y-2">
                        {selectedArtifact.trace.map((traceItem) => (
                          <div
                            key={`${selectedArtifact.id}-${traceItem.label}`}
                            className="rounded-[8px] border border-teal-100 bg-white px-3 py-2"
                          >
                            <div className="text-[11px] font-medium text-teal-700">
                              {traceItem.label}
                            </div>
                            <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                              {traceItem.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <ArtifactDetailBlock
                      icon={<Target className="size-4" aria-hidden="true" />}
                      title="下一步行动"
                    >
                      {selectedArtifact.nextAction}
                    </ArtifactDetailBlock>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedArtifact.tags.map((tag) => (
                        <span
                          key={`${selectedArtifact.id}-${tag}`}
                          className="max-w-full rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700"
                        >
                          <span className="break-words">{tag}</span>
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-orange-200 bg-white px-3 py-2 text-xs leading-5 text-orange-800">
                      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">
                        权限状态：{selectedArtifact.permissionStatus}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                  <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
                  模式快照
                </div>
                <div className="space-y-2 text-sm text-teal-700">
                  <StatusRow label="当前模式" value="daily_work" />
                  <StatusRow label="对话传输" value="Streaming" />
                  <StatusRow label="上下文来源" value="会话级预览" />
                  <StatusRow label="审批请求" value={`${approvalRequests.length} 项`} />
                </div>
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <Code2 className="size-4" aria-hidden="true" />
                  编码模式兼容
                </div>
                <p className="text-xs leading-5">
                  当前分支没有开放文件、Shell 或 Git 工具；后续可在同一模式契约下扩展编码能力。
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function getRuntimeApiBaseUrl() {
  if (typeof window === "undefined") {
    return defaultApiBaseUrl;
  }

  const smokeApiUrl = new URLSearchParams(window.location.search).get(
    "seekdeskSmokeApiUrl"
  );

  return smokeApiUrl || defaultApiBaseUrl;
}

function getRuntimeWebSocketUrl(apiBaseUrl: string) {
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

async function readAssistantResponse(
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

function assistantResponseMode(contentType: string): AssistantResponseMode {
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

async function formatChatError(response: Response) {
  const fallback = `请求失败：${response.status}`;

  try {
    const detail = extractAssistantTextPayload(await response.text());
    return detail ? `${fallback}：${detail}` : fallback;
  } catch {
    return fallback;
  }
}

function extractAssistantTextPayload(payload: string): string {
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

function extractAssistantTextFromJson(value: unknown): string | null {
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

function joinAssistantText(parts: Array<string | null>) {
  const content = parts.filter((part): part is string => Boolean(part)).join("");
  return content || null;
}

function isJsonLike(value: string) {
  return (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  );
}

function parseDailyActivitySnapshot(data: unknown): DailyActivitySnapshotDto | null {
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

function mapDailyActivitySnapshot(payload: DailyActivitySnapshotDto) {
  if (!isDailyActivitySnapshot(payload)) {
    return [];
  }

  return (payload.events ?? [])
    .filter((event) => event.mode === undefined || event.mode === activeMode)
    .map(mapDailyActivityEvent);
}

function mapDailyActivityEvent(event: DailyActivityEventDto): ActivityEventItem {
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

function isDailyActivitySnapshot(value: unknown): value is DailyActivitySnapshotDto {
  if (!isRecord(value) || !Array.isArray(value.events)) {
    return false;
  }

  return value.events.every(isDailyActivityEvent);
}

function isDailyActivityEvent(value: unknown): value is DailyActivityEventDto {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function backendEventTypeToActivityType(
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

function isActivityEventType(value: string): value is ActivityEventType {
  return (
    value === "session" ||
    value === "workflow" ||
    value === "artifact" ||
    value === "approval" ||
    value === "connector"
  );
}

function backendActivityStatusLabel(status: string): ActivityEventStatus {
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

function backendActivityIcon(eventType: string, type: ActivityEventType) {
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

function firstRelatedRefLabel(relatedRefs?: DailyActivityRelatedRefs) {
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

function formatActivityTimestamp(timestamp: string) {
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

function formatActivityUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function ChatThread({
  endpoint,
  error,
  lastSubmittedPrompt,
  messages,
  messagesEndRef,
  modelName,
  onDismissError,
  onRetry,
  status
}: {
  endpoint: string;
  error: string | null;
  lastSubmittedPrompt: string | null;
  messages: ChatMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  modelName: string;
  onDismissError: () => void;
  onRetry: () => void;
  status: ChatStatus;
}) {
  const isBusy = status === "submitting" || status === "streaming";

  return (
    <div
      className="rounded-[8px] border border-teal-100 bg-white p-3 shadow-sm"
      data-chat-message-count={messages.length}
      data-chat-status={status}
      data-chat-thread
    >
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
            <MessageSquare className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">对话工作区</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            daily_work 消息发送到 /api/chat，模型响应会在此增量写入。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">
          <Activity className="size-3.5" aria-hidden="true" />
          {statusLabel(status)}
        </span>
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <ChatEmptyState endpoint={endpoint} modelName={modelName} />
        ) : (
          messages.map((message, index) => (
            <ChatBubble
              key={message.id}
              message={message}
              pending={
                isBusy &&
                message.role === "assistant" &&
                index === messages.length - 1
              }
            />
          ))
        )}

        {isBusy ? <ChatProgress status={status} /> : null}

        {error ? (
          <ChatErrorState
            canRetry={Boolean(lastSubmittedPrompt) && !isBusy}
            error={error}
            onDismiss={onDismissError}
            onRetry={onRetry}
          />
        ) : null}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function ChatEmptyState({
  endpoint,
  modelName
}: {
  endpoint: string;
  modelName: string;
}) {
  return (
    <div
      className="rounded-[8px] border border-dashed border-teal-200 bg-teal-50/70 px-4 py-4"
      data-chat-empty-state
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
            <Bot className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">等待第一条日常工作任务</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            当前会话保持审批边界，输出可包含正文、清单和高亮代码块。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-white px-2.5 py-1 text-[11px] font-medium text-teal-700">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          API ready
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <StatusRow label="Endpoint" value={endpoint} />
        <StatusRow label="Model" value={modelName} />
      </div>
    </div>
  );
}

function ChatProgress({ status }: { status: ChatStatus }) {
  const label =
    status === "submitting"
      ? "正在连接日常工作模型..."
      : "正在接收增量响应...";

  return (
    <div
      className="flex items-center gap-2 rounded-[8px] border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800"
      data-chat-progress
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      <span className="min-w-0 break-words">{label}</span>
    </div>
  );
}

function ChatErrorState({
  canRetry,
  error,
  onDismiss,
  onRetry
}: {
  canRetry: boolean;
  error: string;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{error}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="bg-red-600 hover:bg-red-700"
          disabled={!canRetry}
          onClick={onRetry}
        >
          <Play className="size-4" aria-hidden="true" />
          重新发送
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDismiss}>
          清除错误
        </Button>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  pending
}: {
  message: ChatMessage;
  pending: boolean;
}) {
  const isUser = message.role === "user";
  const hasContent = message.content.trim().length > 0;

  return (
    <div
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
      data-chat-message-role={message.role}
    >
      {!isUser ? (
        <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
          <Bot className="size-4" aria-hidden="true" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[min(720px,100%)] rounded-[8px] border px-4 py-3 text-sm leading-6",
          isUser
            ? "border-orange-200 bg-orange-500 text-white"
            : "border-teal-100 bg-teal-50 text-teal-900"
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-xs font-medium opacity-80">
          {isUser ? (
            <User className="size-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="size-3.5" aria-hidden="true" />
          )}
          {isUser ? "你" : "SeekDesk"}
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
        </div>
        {hasContent ? (
          <MessageContent content={message.content} />
        ) : (
          <div className="flex items-center gap-2 text-sm text-teal-700">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>正在建立响应...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const segments = parseMessageSegments(content);

  return (
    <div className="space-y-3">
      {segments.map((segment, index) =>
        segment.type === "code" ? (
          <CodeBlock
            key={`${segment.type}-${index}`}
            code={segment.content}
            language={segment.language}
          />
        ) : (
          <p
            key={`${segment.type}-${index}`}
            className="whitespace-pre-wrap break-words"
          >
            {segment.content}
          </p>
        )
      )}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const tokens = tokenizeCode(code, normalizedLanguage);

  return (
    <div
      className="min-w-0 overflow-hidden rounded-[8px] border border-slate-700/80 bg-slate-950 text-slate-100 shadow-sm"
      data-code-block={normalizedLanguage || "code"}
      data-language={normalizedLanguage || "code"}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-3 py-2">
        <span
          className="min-w-0 truncate font-mono text-[11px] font-semibold uppercase tracking-normal text-teal-200"
          data-code-language={normalizedLanguage || "code"}
        >
          {normalizedLanguage || "code"}
        </span>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 text-[13px] leading-6 [scrollbar-color:#475569_transparent]">
        <code className="block min-w-max font-mono">
          {tokens.map((token, index) => (
            <span
              key={`${token.kind}-${index}`}
              className={syntaxTokenClass(token.kind)}
              data-token={token.kind}
            >
              {token.value}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const fencePattern = /```([^\r\n`]*)\r?\n?([\s\S]*?)(?:\r?\n```|$)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(content)) !== null) {
    if (match.index > cursor) {
      segments.push({
        type: "text",
        content: content.slice(cursor, match.index)
      });
    }

    segments.push({
      type: "code",
      language: match[1]?.trim() ?? "",
      content: trimCodeBlockEdges(match[2] ?? "")
    });

    cursor = fencePattern.lastIndex;
  }

  if (cursor < content.length) {
    segments.push({
      type: "text",
      content: content.slice(cursor)
    });
  }

  return segments.filter((segment) => segment.content.length > 0);
}

function trimCodeBlockEdges(code: string) {
  return code.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
}

function normalizeCodeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();

  switch (normalized) {
    case "js":
    case "jsx":
    case "javascript":
      return "javascript";
    case "ts":
    case "tsx":
    case "typescript":
      return "typescript";
    case "sh":
    case "shell":
    case "bash":
    case "zsh":
      return "bash";
    case "jsonc":
    case "json":
      return "json";
    default:
      return normalized;
  }
}

const scriptKeywords = new Set([
  "abstract",
  "async",
  "await",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "number",
  "of",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "satisfies",
  "static",
  "string",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unknown",
  "var",
  "void",
  "while",
  "with",
  "yield"
]);

const bashKeywords = new Set([
  "case",
  "done",
  "do",
  "elif",
  "else",
  "esac",
  "export",
  "fi",
  "for",
  "function",
  "if",
  "in",
  "local",
  "readonly",
  "then",
  "while"
]);

function tokenizeCode(code: string, language: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const isBash = language === "bash";
  let index = 0;

  while (index < code.length) {
    const character = code[index] ?? "";
    const nextCharacter = code[index + 1] ?? "";

    if (isWhitespace(character)) {
      const start = index;
      index += 1;

      while (index < code.length && isWhitespace(code[index] ?? "")) {
        index += 1;
      }

      tokens.push({ kind: "text", value: code.slice(start, index) });
      continue;
    }

    if (!isBash && character === "/" && nextCharacter === "*") {
      const end = code.indexOf("*/", index + 2);
      const nextIndex = end === -1 ? code.length : end + 2;
      tokens.push({ kind: "comment", value: code.slice(index, nextIndex) });
      index = nextIndex;
      continue;
    }

    if (!isBash && character === "/" && nextCharacter === "/") {
      const nextIndex = findLineEnd(code, index);
      tokens.push({ kind: "comment", value: code.slice(index, nextIndex) });
      index = nextIndex;
      continue;
    }

    if (isBash && character === "#" && isBashCommentStart(code, index)) {
      const nextIndex = findLineEnd(code, index);
      tokens.push({ kind: "comment", value: code.slice(index, nextIndex) });
      index = nextIndex;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      const nextIndex = scanQuotedString(code, index, character);
      tokens.push({
        kind: nextNonWhitespace(code, nextIndex) === ":" ? "property" : "string",
        value: code.slice(index, nextIndex)
      });
      index = nextIndex;
      continue;
    }

    if (isNumberStart(code, index)) {
      const start = index;
      index += 1;

      while (index < code.length && /[\w.]/.test(code[index] ?? "")) {
        index += 1;
      }

      tokens.push({ kind: "number", value: code.slice(start, index) });
      continue;
    }

    if (isIdentifierStart(character)) {
      const start = index;
      index += 1;

      while (index < code.length && isIdentifierPart(code[index] ?? "", isBash)) {
        index += 1;
      }

      const value = code.slice(start, index);
      const kind = getIdentifierTokenKind(code, index, value, language);
      tokens.push({ kind, value });
      continue;
    }

    if (isPunctuation(character)) {
      tokens.push({ kind: "punctuation", value: character });
      index += 1;
      continue;
    }

    tokens.push({ kind: "text", value: character });
    index += 1;
  }

  return tokens;
}

function findLineEnd(code: string, start: number) {
  const nextLine = code.indexOf("\n", start);
  return nextLine === -1 ? code.length : nextLine;
}

function scanQuotedString(code: string, start: number, quote: string) {
  let index = start + 1;

  while (index < code.length) {
    if (code[index] === "\\") {
      index += 2;
      continue;
    }

    if (code[index] === quote) {
      return index + 1;
    }

    index += 1;
  }

  return code.length;
}

function nextNonWhitespace(code: string, start: number) {
  let index = start;

  while (index < code.length && /\s/.test(code[index] ?? "")) {
    index += 1;
  }

  return code[index] ?? "";
}

function isWhitespace(character: string) {
  return /\s/.test(character);
}

function isNumberStart(code: string, index: number) {
  const character = code[index] ?? "";
  const previous = index > 0 ? code[index - 1] ?? "" : "";

  return /\d/.test(character) && !isIdentifierPart(previous, false);
}

function isIdentifierStart(character: string) {
  return /[A-Za-z_$]/.test(character);
}

function isIdentifierPart(character: string, isBash: boolean) {
  return isBash ? /[A-Za-z0-9_$-]/.test(character) : /[A-Za-z0-9_$]/.test(character);
}

function isPunctuation(character: string) {
  return /[{}()[\].,;:<>+\-*/=%!&|?]/.test(character);
}

function isBashCommentStart(code: string, index: number) {
  return index === 0 || /[\s;]/.test(code[index - 1] ?? "");
}

function getIdentifierTokenKind(
  code: string,
  endIndex: number,
  value: string,
  language: string
): SyntaxTokenKind {
  if (language === "bash") {
    return bashKeywords.has(value) ? "keyword" : "text";
  }

  if (language === "json") {
    return value === "true" || value === "false" || value === "null"
      ? "keyword"
      : "text";
  }

  if (scriptKeywords.has(value)) {
    return "keyword";
  }

  return nextNonWhitespace(code, endIndex) === ":" ||
    previousNonWhitespace(code, endIndex - value.length) === "."
    ? "property"
    : "text";
}

function previousNonWhitespace(code: string, start: number) {
  let index = start - 1;

  while (index >= 0 && /\s/.test(code[index] ?? "")) {
    index -= 1;
  }

  return code[index] ?? "";
}

function syntaxTokenClass(kind: SyntaxTokenKind) {
  switch (kind) {
    case "comment":
      return "text-slate-500";
    case "keyword":
      return "font-semibold text-violet-300";
    case "number":
      return "text-orange-300";
    case "property":
      return "text-sky-300";
    case "punctuation":
      return "text-slate-400";
    case "string":
      return "text-emerald-300";
    case "text":
      return "text-slate-100";
  }
}

function PanelHeader({
  icon,
  title,
  action
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-teal-100 px-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
        <span className="text-teal-700">{icon}</span>
        {title}
      </div>
      {action}
    </div>
  );
}

function PromptCard({
  icon,
  title,
  text,
  onClick
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: (prompt: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="min-h-28 rounded-[8px] border border-teal-100 bg-white p-3 text-left text-sm shadow-sm transition-colors duration-200 hover:border-teal-300 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
    >
      <span className="mb-3 flex items-center gap-2 font-medium text-teal-950">
        <span className="grid size-7 place-items-center rounded-[6px] bg-teal-50 text-teal-700">
          {icon}
        </span>
        {title}
      </span>
      <span className="block text-xs leading-5 text-teal-700">{text}</span>
    </button>
  );
}

function SessionStatusPill({ status }: { status: SessionHistoryStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        sessionHistoryStatusClass(status)
      )}
    >
      {status}
    </span>
  );
}

function PersistenceStatusPanel({ state }: { state: PersistencePanelState }) {
  return (
    <section
      className="rounded-[8px] border border-slate-200 bg-white p-3"
      data-persistence-panel
      data-persistence-current={state.currentLayer}
      data-persistence-source={state.source}
      data-persistence-status={state.syncStatus}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Database className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">数据层 / 同步状态</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            日常工作数据当前状态从 /health 优先读取；缺少字段时保留安全 fallback。
          </p>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-[999px] px-2.5 py-1 text-[11px] font-medium",
            state.syncStatus === "live"
              ? "bg-emerald-100 text-emerald-800"
              : state.syncStatus === "syncing"
                ? "bg-sky-100 text-sky-800"
                : "bg-orange-100 text-orange-800"
          )}
        >
          <Activity className="size-3.5" aria-hidden="true" />
          {persistenceSyncStatusLabel(state.syncStatus)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        {state.layers.map((layer) => {
          const Icon = layer.icon;

          return (
            <div
              key={layer.id}
              className={cn(
                "min-w-0 rounded-[8px] border px-3 py-2",
                persistenceLayerStatusClass(layer.status)
              )}
              data-persistence-layer={layer.id}
              data-persistence-layer-status={layer.status}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-white/75">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">
                      {layer.label}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 opacity-80">
                      {layer.description}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 rounded-[999px] bg-white/80 px-2 py-0.5 text-[10px] font-medium">
                  {persistenceLayerStatusLabel(layer.status)}
                </span>
              </div>
              <div className="mt-2 break-words text-[11px] leading-4 opacity-85">
                {layer.detail}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5",
          state.syncStatus === "degraded"
            ? "border-orange-200 bg-orange-50 text-orange-800"
            : "border-teal-100 bg-teal-50 text-teal-800"
        )}
      >
        <span className="font-medium">最近更新：{state.updatedAt}</span>
        <span className="mx-2 text-slate-300">/</span>
        {state.notice}
      </div>
    </section>
  );
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-teal-100 bg-teal-50 px-2.5 py-2 text-center">
      <div className="truncate text-[11px] font-medium text-teal-700">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-teal-950">
        {value}
      </div>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2">
      <span className="shrink-0 text-xs font-medium text-teal-700">{label}</span>
      <span className="min-w-0 break-words text-right text-sm text-teal-950">
        {value}
      </span>
    </div>
  );
}

function ArtifactStatePill({ state }: { state: ArtifactState }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        artifactStateClass(state)
      )}
    >
      {state}
    </span>
  );
}

function ConnectorPermissionPill({
  state
}: {
  state: ConnectorPermissionState;
}) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        connectorPermissionClass(state)
      )}
    >
      {state}
    </span>
  );
}

function ConnectorRiskPill({ riskLevel }: { riskLevel: ConnectorRiskLevel }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        connectorRiskClass(riskLevel)
      )}
    >
      风险 {riskLevel}
    </span>
  );
}

function WorkflowActionStatusPill({
  status
}: {
  status: WorkflowActionStatus;
}) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        workflowActionStatusClass(status)
      )}
    >
      {status}
    </span>
  );
}

function ActivityEventStatusPill({ status }: { status: ActivityEventStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        activityEventStatusClass(status)
      )}
    >
      {status}
    </span>
  );
}

function ArtifactDetailBlock({
  icon,
  title,
  children
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-[8px] border border-teal-100 bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-teal-950">
        <span className="shrink-0 text-teal-700">{icon}</span>
        <span className="min-w-0 break-words">{title}</span>
      </div>
      <div className="mt-1 break-words text-xs leading-5 text-slate-700">
        {children}
      </div>
    </div>
  );
}

function ArtifactDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-teal-100 bg-white px-3 py-2">
      <div className="text-[11px] font-medium text-teal-700">{label}</div>
      <div className="mt-1 break-words text-xs leading-5 text-teal-950">
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ApprovalStatus }) {
  const config = approvalStatusConfig(status);

  return (
    <span
      className={cn(
        "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[8px] border border-amber-100 bg-amber-50 px-2.5 py-2">
      <span className="shrink-0 text-[11px] font-medium text-amber-700">{label}</span>
      <span className="min-w-0 text-right text-[11px] text-slate-700">{value}</span>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2">
      <span className="text-xs font-medium text-teal-700">{label}</span>
      <span className="truncate text-sm text-teal-950">{value}</span>
    </div>
  );
}

function ActivityFeedMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-14 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2">
      <div className="text-[11px] font-medium text-teal-700">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-teal-950">
        {value}
      </div>
    </div>
  );
}

function statusLabel(status: ChatStatus) {
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

function approvalStatusLabel(status: ApprovalStatus) {
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

function connectorPreviewApprovalStatus(
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

function mapApprovalDecisionStatus(
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

function approvalStatusConfig(status: ApprovalStatus) {
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

function sessionHistoryFilterCount(
  filter: SessionHistoryFilter,
  items: SessionHistoryItem[]
) {
  if (filter === "全部") {
    return items.length;
  }

  return items.filter((item) => item.status === filter).length;
}

function sessionHistoryStatusClass(status: SessionHistoryStatus) {
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

function sessionHistorySourceLabel(source: SessionHistoryPanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Sessions API";
    case "degraded":
      return "降级 fallback";
  }
}

function sessionHistorySyncStatusLabel(status: SessionHistoryPanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

function sessionRestorePreviewSourceLabel(source: SessionRestorePreviewSource) {
  switch (source) {
    case "fallback":
      return "本地预演";
    case "api":
      return "Restore API";
    case "degraded":
      return "降级预演";
  }
}

function sessionRestorePreviewSyncStatusLabel(
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

function templatePanelSourceLabel(source: TemplatePanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Templates API";
    case "degraded":
      return "降级 fallback";
  }
}

function templatePanelSyncStatusLabel(status: TemplatePanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

function templatePreviewSourceLabel(source: TemplatePreviewSource) {
  switch (source) {
    case "fallback":
      return "本地预演";
    case "api":
      return "Template Preview API";
    case "degraded":
      return "降级预演";
  }
}

function templatePreviewSyncStatusLabel(status: TemplatePreviewSyncStatus) {
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

function templateCategoryLabel(value: string) {
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

function templateArtifactTypeLabel(value: string) {
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

function formatSessionLinkList(label: string, values: string[]) {
  return `${label}: ${values.length > 0 ? values.join("、") : "无"}`;
}

function formatSessionRecentMessagePreview(item: SessionHistoryItem) {
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

function artifactFilterCount(filter: ArtifactFilter, items: ArtifactItem[]) {
  if (filter === "全部") {
    return items.length;
  }

  return items.filter((artifact) => artifact.state === filter).length;
}

function connectorFilterCount(filter: ConnectorFilter) {
  if (filter === "全部") {
    return connectorItems.length;
  }

  return connectorItems.filter((item) => connectorMatchesFilter(item, filter)).length;
}

function workflowActionFilterCount(filter: WorkflowActionFilter) {
  if (filter === "全部") {
    return workflowActions.length;
  }

  return workflowActions.filter((item) => item.approvalStatus === filter).length;
}

function connectorMatchesFilter(item: ConnectorItem, filter: ConnectorFilter) {
  switch (filter) {
    case "全部":
      return true;
    case "需审批":
      return item.permissionState === "需审批";
    case "可预览":
      return item.permissionState === "可预览";
  }
}

function workflowActionStatusClass(status: WorkflowActionStatus) {
  switch (status) {
    case "待审批":
      return "bg-orange-100 text-orange-800";
    case "可预演":
      return "bg-emerald-100 text-emerald-800";
    case "需补上下文":
      return "bg-amber-100 text-amber-800";
  }
}

function activityEventStatusClass(status: ActivityEventStatus) {
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

function activityFeedSourceLabel(source: ActivityFeedSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "HTTP API";
    case "websocket":
      return "WebSocket 快照";
  }
}

function activityConnectionStatusLabel(status: ActivityConnectionStatus) {
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

function artifactStateClass(state: ArtifactState) {
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

function connectorPermissionClass(state: ConnectorPermissionState) {
  switch (state) {
    case "未连接":
      return "bg-slate-100 text-slate-700";
    case "需审批":
      return "bg-orange-100 text-orange-800";
    case "可预览":
      return "bg-emerald-100 text-emerald-800";
  }
}

function connectorRiskClass(riskLevel: ConnectorRiskLevel) {
  switch (riskLevel) {
    case "低":
      return "bg-emerald-100 text-emerald-800";
    case "中":
      return "bg-amber-100 text-amber-800";
    case "高":
      return "bg-red-100 text-red-800";
  }
}

function selectedContextLabel(contextId: string) {
  const item = contextItems.find((entry) => entry.id === contextId);
  return item ? item.title : "未知上下文";
}

function modelRouteLabel(mode: ModelRouteMode) {
  return mode === "fast" ? "快速" : "深度";
}

function modelUsageSyncStatusLabel(status: ModelUsageSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 实况";
    case "degraded":
      return "降级快照";
  }
}

function persistenceSyncStatusLabel(status: PersistencePanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "Health 已同步";
    case "degraded":
      return "Fallback";
  }
}

function persistenceLayerStatusLabel(status: PersistenceLayerStatus) {
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

function persistenceLayerStatusClass(status: PersistenceLayerStatus) {
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

function normalizePersistenceLayer(value: string | undefined): PersistenceLayerId {
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

function extractHealthPersistenceSnapshot(
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

function hasPersistenceSignal(value: Record<string, unknown>) {
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

function readRecord(value: unknown) {
  return isRecord(value) && !Array.isArray(value) ? value : undefined;
}

function normalizeModelRoute(value: ModelRouteMode | undefined): ModelRouteMode {
  return value === "pro" ? "pro" : "fast";
}

function normalizeThinkingMode(value: ThinkingMode | undefined): ThinkingMode {
  return value === "enabled" ? "enabled" : "disabled";
}

function normalizeBudgetState(
  value: ModelUsageBudgetState | undefined
): ModelUsageBudgetState {
  return value ?? "tracking_only";
}

function budgetStateLabel(state: ModelUsageBudgetState) {
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

function budgetStatePercent(state: ModelUsageBudgetState) {
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

function nonEmptyText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function nonNegativeNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function sanitizeNotes(notes: string[] | undefined) {
  return notes?.filter((note) => note.trim().length > 0) ?? [];
}

function formatProviderLabel(provider: string | undefined) {
  return provider?.toLowerCase() === "deepseek" ? "DeepSeek" : nonEmptyText(provider, "DeepSeek");
}

function formatEstimatedCost(value: number, currency: string | undefined) {
  const currencyLabel = currency === "USD" || !currency ? "$" : `${currency} `;
  return `估算 ${currencyLabel}${value.toFixed(4)}`;
}

function formatUsageWindow(window: DailyModelUsageWindowDto | undefined) {
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

function formatModelUsageUpdatedAt(value: string | undefined) {
  return formatModelUsageTimestamp(value) ?? "刚刚同步";
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

function formatTokenCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildModelSwitchPrompt(
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

function buildConnectorAccessPrompt(item: ConnectorItem) {
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

function buildWorkflowPreviewPrompt(
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

function buildSessionRestorePrompt(item: SessionHistoryItem) {
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

function buildActivityEventPrompt(item: ActivityEventItem) {
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
