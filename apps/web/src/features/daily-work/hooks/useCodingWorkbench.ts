"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AgentToolCallTraceItem, AgentTraceState } from "../types";

export type CodingWorkbenchSyncStatus = "idle" | "syncing" | "live" | "degraded";
export type CodingWorkspacePickerStatus = "idle" | "loading" | "ready" | "selecting" | "error";

export interface CodingWorkspaceStatus {
  status: "ok";
  service: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceRoot: string;
  workspaceSelectable?: boolean;
  runtimeMode: "local_runtime" | "local_daemon" | "server_local";
  supportedCapabilities: string[];
  safetyBoundary: {
    readsUserFiles: boolean;
    writesUserFiles: boolean;
    executesShell: boolean;
    workspaceRootLocked: boolean;
    requiresApprovalForWritesAndCommands: boolean;
  };
}

export interface CodingWorkspaceSummary {
  workspaceId: string;
  daemonId: string;
  name: string;
  rootPath: string;
  runtimeMode: "local_daemon" | "server_local";
  connected: boolean;
  platform?: string;
  machineName?: string;
  updatedAt: string;
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
  activeWorkspaceId: string;
  workspaces: CodingWorkspaceSummary[];
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
  notice: "新建对话时选择本机工作区。",
  currentPath: "",
  parentPath: null,
  homePath: "",
  manualPath: "",
  suggestedRoots: [],
  entries: []
};

