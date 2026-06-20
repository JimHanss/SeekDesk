"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AgentToolCallTraceItem, AgentTraceState } from "../types";

export type CodingWorkbenchSyncStatus = "idle" | "syncing" | "live" | "degraded";
export type CodingWorkspacePickerStatus = "idle" | "loading" | "ready" | "selecting" | "error";

export interface CodingWorkspaceStatus {
  service: string;
  workspaceRoot: string;
  workspaceSelectable?: boolean;
  runtimeMode: string;
  supportedCapabilities: string[];
  safetyBoundary: {
    readsUserFiles: boolean;
    writesUserFiles: boolean;
    executesShell: boolean;
    workspaceRootLocked: boolean;
    requiresApprovalForWritesAndCommands: boolean;
  };
}

export interface CodingWorkspaceDirectoryEntry {
  name: string;
  path: string;
  selectable: boolean;
}

export interface CodingWorkspaceBrowserState {
  status: CodingWorkspacePickerStatus;
  notice: string;
  currentPath: string;
  parentPath: string | null;
  homePath: string;
  manualPath: string;
  suggestedRoots: string[];
  entries: CodingWorkspaceDirectoryEntry[];
}

export interface CodingFileTreeEntry {
  path: string;
  type: "file" | "directory";
  size: number;
  depth: number;
}

export interface CodingReadFileState {
  path: string;
  size: number;
  content: string;
}

export interface CodingSearchMatch {
  path: string;
  line: number;
  text: string;
}

export interface CodingSearchState {
  query: string;
  path: string;
  includeGlob: string;
  matches: CodingSearchMatch[];
  truncated: boolean;
}

export interface CodingGitState {
  statusText: string;
  diffText: string;
  statusCommand: string;
  diffCommand: string;
  statusExitCode: number | null;
  diffExitCode: number | null;
}

export interface CodingWorkbenchState {
  syncStatus: CodingWorkbenchSyncStatus;
  notice: string;
  workspace: CodingWorkspaceStatus | null;
  workspaceBrowser: CodingWorkspaceBrowserState;
  treeEntries: CodingFileTreeEntry[];
  treeTruncated: boolean;
  selectedFile: CodingReadFileState | null;
  search: CodingSearchState;
  git: CodingGitState;
  terminalToolCalls: AgentToolCallTraceItem[];
  pendingWriteOrCommandToolCalls: AgentToolCallTraceItem[];
}

const initialSearch: CodingSearchState = {
  query: "",
  path: ".",
  includeGlob: "",
  matches: [],
  truncated: false
};

const initialGit: CodingGitState = {
  statusText: "",
  diffText: "",
  statusCommand: "git status --short --branch",
  diffCommand: "git diff",
  statusExitCode: null,
  diffExitCode: null
};

const initialWorkspaceBrowser: CodingWorkspaceBrowserState = {
  status: "idle",
  notice: "点击浏览来选择本机工作区。",
  currentPath: "",
  parentPath: null,
  homePath: "",
  manualPath: "",
  suggestedRoots: [],
  entries: []
};

