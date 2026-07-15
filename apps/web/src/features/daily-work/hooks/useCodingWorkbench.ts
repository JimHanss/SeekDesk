"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CloudWorkspaceCreateRequest,
  CodingWorkspaceDetail,
  CodingWorkspaceSummary,
  RepositoryCredentialMetadata,
  RuntimeLifecycleStatus,
  RuntimeMode,
  UserSelectableRuntimeMode
} from "@seekdesk/shared";

import type { AgentToolCallTraceItem, AgentTraceState } from "../types";
import { runtimeErrorMessage, workspaceStatusMessage } from "../domain/workspace-runtime";

export { isWorkspaceReady, workspaceStatusMessage } from "../domain/workspace-runtime";

export type CodingWorkbenchSyncStatus = "idle" | "syncing" | "live" | "degraded";
export type CodingWorkspacePickerStatus = "idle" | "loading" | "ready" | "selecting" | "error";
export type CloudWorkspaceAction = "create" | "start" | "stop" | "retry" | "delete";

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

export interface CodingRuntimeErrorState {
  code: string;
  message: string;
}

export interface CodingWorkbenchState {
  syncStatus: CodingWorkbenchSyncStatus;
  notice: string;
  runtimeError: CodingRuntimeErrorState | null;
  activeWorkspaceId: string;
  preferredRuntimeMode: UserSelectableRuntimeMode;
  workspaces: CodingWorkspaceSummary[];
  workspace: CodingWorkspaceDetail | null;
  workspaceBrowser: CodingWorkspaceBrowserState;
  repositoryCredentials: RepositoryCredentialMetadata[];
  cloudBusyWorkspaceId: string | null;
  cloudBusyAction: CloudWorkspaceAction | null;
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
  notice: "选择一个已连接的本机 daemon，再打开系统文件夹选择器。",
  currentPath: "",
  parentPath: null,
  homePath: "",
  manualPath: "",
  suggestedRoots: [],
  entries: []
};

const transitionalCloudStatuses = new Set<RuntimeLifecycleStatus>([
  "provisioning",
  "cloning",
  "starting",
  "stopping",
  "retrying",
  "deleting"
]);

const readyStatuses = new Set<RuntimeLifecycleStatus>(["ready"]);
const runtimePreferenceKey = "seekdesk.preferredRuntimeMode";

