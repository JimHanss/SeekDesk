import * as React from "react";

import type {
  GoogleConnectorStatusState,
  GoogleOAuthStartStatus
} from "../types";

const fallbackStatus: GoogleConnectorStatusState = {
  connected: false,
  requiresSetup: true,
  accountEmail: null,
  scopes: [],
  requiredScopes: [],
  missingScopes: [],
  scopesComplete: false,
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
  requiredScopes?: string[];
  missingScopes?: string[];
  scopesComplete?: boolean;
  missingConfig?: string[];
}

interface GoogleOAuthStartDto {
  authorizationUrl?: string;
  error?: string;
  missingConfig?: string[];
}

export function useGoogleConnectorStatus(apiBaseUrl: string) {
  const [googleConnectorStatus, setGoogleConnectorStatus] =
    React.useState<GoogleConnectorStatusState>(fallbackStatus);
  const [googleOAuthStartStatus, setGoogleOAuthStartStatus] =
    React.useState<GoogleOAuthStartStatus>("idle");
  const [googleOAuthStartNotice, setGoogleOAuthStartNotice] = React.useState(
    "Connect email in a secure Google consent window. SeekDesk never asks for your mailbox password."
  );
  const oauthPopupRef = React.useRef<Window | null>(null);
  const oauthPollingRef = React.useRef<number | null>(null);

  const refreshGoogleConnectorStatus = React.useCallback(
    async (signal?: AbortSignal) => {
      setGoogleConnectorStatus((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "Reading Google connector status from /api/connectors/google/status."
      }));

      const response = await fetch(
        `${apiBaseUrl}/api/connectors/google/status`,
        signal ? { signal } : undefined
      );

      if (!response.ok) {
        throw new Error(`Google connector status failed: ${response.status}`);
      }

      const payload = (await response.json()) as GoogleConnectorStatusDto;
      const connected = payload.connected === true;
      const missingScopes = payload.missingScopes ?? [];
      const scopesComplete = payload.scopesComplete === true;
      const requiresSetup =
        payload.requiresSetup === true || !connected || !scopesComplete;
      const missingConfig = payload.missingConfig ?? [];
      const notice = buildGoogleConnectorNotice({
        accountEmail: payload.accountEmail,
        connected,
        missingConfig,
        missingScopes,
        scopesComplete
      });

      const nextStatus: GoogleConnectorStatusState = {
        connected,
        requiresSetup,
        accountEmail: payload.accountEmail ?? null,
        scopes: payload.scopes ?? [],
        requiredScopes: payload.requiredScopes ?? [],
        missingScopes,
        scopesComplete,
        missingConfig,
        source: "api",
        syncStatus: "live",
        notice
      };

      setGoogleConnectorStatus(nextStatus);

      if (connected && scopesComplete) {
        setGoogleOAuthStartStatus("idle");
        setGoogleOAuthStartNotice(
          "Email is authorized. Real Gmail and Calendar read tools can run in preview-only mode."
        );
      } else if (connected && missingScopes.length > 0) {
        setGoogleOAuthStartStatus("idle");
        setGoogleOAuthStartNotice(
          "Email is connected but needs updated consent for the missing Gmail/Calendar scopes. Reopen authorization to refresh scopes."
        );
      } else if (missingConfig.length > 0) {
        setGoogleOAuthStartStatus("requires_setup");
        setGoogleOAuthStartNotice(
          `Add ${missingConfig.join(", ")} to .env.local, restart the API, then start email authorization.`
        );
      } else {
        setGoogleOAuthStartStatus("idle");
        setGoogleOAuthStartNotice(
          "Email authorization is configured. Open the consent window to connect an account."
        );
      }

      return nextStatus;
    },
    [apiBaseUrl]
  );

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchGoogleConnectorStatus() {
      try {
        await refreshGoogleConnectorStatus(controller.signal);
        if (isDisposed) {
          return;
        }
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
  }, [refreshGoogleConnectorStatus]);

  const refreshGoogleConnectorStatusSafely = React.useCallback(async () => {
    try {
      return await refreshGoogleConnectorStatus();
    } catch {
      setGoogleConnectorStatus({
        ...fallbackStatus,
        source: "degraded",
        syncStatus: "degraded",
        notice:
          "Google connector status is unavailable; tools will degrade with connector_not_connected."
      });
      setGoogleOAuthStartStatus("failed");
      setGoogleOAuthStartNotice(
        "Google connector status could not be refreshed."
      );
      return null;
    }
  }, [refreshGoogleConnectorStatus]);

  const stopOAuthStatusPolling = React.useCallback(() => {
    if (oauthPollingRef.current !== null) {
      window.clearInterval(oauthPollingRef.current);
      oauthPollingRef.current = null;
    }
  }, []);

  const startOAuthStatusPolling = React.useCallback(() => {
    stopOAuthStatusPolling();
    const startedAt = Date.now();

    oauthPollingRef.current = window.setInterval(() => {
      void (async () => {
        const nextStatus = await refreshGoogleConnectorStatusSafely();
        const popupClosed = oauthPopupRef.current?.closed === true;

        if (nextStatus?.connected && nextStatus.scopesComplete) {
          stopOAuthStatusPolling();
          setGoogleOAuthStartStatus("idle");
          setGoogleOAuthStartNotice(
            "Email authorization completed. The connector status is live."
          );
          return;
        }

        if (popupClosed) {
          stopOAuthStatusPolling();
          setGoogleOAuthStartStatus(nextStatus?.connected ? "idle" : "failed");
          setGoogleOAuthStartNotice(
            nextStatus?.connected
              ? "Email authorization window closed. Connector status refreshed."
              : "Email authorization window closed before the account was connected."
          );
          return;
        }

        if (Date.now() - startedAt > 120_000) {
          stopOAuthStatusPolling();
          setGoogleOAuthStartStatus("idle");
          setGoogleOAuthStartNotice(
            "Email authorization is still pending. Finish consent in the popup, then refresh connector status."
          );
          return;
        }

        if (nextStatus && !nextStatus.connected) {
          setGoogleOAuthStartStatus("opened");
          setGoogleOAuthStartNotice(
            "Email authorization window is open. Approve access there; this panel will refresh automatically."
          );
        }
      })();
    }, 2500);
  }, [refreshGoogleConnectorStatusSafely, stopOAuthStatusPolling]);

  React.useEffect(() => stopOAuthStatusPolling, [stopOAuthStatusPolling]);

  React.useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        (data as { type?: unknown }).type !== "seekdesk.google_oauth_callback"
      ) {
        return;
      }

      stopOAuthStatusPolling();
      setGoogleOAuthStartNotice(
        "Email authorization callback received. Refreshing connector status."
      );
      void refreshGoogleConnectorStatusSafely();
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [refreshGoogleConnectorStatusSafely, stopOAuthStatusPolling]);

  const startGoogleOAuth = React.useCallback(async () => {
    setGoogleOAuthStartStatus("starting");
    setGoogleOAuthStartNotice("Requesting a secure email authorization URL.");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/connectors/google/oauth/start?workspaceId=workspace-seekdesk`
      );
      const payload = (await response.json()) as GoogleOAuthStartDto;

      if (!response.ok) {
        const missingConfig = payload.missingConfig ?? [];
        setGoogleOAuthStartStatus(
          missingConfig.length > 0 ? "requires_setup" : "failed"
        );
        setGoogleOAuthStartNotice(
          missingConfig.length > 0
            ? `Add ${missingConfig.join(", ")} to .env.local and restart the API.`
            : payload.error ?? `Google OAuth start failed: ${response.status}`
        );
        return;
      }

      if (!payload.authorizationUrl) {
        throw new Error("Google OAuth start did not return an authorization URL.");
      }

      const popup = window.open(
        payload.authorizationUrl,
        "seekdesk-email-authorization",
        createOAuthPopupFeatures()
      );

      if (!popup) {
        setGoogleOAuthStartStatus("failed");
        setGoogleOAuthStartNotice(
          "The browser blocked the email authorization popup. Allow popups for SeekDesk and try again."
        );
        return;
      }

      oauthPopupRef.current = popup;
      popup.focus();
      startOAuthStatusPolling();
      setGoogleOAuthStartStatus("opened");
      setGoogleOAuthStartNotice(
        "Email authorization opened in a new window. After approving access, this panel will refresh automatically."
      );
    } catch (error) {
      setGoogleOAuthStartStatus("failed");
      setGoogleOAuthStartNotice(
        error instanceof Error
          ? error.message
          : "Google OAuth start failed unexpectedly."
      );
    }
  }, [apiBaseUrl, startOAuthStatusPolling]);

  return {
    googleConnectorStatus,
    googleOAuthStartNotice,
    googleOAuthStartStatus,
    refreshGoogleConnectorStatus: refreshGoogleConnectorStatusSafely,
    startGoogleOAuth
  };
}

function buildGoogleConnectorNotice(input: {
  accountEmail?: string | undefined;
  connected: boolean;
  missingConfig: string[];
  missingScopes: string[];
  scopesComplete: boolean;
}) {
  if (input.connected && input.scopesComplete) {
    return `Email authorized${input.accountEmail ? ` as ${input.accountEmail}` : ""}.`;
  }

  if (input.connected && input.missingScopes.length > 0) {
    return `Email authorized but missing required scopes: ${input.missingScopes.join(", ")}.`;
  }

  if (input.missingConfig.length > 0) {
    return `Google OAuth is missing ${input.missingConfig.join(", ")}.`;
  }

  return "Email authorization is configured; connect an account before Gmail or Calendar reads can run.";
}

function createOAuthPopupFeatures() {
  const width = 560;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  return [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "menubar=no",
    "toolbar=no",
    "location=yes",
    "status=no",
    "resizable=yes",
    "scrollbars=yes"
  ].join(",");
}
