import { describe, expect, it } from "vitest";

import { realtimeEventSchema } from "./realtime-events.js";

describe("realtimeEventSchema", () => {
  it("accepts an assistant delta event", () => {
    const event = realtimeEventSchema.parse({
      id: "evt_1",
      sessionId: "ses_1",
      createdAt: "2026-06-03T00:00:00.000Z",
      type: "message.assistant.delta",
      messageId: "msg_1",
      delta: "hello"
    });

    expect(event.type).toBe("message.assistant.delta");
  });
});
