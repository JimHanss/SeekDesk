"use client";

import { Code2, Loader2, ShieldCheck, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  templateArtifactTypeLabel,
  templateCategoryLabel,
  templatePanelSourceLabel,
  templatePanelSyncStatusLabel,
  templatePreviewSourceLabel,
  templatePreviewSyncStatusLabel
} from "../../domain";
import type { TemplateItem, TemplatePanelState } from "../../types";
import { PanelHeader } from "../DailyWorkPrimitives";

interface TemplateLibraryPanelProps {
  templateItems: TemplateItem[];
  templatePanel: TemplatePanelState;
  onApplyTemplate: (template: TemplateItem) => void;
}

export function TemplateLibraryPanel({
  templateItems,
  templatePanel,
  onApplyTemplate
}: TemplateLibraryPanelProps) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-teal-100 bg-white">
      <PanelHeader
        icon={<Wand2 className="size-4" aria-hidden="true" />}
        title="模板库"
      />
      <div
        className="space-y-3 px-3 pb-4 pt-3"
        data-template-panel
        data-template-source={templatePanel.source}
        data-template-sync-status={templatePanel.syncStatus}
        data-template-count={templateItems.length}
        data-template-preview-source={templatePanel.preview.source}
        data-template-preview-only={
          templatePanel.preview.previewOnly ? "true" : "false"
        }
        data-template-preview-status={templatePanel.preview.syncStatus}
        data-template-preview-external-effects={templatePanel.preview.externalEffects.join(
          ","
        )}
      >
        <div className="rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-3 text-sm text-teal-900">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="break-words font-medium text-teal-950">
                日常工作模式
              </div>
              <div className="mt-1 text-xs leading-5 text-teal-700">
                选择模板会先生成仅预览草稿，你可以继续补充上下文后再发送。
              </div>
            </div>
            <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
              {templateItems.length}
            </span>
          </div>

          <div
            className="mt-3 rounded-[8px] border border-teal-100 bg-white px-2.5 py-2 text-xs leading-5 text-teal-700"
            data-template-panel-notice={templatePanel.notice}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="font-medium text-teal-950">
                {templatePanelSourceLabel(templatePanel.source)}
              </span>
              <span>/</span>
              <span>{templatePanelSyncStatusLabel(templatePanel.syncStatus)}</span>
            </div>
            <div className="mt-1 break-words">{templatePanel.notice}</div>
          </div>

          <div
            className="mt-2 rounded-[8px] border border-orange-100 bg-orange-50 px-2.5 py-2 text-xs leading-5 text-orange-800"
            data-template-preview-notice={templatePanel.preview.notice}
            data-template-preview-boundary={
              templatePanel.preview.safetyStatement
            }
          >
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {templatePanel.preview.syncStatus === "syncing" ? (
                <Loader2
                  className="size-3.5 shrink-0 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ShieldCheck
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="font-medium">
                {templatePreviewSourceLabel(templatePanel.preview.source)}
              </span>
              <span>/</span>
              <span>
                {templatePreviewSyncStatusLabel(
                  templatePanel.preview.syncStatus
                )}
              </span>
              <span>
                / previewOnly=
                {templatePanel.preview.previewOnly ? "true" : "false"}
              </span>
            </div>
            <div className="mt-1 break-words">
              {templatePanel.preview.safetyStatement}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {templateItems.map((template) => {
            const Icon = template.icon;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => void onApplyTemplate(template)}
                disabled={!template.enabled}
                data-template-card={template.id}
                data-template-enabled={template.enabled ? "true" : "false"}
                className={cn(
                  "flex min-h-16 w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60",
                  template.enabled
                    ? "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                    : "border-slate-200 bg-slate-50"
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-teal-950">
                        {template.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-4 text-teal-700">
                        {templateCategoryLabel(template.category)} /{" "}
                        {templateArtifactTypeLabel(template.artifactType)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-[999px] px-1.5 py-0.5 text-[10px] font-medium",
                        template.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {template.enabled ? "可用" : "停用"}
                    </span>
                  </span>
                  <span className="mt-1 block max-h-10 overflow-hidden text-xs leading-5 text-teal-700">
                    {template.description}
                  </span>
                  {template.tags.length > 0 ? (
                    <span className="mt-2 flex min-w-0 flex-wrap gap-1">
                      {template.tags.slice(0, 2).map((tag) => (
                        <span
                          key={`${template.id}-${tag}`}
                          className="max-w-full truncate rounded-[999px] bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
            <Code2 className="size-4" aria-hidden="true" />
            编码模式兼容
          </div>
          <p className="text-xs leading-5">
            架构保留编码助手能力位；当前页面只开放日常工作模式，不暴露编码工具。
          </p>
        </div>
      </div>
    </section>
  );
}
