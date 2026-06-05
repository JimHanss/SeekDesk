import type { AssistantResponseMode } from "../types";

export async function readAssistantResponse(
  response: Response,
  onDelta: (delta: string) => void
) {
  const mode = assistantResponseMode(response.headers.get("content-type") ?? "");

  if (mode === "json" || !response.body) {
    const content = extractAssistantTextPayload(await response.text());
    if (content) {
      onDelta(content);
    }
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  switch (mode) {
    case "sse":
      return readAssistantSseStream(reader, decoder, onDelta);
    case "ndjson":
      return readAssistantNdjsonStream(reader, decoder, onDelta);
    case "text":
      return readAssistantTextStream(reader, decoder, onDelta);
  }
}

async function readAssistantTextStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  onDelta: (delta: string) => void
) {
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const delta = decoder.decode(value, { stream: true });
    content += delta;
    onDelta(delta);
  }

  const finalChunk = decoder.decode();
  if (finalChunk) {
    content += finalChunk;
    onDelta(finalChunk);
  }

  return content;
}

async function readAssistantSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  onDelta: (delta: string) => void
) {
  let buffer = "";
  let dataLines: string[] = [];
  let content = "";

  const flushEvent = () => {
    if (!dataLines.length) {
      return;
    }

    const delta = extractAssistantTextPayload(dataLines.join("\n"));
    dataLines = [];

    if (!delta) {
      return;
    }

    content += delta;
    onDelta(delta);
  };

  const processLine = (line: string) => {
    if (!line.trim()) {
      flushEvent();
      return;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach(processLine);
  }

  buffer += decoder.decode();
  if (buffer) {
    buffer.split(/\r?\n/).forEach(processLine);
  }
  flushEvent();

  return content;
}

async function readAssistantNdjsonStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  onDelta: (delta: string) => void
) {
  let buffer = "";
  let content = "";

  const processLine = (line: string) => {
    const delta = extractAssistantTextPayload(line);
    if (!delta) {
      return;
    }

    content += delta;
    onDelta(delta);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach(processLine);
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    processLine(buffer);
  }

  return content;
}

export function assistantResponseMode(contentType: string): AssistantResponseMode {
  const normalized = contentType.toLowerCase();

  if (normalized.includes("text/event-stream")) {
    return "sse";
  }

  if (
    normalized.includes("application/x-ndjson") ||
    normalized.includes("application/jsonl") ||
    normalized.includes("ndjson")
  ) {
    return "ndjson";
  }

  if (normalized.includes("application/json")) {
    return "json";
  }

  return "text";
}

export async function formatChatError(response: Response) {
  const fallback = `请求失败：${response.status}`;

  try {
    const detail = extractAssistantTextPayload(await response.text());
    return detail ? `${fallback}：${detail}` : fallback;
  } catch {
    return fallback;
  }
}

export function extractAssistantTextPayload(payload: string): string {
  const trimmed = payload.trim();

  if (!trimmed || trimmed === "[DONE]") {
    return "";
  }

  if (!isJsonLike(trimmed)) {
    return payload;
  }

  try {
    return extractAssistantTextFromJson(JSON.parse(trimmed)) ?? "";
  } catch {
    return payload;
  }
}

export function extractAssistantTextFromJson(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return joinAssistantText(value.map(extractAssistantTextFromJson));
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of [
    "delta",
    "content",
    "text",
    "response",
    "message",
    "output_text",
    "error"
  ]) {
    if (typeof value[key] === "string") {
      return value[key];
    }
  }

  if (Array.isArray(value.choices)) {
    return joinAssistantText(
      value.choices.map((choice) => {
        if (!isRecord(choice)) {
          return null;
        }

        return (
          extractAssistantTextFromJson(choice.delta) ??
          extractAssistantTextFromJson(choice.message) ??
          extractAssistantTextFromJson(choice.text)
        );
      })
    );
  }

  return (
    extractAssistantTextFromJson(value.message) ??
    extractAssistantTextFromJson(value.delta) ??
    extractAssistantTextFromJson(value.output) ??
    extractAssistantTextFromJson(value.content)
  );
}

export function joinAssistantText(parts: Array<string | null>) {
  const content = parts.filter((part): part is string => Boolean(part)).join("");
  return content || null;
}

export function isJsonLike(value: string) {
  return (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
