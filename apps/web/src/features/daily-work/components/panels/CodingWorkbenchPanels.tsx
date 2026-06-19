"use client";

import type { ReactNode } from "react";
import { FileCode2, Folder, GitCompare, RefreshCw, Search, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CodingWorkbenchState } from "../../hooks/useCodingWorkbench";

interface CodingPanelProps {
  state: CodingWorkbenchState;
}

interface CodingFilesPanelProps extends CodingPanelProps {
  onOpenFile: (path: string) => void;
  onRefreshTree: () => void;
}

interface CodingSearchPanelProps extends CodingPanelProps {
  onOpenFile: (path: string) => void;
  onRunSearch: () => void;
  onUpdateSearch: (patch: Partial<Pick<CodingWorkbenchState["search"], "query" | "path" | "includeGlob">>) => void;
}

interface CodingDiffPanelProps extends CodingPanelProps {
  onRefreshGit: () => void;
}

export function CodingFilesPanel({ state, onOpenFile, onRefreshTree }: CodingFilesPanelProps) {
  const directories = state.treeEntries.filter((entry) => entry.type === "directory").length;
  const files = state.treeEntries.filter((entry) => entry.type === "file").length;

  return (
    <CodingPanelFrame
      title="文件"
      description="读取当前 workspace 内的目录和文本文件。"
      icon={<FileCode2 className="size-4" aria-hidden="true" />}
      status={state.syncStatus}
      notice={state.notice}
      action={<PanelButton onClick={onRefreshTree} label="刷新" icon={<RefreshCw className="size-4" aria-hidden="true" />} />}
      dataAttr="files"
    >
      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" data-coding-files-panel>
        <div className="min-h-0 overflow-hidden rounded-[8px] border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span>{directories} 个目录 / {files} 个文件</span>
            <span>{state.treeTruncated ? "已截断" : "完整"}</span>
          </div>
          <div className="max-h-[62vh] overflow-y-auto p-2">
            {state.treeEntries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                disabled={entry.type !== "file"}
                onClick={() => onOpenFile(entry.path)}
                data-coding-file-row={entry.path}
                className={cn(
                  "flex min-h-8 w-full items-center gap-2 rounded-[6px] border border-transparent px-2 py-1.5 text-left text-xs transition-colors duration-200",
                  entry.type === "file"
                    ? "cursor-pointer text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900"
                    : "cursor-default text-slate-500"
                )}
                style={{ paddingLeft: `${8 + entry.depth * 12}px` }}
              >
                {entry.type === "directory" ? <Folder className="size-3.5 shrink-0" aria-hidden="true" /> : <FileCode2 className="size-3.5 shrink-0" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate">{entry.path}</span>
                {entry.type === "file" ? <span className="shrink-0 text-slate-400">{formatBytes(entry.size)}</span> : null}
              </button>
            ))}
            {state.treeEntries.length === 0 ? <EmptyState text="暂无文件树数据，点击刷新重新读取 workspace。" /> : null}
          </div>
        </div>

        <FilePreview selectedFile={state.selectedFile} />
      </div>
    </CodingPanelFrame>
  );
}

export function CodingSearchPanel({ state, onOpenFile, onRunSearch, onUpdateSearch }: CodingSearchPanelProps) {
  return (
    <CodingPanelFrame
      title="搜索"
      description="在 workspace 内搜索文本，并从结果直接打开文件。"
      icon={<Search className="size-4" aria-hidden="true" />}
      status={state.syncStatus}
      notice={state.notice}
      action={<PanelButton onClick={onRunSearch} label="搜索" icon={<Search className="size-4" aria-hidden="true" />} />}
      dataAttr="search"
    >
      <div className="grid gap-3" data-coding-search-panel>
        <div className="grid gap-2 rounded-[8px] border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
          <Field label="关键词">
            <input
              data-coding-search-input
              value={state.search.query}
              onChange={(event) => onUpdateSearch({ query: event.target.value })}
              className="h-9 w-full rounded-[6px] border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="例如 coding_agent"
            />
          </Field>
          <Field label="路径">
            <input
              value={state.search.path}
              onChange={(event) => onUpdateSearch({ path: event.target.value })}
              className="h-9 w-full rounded-[6px] border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="."
            />
          </Field>
          <Field label="Glob">
            <input
              value={state.search.includeGlob}
              onChange={(event) => onUpdateSearch({ includeGlob: event.target.value })}
              className="h-9 w-full rounded-[6px] border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="*.ts"
            />
          </Field>
        </div>

        <div className="rounded-[8px] border border-slate-200 bg-white" data-coding-search-results={state.search.matches.length}>
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span>{state.search.matches.length} 条结果</span>
            <span>{state.search.truncated ? "结果已截断" : "结果完整"}</span>
          </div>
          <div className="max-h-[62vh] overflow-y-auto p-2">
            {state.search.matches.map((match) => (
              <button
                key={`${match.path}:${match.line}:${match.text}`}
                type="button"
                data-coding-search-result={match.path}
                onClick={() => onOpenFile(match.path)}
                className="mb-2 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-left text-xs transition-colors duration-200 hover:border-teal-300 hover:bg-teal-50"
              >
                <div className="font-mono font-semibold text-teal-800">{match.path}:{match.line}</div>
                <div className="mt-1 line-clamp-2 text-slate-700">{match.text}</div>
              </button>
            ))}
            {state.search.matches.length === 0 ? <EmptyState text="输入关键词后点击搜索。" /> : null}
          </div>
        </div>
      </div>
    </CodingPanelFrame>
  );
}