export function useCodingWorkbench(apiBaseUrl: string, agentTrace: AgentTraceState) {
  const [syncStatus, setSyncStatus] = useState<CodingWorkbenchSyncStatus>("idle");
  const [notice, setNotice] = useState("Coding runtime is ready to sync.");
  const [workspace, setWorkspace] = useState<CodingWorkspaceStatus | null>(null);
  const [workspaceBrowser, setWorkspaceBrowser] = useState<CodingWorkspaceBrowserState>(initialWorkspaceBrowser);
  const [treeEntries, setTreeEntries] = useState<CodingFileTreeEntry[]>([]);
  const [treeTruncated, setTreeTruncated] = useState(false);
  const [selectedFile, setSelectedFile] = useState<CodingReadFileState | null>(null);
  const [search, setSearch] = useState<CodingSearchState>(initialSearch);
  const [git, setGit] = useState<CodingGitState>(initialGit);

  const fetchJson = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(apiBaseUrl + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = await response.json();
        message = formatApiError(payload, message);
      } catch {
        message = await response.text();
      }
      throw new Error(message || "HTTP " + response.status);
    }

    return response.json() as Promise<T>;
  }, [apiBaseUrl]);

  const refreshWorkspace = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const payload = await fetchJson<CodingWorkspaceStatus>("/api/coding/workspace");
      setWorkspace(payload);
      setWorkspaceBrowser((current) => ({
        ...current,
        manualPath: current.manualPath || payload.workspaceRoot
      }));
      setSyncStatus("live");
      setNotice("Coding runtime connected.");
    } catch (error) {
      setSyncStatus("degraded");
      setNotice("Coding runtime unavailable: " + formatUnknownError(error));
    }
  }, [fetchJson]);

  const refreshFileTree = useCallback(async (path = ".") => {
    setSyncStatus("syncing");
    try {
      const payload = await fetchJson<{
        entries?: CodingFileTreeEntry[];
        truncated?: boolean;
      }>("/api/coding/files/tree", {
        method: "POST",
        body: JSON.stringify({ path, maxDepth: 3, maxEntries: 240 })
      });
      setTreeEntries(Array.isArray(payload.entries) ? payload.entries : []);
      setTreeTruncated(Boolean(payload.truncated));
      setSyncStatus("live");
      setNotice("File tree loaded.");
    } catch (error) {
      setSyncStatus("degraded");
      setNotice("File tree failed: " + formatUnknownError(error));
    }
  }, [fetchJson]);

  const readFile = useCallback(async (path: string) => {
    setSyncStatus("syncing");
    try {
      const payload = await fetchJson<CodingReadFileState>("/api/coding/files/read", {
        method: "POST",
        body: JSON.stringify({ path, maxBytes: 240000 })
      });
      setSelectedFile(payload);
      setSyncStatus("live");
      setNotice("Opened " + payload.path + ".");
    } catch (error) {
      setSyncStatus("degraded");
      setNotice("Read failed: " + formatUnknownError(error));
    }
  }, [fetchJson]);

  const updateSearchDraft = useCallback((patch: Partial<Pick<CodingSearchState, "query" | "path" | "includeGlob">>) => {
    setSearch((current) => ({ ...current, ...patch }));
  }, []);

  const runSearch = useCallback(async () => {
    const query = search.query.trim();
    if (!query) {
      setNotice("Enter a search keyword first.");
      return;
    }

    setSyncStatus("syncing");
    try {
      const payload = await fetchJson<{
        matches?: CodingSearchMatch[];
        truncated?: boolean;
      }>("/api/coding/search", {
        method: "POST",
        body: JSON.stringify({
          query,
          path: search.path.trim() || ".",
          ...(search.includeGlob.trim() ? { includeGlob: search.includeGlob.trim() } : {}),
          maxResults: 80
        })
      });
      setSearch((current) => ({
        ...current,
        matches: Array.isArray(payload.matches) ? payload.matches : [],
        truncated: Boolean(payload.truncated)
      }));
      setSyncStatus("live");
      setNotice("Search completed.");
    } catch (error) {
      setSyncStatus("degraded");
      setNotice("Search failed: " + formatUnknownError(error));
    }
  }, [fetchJson, search.includeGlob, search.path, search.query]);

  const refreshGit = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const [statusPayload, diffPayload] = await Promise.all([
        fetchJson<{ command?: string; stdout?: string; stderr?: string; exitCode?: number }>("/api/coding/git/status"),
        fetchJson<{ command?: string; stdout?: string; stderr?: string; exitCode?: number }>("/api/coding/git/diff", {
          method: "POST",
          body: JSON.stringify({ staged: false })
        })
      ]);
      setGit({
        statusText: [statusPayload.stdout, statusPayload.stderr].filter(Boolean).join("\n").trim(),
        diffText: [diffPayload.stdout, diffPayload.stderr].filter(Boolean).join("\n").trim(),
        statusCommand: statusPayload.command ?? "git status --short --branch",
        diffCommand: diffPayload.command ?? "git diff",
        statusExitCode: typeof statusPayload.exitCode === "number" ? statusPayload.exitCode : null,
        diffExitCode: typeof diffPayload.exitCode === "number" ? diffPayload.exitCode : null
      });
      setSyncStatus("live");
      setNotice("Git status and diff loaded.");
    } catch (error) {
      setSyncStatus("degraded");
      setNotice("Git refresh failed: " + formatUnknownError(error));
    }
  }, [fetchJson]);

  const browseWorkspace = useCallback(async (path?: string) => {
    setWorkspaceBrowser((current) => ({
      ...current,
      status: "loading",
      notice: "正在读取本机文件夹...",
      ...(path ? { manualPath: path } : {})
    }));
    try {
      const payload = await fetchJson<{
        currentPath: string;
        parentPath: string | null;
        homePath: string;
        suggestedRoots?: string[];
        entries?: CodingWorkspaceDirectoryEntry[];
      }>("/api/coding/workspace/browse", {
        method: "POST",
        body: JSON.stringify(path ? { path } : {})
      });
      setWorkspaceBrowser({
        status: "ready",
        notice: "选择一个文件夹作为当前工作区。",
        currentPath: payload.currentPath,
        parentPath: payload.parentPath,
        homePath: payload.homePath,
        manualPath: payload.currentPath,
        suggestedRoots: Array.isArray(payload.suggestedRoots) ? payload.suggestedRoots : [],
        entries: Array.isArray(payload.entries) ? payload.entries : []
      });
    } catch (error) {
      setWorkspaceBrowser((current) => ({
        ...current,
        status: "error",
        notice: "读取文件夹失败：" + formatUnknownError(error)
      }));
    }
  }, [fetchJson]);

  const updateWorkspacePathDraft = useCallback((path: string) => {
    setWorkspaceBrowser((current) => ({ ...current, manualPath: path }));
  }, []);

  const selectWorkspace = useCallback(async (path: string) => {
    setWorkspaceBrowser((current) => ({
      ...current,
      status: "selecting",
      notice: "正在切换工作区...",
      manualPath: path
    }));
    try {
      const payload = await fetchJson<{ workspace: CodingWorkspaceStatus }>("/api/coding/workspace/select", {
        method: "POST",
        body: JSON.stringify({ path })
      });
      setWorkspace(payload.workspace);
      setSelectedFile(null);
      setSearch(initialSearch);
      setWorkspaceBrowser((current) => ({
        ...current,
        status: "ready",
        notice: "已切换到 " + payload.workspace.workspaceRoot,
        currentPath: payload.workspace.workspaceRoot,
        manualPath: payload.workspace.workspaceRoot
      }));
      setNotice("Workspace switched to " + payload.workspace.workspaceRoot + ".");
      await Promise.all([refreshFileTree(), refreshGit()]);
    } catch (error) {
      setWorkspaceBrowser((current) => ({
        ...current,
        status: "error",
        notice: "切换工作区失败：" + formatUnknownError(error)
      }));
    }
  }, [fetchJson, refreshFileTree, refreshGit]);

  useEffect(() => {
    void refreshWorkspace();
    void refreshFileTree();
    void refreshGit();
  }, [refreshFileTree, refreshGit, refreshWorkspace]);

  const terminalToolCalls = useMemo(
    () => agentTrace.toolCalls.filter((tool) => tool.name === "coding.run_shell" || tool.name === "coding.run_tests"),
    [agentTrace.toolCalls]
  );

  const pendingWriteOrCommandToolCalls = useMemo(
    () => agentTrace.toolCalls.filter(
      (tool) =>
        ["coding.write_file", "coding.edit_file", "coding.run_shell", "coding.run_tests"].includes(tool.name) &&
        ["requested", "permission_required", "running"].includes(tool.status)
    ),
    [agentTrace.toolCalls]
  );

  return {
    state: {
      syncStatus,
      notice,
      workspace,
      workspaceBrowser,
      treeEntries,
      treeTruncated,
      selectedFile,
      search,
      git,
      terminalToolCalls,
      pendingWriteOrCommandToolCalls
    } satisfies CodingWorkbenchState,
    actions: {
      refreshWorkspace,
      refreshFileTree,
      readFile,
      updateSearchDraft,
      runSearch,
      refreshGit,
      browseWorkspace,
      updateWorkspacePathDraft,
      selectWorkspace
    }
  };
}

function formatApiError(payload: unknown, fallback: string) {
  if (typeof payload !== "object" || payload === null) {
    return fallback;
  }
  const record = payload as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : null;
  const error = typeof record.error === "string" ? record.error : null;
  return [error, message].filter(Boolean).join(": ") || fallback;
}

function formatUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
