import { describe, expect, it } from "vitest";

import { formatPairingCountdown } from "./useDaemonPairing";

describe("formatPairingCountdown", () => {
  it("formats the ten minute pairing window", () => {
    expect(formatPairingCountdown(600)).toBe("10:00");
    expect(formatPairingCountdown(65)).toBe("1:05");
  });

  it("clamps expired values", () => {
    expect(formatPairingCountdown(-1)).toBe("0:00");
  });
});
