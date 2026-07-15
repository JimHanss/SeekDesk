import type {
  AgentModelUsageSummary,
  AgentModelUsageTraceItem,
  AgentPermissionGrantTraceItem,
  AgentPermissionBoundary,
  AgentToolActivityTraceItem,
  AgentToolCallTraceItem,
  AgentTraceResponseDto,
  AgentTraceState
} from "../types";
import { mapDailyActivityEvent } from "./activity";

const defaultPermissionBoundary: AgentPermissionBoundary = {
  previewOnly: true,
  externalEffects: ["none"],
  statement:
    "读取与 Git 检查限定在当前工作区；文件写入、命令和测试需要同一会话授权，并写入运行记录。"
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
    workspaceId: null,
    runtimeMode: null,
    workspace: null,
    syncStatus: "idle",
    toolCalls: [],
    toolActivityEvents: [],
    modelUsageRecords: [],
    modelUsageSummary: emptyUsageSummary,
    permissionGrants: [],
    permissionBoundary: defaultPermissionBoundary,
    notice: "运行详情已准备就绪。",
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
    workspaceId: payload.workspaceId ?? payload.workspace?.workspaceId ?? null,
    runtimeMode: payload.runtimeMode ?? payload.workspace?.runtimeMode ?? null,
    workspace: payload.workspace ?? null,
    syncStatus: "live",
    toolCalls: (payload.toolCalls ?? [])
      .map(mapToolCallRecord)
      .filter((item): item is AgentToolCallTraceItem => Boolean(item)),
    toolActivityEvents: (payload.toolActivityEvents ?? [])
      .map(mapToolActivityEvent)
      .filter((item): item is AgentToolActivityTraceItem => Boolean(item)),
    modelUsageRecords,
    modelUsageSummary: summary,
    permissionGrants: (payload.permissionGrants ?? [])
      .map(mapPermissionGrant)
      .filter((item): item is AgentPermissionGrantTraceItem => Boolean(item)),
    permissionBoundary: mapPermissionBoundary(payload.permissionBoundary),
    notice: "运行详情已从 API 同步。"
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
    notice: `运行详情刷新失败：${input.reason}`
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
    workspaceId: nullableString(value.workspaceId),
    runtimeMode: runtimeModeValue(value.runtimeMode),
    requestId: nullableString(value.requestId),
    inputJson: value.inputJson,
    outputJson: value.outputJson,
    previewOnly: booleanValue(value.previewOnly, true),
    permissionRequired: booleanValue(value.permissionRequired, false),
    error: typeof value.error === "string" ? value.error : null,
    createdAt: stringValue(value.createdAt, ""),
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null
  };
}

function mapToolActivityEvent(
  value: NonNullable<AgentTraceResponseDto["toolActivityEvents"]>[number]
): AgentToolActivityTraceItem | null {
  const activityItem = mapDailyActivityEvent(value);
  const audit = activityItem.toolAudit;

  if (!audit) {
    return null;
  }

  return {
    id: activityItem.id,
    toolName: audit.toolName,
    toolPhase: audit.toolPhase,
    status: activityItem.status,
    time: activityItem.time,
    title: activityItem.title,
    summary: activityItem.summary,
    externalDataSummary: audit.externalDataSummary,
    reference: audit.reference,
    provider: audit.provider,
    previewOnly: audit.previewOnly,
    externalEffects: audit.externalEffects
  };
}

function mapPermissionGrant(value: unknown): AgentPermissionGrantTraceItem | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: stringValue(value.id, "permission-grant"),
    provider: stringValue(value.provider, "unknown"),
    sessionId: stringValue(value.sessionId, ""),
    workspaceId: nullableString(value.workspaceId),
    runtimeMode: runtimeModeValue(value.runtimeMode),
    action: stringValue(value.action, "unknown_action"),
    decision: stringValue(value.decision, "allow_for_session"),
    status: stringValue(value.status, "unknown"),
    reason: typeof value.reason === "string" ? value.reason : null,
    createdAt: stringValue(value.createdAt, ""),
    expiresAt: stringValue(value.expiresAt, ""),
    revokedAt: typeof value.revokedAt === "string" ? value.revokedAt : null
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

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function runtimeModeValue(value: unknown) {
  if (value === "local_daemon" || value === "cloud_runtime" || value === "server_local") {
    return value;
  }
  if (value === "cloud_workspace") {
    return "cloud_runtime" as const;
  }
  if (value === "local_runtime") {
    return "server_local" as const;
  }
  return null;
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
