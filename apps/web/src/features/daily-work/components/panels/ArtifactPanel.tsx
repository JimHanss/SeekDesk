"use client";

import {
  CheckCircle2,
  FileText,
  Lock,
  ShieldCheck,
  Target
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  artifactFilterCount,
  artifactFilters
} from "../../domain";
import type {
  ArtifactFilter,
  ArtifactItem,
  ArtifactPanelState
} from "../../types";
import {
  ArtifactDetailBlock,
  ArtifactDetailRow,
  ArtifactStatePill
} from "../DailyWorkPrimitives";

interface ArtifactPanelProps {
  artifactFilter: ArtifactFilter;
  artifactItems: ArtifactItem[];
  artifactPanel: ArtifactPanelState;
  filteredArtifacts: ArtifactItem[];
  selectedArtifact: ArtifactItem | null;
  onFilterChange: (filter: ArtifactFilter) => void;
  onSelectArtifact: (artifactId: string) => void;
}

export function ArtifactPanel({
  artifactFilter,
  artifactItems,
  artifactPanel,
  filteredArtifacts,
  selectedArtifact,
  onFilterChange,
  onSelectArtifact
}: ArtifactPanelProps) {
  return (
    <div
      className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
      data-artifact-panel
      data-artifact-panel-source={artifactPanel.source}
      data-artifact-panel-sync-status={artifactPanel.syncStatus}
      data-artifact-panel-notice={artifactPanel.notice}
      data-artifact-panel-count={artifactItems.length}
      data-artifacts-panel
      data-artifacts-source={artifactPanel.source}
      data-artifacts-sync-status={artifactPanel.syncStatus}
      data-artifacts-count={artifactItems.length}
      data-selected-artifact-id={selectedArtifact?.id ?? ""}
    >
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-teal-950">
            <CheckCircle2
              className="size-4 shrink-0 text-teal-700"
              aria-hidden="true"
            />
            <span className="min-w-0 break-words">日常工作产物</span>
          </div>
          <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
            {filteredArtifacts.length}/{artifactItems.length}
          </span>
        </div>

        <div className="rounded-[8px] border border-teal-100 bg-white px-3 py-2 text-xs leading-5 text-teal-700">
          <span className="font-medium text-teal-950">
            {artifactPanel.source} / {artifactPanel.syncStatus}
          </span>
          <span className="ml-2">{artifactPanel.notice}</span>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="产物筛选">
          {artifactFilters.map((filter) => {
            const isActive = artifactFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange(filter)}
                className={cn(
                  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                  isActive
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                )}
              >
                <span>{filter}</span>
                <span
                  className={cn(
                    "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-teal-50 text-teal-700"
                  )}
                >
                  {artifactFilterCount(filter, artifactItems)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {filteredArtifacts.map((artifact) => {
          const Icon = artifact.icon;
          const isSelected = selectedArtifact?.id === artifact.id;

          return (
            <button
              key={artifact.id}
              type="button"
              onClick={() => onSelectArtifact(artifact.id)}
              data-artifact-card={artifact.id}
              data-artifact-state={artifact.state}
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                isSelected
                  ? "border-teal-400 bg-white shadow-sm"
                  : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
              )}
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium text-teal-950">
                      {artifact.title}
                    </span>
                    <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                      {artifact.artifactType} / {artifact.owner}
                    </span>
                  </span>
                  <ArtifactStatePill state={artifact.state} />
                </span>
                <span className="mt-2 block break-words text-xs leading-5 text-teal-700">
                  {artifact.description}
                </span>
                <span className="mt-2 block break-words text-[11px] leading-4 text-slate-500">
                  更新：{artifact.updatedAt}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selectedArtifact ? (
        <div
          className="mt-3 border-t border-teal-100 pt-3"
          data-artifact-detail={selectedArtifact.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-teal-700">
                {selectedArtifact.artifactType}
              </div>
              <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                {selectedArtifact.title}
              </div>
              <div className="mt-1 break-words text-xs leading-5 text-teal-700">
                {selectedArtifact.description}
              </div>
            </div>
            <ArtifactStatePill state={selectedArtifact.state} />
          </div>

          <ArtifactDetailBlock
            icon={<FileText className="size-4" aria-hidden="true" />}
            title="摘要"
          >
            {selectedArtifact.summary}
          </ArtifactDetailBlock>

          <div className="mt-3 grid gap-2">
            <ArtifactDetailRow
              label="来源模板"
              value={selectedArtifact.templateTitle}
            />
            <ArtifactDetailRow label="来源上下文" value={selectedArtifact.source} />
          </div>

          <div className="mt-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
              <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
              上下文 / 审批追踪
            </div>
            <div className="space-y-2">
              {selectedArtifact.trace.map((traceItem) => (
                <div
                  key={`${selectedArtifact.id}-${traceItem.label}`}
                  className="rounded-[8px] border border-teal-100 bg-white px-3 py-2"
                >
                  <div className="text-[11px] font-medium text-teal-700">
                    {traceItem.label}
                  </div>
                  <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                    {traceItem.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ArtifactDetailBlock
            icon={<Target className="size-4" aria-hidden="true" />}
            title="下一步行动"
          >
            {selectedArtifact.nextAction}
          </ArtifactDetailBlock>

          <div className="mt-3 flex flex-wrap gap-2">
            {selectedArtifact.tags.map((tag) => (
              <span
                key={`${selectedArtifact.id}-${tag}`}
                className="max-w-full rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700"
              >
                <span className="break-words">{tag}</span>
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-orange-200 bg-white px-3 py-2 text-xs leading-5 text-orange-800">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              权限状态：{selectedArtifact.permissionStatus}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
