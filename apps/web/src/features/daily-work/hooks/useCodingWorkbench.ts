"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AgentToolCallTraceItem, AgentTraceState } from "../types";

export type CodingWorkbenchSyncStatus = "idle" | "syncing" | "live" | "degraded";

export interface CodingWorkspaceStatus {
  service: string;
  workspaceRoot: string;
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

export function useCodingWorkbench(apiBaseUrl: string, agentTrace: AgentTraceState) {
  const [syncStatus, setSyncStatus] = useState<CodingWorkbenchSyncStatus>("idle");
  const [notice, setNotice] = useState("Coding runtime is ready to sync.");
  const [workspace, setWorkspace] = useState<CodingWorkspaceStatus | null>(null);
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
      refreshGit
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
