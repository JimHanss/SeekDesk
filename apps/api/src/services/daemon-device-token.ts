import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual
} from "node:crypto";

import {
  daemonDeviceTokenPayloadSchema,
  type DaemonDeviceTokenPayload
} from "@seekdesk/shared";

const tokenVersion = "sd1";
const defaultTokenTtlMs = 30 * 24 * 60 * 60 * 1000;

export class DaemonDeviceTokenError extends Error {
  constructor(
    message: string,
    readonly code:
      | "daemon_device_token_invalid"
      | "daemon_device_token_expired"
      | "daemon_device_mismatch"
  ) {
    super(message);
    this.name = "DaemonDeviceTokenError";
  }
}

export class DaemonDeviceTokenService {
  private readonly now: () => number;
  private readonly tokenTtlMs: number;

  constructor(
    private readonly secret: string,
    options: { now?: () => number; tokenTtlMs?: number } = {}
  ) {
    if (secret.length < 24) {
      throw new Error("Daemon device token secret must contain at least 24 characters.");
    }
    this.now = options.now ?? Date.now;
    this.tokenTtlMs = options.tokenTtlMs ?? defaultTokenTtlMs;
  }

  issue(input: { ownerId: string; daemonId: string }) {
    const issuedAt = this.now();
    const payload: DaemonDeviceTokenPayload = {
      version: 1,
      tokenId: randomUUID(),
      ownerId: input.ownerId,
      daemonId: input.daemonId,
      issuedAt,
      expiresAt: issuedAt + this.tokenTtlMs
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const unsigned = `${tokenVersion}.${encodedPayload}`;
    return {
      token: `${unsigned}.${this.sign(unsigned)}`,
      expiresAt: new Date(payload.expiresAt).toISOString()
    };
  }

  verify(token: string, expectedDaemonId?: string) {
    const [version, encodedPayload, signature, extra] = token.split(".");
    if (version !== tokenVersion || !encodedPayload || !signature || extra) {
      throw invalidToken();
    }
    const unsigned = `${version}.${encodedPayload}`;
    if (!secureEqual(signature, this.sign(unsigned))) {
      throw invalidToken();
    }

    let payload: DaemonDeviceTokenPayload;
    try {
      payload = daemonDeviceTokenPayloadSchema.parse(
        JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
      );
    } catch {
      throw invalidToken();
    }
    if (payload.expiresAt <= this.now()) {
      throw new DaemonDeviceTokenError(
        "Daemon device token has expired.",
        "daemon_device_token_expired"
      );
    }
    if (expectedDaemonId && payload.daemonId !== expectedDaemonId) {
      throw new DaemonDeviceTokenError(
        "Daemon device token does not belong to this daemon.",
        "daemon_device_mismatch"
      );
    }
    return payload;
  }

  private sign(value: string) {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }
}

export function createDaemonDeviceTokenServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.SEEKDESK_DAEMON_DEVICE_TOKEN_SECRET?.trim();
  const legacyPairingToken = env.SEEKDESK_DAEMON_PAIRING_TOKEN?.trim();
  if (!configured && !legacyPairingToken && env.NODE_ENV === "production") {
    throw new Error("SEEKDESK_DAEMON_DEVICE_TOKEN_SECRET is required in production.");
  }
  const secret = configured || (legacyPairingToken
    ? createHash("sha256").update(legacyPairingToken).digest("hex")
    : "seekdesk-local-development-device-secret");
  return new DaemonDeviceTokenService(
    secret
  );
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function invalidToken() {
  return new DaemonDeviceTokenError(
    "Daemon device token is invalid.",
    "daemon_device_token_invalid"
  );
}
