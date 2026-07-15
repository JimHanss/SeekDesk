"use client";

import type { ReactNode } from "react";
import { ArrowUp, CheckCircle2, FileCode2, Folder, FolderOpen, GitCompare, HardDrive, Home, Play, RefreshCw, Search, ShieldCheck, Terminal } from "lucide-react";
import type { RuntimeMode } from "@seekdesk/shared";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CodingWorkbenchState } from "../../hooks/useCodingWorkbench";
import type { AgentToolCallTraceItem } from "../../types";

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
  onApproveAndApplyToolCall: (toolCall: AgentToolCallTraceItem) => void;
  onRefreshGit: () => void;
}

interface CodingWorkspacePanelProps extends CodingPanelProps {
  onBrowseWorkspace: (path?: string) => void;
  onSelectWorkspace: (path: string) => void;
  onUpdateWorkspacePath: (path: string) => void;
}

export function CodingWorkspacePanel({
  state,
  onBrowseWorkspace,
  onSelectWorkspace,
  onUpdateWorkspacePath
}: CodingWorkspacePanelProps) {
  const browser = state.workspaceBrowser;
  const isBusy = browser.status === "loading" || browser.status === "selecting";

  return (
    <CodingPanelFrame
      title="工作区"
      description="选择本机文件夹作为当前编程 Agent 的 workspace root。所有文件、搜索、Diff 和命令都会锁定在这个目录内。"
      icon={<FolderOpen className="size-4" aria-hidden="true" />}
      status={state.syncStatus}
      notice={state.notice}
      action={
        <PanelButton
          onClick={() => onBrowseWorkspace(browser.currentPath || state.workspace?.rootPath)}
          label="浏览"
          icon={<RefreshCw className="size-4" aria-hidden="true" />}
        />
      }
      dataAttr="workspace"
      workspace={state.workspace}
    >
      <div className="grid gap-3" data-coding-workspace-panel>
        <div className="rounded-[8px] border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <HardDrive className="size-4 text-teal-700" aria-hidden="true" />
            当前工作区
          </div>
          <div className="mt-2 break-all rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700" data-coding-workspace-root>
            {state.workspace?.rootPath ?? "尚未连接 Runtime"}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              value={browser.manualPath ?? ""}
              onChange={(event) => onUpdateWorkspacePath(event.target.value)}
              className="h-9 min-w-0 rounded-[6px] border border-slate-200 px-3 font-mono text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="输入本机路径，例如 /Users/name/project/app"
              data-coding-workspace-path-input
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isBusy || !browser.manualPath.trim()}
              onClick={() => onBrowseWorkspace(browser.manualPath.trim())}
            >
              <FolderOpen className="size-4" aria-hidden="true" />
              打开
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isBusy || !browser.manualPath.trim()}
              onClick={() => onSelectWorkspace(browser.manualPath.trim())}
              data-coding-workspace-select-current
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              选择
            </Button>
          </div>
          <div className={cn(
            "mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5",
            browser.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-teal-100 bg-teal-50 text-teal-800"
          )}>
            {browser.notice}
          </div>
        </div>

        {browser.suggestedRoots.length > 0 ? (
          <div className="rounded-[8px] border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold text-slate-700">建议位置</div>
            <div className="flex flex-wrap gap-2">
              {browser.suggestedRoots.map((rootPath) => (
                <button
                  key={rootPath}
                  type="button"
                  className="inline-flex max-w-full items-center gap-2 rounded-[999px] border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition-colors duration-200 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                  onClick={() => onBrowseWorkspace(rootPath)}
                >
                  <Home className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate font-mono">{rootPath}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white" data-coding-workspace-browser={browser.entries.length}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span className="min-w-0 break-all font-mono">{browser.currentPath || "点击浏览读取目录"}</span>
            {browser.parentPath ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onBrowseWorkspace(browser.parentPath ?? undefined)}>
                <ArrowUp className="size-4" aria-hidden="true" />
                上级
              </Button>
            ) : null}
          </div>
          <div className="max-h-[52vh] overflow-y-auto p-2">
            {browser.entries.map((entry) => (
              <div
                key={entry.path}
                className="mb-1 flex min-h-10 items-center gap-2 rounded-[8px] border border-transparent px-2 py-1.5 text-xs hover:border-teal-200 hover:bg-teal-50"
                data-coding-workspace-directory={entry.path}
              >
                <Folder className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer truncate text-left font-medium text-slate-800"
                  onClick={() => onBrowseWorkspace(entry.path)}
                >
                  {entry.name}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isBusy}
                  onClick={() => onSelectWorkspace(entry.path)}
                >
                  选择
                </Button>
              </div>
            ))}
            {browser.entries.length === 0 ? (
              <EmptyState text="当前目录没有可浏览的子文件夹，或还没有读取目录。" />
            ) : null}
          </div>
        </div>
      </div>
    </CodingPanelFrame>
  );
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
      workspace={state.workspace}
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
      workspace={state.workspace}
    >
      <div className="grid gap-3" data-coding-search-panel>
        <div className="grid gap-2 rounded-[8px] border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
          <Field label="关键词">
            <input
              data-coding-search-input
              value={state.search.query ?? ""}
              onChange={(event) => onUpdateSearch({ query: event.target.value })}
              className="h-9 w-full rounded-[6px] border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="例如 coding_agent"
            />
          </Field>
          <Field label="路径">
            <input
              value={state.search.path ?? ""}
              onChange={(event) => onUpdateSearch({ path: event.target.value })}
              className="h-9 w-full rounded-[6px] border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="."
            />
          </Field>
          <Field label="Glob">
            <input
              value={state.search.includeGlob ?? ""}
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

export function CodingDiffPanel({
  state,
  onApproveAndApplyToolCall,
  onRefreshGit
}: CodingDiffPanelProps) {
  const fileChangePlans = state.pendingWriteOrCommandToolCalls.filter(
    (toolCall) =>
      toolCall.name === "coding.write_file" || toolCall.name === "coding.edit_file"
  );

  return (
    <CodingPanelFrame
      title="Diff"
      description="查看当前仓库状态、未暂存 diff，并审查 Agent 生成的文件修改计划。"
      icon={<GitCompare className="size-4" aria-hidden="true" />}
      status={state.syncStatus}
      notice={state.notice}
      action={<PanelButton onClick={onRefreshGit} label="刷新" icon={<RefreshCw className="size-4" aria-hidden="true" />} />}
      dataAttr="diff"
      workspace={state.workspace}
    >
      <div className="grid gap-3" data-coding-diff-panel>
        <div className="rounded-[8px] border border-slate-200 bg-white" data-coding-diff-approval-count={fileChangePlans.length}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="size-4 text-orange-600" aria-hidden="true" />
              文件修改审批
            </div>
            <span className="rounded-[999px] bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-800">
              {fileChangePlans.length} 个计划
            </span>
          </div>
          <div className="grid gap-2 p-3">
            {fileChangePlans.map((toolCall) => (
              <FileChangePlanCard
                key={toolCall.id}
                toolCall={toolCall}
                runtimeMode={state.workspace?.runtimeMode}
                onApproveAndApply={() => onApproveAndApplyToolCall(toolCall)}
              />
            ))}
            {fileChangePlans.length === 0 ? (
              <EmptyState text="暂无待应用的文件修改计划。让 Agent 生成写入或编辑工具计划后，会在这里审查和应用。" />
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <CommandOutput title="Git status" command={state.git.statusCommand} output={state.git.statusText || "工作区无 status 输出。"} exitCode={state.git.statusExitCode} />
        <CommandOutput title="Git diff" command={state.git.diffCommand} output={state.git.diffText || "当前没有未暂存 diff。"} exitCode={state.git.diffExitCode} large />
        </div>
      </div>
    </CodingPanelFrame>
  );
}

function FileChangePlanCard({
  onApproveAndApply,
  runtimeMode,
  toolCall
}: {
  onApproveAndApply: () => void;
  runtimeMode: RuntimeMode | undefined;
  toolCall: AgentToolCallTraceItem;
}) {
  const input = asRecord(toolCall.inputJson);
  const output = asRecord(toolCall.outputJson);
  const targetPath =
    stringValue(input?.path) ||
    stringValue(input?.filePath) ||
    stringValue(output?.writtenPath) ||
    stringValue(output?.editedPath) ||
    "未指定文件";
  const nextContent = stringValue(input?.content);
  const patch = stringValue(input?.patch);
  const canApply =
    toolCall.status === "requested" ||
    toolCall.status === "permission_required" ||
    toolCall.status === "failed";

  return (
    <article
      className="rounded-[8px] border border-orange-200 bg-orange-50/60 p-3"
      data-coding-diff-approval-tool={toolCall.id}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[999px] bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700">
              {toolCall.name}
            </span>
            <span className={cn("rounded-[999px] px-2 py-0.5 text-[11px] font-medium", toolStatusClass(toolCall.status))}>
              {toolCall.status}
            </span>
          </div>
          <div className="mt-2 break-all font-mono text-xs font-semibold text-slate-900">
            {targetPath}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            审查目标文件和输入内容；批准后由{runtimeMode === "cloud_runtime" ? "云端 Runtime" : "本机 daemon"}在当前工作区内执行。
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!canApply}
          onClick={onApproveAndApply}
          data-coding-diff-approve-apply={toolCall.id}
        >
          <Play className="size-4" aria-hidden="true" />
          批准并应用
        </Button>
      </div>

      <pre className="mt-3 max-h-56 overflow-auto rounded-[8px] bg-slate-950 p-3 text-xs leading-5 text-slate-100">
        <code>
          {nextContent ||
            patch ||
            JSON.stringify(toolCall.inputJson, null, 2)}
        </code>
      </pre>
      {toolCall.outputJson || toolCall.error ? (
        <div className="mt-3 rounded-[8px] border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
          {toolCall.error ? toolCall.error : JSON.stringify(toolCall.outputJson, null, 2)}
        </div>
      ) : null}
    </article>
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
      workspace={state.workspace}
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
          const cwd = stringValue(output?.cwd);
          const requestId = stringValue(output?.requestId);
          const exitCode = typeof output?.exitCode === "number" ? output.exitCode : null;
          const timeout = numberValue(output?.timeoutMs) ?? numberValue(output?.timeout);
          const timedOut = output?.timedOut === true;
          const truncated = output?.truncated === true;
          const terminalOutput = [
            stdout ? "$ stdout\n" + stdout : "",
            stderr ? "$ stderr\n" + stderr : ""
          ].filter(Boolean).join("\n\n");

          return (
            <CommandOutput
              key={toolCall.id}
              title={toolCall.name + " / " + toolCall.status}
              command={command || "命令尚未执行"}
              output={terminalOutput || toolCall.error || "暂无输出"}
              exitCode={exitCode}
              cwd={cwd}
              requestId={requestId}
              timeout={timeout}
              timedOut={timedOut}
              truncated={truncated}
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
  title,
  workspace
}: {
  action?: ReactNode;
  children: ReactNode;
  dataAttr: string;
  description: string;
  icon: ReactNode;
  notice: string;
  status: string;
  title: string;
  workspace: CodingWorkbenchState["workspace"];
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
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">{workspace?.name ?? "未选择工作区"}</span>
              {workspace ? (
                <>
                  <span>{workspace.runtimeMode === "cloud_runtime" ? "云端 Runtime" : workspace.runtimeMode === "local_daemon" ? "本机 daemon" : "开发 Runtime"}</span>
                  <span>{workspace.status}</span>
                  <span className="max-w-[38rem] truncate font-mono">{workspace.rootPath}</span>
                </>
              ) : null}
            </div>
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

function CommandOutput({ command, cwd, exitCode, large = false, output, requestId, timedOut = false, timeout, title, truncated = false }: { command: string; cwd?: string; exitCode: number | null; large?: boolean; output: string; requestId?: string; timedOut?: boolean; timeout?: number | null; title: string; truncated?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 text-xs">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">{title}</div>
          <div className="mt-0.5 truncate font-mono text-slate-500">{command}</div>
        </div>
        <span className={cn("shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium", exitCode === null ? "bg-slate-100 text-slate-600" : exitCode === 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>exit {exitCode ?? "-"}</span>
      </div>
      {cwd || requestId || timeout !== undefined || timedOut || truncated ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
          {cwd ? <span>cwd: {cwd}</span> : null}
          {timeout !== undefined && timeout !== null ? <span>timeout: {timeout}ms</span> : null}
          {timedOut ? <span className="text-rose-700">timed out</span> : null}
          {truncated ? <span className="text-amber-700">output truncated</span> : null}
          {requestId ? <span className="min-w-0 truncate">request: {requestId}</span> : null}
        </div>
      ) : null}
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

function toolStatusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "requested":
    case "running":
      return "bg-sky-100 text-sky-800";
    case "permission_required":
      return "bg-orange-100 text-orange-800";
    case "failed":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
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

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function summarizeInputCommand(value: unknown) {
  const input = asRecord(value);
  return stringValue(input?.command);
}
