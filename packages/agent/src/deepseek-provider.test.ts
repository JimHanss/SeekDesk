import { afterEach, describe, expect, it, vi } from "vitest";

import { DeepSeekModelProvider } from "./deepseek-provider.js";
import type { ModelStreamChunk } from "./provider.js";

const encoder = new TextEncoder();

describe("DeepSeekModelProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts an OpenAI-compatible streaming request with daily-work context", async () => {
    const fetchMock = stubFetch(
      streamResponse([
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "Hello" } }]
        })}\n\n`,
        "data: [DONE]\n\n"
      ])
    );
    const provider = createProvider({
      thinkingMode: "enabled",
      includeUsage: true
    });

    await collectChunks(
      provider.streamChat({
        mode: "daily_work",
        messages: [{ role: "user", content: "Draft a daily update" }],
        maxTurns: 1
      })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.test/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Authorization": "Bearer sk-test-secret",
          "Content-Type": "application/json"
        }
      })
    );

    const [, init] =
      (fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]) ?? [];
    const body = JSON.parse(String(init?.body));

    expect(body).toEqual(
      expect.objectContaining({
        model: "deepseek-v4-pro",
        stream: true,
        stream_options: { include_usage: true },
        thinking: { type: "enabled" }
      })
    );
    expect(body.messages).toEqual([
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("daily-work mode")
      }),
      { role: "user", content: "Draft a daily update" }
    ]);
  });

  it("parses content and reasoning deltas across split SSE chunks", async () => {
    const splitJson = `data: ${JSON.stringify({
      choices: [{ delta: { content: " split" } }]
    })}\n\n`;
    const fetchMock = stubFetch(
      streamResponse([
        "event: message\n",
        `data: ${JSON.stringify({
          choices: [{ delta: { role: "assistant" } }]
        })}\n\n`,
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "Hello" } }]
        })}\n\n`,
        `data: ${JSON.stringify({
          choices: [{ delta: { reasoning_content: " reasoning" } }]
        })}\n\n`,
        "data: {\"choices\":[{\"delta\":{}}]}\n\n",
        "data: {\"usage\":{\"prompt_tokens\":10},\"choices\":[]}\n\n",
        splitJson.slice(0, 18),
        splitJson.slice(18),
        "data: [DONE]\n\n"
      ])
    );
    const provider = createProvider();

    const chunks = await collectChunks(
      provider.streamChat({
        mode: "daily_work",
        messages: [{ role: "user", content: "Stream it" }],
        maxTurns: 1
      })
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(chunks).toEqual([
      { type: "text-delta", delta: "Hello" },
      { type: "text-delta", delta: " reasoning" },
      { type: "text-delta", delta: " split" },
      { type: "done" }
    ]);
  });

  it("throws a clear error for non-2xx responses without leaking the key", async () => {
    stubFetch(new Response("quota exceeded", { status: 429 }));
    const provider = createProvider();

    await expect(
      collectChunks(
        provider.streamChat({
          mode: "daily_work",
          messages: [{ role: "user", content: "Hello" }],
          maxTurns: 1
        })
      )
    ).rejects.toThrow("DeepSeek request failed with 429: quota exceeded");
    await expect(
      collectChunks(
        provider.streamChat({
          mode: "daily_work",
          messages: [{ role: "user", content: "Hello" }],
          maxTurns: 1
        })
      )
    ).rejects.not.toThrow("sk-test-secret");
  });

  it("throws a clear error when a successful response has no stream body", async () => {
    stubFetch(new Response(null, { status: 204 }));
    const provider = createProvider();

    await expect(
      collectChunks(
        provider.streamChat({
          mode: "daily_work",
          messages: [{ role: "user", content: "Hello" }],
          maxTurns: 1
        })
      )
    ).rejects.toThrow("DeepSeek request failed with 204");
  });

  it("reports malformed SSE JSON with parse context", async () => {
    stubFetch(streamResponse(["data: {not-json}\n\n"]));
    const provider = createProvider();

    await expect(
      collectChunks(
        provider.streamChat({
          mode: "daily_work",
          messages: [{ role: "user", content: "Hello" }],
          maxTurns: 1
        })
      )
    ).rejects.toThrow("DeepSeek stream parse failed");
  });
});

function createProvider(
  overrides: Partial<ConstructorParameters<typeof DeepSeekModelProvider>[0]> = {}
) {
  return new DeepSeekModelProvider({
    apiKey: "sk-test-secret",
    baseUrl: "https://api.deepseek.test/",
    model: "deepseek-v4-pro",
    ...overrides
  });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function streamResponse(chunks: string[]) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      }
    }),
    {
      headers: {
        "Content-Type": "text/event-stream"
      },
      status: 200
    }
  );
}

async function collectChunks(chunks: AsyncIterable<ModelStreamChunk>) {
  const collected: ModelStreamChunk[] = [];
  for await (const chunk of chunks) {
    collected.push(chunk);
  }

  return collected;
}
