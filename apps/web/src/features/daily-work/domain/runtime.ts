export const defaultApiBaseUrl =
  process.env.NEXT_PUBLIC_SEEKDESK_API_URL ?? "http://127.0.0.1:4000";

export function getRuntimeApiBaseUrl() {
  if (typeof window === "undefined") {
    return defaultApiBaseUrl;
  }

  const smokeApiUrl = new URLSearchParams(window.location.search).get(
    "seekdeskSmokeApiUrl"
  );

  return smokeApiUrl || defaultApiBaseUrl;
}

export function getRuntimeWebSocketUrl(apiBaseUrl: string) {
  try {
    const url = new URL(
      apiBaseUrl,
      typeof window === "undefined" ? defaultApiBaseUrl : window.location.origin
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}
