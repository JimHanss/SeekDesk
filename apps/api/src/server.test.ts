import { describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

describe("api server", () => {
  it("returns health status", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "seekdesk-api",
      version: "0.1.0"
    });

    await app.close();
  });
});
