import { describe, expect, it } from "vitest";

import {
  dailyWorkToolInputSchemas,
  dailyWorkToolNameSchema,
  outlookCalendarCreateEventInputSchema,
  outlookSendMailInputSchema
} from "./tools.js";

describe("daily-work Microsoft write tool schemas", () => {
  it("registers Microsoft write tool names", () => {
    expect(dailyWorkToolNameSchema.parse("outlook.create_draft")).toBe(
      "outlook.create_draft"
    );
    expect(dailyWorkToolNameSchema.parse("outlook.send_mail")).toBe(
      "outlook.send_mail"
    );
    expect(dailyWorkToolNameSchema.parse("outlook.calendar.create_event")).toBe(
      "outlook.calendar.create_event"
    );
  });

  it("validates send mail input with safe defaults", () => {
    expect(
      outlookSendMailInputSchema.parse({
        to: ["customer@example.com"],
        subject: "Status update",
        bodyText: "Hello"
      })
    ).toEqual({
      to: ["customer@example.com"],
      cc: [],
      bcc: [],
      subject: "Status update",
      bodyText: "Hello",
      saveToSentItems: true
    });
  });

  it("uses the same schema map for calendar writes", () => {
    expect(dailyWorkToolInputSchemas["outlook.calendar.create_event"]).toBe(
      outlookCalendarCreateEventInputSchema
    );
  });
});
