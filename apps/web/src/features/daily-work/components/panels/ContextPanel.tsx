"use client";

import { FileUp, Lock, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  contextPanelSourceLabel,
  contextPanelSyncStatusLabel,
  contextPreviewSourceLabel,
  contextPreviewSyncStatusLabel
} from "../../domain";
import type {
  ContextItem,
  ContextPanelState,
  ContextUploadState
} from "../../types";

interface ContextPanelProps {
  contextItems: ContextItem[];
  contextPanel: ContextPanelState;
  contextUploadState: ContextUploadState;
  selectedContextId: string | null;
  onUploadContextFile: (file: File) => Promise<void>;
  onUseContextItem: (item: ContextItem) => void;
}

export function ContextPanel({
  contextItems,
  contextPanel,
  contextUploadState,
  selectedContextId,
  onUploadContextFile,
  onUseContextItem
}: ContextPanelProps) {
  return (
    <div
      className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
      data-context-panel
      data-context-source={contextPanel.source}
      data-context-sync-status={contextPanel.syncStatus}
      data-context-count={contextItems.length}
      data-context-preview-source={contextPanel.preview.source}
      data-context-preview-status={contextPanel.preview.syncStatus}
      data-context-preview-only={
        contextPanel.preview.previewOnly ? "true" : "false"
      }
      data-context-preview-external-effects={contextPanel.preview.externalEffects.join(
        ","
      )}
      data-selected-context-id={selectedContextId ?? ""}
    >
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-teal-950">
            <ShieldCheck
              className="size-4 shrink-0 text-teal-700"
              aria-hidden="true"
            />
            <span className="min-w-0 break-words">会话知识上下文</span>
          </div>
          <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
            {contextItems.length}
          </span>
        </div>
        <div className="rounded-[8px] border border-teal-100 bg-white/80 px-2.5 py-2 text-[11px] leading-5 text-teal-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-[999px] bg-teal-100 px-2 py-0.5 font-medium text-teal-800">
              {contextPanelSourceLabel(contextPanel.source)}
            </span>
            <span className="rounded-[999px] bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              {contextPanelSyncStatusLabel(contextPanel.syncStatus)}
            </span>
          </div>
          <div className="mt-1 break-words" data-context-panel-notice>
            {contextPanel.notice}
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-[8px] border border-teal-100 bg-white p-2.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium text-teal-950">?????</div>
            <div
              className="mt-1 break-words text-[11px] leading-5 text-teal-700"
              data-context-upload-notice
            >
              {contextUploadState.notice}
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-teal-600 px-3 py-2 text-xs font-medium text-white transition-colors duration-200 hover:bg-teal-700 focus-within:outline focus-within:outline-2 focus-within:outline-teal-600">
            <FileUp className="size-4" aria-hidden="true" />
            ????
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json"
              disabled={contextUploadState.status === "uploading"}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  void onUploadContextFile(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <div
          className={cn(
            "mt-2 inline-flex rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
            contextUploadState.status === "ready"
              ? "bg-emerald-100 text-emerald-800"
              : contextUploadState.status === "error"
                ? "bg-orange-100 text-orange-800"
                : contextUploadState.status === "uploading"
                  ? "bg-sky-100 text-sky-800"
                  : "bg-slate-100 text-slate-700"
          )}
          data-context-upload-status={contextUploadState.status}
          data-context-upload-token-estimate={contextUploadState.tokenEstimate ?? ""}
        >
          {contextUploadState.status}
        </div>
      </div>
      <div className="space-y-2">
        {contextItems.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedContextId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              data-context-card={item.id}
              onClick={() => void onUseContextItem(item)}
              className={cn(
                "w-full cursor-pointer rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                isSelected
                  ? "border-teal-300 bg-white shadow-sm"
                  : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-teal-950">
                      {item.title}
                    </span>
                    <span className="shrink-0 rounded-[999px] bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                      {item.status}
                    </span>
                  </span>
                  <span className="mt-1 block break-words text-xs leading-5 text-teal-700">
                    {item.source} / {item.sourceType}
                  </span>
                  <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                    {item.summary}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      <Lock className="size-3.5" aria-hidden="true" />
                      <span className="break-words">{item.privacy}</span>
                    </span>
                    {item.tags.slice(0, 3).map((tag) => (
                      <span
                        key={`${item.id}-${tag}`}
                        className="rounded-[999px] bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div
        className="mt-3 rounded-[8px] border border-orange-100 bg-orange-50 px-2.5 py-2 text-[11px] leading-5 text-orange-900"
        data-context-preview-notice={contextPanel.preview.notice}
        data-context-preview-safety={contextPanel.preview.safetyStatement}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-[999px] bg-white px-2 py-0.5 font-medium text-orange-800">
            {contextPreviewSourceLabel(contextPanel.preview.source)}
          </span>
          <span className="rounded-[999px] bg-white px-2 py-0.5 font-medium text-slate-700">
            {contextPreviewSyncStatusLabel(contextPanel.preview.syncStatus)}
          </span>
          <span className="rounded-[999px] bg-white px-2 py-0.5 font-medium text-teal-800">
            previewOnly={contextPanel.preview.previewOnly ? "true" : "false"}
          </span>
          <span className="rounded-[999px] bg-white px-2 py-0.5 font-medium text-teal-800">
            externalEffects={contextPanel.preview.externalEffects.join(",")}
          </span>
        </div>
        <div className="mt-1 break-words">{contextPanel.preview.notice}</div>
        <div className="mt-1 break-words">
          {contextPanel.preview.safetyStatement}
        </div>
      </div>
    </div>
  );
}
