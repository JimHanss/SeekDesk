import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const envelopePrefix = "seekdesk-credential";

export interface CredentialCipherOptions {
  activeKeyVersion: string;
  keys: ReadonlyMap<string, Buffer>;
}

export class CredentialCryptoError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "CredentialCryptoError";
  }
}

export class CredentialCipher {
  private readonly activeKeyVersion: string;
  private readonly keys: ReadonlyMap<string, Buffer>;

  constructor(options: CredentialCipherOptions) {
    this.activeKeyVersion = options.activeKeyVersion;
    this.keys = options.keys;
    const activeKey = this.keys.get(this.activeKeyVersion);
    if (!activeKey || activeKey.byteLength !== 32) {
      throw new CredentialCryptoError(
        "The active credential encryption key must decode to exactly 32 bytes.",
        "credential_key_invalid"
      );
    }
  }

  encrypt(plaintext: string, ownerId: string) {
    if (!plaintext || !ownerId.trim()) {
      throw new CredentialCryptoError(
        "Credential plaintext and ownerId are required.",
        "credential_input_invalid"
      );
    }
    const key = this.keys.get(this.activeKeyVersion)!;
    const iv = randomBytes(12);
    const cipher = createCipheriv(algorithm, key, iv);
    cipher.setAAD(Buffer.from(ownerId, "utf8"));
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      envelopePrefix,
      this.activeKeyVersion,
      iv.toString("base64url"),
      tag.toString("base64url"),
      encrypted.toString("base64url")
    ].join(":");
  }

  decrypt(envelope: string, ownerId: string) {
    const [prefix, keyVersion, ivValue, tagValue, encryptedValue, ...extra] = envelope.split(":");
    if (
      prefix !== envelopePrefix ||
      !keyVersion ||
      !ivValue ||
      !tagValue ||
      !encryptedValue ||
      extra.length > 0
    ) {
      throw new CredentialCryptoError("Credential envelope is invalid.", "credential_envelope_invalid");
    }
    const key = this.keys.get(keyVersion);
    if (!key) {
      throw new CredentialCryptoError(
        `Credential key version ${keyVersion} is not configured.`,
        "credential_key_version_unavailable"
      );
    }
    try {
      const decipher = createDecipheriv(algorithm, key, Buffer.from(ivValue, "base64url"));
      decipher.setAAD(Buffer.from(ownerId, "utf8"));
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, "base64url")),
        decipher.final()
      ]).toString("utf8");
    } catch {
      throw new CredentialCryptoError(
        "Credential could not be decrypted for this owner.",
        "credential_decryption_failed"
      );
    }
  }

  get activeVersion() {
    return this.activeKeyVersion;
  }
}

export function createCredentialCipherFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const rawKey = env.SEEKDESK_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!rawKey) {
    throw new CredentialCryptoError(
      "SEEKDESK_CREDENTIAL_ENCRYPTION_KEY is not configured.",
      "credential_key_not_configured"
    );
  }
  const activeKeyVersion = env.SEEKDESK_CREDENTIAL_ENCRYPTION_KEY_VERSION?.trim() || "v1";
  const keys = new Map<string, Buffer>([[activeKeyVersion, decodeKey(rawKey)]]);
  const previous = env.SEEKDESK_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS?.trim();
  if (previous) {
    for (const item of previous.split(",")) {
      const separator = item.indexOf("=");
      if (separator <= 0) {
        throw new CredentialCryptoError(
          "Previous credential keys must use version=base64 format.",
          "credential_key_invalid"
        );
      }
      keys.set(item.slice(0, separator).trim(), decodeKey(item.slice(separator + 1).trim()));
    }
  }
  return new CredentialCipher({ activeKeyVersion, keys });
}

export function redactCredentialText(value: string) {
  return value
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[redacted]@")
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, "$1[redacted]")
    .replace(/([?&](?:access_token|token|key)=)[^&\s]+/gi, "$1[redacted]");
}

function decodeKey(rawKey: string) {
  const key = Buffer.from(rawKey, "base64");
  if (key.byteLength !== 32) {
    throw new CredentialCryptoError(
      "Credential encryption key must be a base64-encoded 32-byte value.",
      "credential_key_invalid"
    );
  }
  return key;
}
