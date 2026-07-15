import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createCredentialCipherFromEnv,
  CredentialCryptoError,
  redactCredentialText
} from "./credential-crypto.js";

describe("repository credential encryption", () => {
  it("encrypts with owner-bound authenticated encryption and a rotation version", () => {
    const cipher = createCredentialCipherFromEnv({
      SEEKDESK_CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      SEEKDESK_CREDENTIAL_ENCRYPTION_KEY_VERSION: "key-2026-07"
    });
    const envelope = cipher.encrypt("github-token-value", "owner-a");
    expect(envelope).toContain("seekdesk-credential:key-2026-07:");
    expect(envelope).not.toContain("github-token-value");
    expect(cipher.decrypt(envelope, "owner-a")).toBe("github-token-value");
    expect(() => cipher.decrypt(envelope, "owner-b")).toThrowError(
      expect.objectContaining({ code: "credential_decryption_failed" })
    );
  });

  it("rejects missing and malformed keys", () => {
    expect(() => createCredentialCipherFromEnv({})).toThrowError(CredentialCryptoError);
    expect(() => createCredentialCipherFromEnv({ SEEKDESK_CREDENTIAL_ENCRYPTION_KEY: "short" }))
      .toThrowError(expect.objectContaining({ code: "credential_key_invalid" }));
  });

  it("decrypts an older envelope through the configured rotation key", () => {
    const oldKey = randomBytes(32).toString("base64");
    const oldCipher = createCredentialCipherFromEnv({
      SEEKDESK_CREDENTIAL_ENCRYPTION_KEY: oldKey,
      SEEKDESK_CREDENTIAL_ENCRYPTION_KEY_VERSION: "key-old"
    });
    const envelope = oldCipher.encrypt("rotating-token", "owner-a");
    const rotatedCipher = createCredentialCipherFromEnv({
      SEEKDESK_CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      SEEKDESK_CREDENTIAL_ENCRYPTION_KEY_VERSION: "key-new",
      SEEKDESK_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS: `key-old=${oldKey}`
    });

    expect(rotatedCipher.activeVersion).toBe("key-new");
    expect(rotatedCipher.decrypt(envelope, "owner-a")).toBe("rotating-token");
  });

  it("redacts credentials from URLs, headers, and query strings", () => {
    expect(redactCredentialText(
      "https://user:token@example.test/repo Authorization: Bearer abc?token=secret"
    )).not.toMatch(/user:token|Bearer abc|token=secret/);
  });
});
