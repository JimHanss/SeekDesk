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
    "Configure Google OAuth, then open the consent screen from this panel."
  );

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

      setGoogleConnectorStatus({
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
      });

      if (connected && scopesComplete) {
        setGoogleOAuthStartStatus("idle");
        setGoogleOAuthStartNotice(
          "Google is connected. Real Gmail and Calendar read tools can run in preview-only mode."
        );
      } else if (connected && missingScopes.length > 0) {
        setGoogleOAuthStartStatus("idle");
        setGoogleOAuthStartNotice(
          "Google is connected but needs updated consent for the missing Gmail/Calendar scopes. Reopen OAuth to refresh scopes."
        );
      } else if (missingConfig.length > 0) {
        setGoogleOAuthStartStatus("requires_setup");
        setGoogleOAuthStartNotice(
          `Add ${missingConfig.join(", ")} to .env.local, restart the API, then start OAuth.`
        );
      } else {
        setGoogleOAuthStartStatus("idle");
        setGoogleOAuthStartNotice(
          "Google OAuth is configured. Open the consent screen to connect an account."
        );
      }
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
      await refreshGoogleConnectorStatus();
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
    }
  }, [refreshGoogleConnectorStatus]);

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

      void refreshGoogleConnectorStatusSafely();
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [refreshGoogleConnectorStatusSafely]);

  const startGoogleOAuth = React.useCallback(async () => {
    setGoogleOAuthStartStatus("starting");
    setGoogleOAuthStartNotice("Requesting a Google OAuth consent URL.");

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

      window.open(payload.authorizationUrl, "_blank", "noopener,noreferrer");
      setGoogleOAuthStartStatus("opened");
      setGoogleOAuthStartNotice(
        "Google consent opened in a new tab. After approving access, return here and refresh connector status."
      );
    } catch (error) {
      setGoogleOAuthStartStatus("failed");
      setGoogleOAuthStartNotice(
        error instanceof Error
          ? error.message
          : "Google OAuth start failed unexpectedly."
      );
    }
  }, [apiBaseUrl]);

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
    return `Google connected${input.accountEmail ? ` as ${input.accountEmail}` : ""}.`;
  }

  if (input.connected && input.missingScopes.length > 0) {
    return `Google connected but missing required scopes: ${input.missingScopes.join(", ")}.`;
  }

  if (input.missingConfig.length > 0) {
    return `Google OAuth is missing ${input.missingConfig.join(", ")}.`;
  }

  return "Google OAuth is configured; connect an account before Gmail or Calendar reads can run.";
}
