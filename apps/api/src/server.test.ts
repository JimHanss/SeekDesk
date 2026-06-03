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

  it("streams chat text from a messages request", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: {
        origin: "http://localhost:3000"
      },
      payload: {
        mode: "daily_work",
        messages: [{ role: "user", content: "summarize this repository" }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000"
    );
    expect(response.body).toContain("Mock daily-work AI response");
    expect(response.body).toContain("summarize this repository");

    await app.close();
  });

  it("accepts prompt shorthand", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        prompt: "hello"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("hello");

    await app.close();
  });

  it("accepts the reserved coding-agent mode without enabling tools", async () => {
    const app = await buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        mode: "coding_agent",
        prompt: "inspect a repository"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("coding-agent compatibility");

    await app.close();
  });
});
