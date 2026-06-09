import * as React from "react";

import type {
  EmailConnectorStatusState,
  EmailOAuthStartStatus
} from "../types";

type EmailConnectorProvider = "google" | "microsoft";

interface EmailConnectorConfig {
  provider: EmailConnectorProvider;
  label: string;
  readToolsLabel: string;
  statusPath: string;
  oauthStartPath: string;
  callbackMessageType: string;
  configuredNotice: string;
  connectedNotice: string;
  degradedNotice: string;
  missingConfigPrefix: string;
}

interface EmailConnectorStatusDto {
  connected?: boolean;
  requiresSetup?: boolean;
  accountEmail?: string;
  scopes?: string[];
  requiredScopes?: string[];
  missingScopes?: string[];
  scopesComplete?: boolean;
  missingConfig?: string[];
}

interface EmailOAuthStartDto {
  authorizationUrl?: string;
  error?: string;
  missingConfig?: string[];
}

const connectorConfigs = {
  google: {
    provider: "google",
    label: "Google",
    readToolsLabel: "Gmail and Google Calendar",
    statusPath: "/api/connectors/google/status",
    oauthStartPath: "/api/connectors/google/oauth/start",
    callbackMessageType: "seekdesk.google_oauth_callback",
    configuredNotice:
      "Google email authorization is configured. Open the consent window to connect an account.",
    connectedNotice:
      "Google email is authorized. Real Gmail and Calendar read tools can run in preview-only mode.",
    degradedNotice:
      "Google connector status is unavailable; tools will degrade with connector_not_connected.",
    missingConfigPrefix: "Google OAuth"
  },
  microsoft: {
    provider: "microsoft",
    label: "Microsoft",
    readToolsLabel: "Outlook Mail and Calendar",
    statusPath: "/api/connectors/microsoft/status",
    oauthStartPath: "/api/connectors/microsoft/oauth/start",
    callbackMessageType: "seekdesk.microsoft_oauth_callback",
    configuredNotice:
      "Microsoft email authorization is configured. Open the consent window to connect an Outlook account.",
    connectedNotice:
      "Microsoft email is authorized. Outlook Mail and Calendar read tools can run in preview-only mode.",
    degradedNotice:
      "Microsoft connector status is unavailable; tools will degrade with connector_not_connected.",
    missingConfigPrefix: "Microsoft OAuth"
  }
} satisfies Record<EmailConnectorProvider, EmailConnectorConfig>;

export function useGoogleConnectorStatus(apiBaseUrl: string) {
  const google = useEmailConnectorAuthorization(
    apiBaseUrl,
    connectorConfigs.google
  );
  const microsoft = useEmailConnectorAuthorization(
    apiBaseUrl,
    connectorConfigs.microsoft
  );

  return {
    googleConnectorStatus: google.connectorStatus,
    googleOAuthStartNotice: google.oauthStartNotice,
    googleOAuthStartStatus: google.oauthStartStatus,
    refreshGoogleConnectorStatus: google.refreshConnectorStatus,
    startGoogleOAuth: google.startOAuth,
    microsoftConnectorStatus: microsoft.connectorStatus,
    microsoftOAuthStartNotice: microsoft.oauthStartNotice,
    microsoftOAuthStartStatus: microsoft.oauthStartStatus,
    refreshMicrosoftConnectorStatus: microsoft.refreshConnectorStatus,
    startMicrosoftOAuth: microsoft.startOAuth
  };
}

