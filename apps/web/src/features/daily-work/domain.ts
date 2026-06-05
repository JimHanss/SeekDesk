import {
  HardDrive,
  Server,
  Sparkles
} from "lucide-react";

import type {
  ChatStatus,
  ChatMessage,
  TemplatePanelSource,
  TemplatePanelSyncStatus,
  TemplatePreviewSource,
  TemplatePreviewSyncStatus,
  SessionHistoryStatus,
  SessionHistoryFilter,
  SessionHistoryPanelSource,
  SessionHistoryPanelSyncStatus,
  SessionRestorePreviewSource,
  SessionRestorePreviewSyncStatus,
  SessionHistoryItem,
  ArtifactState,
  ArtifactFilter,
  ArtifactItem,
  ContextItem,
  ContextPanelSource,
  ContextPanelSyncStatus,
  ContextPreviewSource,
  ContextPreviewSyncStatus,
  ApprovalPanelSource,
  ApprovalPanelSyncStatus,
  ModelRouteMode,
  ThinkingMode,
  ModelUsageBudgetState,
  ModelUsageSyncStatus,
  PersistenceLayerId,
  PersistenceLayerStatus,
  PersistencePanelSyncStatus,
  ModelSnapshotItem,
  UsageSnapshotItem,
  DailyModelUsageWindowDto,
  DailyModelUsageResponseDto,
  ModelUsagePanelState,
  PersistencePanelState,
  HealthPersistenceSnapshotDto
} from "./types";
import { activeMode } from "./domain/base";
import { contextItems } from "./domain/context";

export * from "./domain/activity";
export * from "./domain/approvals";
export * from "./domain/assistant-stream";
export * from "./domain/artifacts";
export * from "./domain/base";
export * from "./domain/context";
export * from "./domain/connectors";
export * from "./domain/runtime";
export * from "./domain/sessions";
export * from "./domain/templates";
export * from "./domain/workflows";

export const initialMessages: ChatMessage[] = [];

