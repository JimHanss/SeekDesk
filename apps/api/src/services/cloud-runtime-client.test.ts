import { describe, expect, it } from "vitest";

import {
  HttpCloudRuntimeClient,
  UnconfiguredCloudRuntimeClient
} from "./cloud-runtime-client.js";

describe("CloudRuntimeClient", () => {
  it("reports an explicit unconfigured state and rejects execution", async () => {
    const client = new UnconfiguredCloudRuntimeClient();

    await expect(client.health()).resolves.toEqual({
      configured: false,
      reachable: false,
      service: "seekdesk-cloud-runtime",
      dockerReady: false,
      message: "Cloud runtime is not configured."
    });
    await expect(client.execute({
      requestId: "request-1",
      ownerId: "owner-a",
      workspaceId: "cloud-a",
      toolName: "coding.read_file",
      inputJson: { path: "README.md" }
    })).rejects.toMatchObject({ code: "runtime_unavailable" });
  });

  it("authenticates internal requests and parses structured execution results", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) });
      return jsonResponse({
        ok: true,
        requestId: "request-1",
        result: { path: "README.md", content: "from worker" }
      });
    }) as typeof fetch;
    const client = new HttpCloudRuntimeClient(
      "https://runtime.internal",
      "service-token",
      fetchImpl
    );

    await expect(client.execute({
      requestId: "request-1",
      ownerId: "owner-a",
      workspaceId: "cloud-a",
      toolName: "coding.read_file",
      inputJson: { path: "README.md" }
    })).resolves.toEqual({ path: "README.md", content: "from worker" });

    expect(calls[0]?.url).toBe(
      "https://runtime.internal/internal/workspaces/cloud-a/execute"
    );
    expect(new Headers(calls[0]?.init?.headers).get("authorization"))
      .toBe("Bearer service-token");
  });

  it("rejects malformed worker responses instead of trusting partial payloads", async () => {
    const client = new HttpCloudRuntimeClient(
      "https://runtime.internal",
      "service-token",
      (async () => jsonResponse({ ok: true, result: "missing request id" })) as typeof fetch
    );

    await expect(client.execute({
      requestId: "request-2",
      ownerId: "owner-a",
      workspaceId: "cloud-a",
      toolName: "coding.git_status",
      inputJson: {}
    })).rejects.toMatchObject({ code: "runtime_protocol_mismatch" });
  });
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}
