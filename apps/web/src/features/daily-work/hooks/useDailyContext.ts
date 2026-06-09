import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useDailyContext(
  apiBaseUrl: string,
  setSelectedContextId: React.Dispatch<React.SetStateAction<string | null>>
) {
  const [contextPanel, setContextPanel] = React.useState<DailyWorkTypes.ContextPanelState>(() =>
    domain.createFallbackContextPanelState()
  );
  const [contextUploadState, setContextUploadState] = React.useState<DailyWorkTypes.ContextUploadState>({
    status: "idle",
    notice: "Upload a PDF, DOCX, text, Markdown, CSV or JSON file to add it to local context.",
    documentId: null,
    tokenEstimate: null
  });

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchContextItems() {
      setContextPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/context?mode=daily_work 同步会话知识上下文。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/context?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Context request failed: ${response.status}`);
        }

        const items = domain.mapContextResponse(
          (await response.json()) as DailyWorkTypes.DailyContextResponseDto
        );

        if (!isDisposed) {
          setContextPanel((current) => {
            const preview =
              current.preview.contextItemId &&
              items.some((item) => item.id === current.preview.contextItemId)
                ? current.preview
                : domain.createLocalContextPreviewState(null);

            return {
              items,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/context?mode=daily_work 同步上下文来源、权限、标签和摘要。",
              preview
            };
          });
          setSelectedContextId((current) =>
            current && items.some((item) => item.id === current) ? current : null
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setContextPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步会话知识上下文，已保留本地上下文示例。"
        }));
      }
    }

    void fetchContextItems();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  const uploadContextFile = React.useCallback(
    async (file: File) => {
      setContextUploadState({
        status: "uploading",
        notice: `Uploading and extracting ${file.name}...`,
        documentId: null,
        tokenEstimate: null
      });

      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", file.name.replace(/\.[^.]+$/, ""));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/context/uploads?mode=${domain.activeMode}`,
          {
            method: "POST",
            body: formData
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Upload failed: ${response.status}`);
        }

        const payload = (await response.json()) as DailyWorkTypes.DailyContextUploadResponseDto;
        const contextItem = payload.contextItem
          ? domain.mapContextDtoToItem(payload.contextItem, 0)
          : null;

        setContextPanel((current) => {
          const nextItems = contextItem
            ? [
                contextItem,
                ...current.items.filter((item) => item.id !== contextItem.id)
              ]
            : current.items;

          return {
            ...current,
            items: nextItems,
            source: "api",
            syncStatus: "live",
            notice:
              "Uploaded context document was extracted locally and added to the workspace context list."
          };
        });

        if (contextItem) {
          setSelectedContextId(contextItem.id);
        }

        setContextUploadState({
          status: "ready",
          notice: `Added ${payload.document?.title ?? file.name} (${payload.document?.tokenEstimate ?? 0} estimated tokens).`,
          documentId: payload.document?.id ?? null,
          tokenEstimate: payload.document?.tokenEstimate ?? null
        });
      } catch (error) {
        setContextUploadState({
          status: "error",
          notice:
            error instanceof Error
              ? error.message
              : "Upload failed before the document could be extracted.",
          documentId: null,
          tokenEstimate: null
        });
      }
    },
    [apiBaseUrl, setSelectedContextId]
  );

  return {
    contextPanel,
    contextUploadState,
    setContextPanel,
    uploadContextFile
  };
}
