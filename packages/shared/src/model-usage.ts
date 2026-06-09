import { z } from "zod";

import { appModeSchema, type AppMode } from "./app-modes.js";

export const deepSeekProviderSchema = z.literal("deepseek");

export const deepSeekModelSchema = z.enum([
  "deepseek-v4-flash",
  "deepseek-v4-pro"
]);

export const modelRouteSchema = z.enum(["fast", "pro"]);

export const thinkingModeSchema = z.enum(["enabled", "disabled"]);

export const modelUsageBudgetStateSchema = z.enum([
  "disabled",
  "tracking_only",
  "within_budget",
  "approaching_limit",
  "over_budget"
]);

export const modelUsageRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  provider: deepSeekProviderSchema,
  model: z.string(),
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().optional(),
  estimatedCostUsd: z.number().nonnegative().optional(),
  createdAt: z.string()
});

export const dailyModelUsageWindowSchema = z.object({
  id: z.string(),
  label: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime()
});

export const dailyModelConfigSnapshotSchema = z.object({
  mode: appModeSchema,
  provider: deepSeekProviderSchema,
  baseUrl: z.string().min(1),
  fastModel: deepSeekModelSchema,
  proModel: deepSeekModelSchema,
  selectedRoute: modelRouteSchema,
  selectedModel: deepSeekModelSchema,
  thinkingMode: thinkingModeSchema,
  streamUsageEnabled: z.boolean(),
  configured: z.boolean(),
  notes: z.array(z.string()).default([])
});

