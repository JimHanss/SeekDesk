import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import {
  dailyContextDocumentSchema,
  dailyContextItemSchema,
  type DailyContextDocument,
  type DailyContextDocumentFileType,
  type DailyContextItem
} from "@seekdesk/shared";

export const maxContextUploadBytes = 10 * 1024 * 1024;

export interface CreateContextDocumentInput {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  title?: string;
  tags?: string[];
  now?: Date;
}

export interface CreateContextDocumentResult {
  document: DailyContextDocument;
  contextItem: DailyContextItem;
}

export async function createContextDocumentFromUpload(
  input: CreateContextDocumentInput
): Promise<CreateContextDocumentResult> {
  const fileType = resolveContextDocumentFileType({
    fileName: input.originalFileName,
    mimeType: input.mimeType
  });
  const extractedText = normalizeExtractedText(
    await extractContextDocumentText({
      buffer: input.buffer,
      fileType
    })
  );

  if (!extractedText) {
    throw new ContextDocumentParseError(
      "empty_document_text",
      "Uploaded document did not contain extractable text."
    );
  }

  const now = (input.now ?? new Date()).toISOString();
  const id = `context-document-${randomUUID()}`;
  const title = normalizeTitle(input.title, input.originalFileName);
  const tags = normalizeTags(input.tags);
  const textPreview = truncateText(extractedText, 700);
  const tokenEstimate = estimateContextTokens(extractedText);
  const document = dailyContextDocumentSchema.parse({
    id,
    mode: "daily_work",
    contextItemId: `uploaded-context-${id}`,
    title,
    originalFileName: input.originalFileName,
    mimeType: input.mimeType || "application/octet-stream",
    fileType,
    fileSizeBytes: input.buffer.byteLength,
    sha256: createHash("sha256").update(input.buffer).digest("hex"),
    extractedText,
    textPreview,
    tokenEstimate,
    status: "ready",
    tags,
    createdAt: now,
    updatedAt: now
  });
  const contextItem = dailyContextItemSchema.parse({
    id: document.contextItemId,
    mode: "daily_work",
    sourceType: "uploaded_document",
    title: document.title,
    summary: document.textPreview,
    permissionState: "workspace_shared",
    tags: ["uploaded", document.fileType, ...document.tags]
  });

  return { document, contextItem };
}

export async function extractContextDocumentText(input: {
  buffer: Buffer;
  fileType: DailyContextDocumentFileType;
}) {
  switch (input.fileType) {
    case "pdf":
      return extractPdfText(input.buffer);
    case "docx":
      return extractDocxText(input.buffer);
    case "txt":
    case "md":
    case "csv":
    case "json":
      return input.buffer.toString("utf8");
  }
}

export function resolveContextDocumentFileType(input: {
  fileName: string;
  mimeType: string;
}): DailyContextDocumentFileType {
  const extension = extname(input.fileName).toLowerCase();
  const mimeType = input.mimeType.toLowerCase();

  if (extension === ".pdf" || mimeType === "application/pdf") {
    return "pdf";
  }

  if (
    extension === ".docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  if (extension === ".md" || mimeType === "text/markdown") {
    return "md";
  }

  if (extension === ".csv" || mimeType === "text/csv") {
    return "csv";
  }

  if (extension === ".json" || mimeType === "application/json") {
    return "json";
  }

  if (extension === ".txt" || mimeType.startsWith("text/")) {
    return "txt";
  }

  throw new ContextDocumentParseError(
    "unsupported_file_type",
    "Only PDF, DOCX, TXT, Markdown, CSV, and JSON uploads are supported."
  );
}

export function estimateContextTokens(text: string) {
  return Math.ceil(normalizeExtractedText(text).length / 4);
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });

  return result.value;
}

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function normalizeTitle(title: string | undefined, originalFileName: string) {
  const normalized = title?.trim();
  if (normalized) {
    return normalized.slice(0, 160);
  }

  return originalFileName.replace(/\.[^.]+$/, "").slice(0, 160) || "Uploaded context";
}

function normalizeTags(tags: string[] | undefined) {
  return (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function truncateText(text: string, limit: number) {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - 1).trim()}...`;
}

export class ContextDocumentParseError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ContextDocumentParseError";
  }
}