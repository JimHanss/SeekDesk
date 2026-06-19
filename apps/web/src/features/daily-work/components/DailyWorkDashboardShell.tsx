"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Settings2, Sparkles, Wand2 } from "lucide-react";

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

export interface DailyWorkConversationItem {
  id: string;
  title: string;
  summary: string;
  status: string;
  updatedAt: string;
  messageCount: number;
}

interface DailyWorkDashboardShellProps {
  activeConversationId?: string | null;
  activeView: DailyWorkView;
  children: ReactNode;
  conversationItems?: DailyWorkConversationItem[];
  primaryViews: DailyWorkViewConfig[];
  settingsViews: DailyWorkViewConfig[];
  onConversationSelect?: (conversationId: string) => void;
  onViewChange: (view: DailyWorkView) => void;
}

export function DailyWorkDashboardShell({
  activeConversationId,
  activeView,
  children,
  conversationItems = [],
  primaryViews,
  settingsViews,
  onConversationSelect,
  onViewChange
}: DailyWorkDashboardShellProps) {
  const views = [...primaryViews, ...settingsViews];
  const currentView = views.find((view) => view.id === activeView) ?? views[0]!;
  const assistantView = primaryViews.find((view) => view.id === "assistant");
  const headerViews = primaryViews.filter((view) => view.id !== "assistant");
  const isSettingsActive = settingsViews.some((view) => view.id === activeView);
  const settingsEntry: DailyWorkViewConfig = {
    id: "models",
    label: "\u8bbe\u7f6e",
    description: "\u6a21\u578b\u3001\u8fde\u63a5\u5668\u3001\u5ba1\u6279\u548c\u5ba1\u8ba1\u3002",
    icon: <Settings2 className="size-4" aria-hidden="true" />
  };

  const renderHeaderViewButton = (
    view: DailyWorkViewConfig,
    options?: {
      active?: boolean;
      onClick?: () => void;
    }
  ) => {
    const isActive = options?.active ?? activeView === view.id;

    return (
      <Button
        key={view.id}
        type="button"
        variant="ghost"
        size="sm"
        data-daily-view-nav={view.id}
        aria-current={isActive ? "page" : undefined}
        aria-label={view.label + "\uFF0C" + view.description}
        onClick={options?.onClick ?? (() => onViewChange(view.id))}
        className={cn(
          "shrink-0 border border-transparent text-slate-600",
          isActive
            ? "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-50 hover:text-teal-800"
            : "hover:border-slate-200"
        )}
      >
        {view.icon}
        <span className="hidden lg:inline">{view.label}</span>
      </Button>
    );
  };

  const currentConversationActive = activeView === "assistant" && !activeConversationId;
  const currentConversationNavActive = activeView === "assistant";

  return (
    <main
      className="h-dvh overflow-hidden bg-slate-100 text-slate-950"
      data-daily-active-view={activeView}
    >
      <div className="flex h-full w-full overflow-hidden bg-white lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-slate-950 text-white lg:min-h-0 lg:border-b-0 lg:border-r">
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

          <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 px-3 py-3">
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>{"\u5bf9\u8bdd\u7a97\u53e3"}</span>
              <span>{conversationItems.length + 1}</span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="\u5bf9\u8bdd\u7a97\u53e3\u5217\u8868">
              <button
                type="button"
                data-daily-view-nav="assistant"
                aria-current={currentConversationNavActive ? "page" : undefined}
                onClick={() => onViewChange("assistant")}
                className={cn(
                  "min-h-[64px] w-full cursor-pointer rounded-[8px] border px-3 py-2 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300",
                  currentConversationActive
                    ? "border-white bg-white text-slate-950 shadow-sm"
                    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      currentConversationNavActive ? "bg-teal-400" : "bg-slate-500"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {"\u5f53\u524d\u5bf9\u8bdd"}
                  </span>
                  {assistantView?.badge ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
                        currentConversationActive
                          ? "bg-slate-100 text-slate-600"
                          : "bg-white/10 text-slate-300"
                      )}
                    >
                      {assistantView.badge}
                    </span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "mt-1 line-clamp-1 text-xs",
                    currentConversationActive ? "text-slate-500" : "text-slate-500"
                  )}
                >
                  {"\u8fde\u63a5\u5230\u53f3\u4fa7\u5de5\u4f5c\u53f0"}
                </div>
              </button>

              {conversationItems.map((conversation) => {
                const isActive = activeView === "assistant" && activeConversationId === conversation.id;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    data-daily-conversation-item={conversation.id}
                    aria-pressed={isActive}
                    onClick={() => onConversationSelect?.(conversation.id)}
                    className={cn(
                      "min-h-[76px] w-full cursor-pointer rounded-[8px] border px-3 py-2 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300",
                      isActive
                        ? "border-white bg-white text-slate-950 shadow-sm"
                        : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full", isActive ? "bg-teal-500" : "bg-slate-500")} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {conversation.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
                          isActive ? "bg-slate-100 text-slate-600" : "bg-white/10 text-slate-300"
                        )}
                      >
                        {conversation.messageCount}
                      </span>
                    </div>
                    <div className={cn("mt-1 line-clamp-1 text-xs", isActive ? "text-slate-500" : "text-slate-500")}>
                      {conversation.summary}
                    </div>
                    <div className={cn("mt-1 flex items-center justify-between text-[11px]", isActive ? "text-slate-500" : "text-slate-500")}>
                      <span>{conversation.status}</span>
                      <span>{formatConversationTime(conversation.updatedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col bg-slate-50">
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 md:px-5">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
              <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                {currentView.icon}
              </span>
              <span className="min-w-0 truncate">{currentView.label}</span>
            </div>

            <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
              {headerViews.map((view) => renderHeaderViewButton(view))}
              <Link
                href="/templates"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <Wand2 className="size-4" aria-hidden="true" />
                <span className="hidden lg:inline">{"\u6a21\u677f\u7ba1\u7406"}</span>
              </Link>
              {renderHeaderViewButton(settingsEntry, {
                active: isSettingsActive,
                onClick: () => onViewChange("models")
              })}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatConversationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
