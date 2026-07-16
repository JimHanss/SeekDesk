"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DaemonPairingCreateResponse,
  DaemonPairingStatusResponse
} from "@seekdesk/shared";

export type DaemonPairingUiStatus =
  | "idle"
  | "creating"
  | "pending"
  | "claimed"
  | "expired"
  | "error";

export interface DaemonPairingState {
  status: DaemonPairingUiStatus;
  pairing: DaemonPairingCreateResponse | null;
  device: DaemonPairingStatusResponse["device"];
  secondsRemaining: number;
  error: string;
}

const initialState: DaemonPairingState = {
  status: "idle",
  pairing: null,
  device: undefined,
  secondsRemaining: 0,
  error: ""
};

export function useDaemonPairing(
  apiBaseUrl: string,
  enabled: boolean,
  onClaimed: (status: DaemonPairingStatusResponse) => void
) {
  const [state, setState] = useState<DaemonPairingState>(initialState);
  const claimedPairingId = useRef("");
  const onClaimedRef = useRef(onClaimed);

  useEffect(() => {
    onClaimedRef.current = onClaimed;
  }, [onClaimed]);

  const createPairing = useCallback(async () => {
    setState({ ...initialState, status: "creating" });
    try {
      const apiUrl = resolvePairingApiUrl(apiBaseUrl);
      const response = await fetch(apiBaseUrl + "/api/coding/daemon-pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl })
      });
      if (!response.ok) {
        throw new Error(await readPairingError(response));
      }
      const pairing = await response.json() as DaemonPairingCreateResponse;
      claimedPairingId.current = "";
      setState({
        status: "pending",
        pairing,
        device: undefined,
        secondsRemaining: secondsUntil(pairing.expiresAt),
        error: ""
      });
      return pairing;
    } catch (error) {
      setState({
        ...initialState,
        status: "error",
        error: pairingErrorMessage(error, "无法生成配对码。")
      });
      return null;
    }
  }, [apiBaseUrl]);

  const resetPairing = useCallback(() => {
    claimedPairingId.current = "";
    setState(initialState);
  }, []);

  useEffect(() => {
    const pairing = state.pairing;
    if (!enabled || state.status !== "pending" || !pairing) {
      return;
    }

    const controller = new AbortController();
    let polling = false;
    const poll = async () => {
      const remaining = secondsUntil(pairing.expiresAt);
      if (remaining <= 0) {
        setState((current) => ({ ...current, status: "expired", secondsRemaining: 0 }));
        return;
      }
      setState((current) => ({ ...current, secondsRemaining: remaining }));
      if (polling) {
        return;
      }
      polling = true;
      try {
        const response = await fetch(
          apiBaseUrl + "/api/coding/daemon-pairings/" + encodeURIComponent(pairing.pairingId),
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(await readPairingError(response));
        }
        const status = await response.json() as DaemonPairingStatusResponse;
        if (status.status === "claimed") {
          setState((current) => ({
            ...current,
            status: "claimed",
            device: status.device,
            secondsRemaining: 0,
            error: ""
          }));
          if (claimedPairingId.current !== status.pairingId) {
            claimedPairingId.current = status.pairingId;
            onClaimedRef.current(status);
          }
        } else if (status.status === "expired") {
          setState((current) => ({ ...current, status: "expired", secondsRemaining: 0 }));
        } else {
          setState((current) => ({ ...current, error: "" }));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState((current) => ({
            ...current,
            error: pairingErrorMessage(error, "暂时无法确认配对状态。")
          }));
        }
      } finally {
        polling = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 1_500);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [apiBaseUrl, enabled, state.pairing, state.status]);

  const expiresLabel = useMemo(
    () => formatPairingCountdown(state.secondsRemaining),
    [state.secondsRemaining]
  );

  return {
    state,
    expiresLabel,
    actions: { createPairing, resetPairing }
  };
}

export function formatPairingCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function secondsUntil(expiresAt: string) {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1_000));
}

function resolvePairingApiUrl(apiBaseUrl: string) {
  if (typeof window === "undefined") {
    return apiBaseUrl;
  }
  return new URL(apiBaseUrl || window.location.origin, window.location.origin)
    .toString()
    .replace(/\/$/, "");
}

async function readPairingError(response: Response) {
  try {
    const payload = await response.json() as { message?: unknown };
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // Fall through to the HTTP status message.
  }
  return `配对请求失败（HTTP ${response.status}）。`;
}

function pairingErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
