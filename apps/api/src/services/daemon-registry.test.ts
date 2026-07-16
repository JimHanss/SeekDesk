import { describe, expect, it } from "vitest";

import { DaemonDeviceTokenService } from "./daemon-device-token.js";
import { DaemonRegistry } from "./daemon-registry.js";

const secret = "test-device-secret-with-enough-entropy";

describe("DaemonRegistry device pairing", () => {
  it("registers a device-token workspace for its owning user only", () => {
    const tokens = new DaemonDeviceTokenService(secret);
    const registry = new DaemonRegistry("legacy-owner", tokens);
    const socket = new FakeSocket();
    const token = tokens.issue({ ownerId: "owner-a", daemonId: "daemon-a" }).token;

    registry.handleConnection(socket);
    socket.receive(registerMessage(token, "daemon-a"));

    expect(registry.listWorkspaces("owner-a")).toEqual([
      expect.objectContaining({ daemonId: "daemon-a", rootPath: "/workspace/project" })
    ]);
    expect(registry.listWorkspaces("owner-b")).toEqual([]);
    expect(socket.sent).toContainEqual(expect.objectContaining({ type: "daemon.registered" }));
  });

  it("rejects a device token used by another daemon id", () => {
    const tokens = new DaemonDeviceTokenService(secret);
    const registry = new DaemonRegistry("legacy-owner", tokens);
    const socket = new FakeSocket();
    const token = tokens.issue({ ownerId: "owner-a", daemonId: "daemon-a" }).token;

    registry.handleConnection(socket);
    socket.receive(registerMessage(token, "daemon-b"));

    expect(registry.listWorkspaces("owner-a")).toEqual([]);
    expect(socket.sent).toContainEqual(expect.objectContaining({ type: "daemon.error" }));
  });
});

function registerMessage(token: string, daemonId: string) {
  return {
    type: "daemon.register",
    token,
    status: {
      daemonId,
      machineName: "developer-machine",
      platform: "win32",
      workspaceRoot: "/workspace/project",
      supportedCapabilities: ["coding.read_file"],
      protocolVersion: 1,
      capabilityVersion: "1"
    }
  };
}

class FakeSocket {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  private readonly listeners = new Map<string, Array<(value: never) => void>>();

  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close() {}

  on(event: string, listener: (value: never) => void) {
    const current = this.listeners.get(event) ?? [];
    current.push(listener);
    this.listeners.set(event, current);
  }

  receive(value: unknown) {
    const message = Buffer.from(JSON.stringify(value));
    for (const listener of this.listeners.get("message") ?? []) {
      listener(message as never);
    }
  }
}
