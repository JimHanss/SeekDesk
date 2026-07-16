import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

import type { StoredDaemonConfig } from "./types.js";

export interface SecretProtector {
  encrypt(value: string): string;
  decrypt(value: string): string;
}

export class DaemonConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DaemonConfigError";
  }
}

export class DaemonConfigStore {
  constructor(
    private readonly filePath: string,
    readonly protector: SecretProtector
  ) {}

  load() {
    if (!existsSync(this.filePath)) {
      return null;
    }
    try {
      return parseConfig(JSON.parse(readFileSync(this.filePath, "utf8")));
    } catch (error) {
      throw new DaemonConfigError(
        `SeekDesk Daemon configuration is invalid: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  save(config: StoredDaemonConfig) {
    const validated = parseConfig(config);
    const directory = path.dirname(this.filePath);
    const temporary = `${this.filePath}.tmp`;
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    renameSync(temporary, this.filePath);
    try {
      chmodSync(this.filePath, 0o600);
    } catch {
      // Windows ACLs are managed by the current user profile.
    }
    return validated;
  }

  clear() {
    rmSync(this.filePath, { force: true });
  }

  encryptToken(token: string) {
    return this.protector.encrypt(token);
  }

  decryptToken(config: StoredDaemonConfig) {
    return this.protector.decrypt(config.encryptedToken);
  }
}

function parseConfig(value: unknown): StoredDaemonConfig {
  if (!value || typeof value !== "object") {
    throw new Error("Configuration must be an object.");
  }
  const input = value as Record<string, unknown>;
  const required = ["apiUrl", "daemonId", "encryptedToken", "tokenExpiresAt", "pairedAt"] as const;
  for (const key of required) {
    if (typeof input[key] !== "string" || !input[key].trim()) {
      throw new Error(`${key} is required.`);
    }
  }
  if (input.version !== 1 || typeof input.autoStart !== "boolean") {
    throw new Error("Unsupported configuration version.");
  }
  const apiUrl = new URL(String(input.apiUrl));
  if (apiUrl.protocol !== "http:" && apiUrl.protocol !== "https:") {
    throw new Error("apiUrl must use HTTP or HTTPS.");
  }
  return {
    version: 1,
    apiUrl: apiUrl.toString().replace(/\/$/, ""),
    daemonId: String(input.daemonId),
    encryptedToken: String(input.encryptedToken),
    tokenExpiresAt: new Date(String(input.tokenExpiresAt)).toISOString(),
    ...(typeof input.workspaceRoot === "string" && input.workspaceRoot.trim()
      ? { workspaceRoot: input.workspaceRoot }
      : {}),
    autoStart: input.autoStart,
    pairedAt: new Date(String(input.pairedAt)).toISOString()
  };
}
