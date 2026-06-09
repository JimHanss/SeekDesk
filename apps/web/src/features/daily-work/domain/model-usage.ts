import { activeMode } from "./base";
import type {
  DailyModelUsageAggregateDto,
  DailyModelUsageRecordDto,
  DailyModelUsageResponseDto,
  DailyModelUsageWindowDto,
  ModelRouteMode,
  ModelSnapshotItem,
  ModelUsageAggregateItem,
  ModelUsageRecordItem,
  ModelUsageBudgetState,
  ModelUsagePanelState,
  ModelUsageSyncStatus,
  ThinkingMode,
  UsageSnapshotItem
} from "../types";

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
    usageWindow: "sample: current session",
    inputTokens: 18420,
    outputTokens: 6110,
    totalTokens: 24530,
    callCount: 3,
    estimatedCost: "token-only",
    budgetState: "token tracking",
    budgetLevel: "tracking_only",
    updatedAt: "sample: today 10:40",
    notes: [
      "Usage snapshot includes prompt, completion and total tokens.",
      "This panel shows tokens only, not billing or balance."
    ]
  },
  pro: {
    id: "pro",
    usageWindow: "sample: current session",
    inputTokens: 23880,
    outputTokens: 9280,
    totalTokens: 33160,
    callCount: 5,
    estimatedCost: "token-only",
    budgetState: "token tracking",
    budgetLevel: "tracking_only",
    updatedAt: "sample: today 10:40",
    notes: [
      "Pro mode sample shows a larger token footprint.",
      "Billing, balance and cost are intentionally hidden."
    ]
  }
};

export function createFallbackModelUsagePanelState(): ModelUsagePanelState {
  return {
    modelSnapshots,
    usageSnapshots,
    usageAggregates: [],
    usageRecords: [],
    source: "fallback",
    syncStatus: "syncing",
    notice:
      "正在连接后端模型与用量接口；连接完成前保留前端示例快照，保证页面可用。"
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
  const usageAggregates = mapModelUsageAggregates(usage?.aggregates);
  const usageRecords = mapModelUsageRecords(usage?.records);
  const currentAggregate = usageAggregates.find(
    (aggregate) => aggregate.id === "current_session"
  );
  const recordCount = currentAggregate?.recordCount ?? usageRecords.length;
  const estimatedCost = "token-only";
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
    "Backend returns daily_work token aggregates and request details.",
    configured
      ? "DeepSeek API key is configured server-side; the frontend never reads it."
      : "DeepSeek API key is not configured; usage remains a simulated snapshot.",
    "Token-only view: no cost, billing or balance is displayed."
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
        callCount: recordCount,
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
    usageAggregates,
    usageRecords,
    source: "api",
    syncStatus: "live",
    notice:
      "已从 /api/daily/model-usage?mode=daily_work 同步 DeepSeek 配置与用量，coding_agent 仅保留为边界说明。"
  };
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

export function mapModelUsageAggregates(
  aggregates: DailyModelUsageAggregateDto[] | undefined
): ModelUsageAggregateItem[] {
  return (aggregates ?? []).map((aggregate, index) => {
    const promptTokens = nonNegativeNumber(aggregate.promptTokens);
    const completionTokens = nonNegativeNumber(aggregate.completionTokens);
    const item: ModelUsageAggregateItem = {
      id: nonEmptyText(aggregate.id, `usage-aggregate-${index + 1}`),
      label: nonEmptyText(aggregate.label, "Token window"),
      promptTokens,
      completionTokens,
      totalTokens:
        nonNegativeNumber(aggregate.totalTokens) ||
        promptTokens + completionTokens,
      recordCount: nonNegativeNumber(aggregate.recordCount)
    };

    if (aggregate.startedAt) {
      item.startedAt = aggregate.startedAt;
    }
    if (aggregate.endedAt) {
      item.endedAt = aggregate.endedAt;
    }

    return item;
  });
}

export function mapModelUsageRecords(
  records: DailyModelUsageRecordDto[] | undefined
): ModelUsageRecordItem[] {
  return (records ?? []).map((record, index) => {
    const promptTokens = nonNegativeNumber(
      record.promptTokens ?? record.inputTokens
    );
    const completionTokens = nonNegativeNumber(
      record.completionTokens ?? record.outputTokens
    );

    return {
      id: nonEmptyText(record.id, `usage-record-${index + 1}`),
      sessionId: nonEmptyText(record.sessionId, "unknown-session"),
      provider: formatProviderLabel(record.provider),
      model: nonEmptyText(record.model, "unknown-model"),
      promptTokens,
      completionTokens,
      totalTokens:
        nonNegativeNumber(record.totalTokens) || promptTokens + completionTokens,
      createdAt: formatModelUsageUpdatedAt(record.createdAt)
    };
  });
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
    `模型快照：服务商 ${modelSnapshot.provider}，当前展示模型 ${modelSnapshot.selectedModel}，后端路由 ${modelRouteLabel(
      modelSnapshot.selectedRoute
    )}，thinking ${modelSnapshot.thinkingMode}，stream usage ${
      modelSnapshot.streamUsageEnabled ? "enabled" : "disabled"
    }。`,
    `Usage snapshot: ${usageSnapshot.usageWindow}, input ${formatTokenCount(
      usageSnapshot.inputTokens
    )} tokens, output ${formatTokenCount(
      usageSnapshot.outputTokens
    )} tokens, total ${formatTokenCount(usageSnapshot.totalTokens)} tokens, calls ${formatTokenCount(
      usageSnapshot.callCount
    )}.`,
    "说明：当前页面固定消费 daily_work；coding_agent 仅作为兼容边界，不在这里切换。"
  ].join("\n");
}