export const dailyModelUsageAggregateSchema = z.object({
  id: z.string(),
  label: z.string(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  recordCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional()
});

export const dailyModelUsageSnapshotSchema = z.object({
  window: dailyModelUsageWindowSchema,
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  currency: z.literal("USD"),
  budgetState: modelUsageBudgetStateSchema,
  updatedAt: z.string().datetime(),
  records: z.array(modelUsageRecordSchema),
  aggregates: z.array(dailyModelUsageAggregateSchema).default([])
});

export const dailyModelUsageResponseSchema = z.object({
  mode: appModeSchema,
  config: dailyModelConfigSnapshotSchema,
  usage: dailyModelUsageSnapshotSchema
});

export type DeepSeekProvider = z.infer<typeof deepSeekProviderSchema>;
export type DeepSeekModel = z.infer<typeof deepSeekModelSchema>;
export type ModelRoute = z.infer<typeof modelRouteSchema>;
export type ThinkingMode = z.infer<typeof thinkingModeSchema>;
export type ModelUsageBudgetState = z.infer<
  typeof modelUsageBudgetStateSchema
>;
export type ModelUsageRecord = z.infer<typeof modelUsageRecordSchema>;
export type DailyModelUsageWindow = z.infer<
  typeof dailyModelUsageWindowSchema
>;
export type DailyModelConfigSnapshot = z.infer<
  typeof dailyModelConfigSnapshotSchema
>;
export type DailyModelUsageAggregate = z.infer<
  typeof dailyModelUsageAggregateSchema
>;
export type DailyModelUsageSnapshot = z.infer<
  typeof dailyModelUsageSnapshotSchema
>;
export type DailyModelUsageResponse = z.infer<
  typeof dailyModelUsageResponseSchema
>;

export interface DailyModelUsageResponseOptions {
  mode?: AppMode;
  configured?: boolean | undefined;
  baseUrl?: string | undefined;
  fastModel?: string | undefined;
  proModel?: string | undefined;
  selectedRoute?: string | undefined;
  thinkingMode?: string | undefined;
  streamUsageEnabled?: boolean | string | undefined;
  updatedAt?: string | undefined;
  records?: ModelUsageRecord[] | undefined;
  sessionId?: string | undefined;
  now?: Date | undefined;
}

const defaultBaseUrl = "https://api.deepseek.com";
const defaultFastModel: DeepSeekModel = "deepseek-v4-flash";
const defaultProModel: DeepSeekModel = "deepseek-v4-pro";
const defaultUsageWindow: DailyModelUsageWindow = {
  id: "daily-work-rolling-24h",
  label: "Last 24 hours",
  startedAt: "2026-06-02T00:00:00.000Z",
  endedAt: "2026-06-03T00:00:00.000Z"
};
const defaultUpdatedAt = "2026-06-03T00:00:00.000Z";

export const defaultDailyModelUsageRecords: ModelUsageRecord[] = [
  {
    id: "daily-model-usage-email-draft",
    sessionId: "customer-follow-up-session",
    provider: "deepseek",
    model: defaultFastModel,
    inputTokens: 1280,
    outputTokens: 420,
    estimatedCostUsd: 0.0017,
    createdAt: "2026-06-02T11:20:00.000Z"
  },
  {
    id: "daily-model-usage-planning-refresh",
    sessionId: "planning-refresh-session",
    provider: "deepseek",
    model: defaultFastModel,
    inputTokens: 960,
    outputTokens: 310,
    estimatedCostUsd: 0.0012,
    createdAt: "2026-06-02T14:05:00.000Z"
  }
];

export function createDailyModelUsageResponse(
  options: DailyModelUsageResponseOptions = {}
): DailyModelUsageResponse {
  const mode = options.mode ?? "daily_work";

  if (mode !== "daily_work") {
    return dailyModelUsageResponseSchema.parse(
      createDisabledDailyModelUsageResponse(mode, options)
    );
  }

  const notes: string[] = [];
  const configured = options.configured ?? false;
  const fastModel = resolveDeepSeekModel(
    options.fastModel,
    defaultFastModel,
    "DEEPSEEK_MODEL_FAST",
    notes
  );
  const proModel = resolveDeepSeekModel(
    options.proModel,
    defaultProModel,
    "DEEPSEEK_MODEL_PRO",
    notes
  );
  const selectedRoute = resolveModelRoute(options.selectedRoute, notes);
  const selectedModel = selectedRoute === "pro" ? proModel : fastModel;
  const thinkingMode = resolveThinkingMode(options.thinkingMode, notes);
  const streamUsageEnabled = resolveBooleanFlag(
    options.streamUsageEnabled,
    true,
    "DEEPSEEK_STREAM_USAGE",
    notes
  );
  const baseUrl = resolveTextOption(options.baseUrl, defaultBaseUrl);

  notes.push(
    configured
      ? "DeepSeek API key is configured; the secret value is intentionally omitted."
      : "DEEPSEEK_API_KEY is not configured; mock usage data is shown."
  );

  const records = (options.records ?? defaultDailyModelUsageRecords).map((record) => ({
    ...record,
    model: record.model || selectedModel,
    totalTokens: record.totalTokens ?? record.inputTokens + record.outputTokens
  }));

  return dailyModelUsageResponseSchema.parse({
    mode,
    config: {
      mode,
      provider: "deepseek",
      baseUrl,
      fastModel,
      proModel,
      selectedRoute,
      selectedModel,
      thinkingMode,
      streamUsageEnabled,
      configured,
      notes
    },
    usage: createUsageSnapshot({
      records,
      budgetState: configured ? "within_budget" : "tracking_only",
      updatedAt: options.updatedAt,
      sessionId: options.sessionId,
      now: options.now
    })
  });
}

function createDisabledDailyModelUsageResponse(
  mode: AppMode,
  options: DailyModelUsageResponseOptions
): DailyModelUsageResponse {
  const updatedAt = options.updatedAt ?? defaultUpdatedAt;

  return {
    mode,
    config: {
      mode,
      provider: "deepseek",
      baseUrl: defaultBaseUrl,
      fastModel: defaultFastModel,
      proModel: defaultProModel,
      selectedRoute: "fast",
      selectedModel: defaultFastModel,
      thinkingMode: "disabled",
      streamUsageEnabled: false,
      configured: false,
      notes: [
        "coding_agent mode is reserved in this build; model usage is disabled."
      ]
    },
    usage: {
      window: defaultUsageWindow,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      currency: "USD",
      budgetState: "disabled",
      updatedAt,
      records: [],
      aggregates: []
    }
  };
}

function createUsageSnapshot(options: {
  records: ModelUsageRecord[];
  budgetState: ModelUsageBudgetState;
  updatedAt?: string | undefined;
  sessionId?: string | undefined;
  now?: Date | undefined;
}): DailyModelUsageSnapshot {
  const promptTokens = options.records.reduce(
    (total, record) => total + record.inputTokens,
    0
  );
  const completionTokens = options.records.reduce(
    (total, record) => total + record.outputTokens,
    0
  );
  const estimatedCostUsd = options.records.reduce(
    (total, record) => total + (record.estimatedCostUsd ?? 0),
    0
  );

  return {
    window: defaultUsageWindow,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    currency: "USD",
    budgetState: options.budgetState,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    records: options.records,
    aggregates: createUsageAggregates(
      options.records,
      options.now ?? new Date(),
      options.sessionId
    )
  };
}

function createUsageAggregates(
  records: ModelUsageRecord[],
  now: Date,
  sessionId?: string
) {
  const endedAt = now.toISOString();
  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return [
    createAggregate(
      "current_session",
      "Current session",
      sessionId ? records.filter((record) => record.sessionId === sessionId) : []
    ),
    createAggregate("24h", "Last 24 hours", filterRecordsSince(records, dayStart), dayStart.toISOString(), endedAt),
    createAggregate("7d", "Last 7 days", filterRecordsSince(records, weekStart), weekStart.toISOString(), endedAt),
    createAggregate("all", "All time", records)
  ];
}

function createAggregate(
  id: string,
  label: string,
  records: ModelUsageRecord[],
  startedAt?: string,
  endedAt?: string
) {
  const promptTokens = records.reduce((total, record) => total + record.inputTokens, 0);
  const completionTokens = records.reduce((total, record) => total + record.outputTokens, 0);

  return {
    id,
    label,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    recordCount: records.length,
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {})
  };
}