function useEmailConnectorAuthorization(
  apiBaseUrl: string,
  config: EmailConnectorConfig
) {
  const fallbackStatus = React.useMemo(
    () => createFallbackStatus(config, "syncing"),
    [config]
  );
  const [connectorStatus, setConnectorStatus] =
    React.useState<EmailConnectorStatusState>(fallbackStatus);
  const [oauthStartStatus, setOAuthStartStatus] =
    React.useState<EmailOAuthStartStatus>("idle");
  const [oauthStartNotice, setOAuthStartNotice] = React.useState(
    `Connect ${config.label} email in a secure consent window. SeekDesk never asks for your mailbox password.`
  );
  const oauthPopupRef = React.useRef<Window | null>(null);
  const oauthPollingRef = React.useRef<number | null>(null);

  const refreshConnectorStatus = React.useCallback(
    async (signal?: AbortSignal) => {
      setConnectorStatus((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: `Reading ${config.label} connector status from ${config.statusPath}.`
      }));

      const response = await fetch(
        `${apiBaseUrl}${config.statusPath}`,
        signal ? { signal } : undefined
      );

      if (!response.ok) {
        throw new Error(
          `${config.label} connector status failed: ${response.status}`
        );
      }

      const payload = (await response.json()) as EmailConnectorStatusDto;
      const connected = payload.connected === true;
      const missingScopes = payload.missingScopes ?? [];
      const scopesComplete = payload.scopesComplete === true;
      const requiresSetup =
        payload.requiresSetup === true || !connected || !scopesComplete;
      const missingConfig = payload.missingConfig ?? [];
      const notice = buildConnectorNotice(config, {
        accountEmail: payload.accountEmail,
        connected,
        missingConfig,
        missingScopes,
        scopesComplete
      });

      const nextStatus: EmailConnectorStatusState = {
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

      setConnectorStatus(nextStatus);

      if (connected && scopesComplete) {
        setOAuthStartStatus("idle");
        setOAuthStartNotice(config.connectedNotice);
      } else if (connected && missingScopes.length > 0) {
        setOAuthStartStatus("idle");
        setOAuthStartNotice(
          `${config.label} email is connected but needs updated consent for missing scopes. Reopen authorization to refresh scopes.`
        );
      } else if (missingConfig.length > 0) {
        setOAuthStartStatus("requires_setup");
        setOAuthStartNotice(
          `Add ${missingConfig.join(", ")} to .env.local, restart the API, then start ${config.label} email authorization.`
        );
      } else {
        setOAuthStartStatus("idle");
        setOAuthStartNotice(config.configuredNotice);
      }

      return nextStatus;
    },
    [apiBaseUrl, config]
  );

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchConnectorStatus() {
      try {
        await refreshConnectorStatus(controller.signal);
        if (isDisposed) {
          return;
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setConnectorStatus(createFallbackStatus(config, "degraded"));
      }
    }

    void fetchConnectorStatus();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [config, refreshConnectorStatus]);

  const refreshConnectorStatusSafely = React.useCallback(async () => {
    try {
      return await refreshConnectorStatus();
    } catch {
      setConnectorStatus(createFallbackStatus(config, "degraded"));
      setOAuthStartStatus("failed");
      setOAuthStartNotice(
        `${config.label} connector status could not be refreshed.`
      );
      return null;
    }
  }, [config, refreshConnectorStatus]);

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
        const nextStatus = await refreshConnectorStatusSafely();
        const popupClosed = oauthPopupRef.current?.closed === true;

        if (nextStatus?.connected && nextStatus.scopesComplete) {
          stopOAuthStatusPolling();
          setOAuthStartStatus("idle");
          setOAuthStartNotice(
            `${config.label} email authorization completed. The connector status is live.`
          );
          return;
        }

        if (popupClosed) {
          stopOAuthStatusPolling();
          setOAuthStartStatus(nextStatus?.connected ? "idle" : "failed");
          setOAuthStartNotice(
            nextStatus?.connected
              ? `${config.label} email authorization window closed. Connector status refreshed.`
              : `${config.label} email authorization window closed before the account was connected.`
          );
          return;
        }

        if (Date.now() - startedAt > 120_000) {
          stopOAuthStatusPolling();
          setOAuthStartStatus("idle");
          setOAuthStartNotice(
            `${config.label} email authorization is still pending. Finish consent in the popup, then refresh connector status.`
          );
          return;
        }

        if (nextStatus && !nextStatus.connected) {
          setOAuthStartStatus("opened");
          setOAuthStartNotice(
            `${config.label} email authorization window is open. Approve access there; this panel will refresh automatically.`
          );
        }
      })();
    }, 2500);
  }, [config, refreshConnectorStatusSafely, stopOAuthStatusPolling]);

  React.useEffect(() => stopOAuthStatusPolling, [stopOAuthStatusPolling]);

  React.useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        (data as { type?: unknown }).type !== config.callbackMessageType
      ) {
        return;
      }

      stopOAuthStatusPolling();
      setOAuthStartNotice(
        `${config.label} email authorization callback received. Refreshing connector status.`
      );
      void refreshConnectorStatusSafely();
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [config, refreshConnectorStatusSafely, stopOAuthStatusPolling]);

  const startOAuth = React.useCallback(async () => {
    setOAuthStartStatus("starting");
    setOAuthStartNotice(
      `Requesting a secure ${config.label} email authorization URL.`
    );

    try {
      const response = await fetch(
        `${apiBaseUrl}${config.oauthStartPath}?workspaceId=workspace-seekdesk`
      );
      const payload = (await response.json()) as EmailOAuthStartDto;

      if (!response.ok) {
        const missingConfig = payload.missingConfig ?? [];
        setOAuthStartStatus(
          missingConfig.length > 0 ? "requires_setup" : "failed"
        );
        setOAuthStartNotice(
          missingConfig.length > 0
            ? `Add ${missingConfig.join(", ")} to .env.local and restart the API.`
            : payload.error ??
                `${config.label} OAuth start failed: ${response.status}`
        );
        return;
      }

      if (!payload.authorizationUrl) {
        throw new Error(
          `${config.label} OAuth start did not return an authorization URL.`
        );
      }

      const popup = window.open(
        payload.authorizationUrl,
        `seekdesk-${config.provider}-email-authorization`,
        createOAuthPopupFeatures()
      );

      if (!popup) {
        setOAuthStartStatus("failed");
        setOAuthStartNotice(
          `The browser blocked the ${config.label} email authorization popup. Allow popups for SeekDesk and try again.`
        );
        return;
      }

      oauthPopupRef.current = popup;
      popup.focus();
      startOAuthStatusPolling();
      setOAuthStartStatus("opened");
      setOAuthStartNotice(
        `${config.label} email authorization opened in a new window. After approving access, this panel will refresh automatically.`
      );
    } catch (error) {
      setOAuthStartStatus("failed");
      setOAuthStartNotice(
        error instanceof Error
          ? error.message
          : `${config.label} OAuth start failed unexpectedly.`
      );
    }
  }, [apiBaseUrl, config, startOAuthStatusPolling]);

  return {
    connectorStatus,
    oauthStartNotice,
    oauthStartStatus,
    refreshConnectorStatus: refreshConnectorStatusSafely,
    startOAuth
  };
}

