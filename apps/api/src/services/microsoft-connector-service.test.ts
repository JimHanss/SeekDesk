import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DailyWorkConnectorAccount,
  DailyWorkRepository
} from "../repositories/daily-work-repository.js";
import {
  createMicrosoftAuthUrl,
  createOutlookCalendarEventPreview,
  createOutlookDraftPreview,
  exchangeMicrosoftOAuthCode,
  getMicrosoftConnectionStatus,
  getMissingMicrosoftOAuthConfig,
  microsoftConnectorScopes
} from "./microsoft-connector-service.js";

describe("microsoft connector service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports missing Microsoft OAuth environment variables", () => {
    expect(getMissingMicrosoftOAuthConfig({} as NodeJS.ProcessEnv)).toEqual([
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_REDIRECT_URI",
      "MICROSOFT_TOKEN_ENCRYPTION_KEY"
    ]);
  });

  it("creates Microsoft authorization URLs with required delegated scopes", () => {
    const result = createMicrosoftAuthUrl({
      config: createConfig(),
      workspaceId: "workspace-test"
    });
    const url = new URL(result.authorizationUrl);

    expect(url.origin).toBe("https://login.microsoftonline.com");
    expect(url.searchParams.get("client_id")).toBe("microsoft-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:4000/api/connectors/microsoft/oauth/callback"
    );
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([
      ...microsoftConnectorScopes
    ]);
    expect(result.state).toEqual(expect.any(String));
  });

  it("reports required scopes for disconnected Microsoft status", async () => {
    const status = await getMicrosoftConnectionStatus({
      repository: createRepository(),
      env: createEnv()
    });

    expect(status).toMatchObject({
      provider: "microsoft",
      connected: false,
      requiredScopes: [...microsoftConnectorScopes],
      missingScopes: [...microsoftConnectorScopes],
      scopesComplete: false,
      requiresSetup: true
    });
  });

  it("exchanges OAuth code and stores encrypted Microsoft tokens", async () => {
    const repository = createRepository();
    const config = createConfig();
    const authUrl = createMicrosoftAuthUrl({ config });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          scope: microsoftConnectorScopes.join(" ")
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          mail: "user@example.com",
          userPrincipalName: "user@example.com",
          displayName: "User Example"
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const account = await exchangeMicrosoftOAuthCode({
      code: "oauth-code",
      state: authUrl.state,
      config,
      repository
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(account).toMatchObject({
      id: "microsoft:user@example.com",
      provider: "microsoft",
      accountEmail: "user@example.com",
      scopes: [...microsoftConnectorScopes]
    });
    expect(account.encryptedTokens).toMatch(/^v1\./);
    expect(account.encryptedTokens).not.toContain("refresh-token");
  });

  it("creates Outlook draft previews without Graph write effects", () => {
    const preview = createOutlookDraftPreview({
      to: ["customer@example.com"],
      cc: [],
      subject: "Follow-up",
      bodyText: "Thanks for the update."
    });

    expect(preview).toEqual(
      expect.objectContaining({
        provider: "outlook",
        previewOnly: true,
        externalEffects: ["none"],
        to: ["customer@example.com"],
        subject: "Follow-up",
        safetyBoundary: expect.stringContaining("does not call Microsoft Graph")
      })
    );
    expect(preview.draftPayloadPreview.toRecipients).toEqual([
      {
        emailAddress: {
          address: "customer@example.com"
        }
      }
    ]);
  });

  it("creates Outlook calendar event previews without Graph write effects", () => {
    const preview = createOutlookCalendarEventPreview({
      calendarId: "primary",
      summary: "Project sync",
      startDateTime: "2026-06-07T09:00:00.000Z",
      endDateTime: "2026-06-07T09:30:00.000Z",
      attendeeEmails: ["teammate@example.com"],
      timeZone: "UTC"
    });

    expect(preview).toEqual(
      expect.objectContaining({
        provider: "outlook_calendar",
        previewOnly: true,
        externalEffects: ["none"],
        calendarId: "primary",
        safetyBoundary: expect.stringContaining("does not call Microsoft Graph")
      })
    );
    expect(preview.eventPayloadPreview).toEqual(
      expect.objectContaining({
        subject: "Project sync",
        attendees: [
          {
            emailAddress: {
              address: "teammate@example.com"
            },
            type: "required"
          }
        ]
      })
    );
  });
});

function createConfig() {
  return {
    clientId: "microsoft-client-id",
    clientSecret: "microsoft-client-secret",
    redirectUri:
      "http://127.0.0.1:4000/api/connectors/microsoft/oauth/callback",
    tokenEncryptionKey: "microsoft-token-encryption-key",
    stateSecret: "microsoft-state-secret"
  };
}

function createEnv(): NodeJS.ProcessEnv {
  return {
    MICROSOFT_CLIENT_ID: "microsoft-client-id",
    MICROSOFT_CLIENT_SECRET: "microsoft-client-secret",
    MICROSOFT_REDIRECT_URI:
      "http://127.0.0.1:4000/api/connectors/microsoft/oauth/callback",
    MICROSOFT_TOKEN_ENCRYPTION_KEY: "microsoft-token-encryption-key"
  } as NodeJS.ProcessEnv;
}

function createRepository(): DailyWorkRepository {
  const accounts = new Map<string, DailyWorkConnectorAccount>();

  return {
    getConnectorAccount: async (provider: string) =>
      accounts.get(provider) ?? null,
    upsertConnectorAccount: async (account: DailyWorkConnectorAccount) => {
      accounts.set(account.provider, account);

      return account;
    }
  } as DailyWorkRepository;
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
