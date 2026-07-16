import {
  daemonPairingApiUrlSchema,
  daemonPairingCodeSchema
} from "@seekdesk/shared";

import type { PairingDraft } from "./types.js";

export function parsePairingDeepLink(value: string): PairingDraft | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "seekdesk:" || url.hostname !== "pair") {
      return null;
    }
    return {
      apiUrl: daemonPairingApiUrlSchema.parse(url.searchParams.get("api")),
      code: daemonPairingCodeSchema.parse(url.searchParams.get("code"))
    };
  } catch {
    return null;
  }
}

export function findPairingDeepLink(values: string[]) {
  for (const value of values) {
    const parsed = parsePairingDeepLink(value);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}