export function useCodingWorkbench(
  apiBaseUrl: string,
  agentTrace: AgentTraceState,
  activeWorkspaceId: string,
  onActiveWorkspaceChange: (workspaceId: string) => void
) {
  const [syncStatus, setSyncStatus] = useState<CodingWorkbenchSyncStatus>("idle");
  const [notice, setNotice] = useState("Coding runtime is ready to sync.");
  const [workspaces, setWorkspaces] = useState<CodingWorkspaceSummary[]>([]);
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

  const withWorkspace = useCallback(
    (body: Record<string, unknown> = {}) => ({
      ...body,
      ...(activeWorkspaceId ? { workspaceId: activeWorkspaceId } : {})
    }),
    [activeWorkspaceId]
  );

  const refreshWorkspaces = useCallback(async () => {
    try {
      const payload = await fetchJson<{ workspaces?: CodingWorkspaceSummary[] }>("/api/coding/workspaces");
      const nextWorkspaces = Array.isArray(payload.workspaces) ? payload.workspaces : [];
      setWorkspaces(nextWorkspaces);
      if (!activeWorkspaceId && nextWorkspaces[0]) {
        onActiveWorkspaceChange(nextWorkspaces[0].workspaceId);
      }
      return nextWorkspaces;
    } catch (error) {
      setNotice("Workspace list failed: " + formatUnknownError(error));
      return [];
    }
  }, [activeWorkspaceId, fetchJson, onActiveWorkspaceChange]);

  const refreshWorkspace = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const suffix = activeWorkspaceId ? "?workspaceId=" + encodeURIComponent(activeWorkspaceId) : "";
      const payload = await fetchJson<CodingWorkspaceStatus>("/api/coding/workspace" + suffix);
      setWorkspace(payload);
      if (payload.workspaceId && payload.workspaceId !== activeWorkspaceId) {
        onActiveWorkspaceChange(payload.workspaceId);
      }
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
  }, [activeWorkspaceId, fetchJson, onActiveWorkspaceChange]);

  const refreshFileTree = useCallback(async (path = ".") => {
    setSyncStatus("syncing");
    try {
      const payload = await fetchJson<{ entries?: CodingFileTreeEntry[]; truncated?: boolean }>("/api/coding/files/tree", {
        method: "POST",
        body: JSON.stringify(withWorkspace({ path, maxDepth: 3, maxEntries: 240 }))
      });
      setTreeEntries(Array.isArray(payload.entries) ? payload.entries : []);
      setTreeTruncated(Boolean(payload.truncated));
      setSyncStatus("live");
      setNotice("File tree loaded.");
    } catch (error) {
      setSyncStatus("degraded");
      setNotice("File tree failed: " + formatUnknownError(error));
    }
  }, [fetchJson, withWorkspace]);

  const readFile = useCallback(async (path: string) => {
    setSyncStatus("syncing");
    try {
      const payload = await fetchJson<CodingReadFileState>("/api/coding/files/read", {
        method: "POST",
        body: JSON.stringify(withWorkspace({ path, maxBytes: 240000 }))
      });
      setSelectedFile(payload);
      setSyncStatus("live");
      setNotice("Opened " + payload.path + ".");
    } catch (error) {
      setSyncStatus("degraded");
      setNotice("Read failed: " + formatUnknownError(error));
    }
  }, [fetchJson, withWorkspace]);

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
      const payload = await fetchJson<{ matches?: CodingSearchMatch[]; truncated?: boolean }>("/api/coding/search", {
        method: "POST",
        body: JSON.stringify(withWorkspace({
          query,
          path: search.path.trim() || ".",
          ...(search.includeGlob.trim() ? { includeGlob: search.includeGlob.trim() } : {}),
          maxResults: 80
        }))
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
  }, [fetchJson, search.includeGlob, search.path, search.query, withWorkspace]);

  const refreshGit = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const query = activeWorkspaceId ? "?workspaceId=" + encodeURIComponent(activeWorkspaceId) : "";
      const [statusPayload, diffPayload] = await Promise.all([
        fetchJson<{ command?: string; stdout?: string; stderr?: string; exitCode?: number }>("/api/coding/git/status" + query),
        fetchJson<{ command?: string; stdout?: string; stderr?: string; exitCode?: number }>("/api/coding/git/diff", {
          method: "POST",
          body: JSON.stringify(withWorkspace({ staged: false }))
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
  }, [activeWorkspaceId, fetchJson, withWorkspace]);

  const browseWorkspace = useCallback(async (path?: string, workspaceId = activeWorkspaceId) => {
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
        body: JSON.stringify({ ...(path ? { path } : {}), ...(workspaceId ? { workspaceId } : {}) })
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
      setWorkspaceBrowser((current) => ({ ...current, status: "error", notice: "读取文件夹失败：" + formatUnknownError(error) }));
    }
  }, [activeWorkspaceId, fetchJson]);

  const updateWorkspacePathDraft = useCallback((path: string) => {
    setWorkspaceBrowser((current) => ({ ...current, manualPath: path }));
  }, []);

  const applyWorkspaceSelection = useCallback(async (payload: { workspace?: CodingWorkspaceSummary; status?: { workspaceRoot?: string } }) => {
    const selectedWorkspace = payload.workspace;
    if (selectedWorkspace) {
      onActiveWorkspaceChange(selectedWorkspace.workspaceId);
      setWorkspaces((current) => [selectedWorkspace, ...current.filter((item) => item.workspaceId !== selectedWorkspace.workspaceId)]);
      setWorkspace({
        status: "ok",
        service: selectedWorkspace.runtimeMode === "local_daemon" ? "seekdesk-daemon" : "seekdesk-coding-runtime",
        workspaceId: selectedWorkspace.workspaceId,
        workspaceName: selectedWorkspace.name,
        workspaceRoot: selectedWorkspace.rootPath,
        workspaceSelectable: true,
        runtimeMode: selectedWorkspace.runtimeMode,
        supportedCapabilities: [],
        safetyBoundary: {
          readsUserFiles: true,
          writesUserFiles: true,
          executesShell: true,
          workspaceRootLocked: true,
          requiresApprovalForWritesAndCommands: true
        }
      });
      setWorkspaceBrowser((current) => ({
        ...current,
        status: "ready",
        notice: "已切换到 " + selectedWorkspace.rootPath,
        currentPath: selectedWorkspace.rootPath,
        manualPath: selectedWorkspace.rootPath
      }));
      return selectedWorkspace;
    }

    await refreshWorkspace();
    return null;
  }, [onActiveWorkspaceChange, refreshWorkspace]);

  const selectWorkspace = useCallback(async (path: string, workspaceId = activeWorkspaceId) => {
    setWorkspaceBrowser((current) => ({ ...current, status: "selecting", notice: "正在切换工作区...", manualPath: path }));
    try {
      const payload = await fetchJson<{ workspace?: CodingWorkspaceSummary; status?: { workspaceRoot?: string } }>("/api/coding/workspace/select", {
        method: "POST",
        body: JSON.stringify({ path, ...(workspaceId ? { workspaceId } : {}) })
      });
      await applyWorkspaceSelection(payload);
      setSelectedFile(null);
      setSearch(initialSearch);
      setNotice("Workspace switched.");
      await Promise.all([refreshWorkspaces(), refreshFileTree(), refreshGit()]);
    } catch (error) {
      setWorkspaceBrowser((current) => ({ ...current, status: "error", notice: "切换工作区失败：" + formatUnknownError(error) }));
    }
  }, [activeWorkspaceId, applyWorkspaceSelection, fetchJson, refreshFileTree, refreshGit, refreshWorkspaces]);

  const pickWorkspace = useCallback(async (workspaceId = activeWorkspaceId) => {
    setWorkspaceBrowser((current) => ({ ...current, status: "selecting", notice: "正在打开本机文件夹选择器..." }));
    try {
      const payload = await fetchJson<{ workspace?: CodingWorkspaceSummary; status?: { workspaceRoot?: string } }>("/api/coding/workspace/pick", {
        method: "POST",
        body: JSON.stringify(workspaceId ? { workspaceId } : {})
      });
      await applyWorkspaceSelection(payload);
      await Promise.all([refreshWorkspaces(), refreshFileTree(), refreshGit()]);
    } catch (error) {
      setWorkspaceBrowser((current) => ({ ...current, status: "error", notice: "打开文件夹选择器失败：" + formatUnknownError(error) }));
    }
  }, [activeWorkspaceId, applyWorkspaceSelection, fetchJson, refreshFileTree, refreshGit, refreshWorkspaces]);

  const setActiveWorkspace = useCallback((workspaceId: string) => {
    onActiveWorkspaceChange(workspaceId);
    setSelectedFile(null);
    setSearch(initialSearch);
  }, [onActiveWorkspaceChange]);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

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
      activeWorkspaceId,
      workspaces,
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
      refreshWorkspaces,
      refreshWorkspace,
      refreshFileTree,
      readFile,
      updateSearchDraft,
      runSearch,
      refreshGit,
      browseWorkspace,
      updateWorkspacePathDraft,
      selectWorkspace,
      pickWorkspace,
      setActiveWorkspace
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
