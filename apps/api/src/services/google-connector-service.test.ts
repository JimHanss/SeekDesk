import { describe, expect, it } from "vitest";

import {
  createCalendarEventPreview,
  createGmailDraftPreview,
  decryptJson,
  encryptJson,
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
});
