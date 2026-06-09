import type { LucideIcon } from "lucide-react";

export type AppMode = "daily_work" | "coding_agent";
export type ChatRole = "user" | "assistant";
export type ChatStatus = "idle" | "submitting" | "streaming" | "error";
export type AssistantResponseMode = "text" | "json" | "sse" | "ndjson";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export type AgentTraceSyncStatus = "idle" | "syncing" | "live" | "degraded";

export interface AgentToolCallTraceItem {
  id: string;
  name: string;
  status: string;
  inputJson?: unknown;
  outputJson?: unknown;
  previewOnly: boolean;
  permissionRequired: boolean;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AgentToolActivityTraceItem {
  id: string;
  toolName: string;
  toolPhase: string;
  status: string;
  time: string;
  title: string;
  summary: string;
  externalDataSummary: string;
  reference: string | null;
  provider: string | null;
  previewOnly: boolean;
  externalEffects: string[];
}

export interface AgentModelUsageTraceItem {
  id: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  createdAt: string;
}

export interface AgentModelUsageSummary {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  recordCount: number;
}

export interface AgentPermissionBoundary {
  previewOnly: boolean;
  externalEffects: string[];
  statement: string;
}

export interface AgentTraceState {
  sessionId: string | null;
  provider: string | null;
  syncStatus: AgentTraceSyncStatus;
  toolCalls: AgentToolCallTraceItem[];
  toolActivityEvents: AgentToolActivityTraceItem[];
  modelUsageRecords: AgentModelUsageTraceItem[];
  modelUsageSummary: AgentModelUsageSummary;
  permissionBoundary: AgentPermissionBoundary;
  notice: string;
}

export interface AgentTraceResponseDto {
  mode?: AppMode;
  sessionId?: string;
  toolCalls?: unknown[];
  toolActivityEvents?: DailyActivityEventDto[];
  modelUsageRecords?: unknown[];
  modelUsageSummary?: Partial<AgentModelUsageSummary>;
  permissionBoundary?: Partial<AgentPermissionBoundary>;
  generatedAt?: string;
}

export type MessageSegment =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "code";
      content: string;
      language: string;
    };

export type SyntaxTokenKind =
  | "comment"
  | "keyword"
  | "number"
  | "property"
  | "punctuation"
  | "string"
  | "text";

export interface SyntaxToken {
  kind: SyntaxTokenKind;
  value: string;
}

