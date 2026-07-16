import { describe, expect, it, vi } from "vitest";

import { createDaemonWebSocketUrl, startDaemonClient } from "./client.js";

describe("daemon client lifecycle", () => {
  it("maps HTTP API URLs to the daemon WebSocket", () => {
    expect(createDaemonWebSocketUrl("http://127.0.0.1:4100/api")).toBe(
      "ws://127.0.0.1:4100/ws/daemon"
    );
    expect(createDaemonWebSocketUrl("https://desk.example.com")).toBe(
      "wss://desk.example.com/ws/daemon"
    );
  });

  it("stops before opening a socket when already aborted", async () => {
    const controller = new AbortController();
    const onStatus = vi.fn();
    controller.abort();

    await startDaemonClient({
      apiUrl: "http://127.0.0.1:4100",
      token: "not-logged",
      workspaceRoot: ".",
      signal: controller.signal,
      onStatus
    });

    expect(onStatus).toHaveBeenCalledWith({ phase: "stopped", attempt: 0 });
  });
});
