"use client";

import { Code2, Sparkles } from "lucide-react";

import { StatusRow } from "../DailyWorkPrimitives";

interface ModeSnapshotPanelProps {
  approvalCount: number;
}

export function ModeSnapshotPanel({ approvalCount }: ModeSnapshotPanelProps) {
  return (
    <>
      <div className="rounded-[8px] border border-teal-100 bg-white p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
          <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
          模式快照
        </div>
        <div className="space-y-2 text-sm text-teal-700">
          <StatusRow label="当前模式" value="daily_work" />
          <StatusRow label="对话传输" value="流式传输" />
          <StatusRow label="上下文来源" value="会话级预览" />
          <StatusRow label="审批请求" value={`${approvalCount} 项`} />
        </div>
      </div>

      <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
          <Code2 className="size-4" aria-hidden="true" />
          编码模式兼容
        </div>
        <p className="text-xs leading-5">
          当前分支没有开放文件、命令行或 Git 工具；后续可在同一模式契约下扩展编码能力。
        </p>
      </div>
    </>
  );
}
