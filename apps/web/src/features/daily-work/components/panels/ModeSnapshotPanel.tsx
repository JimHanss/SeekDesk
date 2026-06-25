"use client";

import { Code2, Sparkles } from "lucide-react";

import { StatusRow } from "../DailyWorkPrimitives";

interface ModeSnapshotPanelProps {
  pendingToolCount: number;
  runtimeMode?: string | null | undefined;
  workspaceName?: string | null | undefined;
}

export function ModeSnapshotPanel({
  pendingToolCount,
  runtimeMode,
  workspaceName
}: ModeSnapshotPanelProps) {
  return (
    <>
      <div className="rounded-[8px] border border-teal-100 bg-white p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
          <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
          模式快照
        </div>
        <div className="space-y-2 text-sm text-teal-700">
          <StatusRow label="当前模式" value="coding_agent" />
          <StatusRow label="对话传输" value="流式传输" />
          <StatusRow label="当前工作区" value={workspaceName ?? "未绑定"} />
          <StatusRow label="Runtime" value={runtimeMode ?? "未连接"} />
          <StatusRow label="待授权工具" value={`${pendingToolCount} 项`} />
        </div>
      </div>

      <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
          <Code2 className="size-4" aria-hidden="true" />
          工具执行边界
        </div>
        <p className="text-xs leading-5">
          文件读取、搜索和 Git 查看可直接执行；写文件、编辑文件、Shell 和测试运行会先进入待授权状态，批准后才交给当前 workspace runtime。
        </p>
      </div>
    </>
  );
}
