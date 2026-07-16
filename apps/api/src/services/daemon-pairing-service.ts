import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  daemonPairingApiUrlSchema,
  daemonPairingCodeSchema,
  type DaemonPairingClaimRequest,
  type DaemonPairingCreateResponse,
  type DaemonPairingDevice,
  type DaemonPairingStatus,
  type DaemonPairingStatusResponse
} from "@seekdesk/shared";

import type { DaemonDeviceTokenService } from "./daemon-device-token.js";

const pairingAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const defaultPairingTtlMs = 10 * 60 * 1000;

interface PairingRecord {
  pairingId: string;
  ownerId: string;
  apiUrl: string;
  codeDigest: string;
  status: DaemonPairingStatus;
  expiresAtMs: number;
  claimedAt?: string;
  device?: DaemonPairingDevice;
}

export class DaemonPairingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "daemon_pairing_not_found"
      | "daemon_pairing_code_invalid"
      | "daemon_pairing_code_expired"
      | "daemon_pairing_code_used"
      | "daemon_pairing_api_insecure",
    readonly statusCode: 400 | 404 | 409 | 410
  ) {
    super(message);
    this.name = "DaemonPairingError";
  }
}

export class DaemonPairingService {
  private readonly pairings = new Map<string, PairingRecord>();
  private readonly codeIndex = new Map<string, string>();
  private readonly now: () => number;
  private readonly pairingTtlMs: number;
  readonly readiness = {
    codeTtlSeconds: defaultPairingTtlMs / 1000,
    deviceTokenConfigured: true
  };

  constructor(
    private readonly deviceTokens: DaemonDeviceTokenService,
    options: { now?: () => number; pairingTtlMs?: number; production?: boolean } = {}
  ) {
    this.now = options.now ?? Date.now;
    this.pairingTtlMs = options.pairingTtlMs ?? defaultPairingTtlMs;
    this.production = options.production ?? process.env.NODE_ENV === "production";
    this.readiness.codeTtlSeconds = Math.round(this.pairingTtlMs / 1000);
  }

  private readonly production: boolean;

  create(input: { ownerId: string; apiUrl: string }): DaemonPairingCreateResponse {
    const apiUrl = normalizeApiUrl(input.apiUrl, this.production);
    const pairingId = randomUUID();
    const code = createPairingCode();
    const expiresAtMs = this.now() + this.pairingTtlMs;
    const record: PairingRecord = {
      pairingId,
      ownerId: input.ownerId,
      apiUrl,
      codeDigest: digestCode(code),
      status: "pending",
      expiresAtMs
    };
    this.pairings.set(pairingId, record);
    this.codeIndex.set(record.codeDigest, pairingId);
    const deepLink = new URL("seekdesk://pair");
    deepLink.searchParams.set("api", apiUrl);
    deepLink.searchParams.set("code", code);
    return {
      pairingId,
      code,
      status: "pending",
      apiUrl,
      deepLink: deepLink.toString(),
      expiresAt: new Date(expiresAtMs).toISOString()
    };
  }

  getStatus(ownerId: string, pairingId: string): DaemonPairingStatusResponse {
    const record = this.pairings.get(pairingId);
    if (!record || record.ownerId !== ownerId) {
      throw new DaemonPairingError(
        "Daemon pairing session was not found.",
        "daemon_pairing_not_found",
        404
      );
    }
    this.expire(record);
    return toStatus(record);
  }

  claim(input: DaemonPairingClaimRequest) {
    const code = daemonPairingCodeSchema.parse(input.code);
    const pairingId = this.codeIndex.get(digestCode(code));
    const record = pairingId ? this.pairings.get(pairingId) : undefined;
    if (!record) {
      throw new DaemonPairingError(
        "Daemon pairing code is invalid.",
        "daemon_pairing_code_invalid",
        400
      );
    }
    this.expire(record);
    if (record.status === "expired") {
      throw new DaemonPairingError(
        "Daemon pairing code has expired.",
        "daemon_pairing_code_expired",
        410
      );
    }
    if (record.status === "claimed") {
      throw new DaemonPairingError(
        "Daemon pairing code has already been used.",
        "daemon_pairing_code_used",
        409
      );
    }

    const claimedAt = new Date(this.now()).toISOString();
    record.status = "claimed";
    record.claimedAt = claimedAt;
    record.device = {
      daemonId: input.daemonId,
      machineName: input.machineName,
      platform: input.platform
    };
    const issued = this.deviceTokens.issue({
      ownerId: record.ownerId,
      daemonId: input.daemonId
    });
    return {
      apiUrl: record.apiUrl,
      daemonId: input.daemonId,
      deviceToken: issued.token,
      tokenExpiresAt: issued.expiresAt
    };
  }

  private expire(record: PairingRecord) {
    if (record.status === "pending" && record.expiresAtMs <= this.now()) {
      record.status = "expired";
    }
  }
}

function toStatus(record: PairingRecord): DaemonPairingStatusResponse {
  return {
    pairingId: record.pairingId,
    status: record.status,
    expiresAt: new Date(record.expiresAtMs).toISOString(),
    ...(record.claimedAt ? { claimedAt: record.claimedAt } : {}),
    ...(record.device ? { device: record.device } : {})
  };
}

function createPairingCode() {
  const bytes = randomBytes(12);
  const raw = Array.from(bytes, (byte) => pairingAlphabet[byte % pairingAlphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function digestCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function normalizeApiUrl(value: string, production: boolean) {
  const parsed = daemonPairingApiUrlSchema.parse(value);
  const url = new URL(parsed);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (production && url.protocol !== "https:" && !local) {
    throw new DaemonPairingError(
      "Production daemon pairing requires an HTTPS API URL.",
      "daemon_pairing_api_insecure",
      400
    );
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
