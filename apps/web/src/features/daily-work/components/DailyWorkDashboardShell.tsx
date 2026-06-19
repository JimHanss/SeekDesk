"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Play, Search, Settings2, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DailyWorkView =
  | "assistant"
  | "templates"
  | "knowledge"
  | "workflows"
  | "connectors"
  | "artifacts"
  | "approvals"
  | "activity"
  | "sessions"
  | "models";

export interface DailyWorkViewConfig {
  id: DailyWorkView;
  label: string;
  description: string;
  icon: ReactNode;
  badge?: string;
}

interface DailyWorkDashboardShellProps {
  activeView: DailyWorkView;
  children: ReactNode;
  primaryViews: DailyWorkViewConfig[];
  settingsViews: DailyWorkViewConfig[];
  onViewChange: (view: DailyWorkView) => void;
}

export function DailyWorkDashboardShell({
  activeView,
  children,
  primaryViews,
  settingsViews,
  onViewChange
}: DailyWorkDashboardShellProps) {
  const views = [...primaryViews, ...settingsViews];
  const currentView = views.find((view) => view.id === activeView) ?? views[0]!;

  const renderNavButton = (
    view: DailyWorkViewConfig,
    density: "primary" | "compact" = "primary"
  ) => {
    const isActive = activeView === view.id;

    return (
      <button
        key={view.id}
        type="button"
        data-daily-view-nav={view.id}
        aria-current={isActive ? "page" : undefined}
        aria-label={`${view.label}，${view.description}`}
        onClick={() => onViewChange(view.id)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-[8px] text-left text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300",
          density === "compact" ? "px-2.5 py-2" : "px-3 py-2.5",
          isActive
            ? "bg-white text-slate-950 shadow-sm"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-[8px]",
            density === "compact" ? "size-7" : "size-8",
            isActive ? "bg-teal-50 text-teal-700" : "bg-white/10"
          )}
        >
          {view.icon}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{view.label}</span>
        {view.badge ? (
          <span
            className={cn(
              "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
              isActive ? "bg-slate-100 text-slate-600" : "bg-white/10 text-slate-300"
            )}
          >
            {view.badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-slate-100 px-3 py-3 text-slate-950 md:px-4"
      data-daily-active-view={activeView}
    >
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1500px] overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_18px_70px_rgba(15,23,42,0.12)] lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-950 text-white lg:border-b-0 lg:border-r">
          <div className="flex h-14 items-center gap-3 px-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-teal-500 text-white shadow-sm">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-base font-semibold tracking-normal">
                SeekDesk
              </h1>
              <div className="truncate text-[11px] font-medium text-slate-400">
                daily_work
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:border-t-0">
            <div className="flex shrink-0 gap-2 lg:flex-col lg:gap-1">
              {primaryViews.map((view) => renderNavButton(view))}
            </div>

            <div className="flex shrink-0 gap-2 border-l border-white/10 pl-3 lg:mt-auto lg:flex-col lg:border-l-0 lg:border-t lg:pl-0 lg:pt-3">
              {settingsViews.map((view) => renderNavButton(view, "compact"))}
            </div>
          </nav>
        </aside>

        <section className="flex min-h-0 flex-col bg-slate-50">
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 md:px-5">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
              <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                {currentView.icon}
              </span>
              <span className="min-w-0 truncate">{currentView.label}</span>
            </div>

            <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onViewChange("knowledge")}
              >
                <Search className="size-4" aria-hidden="true" />
                上下文
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onViewChange("templates")}
              >
                <Wand2 className="size-4" aria-hidden="true" />
                模板
              </Button>
              <Link
                href="/templates"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <Wand2 className="size-4" aria-hidden="true" />
                模板管理
              </Link>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onViewChange("models")}
              >
                <Settings2 className="size-4" aria-hidden="true" />
                设置
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => onViewChange("workflows")}
              >
                <Play className="size-4" aria-hidden="true" />
                新建流程
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}