function filterRecordsSince(records: ModelUsageRecord[], startedAt: Date) {
  const startMs = startedAt.getTime();
  return records.filter((record) => new Date(record.createdAt).getTime() >= startMs);
}

function resolveDeepSeekModel(
  value: string | undefined,
  fallback: DeepSeekModel,
  envName: string,
  notes: string[]
): DeepSeekModel {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = deepSeekModelSchema.safeParse(trimmed);
  if (parsed.success) {
    return parsed.data;
  }

  notes.push(`${envName} is unsupported; falling back to ${fallback}.`);
  return fallback;
}

function resolveModelRoute(
  value: string | undefined,
  notes: string[]
): ModelRoute {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "fast";
  }

  const parsed = modelRouteSchema.safeParse(trimmed);
  if (parsed.success) {
    return parsed.data;
  }

  notes.push("DEEPSEEK_MODEL_ROUTE is unsupported; falling back to fast.");
  return "fast";
}

function resolveThinkingMode(
  value: string | undefined,
  notes: string[]
): ThinkingMode {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "disabled";
  }

  const parsed = thinkingModeSchema.safeParse(trimmed);
  if (parsed.success) {
    return parsed.data;
  }

  notes.push("DEEPSEEK_THINKING_MODE is unsupported; falling back to disabled.");
  return "disabled";
}

function resolveBooleanFlag(
  value: boolean | string | undefined,
  fallback: boolean,
  envName: string,
  notes: string[]
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (["1", "true", "yes", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "disabled"].includes(normalized)) {
    return false;
  }

  notes.push(`${envName} is unsupported; falling back to ${String(fallback)}.`);
  return fallback;
}

function resolveTextOption(
  value: string | undefined,
  fallback: string
): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}
