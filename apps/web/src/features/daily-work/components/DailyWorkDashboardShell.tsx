"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Archive, MoreHorizontal, Pencil, Pin, Plus, Settings2, Sparkles, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DailyWorkView =
  | "assistant"
  | "files"
  | "search"
  | "diff"
  | "terminal"
  | "trace"
  | "workspace"
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
  pinned?: boolean;
}

export interface DailyWorkConversationGroup {
  id: string;
  label: string;
  description?: string;
  items: DailyWorkConversationItem[];
}

interface DailyWorkDashboardShellProps {
  activeConversationId?: string | null;
  activeView: DailyWorkView;
  children: ReactNode;
  currentConversation: DailyWorkConversationItem;
  conversationItems?: DailyWorkConversationItem[];
  conversationGroups?: DailyWorkConversationGroup[];
  primaryViews: DailyWorkViewConfig[];
  settingsViews: DailyWorkViewConfig[];
  onConversationArchive?: (conversationId: string) => void | Promise<void>;
  onConversationDelete?: (conversationId: string) => void | Promise<void>;
  onConversationPinToggle?: (conversationId: string) => void | Promise<void>;
  onConversationRename?: (conversationId: string) => void | Promise<void>;
  onConversationSelect?: (conversationId: string) => void;
  onCurrentConversationSelect?: () => void;
  onNewConversationSelect?: () => void;
  onViewChange: (view: DailyWorkView) => void;
}