function createFallbackStatus(
  config: EmailConnectorConfig,
  syncStatus: "syncing" | "degraded"
): EmailConnectorStatusState {
  return {
    connected: false,
    requiresSetup: true,
    accountEmail: null,
    scopes: [],
    requiredScopes: [],
    missingScopes: [],
    scopesComplete: false,
    missingConfig: [],
    source: syncStatus === "syncing" ? "local" : "degraded",
    syncStatus,
    notice:
      syncStatus === "syncing"
        ? `Reading ${config.label} connector status from ${config.statusPath}.`
        : config.degradedNotice
  };
}

function buildConnectorNotice(
  config: EmailConnectorConfig,
  input: {
    accountEmail?: string | undefined;
    connected: boolean;
    missingConfig: string[];
    missingScopes: string[];
    scopesComplete: boolean;
  }
) {
  if (input.connected && input.scopesComplete) {
    return `${config.label} email authorized${input.accountEmail ? ` as ${input.accountEmail}` : ""}.`;
  }

  if (input.connected && input.missingScopes.length > 0) {
    return `${config.label} email authorized but missing required scopes: ${input.missingScopes.join(", ")}.`;
  }

  if (input.missingConfig.length > 0) {
    return `${config.missingConfigPrefix} is missing ${input.missingConfig.join(", ")}.`;
  }

  return `${config.label} email authorization is configured; connect an account before ${config.readToolsLabel} reads can run.`;
}

function createOAuthPopupFeatures() {
  const width = 560;
  const height = 720;
  const left = Math.max(
    0,
    Math.round(window.screenX + (window.outerWidth - width) / 2)
  );
  const top = Math.max(
    0,
    Math.round(window.screenY + (window.outerHeight - height) / 2)
  );

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
