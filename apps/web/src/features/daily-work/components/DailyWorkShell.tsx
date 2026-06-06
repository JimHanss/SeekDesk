import type { ReactNode } from "react";
import { Play, Search, Sparkles, Wand2 } from "lucide-react";

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

interface DailyWorkShellProps {
  activeView: DailyWorkView;
  children: ReactNode;
  currentView: DailyWorkViewConfig;
  views: DailyWorkViewConfig[];
  onViewChange: (view: DailyWorkView) => void;
}

export function DailyWorkShell({
  activeView,
  children,
  currentView,
  views,
  onViewChange
}: DailyWorkShellProps) {
  return (
    <main
      className="min-h-screen overflow-x-hidden bg-slate-100 px-3 py-3 text-slate-950 md:px-4"
      data-daily-active-view={activeView}
    >
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1440px] overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_18px_70px_rgba(15,23,42,0.12)] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-950 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-teal-500 text-white shadow-sm">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-semibold tracking-normal">
                SeekDesk
              </h1>
              <p className="truncate text-xs text-slate-300">Daily AI workspace</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:border-t-0">
            {views.map((view) => {
              const isActive = activeView === view.id;

              return (
                <button
                  key={view.id}
                  type="button"
                  data-daily-view-nav={view.id}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onViewChange(view.id)}
                  className={cn(
                    "flex min-w-[148px] cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300 lg:min-w-0",
                    isActive
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-[8px]",
                      isActive ? "bg-teal-50 text-teal-700" : "bg-white/10"
                    )}
                  >
                    {view.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{view.label}</span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[11px]",
                        isActive ? "text-slate-500" : "text-slate-400"
                      )}
                    >
                      {view.description}
                    </span>
                  </span>
                  {view.badge ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
                        isActive
                          ? "bg-slate-100 text-slate-600"
                          : "bg-white/10 text-slate-300"
                      )}
                    >
                      {view.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-h-0 flex-col bg-slate-50">
          <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-teal-700">
                  <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-teal-50">
                    {currentView.icon}
                  </span>
                  <span>daily_work</span>
                </div>
                <h2 className="mt-2 break-words font-heading text-2xl font-semibold tracking-normal text-slate-950">
                  {currentView.label}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  {currentView.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-5 md:py-4">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
