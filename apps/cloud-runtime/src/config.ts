import { resolve } from "node:path";

import { z } from "zod";

const configSchema = z.object({
  host: z.string().trim().min(1),
  port: z.number().int().min(1).max(65535),
  serviceToken: z.string().min(16),
  dockerBinary: z.string().trim().min(1),
  runtimeImage: z.string().trim().min(1),
  storageRoot: z.string().trim().min(1),
  workspaceQuotaBytes: z.number().int().positive(),
  idleTimeoutMs: z.number().int().positive(),
  reconcileIntervalMs: z.number().int().positive(),
  cloneTimeoutMs: z.number().int().positive(),
  executeTimeoutMs: z.number().int().positive(),
  maxCommandOutputBytes: z.number().int().positive(),
  cpuLimit: z.number().positive(),
  memoryLimit: z.string().trim().min(1),
  pidsLimit: z.number().int().positive(),
  tmpfsSize: z.string().trim().min(1),
  runtimeUid: z.number().int().positive(),
  runtimeGid: z.number().int().nonnegative()
});

export type CloudRuntimeConfig = z.infer<typeof configSchema>;

export function createCloudRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const serviceToken = env.SEEKDESK_CLOUD_RUNTIME_SERVICE_TOKEN?.trim();
  if (!serviceToken) {
    throw new Error("SEEKDESK_CLOUD_RUNTIME_SERVICE_TOKEN is required.");
  }
  return configSchema.parse({
    host: env.SEEKDESK_CLOUD_RUNTIME_HOST?.trim() || "127.0.0.1",
    port: numberValue(env.SEEKDESK_CLOUD_RUNTIME_PORT, 4100),
    serviceToken,
    dockerBinary: env.SEEKDESK_DOCKER_BINARY?.trim() || "docker",
    runtimeImage: env.SEEKDESK_RUNTIME_IMAGE?.trim() || "seekdesk-runtime:node22",
    storageRoot: resolve(
      env.SEEKDESK_CLOUD_STORAGE_ROOT?.trim() ||
      env.SEEKDESK_RUNTIME_STORAGE_ROOT?.trim() ||
      "/var/lib/seekdesk/runtime"
    ),
    workspaceQuotaBytes: numberValue(
      env.SEEKDESK_CLOUD_WORKSPACE_QUOTA_BYTES,
      numberValue(env.SEEKDESK_RUNTIME_DISK_GB, 10) * 1024 * 1024 * 1024
    ),
    idleTimeoutMs: numberValue(
      env.SEEKDESK_CLOUD_IDLE_TIMEOUT_MS,
      numberValue(env.SEEKDESK_RUNTIME_IDLE_TTL_MINUTES, 30) * 60 * 1000
    ),
    reconcileIntervalMs: numberValue(env.SEEKDESK_CLOUD_RECONCILE_INTERVAL_MS, 60_000),
    cloneTimeoutMs: numberValue(env.SEEKDESK_CLOUD_CLONE_TIMEOUT_MS, 120_000),
    executeTimeoutMs: numberValue(env.SEEKDESK_CLOUD_EXECUTE_TIMEOUT_MS, 130_000),
    maxCommandOutputBytes: numberValue(
      env.SEEKDESK_CLOUD_MAX_COMMAND_OUTPUT_BYTES,
      2_000_000
    ),
    cpuLimit: numberValue(
      env.SEEKDESK_CLOUD_CPU_LIMIT ?? env.SEEKDESK_RUNTIME_CPU_LIMIT,
      2
    ),
    memoryLimit: env.SEEKDESK_CLOUD_MEMORY_LIMIT?.trim() || (
      env.SEEKDESK_RUNTIME_MEMORY_MB?.trim()
        ? `${numberValue(env.SEEKDESK_RUNTIME_MEMORY_MB, 4096)}m`
        : "4g"
    ),
    pidsLimit: numberValue(
      env.SEEKDESK_CLOUD_PIDS_LIMIT ?? env.SEEKDESK_RUNTIME_PID_LIMIT,
      256
    ),
    tmpfsSize: env.SEEKDESK_CLOUD_TMPFS_SIZE?.trim() || "256m",
    runtimeUid: numberValue(
      env.SEEKDESK_CLOUD_RUNTIME_UID,
      process.getuid?.() === 0 ? 10001 : process.getuid?.() ?? 10001
    ),
    runtimeGid: numberValue(
      env.SEEKDESK_CLOUD_RUNTIME_GID,
      process.getgid?.() === 0 ? 10001 : process.getgid?.() ?? 10001
    )
  });
}

function numberValue(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