export function DailyWorkDashboardShell({
  activeConversationId,
  activeView,
  children,
  currentConversation,
  conversationItems = [],
  conversationGroups,
  primaryViews,
  settingsViews,
  onConversationArchive,
  onConversationDelete,
  onConversationPinToggle,
  onConversationRename,
  onConversationSelect,
  onCurrentConversationSelect,
  onNewConversationSelect,
  onViewChange
}: DailyWorkDashboardShellProps) {
  const views = [...primaryViews, ...settingsViews];
  const currentView = views.find((view) => view.id === activeView) ?? views[0]!;
  const headerViews = primaryViews.filter((view) => view.id !== "assistant");
  const groupedConversationItems = conversationGroups?.length
    ? conversationGroups
    : [{ id: "default", label: "当前工作区", items: conversationItems }];
  const historyConversationCount = groupedConversationItems.reduce(
    (total, group) => total + group.items.length,
    0
  );
  const isSettingsActive = settingsViews.some((view) => view.id === activeView);
  const settingsEntry: DailyWorkViewConfig = {
    id: "models",
    label: "\u8bbe\u7f6e",
    description: "模型、运行时、审批和审计。",
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
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);

  const handleConversationMenuAction = (action: () => void) => {
    setOpenConversationMenuId(null);
    action();
  };

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
                coding agent
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 px-3 py-3">
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>{"\u5bf9\u8bdd"}</span>
              <span>{historyConversationCount + 1}</span>
            </div>

            <button
              type="button"
              data-daily-new-conversation
              onClick={() => {
                setOpenConversationMenuId(null);
                if (onNewConversationSelect) {
                  onNewConversationSelect();
                  return;
                }

                onCurrentConversationSelect?.();
              }}
              className="mb-2 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white transition-colors duration-200 hover:border-teal-300/40 hover:bg-teal-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>{"\u65b0\u5bf9\u8bdd"}</span>
            </button>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="\u5bf9\u8bdd\u7a97\u53e3\u5217\u8868">
              <ConversationRow
                conversation={currentConversation}
                isActive={currentConversationActive}
                viewNavId="assistant"
                onSelect={() => {
                  if (onCurrentConversationSelect) {
                    onCurrentConversationSelect();
                    return;
                  }

                  onViewChange("assistant");
                }}
              />

              {groupedConversationItems.map((group) => (
                <div key={group.id} className="mt-2 first:mt-1">
                  <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-semibold text-slate-500">
                    <span className="truncate">{group.label}</span>
                    <span>{group.items.length}</span>
                  </div>
                  {group.description ? (
                    <div className="mb-1 truncate px-2 text-[10px] text-slate-600">
                      {group.description}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    {group.items.map((conversation) => {
                      const isActive = activeView === "assistant" && activeConversationId === conversation.id;
                      const menuOpen = openConversationMenuId === conversation.id;

                      return (
                        <ConversationRow
                          key={conversation.id}
                          conversation={conversation}
                          isActive={isActive}
                          menuOpen={menuOpen}
                          onMenuToggle={() =>
                            setOpenConversationMenuId((current) =>
                              current === conversation.id ? null : conversation.id
                            )
                          }
                          onRename={() =>
                            handleConversationMenuAction(() =>
                              void onConversationRename?.(conversation.id)
                            )
                          }
                          onArchive={() =>
                            handleConversationMenuAction(() =>
                              void onConversationArchive?.(conversation.id)
                            )
                          }
                          onDelete={() =>
                            handleConversationMenuAction(() =>
                              void onConversationDelete?.(conversation.id)
                            )
                          }
                          onPinToggle={() =>
                            handleConversationMenuAction(() =>
                              void onConversationPinToggle?.(conversation.id)
                            )
                          }
                          onSelect={() => onConversationSelect?.(conversation.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
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

function ConversationRow({
  conversation,
  isActive,
  menuOpen = false,
  onArchive,
  onDelete,
  onMenuToggle,
  onPinToggle,
  onRename,
  onSelect,
  viewNavId
}: {
  conversation: DailyWorkConversationItem;
  isActive: boolean;
  menuOpen?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
  onMenuToggle?: () => void;
  onPinToggle?: () => void;
  onRename?: () => void;
  onSelect: () => void;
  viewNavId?: DailyWorkView | undefined;
}) {
  const hasMenu = Boolean(onMenuToggle);

  return (
    <div
      className={cn(
        "relative min-h-[76px] rounded-[8px] border transition-colors duration-200",
        isActive
          ? "border-white bg-white text-slate-950 shadow-sm"
          : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white"
      )}
      data-daily-conversation-row={conversation.id}
    >
      <button
        type="button"
        data-daily-conversation-item={conversation.id}
        data-daily-view-nav={viewNavId}
        aria-current={viewNavId && isActive ? "page" : undefined}
        aria-pressed={isActive}
        onClick={onSelect}
        className="h-full min-h-[76px] w-full cursor-pointer px-3 py-2 pr-10 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300"
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              isActive ? "bg-teal-500" : conversation.pinned ? "bg-amber-300" : "bg-slate-500"
            )}
          />
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
          <span>{conversation.pinned ? "\u5df2\u7f6e\u9876" : conversation.status}</span>
          <span>{formatConversationTime(conversation.updatedAt)}</span>
        </div>
      </button>

      {hasMenu ? (
        <div className="absolute right-2 top-2">
          <button
            type="button"
            data-daily-conversation-menu={conversation.id}
            aria-label={conversation.title + " menu"}
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation();
              onMenuToggle?.();
            }}
            className={cn(
              "grid size-7 cursor-pointer place-items-center rounded-[6px] border border-transparent transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300",
              isActive
                ? "text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                : "text-slate-400 hover:border-white/10 hover:bg-white/10 hover:text-white"
            )}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 z-40 mt-1 w-32 overflow-hidden rounded-[8px] border border-slate-200 bg-white py-1 text-slate-800 shadow-xl">
              <ConversationMenuButton icon={<Pencil className="size-3.5" aria-hidden="true" />} label="\u6539\u540d" onClick={onRename} />
              <ConversationMenuButton icon={<Pin className="size-3.5" aria-hidden="true" />} label={conversation.pinned ? "\u53d6\u6d88\u7f6e\u9876" : "\u7f6e\u9876"} onClick={onPinToggle} />
              <ConversationMenuButton icon={<Archive className="size-3.5" aria-hidden="true" />} label="\u5f52\u6863" onClick={onArchive} />
              <ConversationMenuButton destructive icon={<Trash2 className="size-3.5" aria-hidden="true" />} label="\u5220\u9664" onClick={onDelete} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ConversationMenuButton({
  destructive = false,
  icon,
  label,
  onClick
}: {
  destructive?: boolean | undefined;
  icon: ReactNode;
  label: string;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-full cursor-pointer items-center gap-2 px-3 text-left text-xs font-medium transition-colors duration-200",
        destructive
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-100"
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
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
