import { Database, HardDrive, Server, Sparkles } from "lucide-react";

import { formatModelUsageTimestamp, nonEmptyText } from "./model-usage";
import type {
  HealthPersistenceSnapshotDto,
  PersistenceLayerId,
  PersistenceLayerStatus,
  PersistencePanelState,
  PersistencePanelSyncStatus
} from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
        id: "postgres",
        label: "Postgres / Drizzle",
        description: "Postgres-backed workspace persistence with Drizzle migrations.",
        status: "planned",
        detail: "DATABASE_URL is not active in this fallback snapshot.",
        icon: Database
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
    updatedAt: "本地示例",
    notice: "正在读取 /health 的数据层状态；字段缺失时保留本地示例快照。"
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
    currentLayer === "postgres" ||
    currentLayer === "future_database" ||
    snapshot?.databaseReady === true ||
    snapshot?.postgresReady === true ||
    snapshot?.futureDatabaseReady === true;
  const statusText = nonEmptyText(snapshot?.status, "");
  const healthSource = snapshot ? "health" : "fallback";
  const updatedAt =
    formatModelUsageTimestamp(snapshot?.updatedAt) ??
    (healthSource === "health" ? "刚刚同步" : "本地示例");

  return {
    layers: [
      {
        id: "seed_mock",
        label: "Seed / Mock",
        description: "启动 seed、mock 数据和前端示例快照。",
        status: currentLayer === "seed_mock" ? "active" : "available",
        detail:
          currentLayer === "seed_mock"
            ? "当前工作台仍以本地示例作为数据来源。"
            : "保留为离线与冒烟测试回退，不阻塞主流程。",
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
        id: "postgres",
        label: "Postgres / Drizzle",
        description: "DATABASE_URL powered persistence for sessions, tools, traces and artifacts.",
        status:
          currentLayer === "postgres"
            ? "active"
            : snapshot?.postgresConfigured === true
              ? "available"
              : "planned",
        detail:
          currentLayer === "postgres"
            ? snapshot?.postgresReady === false
              ? "Postgres is configured, but the health check is not connected."
              : "Postgres repository is active; workspace data writes prefer the database."
            : snapshot?.postgresConfigured === true
              ? "Postgres is configured but is not the active data layer."
              : "Set DATABASE_URL and run Drizzle migrations to enable Postgres.",
        icon: Database
      },
      {
        id: "future_database",
        label: "Future Database",
        description: "未来数据库持久化入口。",
        status:
          currentLayer === "future_database"
            ? "active"
            : isDatabaseReady && currentLayer !== "postgres"
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
        : "后端 health 暂未暴露数据层字段，界面使用本地示例快照。"
  };
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
    normalized === "postgres" ||
    normalized === "postgresql"
  ) {
    return "postgres";
  }

  if (
    normalized === "database" ||
    normalized === "db" ||
    normalized === "future_database" ||
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
    "postgresConfigured",
    "postgresReady",
    "futureDatabaseReady"
  ].some((key) => key in value);
}

export function readRecord(value: unknown) {
  return isRecord(value) && !Array.isArray(value) ? value : undefined;
}