export const modelSnapshots: Record<ModelRouteMode, ModelSnapshotItem> = {
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

export const usageSnapshots: Record<ModelRouteMode, UsageSnapshotItem> = {
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

export function createFallbackModelUsagePanelState(): ModelUsagePanelState {
  return {
    modelSnapshots,
    usageSnapshots,
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在连接后端模型与用量接口；连接完成前保留前端示例快照，保证页面可用。"
  };
}

export function createFallbackPersistencePanelState(): PersistencePanelState {
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

export function mapHealthPersistenceResponse(payload: unknown): PersistencePanelState {
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

export function mapDailyModelUsageResponse(
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function statusLabel(status: ChatStatus) {
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

export function sessionHistoryFilterCount(
  filter: SessionHistoryFilter,
  items: SessionHistoryItem[]
) {
  if (filter === "全部") {
    return items.length;
  }

  return items.filter((item) => item.status === filter).length;
}

export function sessionHistoryStatusClass(status: SessionHistoryStatus) {
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

export function sessionHistorySourceLabel(source: SessionHistoryPanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Sessions API";
    case "degraded":
      return "降级 fallback";
  }
}

export function sessionHistorySyncStatusLabel(status: SessionHistoryPanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

export function sessionRestorePreviewSourceLabel(source: SessionRestorePreviewSource) {
  switch (source) {
    case "fallback":
      return "本地预演";
    case "api":
      return "Restore API";
    case "degraded":
      return "降级预演";
  }
}

export function sessionRestorePreviewSyncStatusLabel(
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

export function templatePanelSourceLabel(source: TemplatePanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Templates API";
    case "degraded":
      return "降级 fallback";
  }
}

export function templatePanelSyncStatusLabel(status: TemplatePanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

export function templatePreviewSourceLabel(source: TemplatePreviewSource) {
  switch (source) {
    case "fallback":
      return "本地预演";
    case "api":
      return "Template Preview API";
    case "degraded":
      return "降级预演";
  }
}

export function templatePreviewSyncStatusLabel(status: TemplatePreviewSyncStatus) {
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

export function approvalPanelSourceLabel(source: ApprovalPanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Approvals API";
    case "degraded":
      return "降级 fallback";
  }
}

export function approvalPanelSyncStatusLabel(status: ApprovalPanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

export function templateCategoryLabel(value: string) {
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

export function templateArtifactTypeLabel(value: string) {
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

export function artifactFilterCount(filter: ArtifactFilter, items: ArtifactItem[]) {
  if (filter === "全部") {
    return items.length;
  }

  return items.filter((artifact) => artifact.state === filter).length;
}

export function artifactStateClass(state: ArtifactState) {
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

export function contextPanelSourceLabel(source: ContextPanelSource) {
  switch (source) {
    case "fallback":
      return "前端 fallback";
    case "api":
      return "Context API";
    case "degraded":
      return "降级 fallback";
  }
}

export function contextPanelSyncStatusLabel(status: ContextPanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 已同步";
    case "degraded":
      return "保留快照";
  }
}

export function contextPreviewSourceLabel(source: ContextPreviewSource) {
  switch (source) {
    case "fallback":
      return "本地预演";
    case "api":
      return "Context Preview API";
    case "degraded":
      return "降级预演";
  }
}

export function contextPreviewSyncStatusLabel(status: ContextPreviewSyncStatus) {
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

export function selectedContextLabel(contextId: string, items: ContextItem[] = contextItems) {
  const item = items.find((entry) => entry.id === contextId);
  return item ? item.title : "未知上下文";
}

export function modelRouteLabel(mode: ModelRouteMode) {
  return mode === "fast" ? "快速" : "深度";
}

export function modelUsageSyncStatusLabel(status: ModelUsageSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "API 实况";
    case "degraded":
      return "降级快照";
  }
}

export function persistenceSyncStatusLabel(status: PersistencePanelSyncStatus) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "Health 已同步";
    case "degraded":
      return "Fallback";
  }
}

export function persistenceLayerStatusLabel(status: PersistenceLayerStatus) {
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

export function persistenceLayerStatusClass(status: PersistenceLayerStatus) {
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

export function normalizePersistenceLayer(value: string | undefined): PersistenceLayerId {
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

export function extractHealthPersistenceSnapshot(
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

export function hasPersistenceSignal(value: Record<string, unknown>) {
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

export function readRecord(value: unknown) {
  return isRecord(value) && !Array.isArray(value) ? value : undefined;
}

export function normalizeModelRoute(value: ModelRouteMode | undefined): ModelRouteMode {
  return value === "pro" ? "pro" : "fast";
}

export function normalizeThinkingMode(value: ThinkingMode | undefined): ThinkingMode {
  return value === "enabled" ? "enabled" : "disabled";
}

export function normalizeBudgetState(
  value: ModelUsageBudgetState | undefined
): ModelUsageBudgetState {
  return value ?? "tracking_only";
}

export function budgetStateLabel(state: ModelUsageBudgetState) {
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

export function budgetStatePercent(state: ModelUsageBudgetState) {
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

export function nonEmptyText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function nonNegativeNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function sanitizeNotes(notes: string[] | undefined) {
  return notes?.filter((note) => note.trim().length > 0) ?? [];
}

export function formatProviderLabel(provider: string | undefined) {
  return provider?.toLowerCase() === "deepseek" ? "DeepSeek" : nonEmptyText(provider, "DeepSeek");
}

export function formatEstimatedCost(value: number, currency: string | undefined) {
  const currencyLabel = currency === "USD" || !currency ? "$" : `${currency} `;
  return `估算 ${currencyLabel}${value.toFixed(4)}`;
}

export function formatUsageWindow(window: DailyModelUsageWindowDto | undefined) {
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

export function formatModelUsageUpdatedAt(value: string | undefined) {
  return formatModelUsageTimestamp(value) ?? "刚刚同步";
}

export function formatModelUsageTimestamp(value: string | undefined) {
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

export function formatTokenCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function buildModelSwitchPrompt(
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
