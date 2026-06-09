import { describe, expect, it } from "vitest";

import {
  createCalendarEventPreview,
  createGmailDraftPreview,
  decryptJson,
  encryptJson,
  getGoogleConnectionStatus,
  googleConnectorScopes,
  getMissingGoogleOAuthConfig
} from "./google-connector-service.js";

describe("google connector service", () => {
  it("encrypts and decrypts token payloads", () => {
    const encrypted = encryptJson(
      {
        access_token: "access-token",
        refresh_token: "refresh-token"
      },
      "test-secret"
    );

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("refresh-token");
    expect(decryptJson(encrypted, "test-secret")).toEqual({
      access_token: "access-token",
      refresh_token: "refresh-token"
    });
  });

  it("creates Gmail draft payload previews without send effects", () => {
    const preview = createGmailDraftPreview({
      to: ["customer@example.com"],
      cc: [],
      subject: "Follow-up",
      bodyText: "Thanks for the update."
    });

    expect(preview).toEqual(
      expect.objectContaining({
        provider: "gmail",
        previewOnly: true,
        externalEffects: ["none"],
        to: ["customer@example.com"],
        subject: "Follow-up",
        safetyBoundary: expect.stringContaining("does not call drafts.create")
      })
    );
    expect(preview.draftPayloadPreview.message.raw).toEqual(expect.any(String));
  });

  it("creates Calendar event previews without insert effects", () => {
    const preview = createCalendarEventPreview({
      calendarId: "primary",
      summary: "Project sync",
      startDateTime: "2026-06-07T09:00:00.000Z",
      endDateTime: "2026-06-07T09:30:00.000Z",
      attendeeEmails: ["teammate@example.com"]
    });

    expect(preview).toEqual(
      expect.objectContaining({
        provider: "google_calendar",
        previewOnly: true,
        externalEffects: ["none"],
        calendarId: "primary",
        safetyBoundary: expect.stringContaining("does not call events.insert")
      })
    );
    expect(preview.eventPayloadPreview).toEqual(
      expect.objectContaining({
        summary: "Project sync",
        attendees: [{ email: "teammate@example.com" }]
      })
    );
  });

  it("reports missing OAuth environment variables", () => {
    expect(getMissingGoogleOAuthConfig({} as NodeJS.ProcessEnv)).toEqual([
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REDIRECT_URI",
      "GOOGLE_TOKEN_ENCRYPTION_KEY"
    ]);
  });

  it("reports required OAuth scopes for disconnected Google status", async () => {
    const status = await getGoogleConnectionStatus({
      repository: {
        getConnectorAccount: async () => null
      } as never,
      env: {
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        GOOGLE_REDIRECT_URI: "http://127.0.0.1/callback",
        GOOGLE_TOKEN_ENCRYPTION_KEY: "encryption-key"
      } as NodeJS.ProcessEnv
    });

    expect(status).toMatchObject({
      connected: false,
      requiredScopes: [...googleConnectorScopes],
      missingScopes: [...googleConnectorScopes],
      scopesComplete: false,
      requiresSetup: true
    });
  });

  it("reports connected Google status with complete scopes", async () => {
    const status = await getGoogleConnectionStatus({
      repository: {
        getConnectorAccount: async () => ({
          id: "google:user@example.com",
          provider: "google",
          accountEmail: "user@example.com",
          encryptedTokens: "encrypted",
          scopes: [...googleConnectorScopes],
          connectedAt: "2026-06-08T00:00:00.000Z",
          updatedAt: "2026-06-08T00:00:00.000Z"
        })
      } as never,
      env: {
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        GOOGLE_REDIRECT_URI: "http://127.0.0.1/callback",
        GOOGLE_TOKEN_ENCRYPTION_KEY: "encryption-key"
      } as NodeJS.ProcessEnv
    });

    expect(status).toMatchObject({
      connected: true,
      scopesComplete: true,
      missingScopes: [],
      accountEmail: "user@example.com"
    });
  });

  it("reports connected Google status with missing scopes", async () => {
    const status = await getGoogleConnectionStatus({
      repository: {
        getConnectorAccount: async () => ({
          id: "google:user@example.com",
          provider: "google",
          accountEmail: "user@example.com",
          encryptedTokens: "encrypted",
          scopes: [googleConnectorScopes[0]],
          connectedAt: "2026-06-08T00:00:00.000Z",
          updatedAt: "2026-06-08T00:00:00.000Z"
        })
      } as never,
      env: {
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        GOOGLE_REDIRECT_URI: "http://127.0.0.1/callback",
        GOOGLE_TOKEN_ENCRYPTION_KEY: "encryption-key"
      } as NodeJS.ProcessEnv
    });

    expect(status).toMatchObject({
      connected: true,
      scopesComplete: false,
      requiresSetup: true,
      missingScopes: googleConnectorScopes.slice(1)
    });
  });
});
