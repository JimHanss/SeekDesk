import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type {
  DailyWorkConnectorAccount,
  DailyWorkRepository
} from "../repositories/daily-work-repository.js";

export type EmailConnectorProvider = "google" | "microsoft";

export interface EmailConnectorStatus {
  provider: EmailConnectorProvider;
  connected: boolean;
  scopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  scopesComplete: boolean;
  accountEmail?: string;
  connectedAt?: string;
  updatedAt?: string;
  requiresSetup?: boolean;
  missingConfig?: string[];
}

export class EmailConnectorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConnectorConfigurationError";
  }
}

export async function getEmailConnectorStatus(input: {
  provider: EmailConnectorProvider;
  repository: DailyWorkRepository;
  requiredScopes: readonly string[];
  missingConfig: string[];
}): Promise<EmailConnectorStatus> {
  const account = await input.repository.getConnectorAccount(input.provider);
  const requiredScopes = [...input.requiredScopes];

  if (!account) {
    return {
      provider: input.provider,
      connected: false,
      scopes: requiredScopes,
      requiredScopes,
      missingScopes: requiredScopes,
      scopesComplete: false,
      requiresSetup: true,
      ...(input.missingConfig.length > 0
        ? { missingConfig: input.missingConfig }
        : {})
    };
  }

  const scopes = normalizeScopeArray(account.scopes);
  const missingScopes = getMissingScopes(scopes, input.requiredScopes);

  return {
    provider: input.provider,
    connected: true,
    scopes,
    requiredScopes,
    missingScopes,
    scopesComplete: missingScopes.length === 0,
    ...(account.accountEmail ? { accountEmail: account.accountEmail } : {}),
    connectedAt: account.connectedAt,
    updatedAt: account.updatedAt,
    ...(missingScopes.length > 0 ? { requiresSetup: true } : {}),
    ...(input.missingConfig.length > 0
      ? { missingConfig: input.missingConfig }
      : {})
  };
}

export function encryptConnectorJson(value: unknown, secret: string) {
  const iv = randomBytes(12);
  const key = deriveEncryptionKey(secret);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

export function decryptConnectorJson<T = unknown>(
  payload: string,
  secret: string
): T {
  const [version, ivText, tagText, encryptedText] = payload.split(".");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    throw new EmailConnectorConfigurationError(
      "Encrypted email connector token payload is invalid."
    );
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(secret),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function createEmailOAuthState(input: {
  secret: string;
  provider: EmailConnectorProvider;
  workspaceId?: string;
}) {
  const payload = Buffer.from(
    JSON.stringify({
      provider: input.provider,
      workspaceId: input.workspaceId ?? "workspace-seekdesk",
      nonce: randomBytes(12).toString("base64url"),
      createdAt: new Date().toISOString()
    }),
    "utf8"
  ).toString("base64url");
  const signature = signState(payload, input.secret);

  return `${payload}.${signature}`;
}

export function verifyEmailOAuthState(input: {
  state: string;
  secret: string;
  provider: EmailConnectorProvider;
}) {
  const [payload, signature] = input.state.split(".");
  if (!payload || !signature || signState(payload, input.secret) !== signature) {
    throw new EmailConnectorConfigurationError(
      `Invalid ${input.provider} OAuth state.`
    );
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { provider?: unknown };
    if (parsed.provider !== input.provider) {
      throw new Error("Provider mismatch.");
    }
  } catch {
    throw new EmailConnectorConfigurationError(
      `Invalid ${input.provider} OAuth state.`
    );
  }
}

export function normalizeScopeString(
  scope: string | null | undefined,
  fallbackScopes: readonly string[]
) {
  if (!scope) {
    return [...fallbackScopes];
  }

  return scope
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeScopeArray(scopes: readonly string[]) {
  return scopes.map((scope) => scope.trim()).filter(Boolean);
}

export function getMissingScopes(
  scopes: readonly string[],
  requiredScopes: readonly string[]
) {
  const scopeSet = new Set(scopes);

  return requiredScopes.filter((scope) => !scopeSet.has(scope));
}

export function createConnectorAccount(input: {
  provider: EmailConnectorProvider;
  accountEmail?: string;
  encryptedTokens: string;
  scopes: string[];
  now?: Date;
}): DailyWorkConnectorAccount {
  const now = (input.now ?? new Date()).toISOString();
  const account: DailyWorkConnectorAccount = {
    id: `${input.provider}:${input.accountEmail ?? "connected"}`,
    provider: input.provider,
    encryptedTokens: input.encryptedTokens,
    scopes: input.scopes,
    connectedAt: now,
    updatedAt: now
  };

  if (input.accountEmail) {
    account.accountEmail = input.accountEmail;
  }

  return account;
}

function signState(payload: string, secret: string) {
  return createHash("sha256")
    .update(`${payload}.${secret}`)
    .digest("base64url");
}

function deriveEncryptionKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}
