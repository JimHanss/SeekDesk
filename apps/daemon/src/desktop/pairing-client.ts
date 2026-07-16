import {
  daemonPairingClaimRequestSchema,
  daemonPairingClaimResponseSchema,
  type DaemonPairingClaimResponse
} from "@seekdesk/shared";

import type { PairingDraft } from "./types.js";

export async function claimDaemonPairing(
  input: PairingDraft & { daemonId: string; machineName: string; platform: string },
  fetchImplementation: typeof fetch = fetch
): Promise<DaemonPairingClaimResponse> {
  const apiUrl = new URL(input.apiUrl);
  apiUrl.pathname = apiUrl.pathname.replace(/\/$/, "");
  apiUrl.search = "";
  apiUrl.hash = "";
  const payload = daemonPairingClaimRequestSchema.parse(input);
  const response = await fetchImplementation(
    `${apiUrl.toString().replace(/\/$/, "")}/api/coding/daemon-pairings/claim`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );
  if (!response.ok) {
    const error = await readError(response);
    throw new Error(error.message || `Pairing failed with HTTP ${response.status}.`);
  }
  return daemonPairingClaimResponseSchema.parse(await response.json());
}

async function readError(response: Response) {
  try {
    const value = await response.json() as { error?: unknown; message?: unknown };
    return {
      code: typeof value.error === "string" ? value.error : "daemon_pairing_failed",
      message: typeof value.message === "string" ? value.message : ""
    };
  } catch {
    return { code: "daemon_pairing_failed", message: "" };
  }
}
