import { describe, expect, it } from "vitest";

import {
  ContextDocumentParseError,
  createContextDocumentFromUpload,
  estimateContextTokens,
  resolveContextDocumentFileType
} from "./daily-work-context-documents.js";

describe("daily-work context document uploads", () => {
  it("extracts text uploads into a ready context document and context item", async () => {
    const result = await createContextDocumentFromUpload({
      buffer: Buffer.from("Project notes\nNext action: send weekly summary", "utf8"),
      originalFileName: "notes.md",
      mimeType: "text/markdown",
      title: "Weekly notes",
      tags: ["weekly", " notes "],
      now: new Date("2026-06-09T00:00:00.000Z")
    });

    expect(result.document).toEqual(
      expect.objectContaining({
        mode: "daily_work",
        title: "Weekly notes",
        originalFileName: "notes.md",
        fileType: "md",
        status: "ready",
        extractedText: "Project notes\nNext action: send weekly summary",
        textPreview: "Project notes\nNext action: send weekly summary",
        tokenEstimate: estimateContextTokens(
          "Project notes\nNext action: send weekly summary"
        ),
        tags: ["weekly", "notes"],
        createdAt: "2026-06-09T00:00:00.000Z",
        updatedAt: "2026-06-09T00:00:00.000Z"
      })
    );
    expect(result.document.sha256).toHaveLength(64);
    expect(result.contextItem).toEqual(
      expect.objectContaining({
        id: result.document.contextItemId,
        mode: "daily_work",
        sourceType: "uploaded_document",
        permissionState: "workspace_shared",
        tags: expect.arrayContaining(["uploaded", "md", "weekly", "notes"])
      })
    );
  });

  it("rejects unsupported uploads with an explicit parse error", () => {
    expect(() =>
      resolveContextDocumentFileType({
        fileName: "archive.zip",
        mimeType: "application/zip"
      })
    ).toThrow(ContextDocumentParseError);
  });

  it("rejects empty extracted text", async () => {
    await expect(
      createContextDocumentFromUpload({
        buffer: Buffer.from("   ", "utf8"),
        originalFileName: "empty.txt",
        mimeType: "text/plain"
      })
    ).rejects.toMatchObject({
      code: "empty_document_text"
    });
  });
});
