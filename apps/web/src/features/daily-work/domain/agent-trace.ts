import type {
  AgentModelUsageSummary,
  AgentModelUsageTraceItem,
  AgentPermissionBoundary,
  AgentToolCallTraceItem,
  AgentTraceResponseDto,
  AgentTraceState
} from "../types";

const defaultPermissionBoundary: AgentPermissionBoundary = {
  previewOnly: true,
  externalEffects: ["none"],
  statement:
    "Daily-work agent tools may read authorized connector data and create local previews only. SeekDesk will not send email, create calendar events, write external documents, or run coding-agent tools in this mode."
};

const emptyUsageSummary: AgentModelUsageSummary = {
  provider: "unknown",
  model: "unknown",
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  recordCount: 0
};

export function createEmptyAgentTraceState(
  overrides: Partial<AgentTraceState> = {}
): AgentTraceState {
  return {
    sessionId: null,
    provider: null,
    syncStatus: "idle",
    toolCalls: [],
    modelUsageRecords: [],
    modelUsageSummary: emptyUsageSummary,
    permissionBoundary: defaultPermissionBoundary,
    notice: "Agent trace is ready for the next daily-work request.",
    ...overrides
  };
}

export function mapAgentTraceResponse(
  payload: AgentTraceResponseDto,
  fallback: {
    sessionId: string;
    provider?: string | null;
  }
): AgentTraceState {
  const modelUsageRecords = (payload.modelUsageRecords ?? [])
    .map(mapModelUsageRecord)
    .filter((item): item is AgentModelUsageTraceItem => Boolean(item));
  const summary = mapModelUsageSummary(
    payload.modelUsageSummary,
    modelUsageRecords,
    fallback.provider
  );

  return createEmptyAgentTraceState({
    sessionId: payload.sessionId ?? fallback.sessionId,
    provider: fallback.provider ?? summary.provider,
    syncStatus: "live",
    toolCalls: (payload.toolCalls ?? [])
      .map(mapToolCallRecord)
      .filter((item): item is AgentToolCallTraceItem => Boolean(item)),
    modelUsageRecords,
    modelUsageSummary: summary,
    permissionBoundary: mapPermissionBoundary(payload.permissionBoundary),
    notice: "Agent trace synced from the API."
  });
}

export function createAgentTraceDegradedState(input: {
  sessionId: string | null;
  provider?: string | null;
  reason: string;
}): AgentTraceState {
  return createEmptyAgentTraceState({
    sessionId: input.sessionId,
    provider: input.provider ?? null,
    syncStatus: "degraded",
    notice: `Agent trace could not be refreshed: ${input.reason}`
  });
}

function mapToolCallRecord(value: unknown): AgentToolCallTraceItem | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: stringValue(value.id, "tool-call"),
    name: stringValue(value.name, "unknown_tool"),
    status: stringValue(value.status, "unknown"),
    inputJson: value.inputJson,
    outputJson: value.outputJson,
    previewOnly: booleanValue(value.previewOnly, true),
    permissionRequired: booleanValue(value.permissionRequired, false),
    error: typeof value.error === "string" ? value.error : null,
    createdAt: stringValue(value.createdAt, ""),
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null
  };
}

function mapModelUsageRecord(value: unknown): AgentModelUsageTraceItem | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: stringValue(value.id, "model-usage"),
    provider: stringValue(value.provider, "unknown"),
    model: stringValue(value.model, "unknown"),
    promptTokens: numberValue(value.promptTokens),
    completionTokens: numberValue(value.completionTokens),
    totalTokens: numberValue(value.totalTokens),
    createdAt: stringValue(value.createdAt, "")
  };
}

function mapModelUsageSummary(
  value: AgentTraceResponseDto["modelUsageSummary"],
  records: AgentModelUsageTraceItem[],
  provider?: string | null
): AgentModelUsageSummary {
  const latest = records.at(-1);

  return {
    provider: value?.provider ?? provider ?? latest?.provider ?? "unknown",
    model: value?.model ?? latest?.model ?? "unknown",
    promptTokens:
      value?.promptTokens ??
      records.reduce((sum, record) => sum + record.promptTokens, 0),
    completionTokens:
      value?.completionTokens ??
      records.reduce((sum, record) => sum + record.completionTokens, 0),
    totalTokens:
      value?.totalTokens ??
      records.reduce((sum, record) => sum + record.totalTokens, 0),
    recordCount: value?.recordCount ?? records.length
  };
}

function mapPermissionBoundary(
  value: AgentTraceResponseDto["permissionBoundary"]
): AgentPermissionBoundary {
  return {
    previewOnly: value?.previewOnly ?? defaultPermissionBoundary.previewOnly,
    externalEffects:
      value?.externalEffects?.filter((item): item is string => typeof item === "string") ??
      defaultPermissionBoundary.externalEffects,
    statement: value?.statement ?? defaultPermissionBoundary.statement
  };
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