export interface TemplateItem {
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

export type TemplatePanelSource = "fallback" | "api" | "degraded";
export type TemplatePanelSyncStatus = "syncing" | "live" | "degraded";
export type TemplatePreviewSource = "fallback" | "api" | "degraded";
export type TemplatePreviewSyncStatus = "idle" | "syncing" | "live" | "degraded";

export interface DailyWorkTemplateDto {
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

export interface DailyWorkTemplatesResponseDto {
  mode?: AppMode;
  templates?: DailyWorkTemplateDto[];
}

export interface DailyWorkTemplateApplyPreviewDto {
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

export interface DailyWorkTemplateApplyPreviewResponseDto {
  mode?: AppMode;
  preview?: DailyWorkTemplateApplyPreviewDto;
}

export interface TemplatePreviewPanelState {
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

export interface TemplatePanelState {
  items: TemplateItem[];
  source: TemplatePanelSource;
  syncStatus: TemplatePanelSyncStatus;
  notice: string;
  preview: TemplatePreviewPanelState;
}

export type SessionHistoryStatus = "进行中" | "待审批" | "已完成" | "已归档";
export type SessionHistoryFilter = "全部" | SessionHistoryStatus;
export type SessionHistoryPanelSource = "fallback" | "api" | "degraded";
export type SessionHistoryPanelSyncStatus = "syncing" | "live" | "degraded";
export type SessionRestorePreviewSource = "fallback" | "api" | "degraded";
export type SessionRestorePreviewSyncStatus = "idle" | "syncing" | "live" | "degraded";

export interface SessionHistoryMessageItem {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  artifactIds: string[];
  contextItemIds: string[];
  approvalRequestIds: string[];
}

export interface WorkflowSnapshotItem {
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

export type SessionHistoryItem = WorkflowSnapshotItem;

export interface DailyWorkSessionLastActionDto {
  at?: string;
  actor?: string;
  label?: string;
  artifactId?: string;
  approvalRequestId?: string;
}

export interface DailyWorkSessionMessageDto {
  id?: string;
  role?: string;
  content?: string;
  createdAt?: string;
  artifactIds?: string[];
  contextItemIds?: string[];
  approvalRequestIds?: string[];
}

export interface DailyWorkSessionDto {
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

export interface DailyWorkSessionsResponseDto {
  mode?: AppMode;
  sessions?: DailyWorkSessionDto[];
}

export interface DailyWorkSessionResponseDto {
  mode?: AppMode;
  session?: DailyWorkSessionDto;
}

export interface DailyWorkSessionRestorePreviewDto {
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

export interface DailyWorkSessionRestorePreviewResponseDto {
  mode?: AppMode;
  preview?: DailyWorkSessionRestorePreviewDto;
}

export interface SessionRestorePreviewPanelState {
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

export interface SessionHistoryPanelState {
  items: SessionHistoryItem[];
  source: SessionHistoryPanelSource;
  syncStatus: SessionHistoryPanelSyncStatus;
  notice: string;
  restorePreview: SessionRestorePreviewPanelState;
}

export type ArtifactState = "计划中" | "排队中" | "草稿" | "可复用" | "待复核";
export type ArtifactFilter = "全部" | "草稿" | "可复用";
export type ArtifactPanelSource = "fallback" | "api" | "degraded";
export type ArtifactPanelSyncStatus = "syncing" | "live" | "degraded";

export interface ArtifactTraceItem {
  label: string;
  value: string;
}

export interface ArtifactItem {
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

export interface DailyWorkArtifactOwnerDto {
  displayName?: string;
  team?: string;
}

export interface DailyWorkArtifactNextActionDto {
  label?: string;
  description?: string;
  approvalRequestId?: string;
}

export interface DailyWorkArtifactTraceEventDto {
  actor?: string;
  type?: string;
  summary?: string;
  at?: string;
}

export interface DailyWorkArtifactTraceDto {
  origin?: string;
  createdBy?: string;
  createdAt?: string;
  events?: DailyWorkArtifactTraceEventDto[];
}

export interface DailyWorkArtifactDto {
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

export interface DailyWorkArtifactsResponseDto {
  mode?: AppMode;
  artifacts?: DailyWorkArtifactDto[];
}

export interface DailyWorkArtifactResponseDto {
  mode?: AppMode;
  artifact?: DailyWorkArtifactDto;
}

export interface ArtifactPanelState {
  items: ArtifactItem[];
  source: ArtifactPanelSource;
  syncStatus: ArtifactPanelSyncStatus;
  notice: string;
}

export interface ContextItem {
  id: string;
  title: string;
  source: string;
  sourceType: string;
  status: string;
  summary: string;
  privacy: string;
  prompt: string;
  tags: string[];
  icon: LucideIcon;
}

export type ContextPanelSource = "fallback" | "api" | "degraded";
export type ContextPanelSyncStatus = "syncing" | "live" | "degraded";
export type ContextPreviewSource = "fallback" | "api" | "degraded";
export type ContextPreviewSyncStatus = "idle" | "syncing" | "live" | "degraded";

export interface DailyContextItemDto {
  id?: string;
  mode?: AppMode;
  sourceType?: string;
  title?: string;
  summary?: string;
  permissionState?: string;
  tags?: string[];
}

export interface DailyContextResponseDto {
  mode?: AppMode;
  items?: DailyContextItemDto[];
}

export interface DailyContextUsePreviewDto {
  id?: string;
  mode?: AppMode;
  contextItemId?: string;
  contextTitle?: string;
  sourceType?: string;
  summary?: string;
  permissionState?: string;
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

export interface DailyContextUsePreviewResponseDto {
  mode?: AppMode;
  preview?: DailyContextUsePreviewDto;
}

export interface ContextPreviewPanelState {
  contextItemId: string;
  source: ContextPreviewSource;
  syncStatus: ContextPreviewSyncStatus;
  previewOnly: boolean;
  externalEffects: string[];
  safetyStatement: string;
  promptDraft: string;
  generatedAt: string;
  notice: string;
}

export interface ContextPanelState {
  items: ContextItem[];
  source: ContextPanelSource;
  syncStatus: ContextPanelSyncStatus;
  notice: string;
  preview: ContextPreviewPanelState;
}

export type ConnectorCategory = "文档" | "日历" | "邮箱" | "笔记" | "团队知识";
export type ConnectorFilter = "全部" | "需审批" | "可预览";
export type ConnectorPermissionState = "未连接" | "需审批" | "可预览";
export type ConnectorRiskLevel = "低" | "中" | "高";

export interface ConnectorItem {
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

export type WorkflowActionStatus = "待审批" | "可预演" | "需补上下文";
export type WorkflowActionFilter = "全部" | WorkflowActionStatus;

export interface WorkflowActionItem {
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

export type ActivityEventType = "session" | "workflow" | "artifact" | "approval" | "connector";
export type ActivityEventStatus =
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

export interface ActivityEventItem {
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
  toolAudit?: ActivityToolAuditItem;
}

export interface ActivityToolAuditItem {
  toolName: string;
  toolPhase: string;
  provider: string | null;
  connectorId: string | null;
  inputFields: string[];
  externalDataSummary: string;
  resultCount: number | null;
  reference: string | null;
  previewOnly: boolean;
  externalEffects: string[];
}

export type ActivityFeedSource = "fallback" | "api" | "websocket";
export type ActivityConnectionStatus =
  | "connecting"
  | "live"
  | "degraded"
  | "closed";

export interface DailyActivityRelatedRefs {
  sessionIds?: string[];
  templateIds?: string[];
  workflowIds?: string[];
  actionQueueItemIds?: string[];
  artifactIds?: string[];
  approvalRequestIds?: string[];
  connectorIds?: string[];
  contextItemIds?: string[];
}

export interface DailyActivitySafetyBoundary {
  previewOnly?: boolean;
  externalEffects?: string[];
  prohibitedExternalActions?: string[];
  statement?: string;
}

export interface DailyActivityNextAction {
  label: string;
  description?: string;
  targetType: ActivityEventType | "template" | "context";
  targetId: string;
  requiredStatus?: string;
  dueAt?: string;
}

export interface DailyActivityMetadataDto {
  riskLevel?: string;
  permissionState?: string;
  externalEffects?: string[];
  artifactType?: string;
  toolName?: string;
  toolPhase?: string;
  provider?: string;
  connectorId?: string;
  inputFields?: string[];
  externalDataSummary?: string;
  resultCount?: number;
  reference?: string;
}

export interface DailyActivityEventDto {
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
  metadata?: DailyActivityMetadataDto;
}

export interface DailyActivitySnapshotDto {
  type?: string;
  mode?: AppMode;
  events?: DailyActivityEventDto[];
}

export type ApprovalStatus = "waiting" | "allowed_once" | "denied" | "blocked";
export type ApprovalRisk = "低" | "中" | "高" | "极高";
export type ApprovalPanelSource = "fallback" | "api" | "degraded";
export type ApprovalPanelSyncStatus = "syncing" | "live" | "degraded";
export type ModelRouteMode = "fast" | "pro";
export type ThinkingMode = "enabled" | "disabled";
export type ModelUsageBudgetState =
  | "disabled"
  | "tracking_only"
  | "within_budget"
  | "approaching_limit"
  | "over_budget";
export type ModelUsagePanelSource = "fallback" | "api" | "degraded";
export type ModelUsageSyncStatus = "syncing" | "live" | "degraded";
export type PersistenceLayerId =
  | "seed_mock"
  | "json_local"
  | "postgres"
  | "future_database";
export type PersistenceLayerStatus = "active" | "available" | "planned" | "unknown";
export type PersistencePanelSource = "fallback" | "health" | "degraded";
export type PersistencePanelSyncStatus = "syncing" | "live" | "degraded";

export interface ApprovalRequestItem {
  id: string;
  title: string;
  requestedAction: string;
  scope: string;
  risk: ApprovalRisk;
  status: ApprovalStatus;
  detail: string;
  icon: LucideIcon;
}

export interface DailyApprovalRequestDto {
  id?: string;
  mode?: AppMode;
  actionType?: string;
  title?: string;
  description?: string;
  riskLevel?: string;
  requiredPermissionMode?: string;
  permissionAware?: boolean;
  contextItemIds?: string[];
  decision?: string;
  status?: string;
  tags?: string[];
}

export interface DailyApprovalRequestsResponseDto {
  mode?: AppMode;
  requests?: DailyApprovalRequestDto[];
}

export interface ApprovalPanelState {
  items: ApprovalRequestItem[];
  source: ApprovalPanelSource;
  syncStatus: ApprovalPanelSyncStatus;
  notice: string;
}

export interface ModelSnapshotItem {
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

export interface UsageSnapshotItem {
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

export interface DailyModelConfigSnapshotDto {
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

export interface DailyModelUsageWindowDto {
  id?: string;
  label?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface DailyModelUsageSnapshotDto {
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

export interface DailyModelUsageResponseDto {
  mode?: AppMode;
  config?: DailyModelConfigSnapshotDto;
  usage?: DailyModelUsageSnapshotDto;
}

export type ConnectorPreviewPanelSource = "local" | "api" | "degraded";
export type ConnectorPreviewPanelSyncStatus = "idle" | "syncing" | "live" | "degraded";

export interface ConnectorActionPreviewStepDto {
  title?: string;
  description?: string;
  externalEffect?: string;
}

export interface ConnectorActionPreviewDto {
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

export interface ConnectorActionPreviewResponseDto {
  mode?: AppMode;
  preview?: ConnectorActionPreviewDto;
}

export interface DailyApprovalDecisionResponseDto {
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

export interface ConnectorPreviewPanelState {
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

export type EmailConnectorStatusSource = "local" | "api" | "degraded";
export type EmailConnectorSyncStatus = "syncing" | "live" | "degraded";

export interface EmailConnectorStatusState {
  connected: boolean;
  requiresSetup: boolean;
  accountEmail: string | null;
  scopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  scopesComplete: boolean;
  missingConfig: string[];
  source: EmailConnectorStatusSource;
  syncStatus: EmailConnectorSyncStatus;
  notice: string;
}

export type EmailOAuthStartStatus =
  | "idle"
  | "starting"
  | "opened"
  | "requires_setup"
  | "failed";

export type GoogleConnectorStatusState = EmailConnectorStatusState;
export type MicrosoftConnectorStatusState = EmailConnectorStatusState;
export type GoogleOAuthStartStatus = EmailOAuthStartStatus;
export type MicrosoftOAuthStartStatus = EmailOAuthStartStatus;

export type WorkflowPreviewPanelSource = "local" | "api" | "degraded";
export type WorkflowPreviewPanelSyncStatus = "idle" | "syncing" | "live" | "degraded";

export interface DailyWorkflowPreviewConnectorLinkDto {
  connectorId?: string;
  displayName?: string;
  action?: string;
}

export interface DailyWorkflowPreviewContextLinkDto {
  contextItemId?: string;
  title?: string;
  usage?: string;
}

export interface DailyWorkflowPreviewArtifactLinkDto {
  artifactId?: string;
  title?: string;
  artifactType?: string;
  status?: string;
}

export interface DailyWorkflowPreviewApprovalLinkDto {
  approvalRequestId?: string;
  title?: string;
  status?: string;
}

export interface DailyWorkflowPreviewStepDto {
  actionId?: string;
  title?: string;
  description?: string;
  status?: string;
  externalEffect?: string;
  summary?: string;
  suggestedNextStep?: string;
  userVisibleDraft?: string;
}

export interface DailyWorkflowPreviewDto {
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

export interface DailyWorkflowPreviewResponseDto {
  mode?: AppMode;
  preview?: DailyWorkflowPreviewDto;
}

export interface WorkflowPreviewPanelState {
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

export interface ModelUsagePanelState {
  modelSnapshots: Record<ModelRouteMode, ModelSnapshotItem>;
  usageSnapshots: Record<ModelRouteMode, UsageSnapshotItem>;
  source: ModelUsagePanelSource;
  syncStatus: ModelUsageSyncStatus;
  notice: string;
}

export interface PersistenceLayerItem {
  id: PersistenceLayerId;
  label: string;
  description: string;
  status: PersistenceLayerStatus;
  detail: string;
  icon: LucideIcon;
}

export interface PersistencePanelState {
  layers: PersistenceLayerItem[];
  source: PersistencePanelSource;
  syncStatus: PersistencePanelSyncStatus;
  currentLayer: PersistenceLayerId;
  updatedAt: string;
  notice: string;
}

export interface HealthPersistenceSnapshotDto {
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
  postgresConfigured?: boolean;
  postgresReady?: boolean;
  futureDatabaseReady?: boolean;
  updatedAt?: string;
  notes?: string[];
}