export function useCodingWorkbench(
  apiBaseUrl: string,
  agentTrace: AgentTraceState,
  activeWorkspaceId: string,
  onActiveWorkspaceChange: (workspaceId: string) => void
) {
  const [syncStatus, setSyncStatus] = useState<CodingWorkbenchSyncStatus>("idle");
  const [notice, setNotice] = useState("选择工作区后即可读取文件、搜索代码和查看 Git Diff。");
  const [runtimeError, setRuntimeError] = useState<CodingRuntimeErrorState | null>(null);
  const [preferredRuntimeMode, setPreferredRuntimeMode] = useState<UserSelectableRuntimeMode>("local_daemon");
  const [workspaces, setWorkspaces] = useState<CodingWorkspaceSummary[]>([]);
  const [workspace, setWorkspace] = useState<CodingWorkspaceDetail | null>(null);
  const [workspaceBrowser, setWorkspaceBrowser] = useState<CodingWorkspaceBrowserState>(initialWorkspaceBrowser);
  const [repositoryCredentials, setRepositoryCredentials] = useState<RepositoryCredentialMetadata[]>([]);
  const [cloudBusyWorkspaceId, setCloudBusyWorkspaceId] = useState<string | null>(null);
  const [cloudBusyAction, setCloudBusyAction] = useState<CloudWorkspaceAction | null>(null);
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
      const payload = await readErrorPayload(response);
      throw new CodingApiError(
        payload.code,
        payload.message || `请求失败（HTTP ${response.status}）`,
        response.status
      );
    }
    return response.json() as Promise<T>;
  }, [apiBaseUrl]);

  const setSingleError = useCallback((error: unknown, fallback: string) => {
    const normalized = normalizeRuntimeError(error, fallback);
    setRuntimeError(normalized);
    setNotice(normalized.message);
    setSyncStatus("degraded");
    return normalized;
  }, []);

  const clearRuntimeError = useCallback(() => setRuntimeError(null), []);

  const requireWorkspace = useCallback(() => {
    if (!activeWorkspaceId) {
      throw new CodingApiError("workspace_not_selected", "请先新建对话并选择工作区。", 400);
    }
    return activeWorkspaceId;
  }, [activeWorkspaceId]);

  const withWorkspace = useCallback((body: Record<string, unknown> = {}) => {
    const workspaceId = requireWorkspace();
    const selected = workspaces.find((item) => item.workspaceId === workspaceId);
    return {
      ...body,
      workspaceId,
      ...(selected?.runtimeMode ? { runtimeMode: selected.runtimeMode } : {})
    };
  }, [requireWorkspace, workspaces]);

  const mergeWorkspace = useCallback((next: CodingWorkspaceSummary) => {
    if (next.status === "deleted") {
      setWorkspaces((current) => current.filter(
        (item) => item.workspaceId !== next.workspaceId
      ));
      return;
    }
    setWorkspaces((current) => [
      next,
      ...current.filter((item) => item.workspaceId !== next.workspaceId)
    ]);
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const payload = await fetchJson<{ workspaces?: CodingWorkspaceSummary[] }>("/api/coding/workspaces");
      const next = Array.isArray(payload.workspaces) ? payload.workspaces : [];
      setWorkspaces(next);
      setRuntimeError(null);
      return next;
    } catch (error) {
      setSingleError(error, "无法加载工作区列表。");
      return [];
    }
  }, [fetchJson, setSingleError]);

  const refreshRepositoryCredentials = useCallback(async () => {
    try {
      const payload = await fetchJson<{ credentials?: RepositoryCredentialMetadata[] }>(
        "/api/coding/repository-credentials"
      );
      const credentials = Array.isArray(payload.credentials)
        ? payload.credentials.filter((item) => !item.revokedAt)
        : [];
      setRepositoryCredentials(credentials);
      return credentials;
    } catch {
      setRepositoryCredentials([]);
      return [];
    }
  }, [fetchJson]);

  const refreshWorkspace = useCallback(async (
    workspaceId = activeWorkspaceId,
    signal?: AbortSignal
  ) => {
    if (!workspaceId) {
      setWorkspace(null);
      return null;
    }
    try {
      const detail = await fetchJson<CodingWorkspaceDetail>(
        "/api/coding/workspaces/" + encodeURIComponent(workspaceId),
        signal ? { signal } : undefined
      );
      if (detail.status === "deleted") {
        mergeWorkspace(detail);
        if (activeWorkspaceId === workspaceId) {
          onActiveWorkspaceChange("");
          setWorkspace(null);
        }
        setNotice("云端工作区已删除。");
        return detail;
      }
      setWorkspace(detail);
      mergeWorkspace(detail);
      setSyncStatus(detail.status === "error" || detail.status === "offline" ? "degraded" : "live");
      if (detail.error) {
        setSingleError(
          new CodingApiError(detail.error.code, detail.error.message, 409),
          "Runtime 状态异常。"
        );
      } else {
        setRuntimeError(null);
        setNotice(workspaceStatusMessage(detail));
      }
      return detail;
    } catch (error) {
      if (isAbortError(error)) {
        return null;
      }
      if (error instanceof CodingApiError && error.status === 404) {
        setWorkspaces((current) => current.filter((item) => item.workspaceId !== workspaceId));
        if (activeWorkspaceId === workspaceId) {
          onActiveWorkspaceChange("");
          setWorkspace(null);
        }
        return null;
      }
      setWorkspaces((current) => current.map((item) =>
        item.workspaceId === workspaceId && transitionalCloudStatuses.has(item.status)
          ? { ...item, status: "error", connected: false, updatedAt: new Date().toISOString() }
          : item
      ));
      setSingleError(error, "无法读取 Runtime 状态。");
      return null;
    }
  }, [activeWorkspaceId, fetchJson, mergeWorkspace, onActiveWorkspaceChange, setSingleError]);

  const refreshFileTree = useCallback(async (path = ".") => {
    setSyncStatus("syncing");
    try {
      const payload = await fetchJson<{ entries?: CodingFileTreeEntry[]; truncated?: boolean }>(
        "/api/coding/files/tree",
        { method: "POST", body: JSON.stringify(withWorkspace({ path, maxDepth: 3, maxEntries: 240 })) }
      );
      setTreeEntries(Array.isArray(payload.entries) ? payload.entries : []);
      setTreeTruncated(Boolean(payload.truncated));
      setSyncStatus("live");
      setRuntimeError(null);
      setNotice("文件树已更新。");
    } catch (error) {
      setSingleError(error, "无法读取文件树。");
    }
  }, [fetchJson, setSingleError, withWorkspace]);

  const readFile = useCallback(async (path: string) => {
    setSyncStatus("syncing");
    try {
      const payload = await fetchJson<CodingReadFileState>("/api/coding/files/read", {
        method: "POST",
        body: JSON.stringify(withWorkspace({ path, maxBytes: 240_000 }))
      });
      setSelectedFile(payload);
      setSyncStatus("live");
      setRuntimeError(null);
      setNotice(`已打开 ${payload.path}。`);
    } catch (error) {
      setSingleError(error, "无法读取文件。");
    }
  }, [fetchJson, setSingleError, withWorkspace]);

  const updateSearchDraft = useCallback((patch: Partial<Pick<CodingSearchState, "query" | "path" | "includeGlob">>) => {
    setSearch((current) => ({ ...current, ...patch }));
  }, []);

  const runSearch = useCallback(async () => {
    const query = search.query.trim();
    if (!query) {
      setNotice("请先输入搜索关键词。");
      return;
    }
    setSyncStatus("syncing");
    try {
      const payload = await fetchJson<{ matches?: CodingSearchMatch[]; truncated?: boolean }>(
        "/api/coding/search",
        {
          method: "POST",
          body: JSON.stringify(withWorkspace({
            query,
            path: search.path.trim() || ".",
            ...(search.includeGlob.trim() ? { includeGlob: search.includeGlob.trim() } : {}),
            maxResults: 80
          }))
        }
      );
      setSearch((current) => ({
        ...current,
        matches: Array.isArray(payload.matches) ? payload.matches : [],
        truncated: Boolean(payload.truncated)
      }));
      setSyncStatus("live");
      setRuntimeError(null);
      setNotice("搜索完成。");
    } catch (error) {
      setSingleError(error, "搜索失败。");
    }
  }, [fetchJson, search.includeGlob, search.path, search.query, setSingleError, withWorkspace]);

  const refreshGit = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const body = withWorkspace({ staged: false });
      const selectedWorkspaceId = String(body.workspaceId);
      const runtimeMode = body.runtimeMode as RuntimeMode | undefined;
      const query = new URLSearchParams({ workspaceId: selectedWorkspaceId });
      if (runtimeMode) {
        query.set("runtimeMode", runtimeMode);
      }
      const [statusPayload, diffPayload] = await Promise.all([
        fetchJson<{ command?: string; stdout?: string; stderr?: string; exitCode?: number }>(
          "/api/coding/git/status?" + query.toString()
        ),
        fetchJson<{ command?: string; stdout?: string; stderr?: string; exitCode?: number }>(
          "/api/coding/git/diff",
          { method: "POST", body: JSON.stringify(body) }
        )
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
      setRuntimeError(null);
      setNotice("Git 状态与 Diff 已更新。");
    } catch (error) {
      setSingleError(error, "无法读取 Git 状态。");
    }
  }, [fetchJson, setSingleError, withWorkspace]);

  const browseWorkspace = useCallback(async (path?: string, workspaceId = activeWorkspaceId) => {
    setWorkspaceBrowser((current) => ({
      ...current,
      status: "loading",
      notice: "正在读取本机目录...",
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
        notice: "选择一个目录作为工作区。",
        currentPath: payload.currentPath,
        parentPath: payload.parentPath,
        homePath: payload.homePath,
        manualPath: payload.currentPath,
        suggestedRoots: Array.isArray(payload.suggestedRoots) ? payload.suggestedRoots : [],
        entries: Array.isArray(payload.entries) ? payload.entries : []
      });
    } catch (error) {
      const normalized = normalizeRuntimeError(error, "无法读取本机目录。");
      setWorkspaceBrowser((current) => ({ ...current, status: "error", notice: normalized.message }));
    }
  }, [activeWorkspaceId, fetchJson]);

  const updateWorkspacePathDraft = useCallback((path: string) => {
    setWorkspaceBrowser((current) => ({ ...current, manualPath: path }));
  }, []);

  const applyWorkspaceSelection = useCallback((selected: CodingWorkspaceSummary | undefined) => {
    if (!selected) {
      return null;
    }
    onActiveWorkspaceChange(selected.workspaceId);
    mergeWorkspace(selected);
    setWorkspace(selected);
    setWorkspaceBrowser((current) => ({
      ...current,
      status: "ready",
      notice: `已选择 ${selected.rootPath}`,
      currentPath: selected.rootPath,
      manualPath: selected.rootPath
    }));
    setRuntimeError(null);
    return selected;
  }, [mergeWorkspace, onActiveWorkspaceChange]);

  const selectWorkspace = useCallback(async (path: string, workspaceId = activeWorkspaceId) => {
    setWorkspaceBrowser((current) => ({
      ...current,
      status: "selecting",
      notice: "正在绑定工作区...",
      manualPath: path
    }));
    try {
      const payload = await fetchJson<{ workspace?: CodingWorkspaceSummary }>(
        "/api/coding/workspace/select",
        {
          method: "POST",
          body: JSON.stringify({ path, ...(workspaceId ? { workspaceId } : {}) })
        }
      );
      const selected = applyWorkspaceSelection(payload.workspace);
      if (selected) {
        rememberRuntimeMode("local_daemon");
        setSelectedFile(null);
        setSearch(initialSearch);
        await refreshWorkspaces();
      }
      return selected;
    } catch (error) {
      const normalized = normalizeRuntimeError(error, "无法切换工作区。");
      setWorkspaceBrowser((current) => ({ ...current, status: "error", notice: normalized.message }));
      return null;
    }
  }, [activeWorkspaceId, applyWorkspaceSelection, fetchJson, refreshWorkspaces]);

  const pickWorkspace = useCallback(async (workspaceId = activeWorkspaceId) => {
    setWorkspaceBrowser((current) => ({
      ...current,
      status: "selecting",
      notice: "正在打开系统文件夹选择器..."
    }));
    try {
      const payload = await fetchJson<{ workspace?: CodingWorkspaceSummary }>(
        "/api/coding/workspace/pick",
        { method: "POST", body: JSON.stringify(workspaceId ? { workspaceId } : {}) }
      );
      const selected = applyWorkspaceSelection(payload.workspace);
      if (selected) {
        rememberRuntimeMode("local_daemon");
        await refreshWorkspaces();
      }
      return selected;
    } catch (error) {
      const normalized = normalizeRuntimeError(error, "无法打开系统文件夹选择器。");
      setWorkspaceBrowser((current) => ({ ...current, status: "error", notice: normalized.message }));
      return null;
    }
  }, [activeWorkspaceId, applyWorkspaceSelection, fetchJson, refreshWorkspaces]);

  const createCloudWorkspace = useCallback(async (
    draft: Omit<CloudWorkspaceCreateRequest, "idempotencyKey">
  ) => {
    setCloudBusyAction("create");
    setCloudBusyWorkspaceId(null);
    clearRuntimeError();
    try {
      const payload = await fetchJson<{ workspace: CodingWorkspaceSummary }>(
        "/api/coding/workspaces/cloud",
        {
          method: "POST",
          body: JSON.stringify({
            ...draft,
            idempotencyKey: createIdempotencyKey("provision")
          })
        }
      );
      mergeWorkspace(payload.workspace);
      onActiveWorkspaceChange(payload.workspace.workspaceId);
      rememberRuntimeMode("cloud_runtime");
      setNotice("云端工作区已提交，正在克隆仓库。");
      return payload.workspace;
    } catch (error) {
      setSingleError(error, "无法创建云端工作区。");
      return null;
    } finally {
      setCloudBusyAction(null);
      setCloudBusyWorkspaceId(null);
    }
  }, [clearRuntimeError, fetchJson, mergeWorkspace, onActiveWorkspaceChange, setSingleError]);

  const runCloudLifecycle = useCallback(async (
    workspaceId: string,
    action: Exclude<CloudWorkspaceAction, "create">
  ) => {
    setCloudBusyWorkspaceId(workspaceId);
    setCloudBusyAction(action);
    clearRuntimeError();
    try {
      const path = "/api/coding/workspaces/" + encodeURIComponent(workspaceId) + (
        action === "delete" ? "" : "/" + action
      );
      const payload = await fetchJson<{ workspace: CodingWorkspaceSummary }>(path, {
        method: action === "delete" ? "DELETE" : "POST",
        body: JSON.stringify({ idempotencyKey: createIdempotencyKey(action) })
      });
      mergeWorkspace(payload.workspace);
      setNotice(cloudActionMessage(action));
      return payload.workspace;
    } catch (error) {
      setSingleError(error, `云端工作区${cloudActionLabel(action)}失败。`);
      return null;
    } finally {
      setCloudBusyWorkspaceId(null);
      setCloudBusyAction(null);
    }
  }, [clearRuntimeError, fetchJson, mergeWorkspace, setSingleError]);

  const setActiveWorkspace = useCallback((workspaceId: string) => {
    const selected = workspaces.find((item) => item.workspaceId === workspaceId);
    onActiveWorkspaceChange(workspaceId);
    setWorkspace(selected ?? null);
    setSelectedFile(null);
    setSearch(initialSearch);
    setGit(initialGit);
    setRuntimeError(null);
  }, [onActiveWorkspaceChange, workspaces]);

  const rememberRuntimeMode = useCallback((mode: UserSelectableRuntimeMode) => {
    setPreferredRuntimeMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(runtimePreferenceKey, mode);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(runtimePreferenceKey);
      if (stored === "local_daemon" || stored === "cloud_runtime") {
        setPreferredRuntimeMode(stored);
      }
    }
    void refreshWorkspaces();
    void refreshRepositoryCredentials();
  }, [refreshRepositoryCredentials, refreshWorkspaces]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setWorkspace(null);
      setTreeEntries([]);
      setGit(initialGit);
      return;
    }
    const controller = new AbortController();
    void refreshWorkspace(activeWorkspaceId, controller.signal);
    return () => controller.abort();
  }, [activeWorkspaceId, refreshWorkspace]);

  useEffect(() => {
    const selected = workspaces.find((item) => item.workspaceId === activeWorkspaceId);
    if (!selected || !readyStatuses.has(selected.status)) {
      return;
    }
    void refreshFileTree();
    void refreshGit();
  }, [activeWorkspaceId, refreshFileTree, refreshGit, workspaces]);

  useEffect(() => {
    const pending = workspaces.filter(
      (item) => item.runtimeMode === "cloud_runtime" && transitionalCloudStatuses.has(item.status)
    );
    if (pending.length === 0) {
      return;
    }
    const controller = new AbortController();
    const poll = () => {
      for (const item of pending) {
        void refreshWorkspace(item.workspaceId, controller.signal);
      }
    };
    const timer = window.setInterval(poll, 2_000);
    poll();
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [refreshWorkspace, workspaces]);

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
      runtimeError,
      activeWorkspaceId,
      preferredRuntimeMode,
      workspaces,
      workspace,
      workspaceBrowser,
      repositoryCredentials,
      cloudBusyWorkspaceId,
      cloudBusyAction,
      treeEntries,
      treeTruncated,
      selectedFile,
      search,
      git,
      terminalToolCalls,
      pendingWriteOrCommandToolCalls
    } satisfies CodingWorkbenchState,
    actions: {
      clearRuntimeError,
      refreshWorkspaces,
      refreshRepositoryCredentials,
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
      createCloudWorkspace,
      runCloudLifecycle,
      setActiveWorkspace,
      rememberRuntimeMode
    }
  };
}

export type CodingWorkbenchController = ReturnType<typeof useCodingWorkbench>;

class CodingApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "CodingApiError";
  }
}

async function readErrorPayload(response: Response) {
  try {
    const payload = await response.json() as Record<string, unknown>;
    return {
      code: typeof payload.error === "string" ? payload.error : "request_failed",
      message: typeof payload.message === "string" ? payload.message : ""
    };
  } catch {
    return {
      code: "request_failed",
      message: await response.text()
    };
  }
}

export function normalizeRuntimeError(error: unknown, fallback: string): CodingRuntimeErrorState {
  const code = error instanceof CodingApiError ? error.code : "request_failed";
  const raw = error instanceof Error ? error.message : String(error);
  return { code, message: runtimeErrorMessage(code, raw, fallback) };
}

function createIdempotencyKey(action: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `web-${action}-${random}`;
}

function cloudActionLabel(action: Exclude<CloudWorkspaceAction, "create">) {
  return { start: "启动", stop: "停止", retry: "重试", delete: "删除" }[action];
}

function cloudActionMessage(action: Exclude<CloudWorkspaceAction, "create">) {
  return `云端工作区${cloudActionLabel(action)}请求已提交。`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
