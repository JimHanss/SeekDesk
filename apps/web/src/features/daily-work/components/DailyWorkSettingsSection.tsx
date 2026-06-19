"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { DailyWorkView, DailyWorkViewConfig } from "./DailyWorkDashboardShell";
import { DailyWorkModuleStack } from "./DailyWorkModuleStack";

interface DailyWorkSettingsSectionProps {
  activeView: DailyWorkView;
  children: ReactNode;
  settingsViews: DailyWorkViewConfig[];
  onViewChange: (view: DailyWorkView) => void;
}

export function DailyWorkSettingsSection({
  activeView,
  children,
  settingsViews,
  onViewChange
}: DailyWorkSettingsSectionProps) {
  return (
    <DailyWorkModuleStack>
      <section className="flex flex-col gap-4">
        <div
          className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3"
          aria-label="设置分区"
        >
          {settingsViews.map((view) => {
            const isActive = activeView === view.id;

            return (
              <button
                key={view.id}
                type="button"
                data-daily-settings-section={view.id}
                aria-pressed={isActive}
                onClick={() => onViewChange(view.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500",
                  isActive
                    ? "border-teal-200 bg-teal-50 text-teal-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                )}
              >
                {view.icon}
                {view.label}
              </button>
            );
          })}
        </div>

        {children}
      </section>
    </DailyWorkModuleStack>
  );
}