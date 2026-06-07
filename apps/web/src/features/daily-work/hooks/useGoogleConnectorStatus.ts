import * as React from "react";

import type { GoogleConnectorStatusState } from "../types";

const fallbackStatus: GoogleConnectorStatusState = {
  connected: false,
  requiresSetup: true,
  accountEmail: null,
  scopes: [],
  missingConfig: [],
  source: "local",
  syncStatus: "syncing",
  notice: "Reading Google connector status from /api/connectors/google/status."
};

interface GoogleConnectorStatusDto {
  connected?: boolean;
  requiresSetup?: boolean;
  accountEmail?: string;
  scopes?: string[];
  missingConfig?: string[];
}

export function useGoogleConnectorStatus(apiBaseUrl: string) {
  const [googleConnectorStatus, setGoogleConnectorStatus] =
    React.useState<GoogleConnectorStatusState>(fallbackStatus);

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchGoogleConnectorStatus() {
      setGoogleConnectorStatus((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "Reading Google connector status from /api/connectors/google/status."
      }));

      try {
        const response = await fetch(`${apiBaseUrl}/api/connectors/google/status`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Google connector status failed: ${response.status}`);
        }

        const payload = (await response.json()) as GoogleConnectorStatusDto;
        if (isDisposed) {
          return;
        }

        const connected = payload.connected === true;
        const requiresSetup = payload.requiresSetup === true || !connected;
        setGoogleConnectorStatus({
          connected,
          requiresSetup,
          accountEmail: payload.accountEmail ?? null,
          scopes: payload.scopes ?? [],
          missingConfig: payload.missingConfig ?? [],
          source: "api",
          syncStatus: "live",
          notice: connected
            ? `Google connected${payload.accountEmail ? ` as ${payload.accountEmail}` : ""}.`
            : "Google connector requires setup before Gmail or Calendar reads can run."
        });
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setGoogleConnectorStatus({
          ...fallbackStatus,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "Google connector status is unavailable; tools will degrade with connector_not_connected."
        });
      }
    }

    void fetchGoogleConnectorStatus();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl]);

  return { googleConnectorStatus };
}