export function CodingDiffPanel({ state, onRefreshGit }: CodingDiffPanelProps) {
  return (
    <CodingPanelFrame
      title="Diff"
      description="查看当前仓库状态和未暂存 diff；不执行 git 写操作。"
      icon={<GitCompare className="size-4" aria-hidden="true" />}
      status={state.syncStatus}
      notice={state.notice}
      action={<PanelButton onClick={onRefreshGit} label="刷新" icon={<RefreshCw className="size-4" aria-hidden="true" />} />}
      dataAttr="diff"
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" data-coding-diff-panel>
        <CommandOutput title="Git status" command={state.git.statusCommand} output={state.git.statusText || "工作区无 status 输出。"} exitCode={state.git.statusExitCode} />
        <CommandOutput title="Git diff" command={state.git.diffCommand} output={state.git.diffText || "当前没有未暂存 diff。"} exitCode={state.git.diffExitCode} large />
      </div>
    </CodingPanelFrame>
  );
}

export function CodingTerminalPanel({ state }: CodingPanelProps) {
  return (
    <CodingPanelFrame
      title="终端"
      description="展示已授权 shell/test 工具的输出。命令执行仍由运行详情审批触发。"
      icon={<Terminal className="size-4" aria-hidden="true" />}
      status={state.syncStatus}
      notice={state.notice}
      dataAttr="terminal"
    >
      <div className="grid gap-3" data-coding-terminal-panel data-coding-terminal-count={state.terminalToolCalls.length}>
        {state.pendingWriteOrCommandToolCalls.length > 0 ? (
          <div className="rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
            {state.pendingWriteOrCommandToolCalls.length} 个工具计划等待授权或执行，请在运行详情中处理。
          </div>
        ) : null}

        {state.terminalToolCalls.map((toolCall) => {
          const output = asRecord(toolCall.outputJson);
          const stdout = stringValue(output?.stdout);
          const stderr = stringValue(output?.stderr);
          const command = stringValue(output?.command) || summarizeInputCommand(toolCall.inputJson);
          const exitCode = typeof output?.exitCode === "number" ? output.exitCode : null;

          return (
            <CommandOutput
              key={toolCall.id}
              title={toolCall.name + " / " + toolCall.status}
              command={command || "命令尚未执行"}
              output={[stdout, stderr].filter(Boolean).join("\n") || toolCall.error || "暂无输出"}
              exitCode={exitCode}
              large
            />
          );
        })}

        {state.terminalToolCalls.length === 0 ? (
          <div className="rounded-[8px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
            暂无终端输出。让 Agent 生成 `coding.run_shell` 或 `coding.run_tests` 工具计划后，在运行详情中批准执行。
          </div>
        ) : null}
      </div>
    </CodingPanelFrame>
  );
}

function CodingPanelFrame({
  action,
  children,
  dataAttr,
  description,
  icon,
  notice,
  status,
  title
}: {
  action?: ReactNode;
  children: ReactNode;
  dataAttr: string;
  description: string;
  icon: ReactNode;
  notice: string;
  status: string;
  title: string;
}) {
  return (
    <section className="flex min-h-full flex-col gap-3" data-coding-panel={dataAttr}>
      <div className="rounded-[8px] border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <span className="grid size-8 place-items-center rounded-[8px] bg-teal-50 text-teal-700">{icon}</span>
              <span>{title}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn("rounded-[999px] px-2.5 py-1 text-[11px] font-medium", status === "live" ? "bg-emerald-100 text-emerald-800" : status === "syncing" ? "bg-sky-100 text-sky-800" : status === "degraded" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700")}>{statusLabel(status)}</span>
            {action}
          </div>
        </div>
        <div className="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">{notice}</div>
      </div>
      {children}
    </section>
  );
}

function FilePreview({ selectedFile }: { selectedFile: CodingWorkbenchState["selectedFile"] }) {
  return (
    <div className="min-h-0 overflow-hidden rounded-[8px] border border-slate-200 bg-white" data-coding-file-content={selectedFile?.path ?? "none"}>
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
        <span className="min-w-0 truncate font-mono">{selectedFile?.path ?? "未选择文件"}</span>
        <span>{selectedFile ? formatBytes(selectedFile.size) : ""}</span>
      </div>
      <pre className="max-h-[62vh] overflow-auto p-3 text-xs leading-5 text-slate-800"><code>{selectedFile?.content ?? "从左侧文件树或搜索结果中选择一个文本文件。"}</code></pre>
    </div>
  );
}

function CommandOutput({ command, exitCode, large = false, output, title }: { command: string; exitCode: number | null; large?: boolean; output: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 text-xs">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">{title}</div>
          <div className="mt-0.5 truncate font-mono text-slate-500">{command}</div>
        </div>
        <span className={cn("shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium", exitCode === null ? "bg-slate-100 text-slate-600" : exitCode === 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>exit {exitCode ?? "-"}</span>
      </div>
      <pre className={cn("overflow-auto bg-slate-950 p-3 text-xs leading-5 text-slate-100", large ? "max-h-[62vh]" : "max-h-80")}><code>{output}</code></pre>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      {children}
    </label>
  );
}

function PanelButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="secondary" onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[8px] border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">{text}</div>;
}

function statusLabel(status: string) {
  switch (status) {
    case "syncing":
      return "同步中";
    case "live":
      return "已连接";
    case "degraded":
      return "异常";
    default:
      return "待同步";
  }
}

function formatBytes(value: number) {
  if (value < 1024) {
    return value + " B";
  }
  if (value < 1024 * 1024) {
    return (value / 1024).toFixed(1) + " KB";
  }
  return (value / 1024 / 1024).toFixed(1) + " MB";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function summarizeInputCommand(value: unknown) {
  const input = asRecord(value);
  return stringValue(input?.command);
}
