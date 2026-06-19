import { afterEach, describe, expect, it } from "vitest";

import { SeedDailyWorkRepository } from "../repositories/daily-work-repository.js";
import { executeMicrosoftWriteToolCall } from "./daily-work-tools.js";

const microsoftEnvKeys = [
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "MICROSOFT_REDIRECT_URI",
  "MICROSOFT_TOKEN_ENCRYPTION_KEY",
  "MICROSOFT_OAUTH_STATE_SECRET"
] as const;
const savedEnv = Object.fromEntries(
  microsoftEnvKeys.map((key) => [key, process.env[key]])
);

afterEach(() => {
  for (const key of microsoftEnvKeys) {
    const value = savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("executeMicrosoftWriteToolCall", () => {
  it("records permission_required when the session has no grant", async () => {
    const repository = new SeedDailyWorkRepository();
    await repository.recordToolCall(createSendMailToolCall());

    await expect(
      executeMicrosoftWriteToolCall({
        repository,
        sessionId: "session-1",
        toolCallId: "tool-call-1"
      })
    ).rejects.toMatchObject({ code: "permission_required" });

    const [toolCall] = await repository.listToolCalls({ sessionId: "session-1" });
    expect(toolCall).toMatchObject({
      status: "permission_required",
      permissionRequired: true,
      previewOnly: false,
      error: "permission_required"
    });
    expect(await repository.listEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relatedRefs: expect.objectContaining({ sessionIds: ["session-1"] }),
          metadata: expect.objectContaining({ toolName: "outlook.send_mail" })
        })
      ])
    );
  });

  it("requires Microsoft OAuth configuration after a valid session grant", async () => {
    for (const key of microsoftEnvKeys) {
      delete process.env[key];
    }

    const repository = new SeedDailyWorkRepository();
    await repository.recordToolCall(createSendMailToolCall());
    await repository.upsertPermissionGrant({
      id: "grant-1",
      mode: "daily_work",
      provider: "microsoft",
      sessionId: "session-1",
      action: "outlook.send_mail",
      decision: "allow_for_session",
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });

    await expect(
      executeMicrosoftWriteToolCall({
        repository,
        sessionId: "session-1",
        toolCallId: "tool-call-1"
      })
    ).rejects.toMatchObject({ code: "microsoft_oauth_not_configured" });

    const [toolCall] = await repository.listToolCalls({ sessionId: "session-1" });
    expect(toolCall).toMatchObject({
      status: "failed",
      previewOnly: false,
      error: "microsoft_oauth_not_configured"
    });
  });
});

function createSendMailToolCall() {
  return {
    id: "tool-call-1",
    sessionId: "session-1",
    name: "outlook.send_mail" as const,
    status: "permission_required" as const,
    inputJson: {
      to: ["customer@example.com"],
      subject: "Status update",
      bodyText: "Hello"
    },
    previewOnly: false,
    permissionRequired: true,
    createdAt: new Date().toISOString()
  };
}
