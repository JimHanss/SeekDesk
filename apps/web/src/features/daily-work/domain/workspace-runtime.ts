import type {
  CodingWorkspaceSummary,
  RuntimeLifecycleStatus,
  RuntimeMode
} from "@seekdesk/shared";

export interface CloudWorkspaceDraftInput {
  name: string;
  repositoryUrl: string;
  branch: string;
}

export interface WorkspaceConversationSortRecord {
  createdAt: string;
  sourceIndex: number;
  item: {
    id: string;
    pinned?: boolean;
  };
}

export function isWorkspaceReady(
  workspace: CodingWorkspaceSummary | null | undefined
): workspace is CodingWorkspaceSummary {
  return Boolean(
    workspace && workspace.status === "ready" && workspace.connected
  );
}

export function createWorkspaceSessionBinding(
  workspace: CodingWorkspaceSummary | null | undefined
) {
  if (!isWorkspaceReady(workspace)) {
    return null;
  }
  return {
    workspaceId: workspace.workspaceId,
    runtimeMode: workspace.runtimeMode
  };
}

export function workspaceStatusMessage(workspace: CodingWorkspaceSummary) {
  const labels: Record<RuntimeLifecycleStatus, string> = {
    provisioning: "正在准备云端工作区...",
    cloning: "正在克隆 Git 仓库...",
    ready: "Runtime 已就绪。",
    busy: "Runtime 正在执行任务。",
    stopping: "正在停止 Runtime...",
    stopped: "Runtime 已停止，可重新启动。",
    starting: "正在启动 Runtime...",
    retrying: "正在重试 Runtime...",
    deleting: "正在删除云端工作区...",
    deleted: "云端工作区已删除。",
    offline: "本机 daemon 已离线。",
    error: "Runtime 出现错误，请查看状态后重试。"
  };
  return labels[workspace.status];
}

export function runtimeModeLabel(mode: RuntimeMode) {
  if (mode === "cloud_runtime") {
    return "云端 Runtime";
  }
  if (mode === "local_daemon") {
    return "本机 daemon";
  }
  return "开发 Runtime";
}

export function validateCloudWorkspaceDraft(draft: CloudWorkspaceDraftInput) {
  if (!draft.name.trim()) {
    return "请输入云端工作区名称。";
  }
  if (!isHttpsGitRepositoryUrl(draft.repositoryUrl)) {
    return "请输入有效的 HTTPS Git 仓库地址。";
  }
  if (!draft.branch.trim()) {
    return "请输入 Git 分支。";
  }
  return null;
}

export function isHttpsGitRepositoryUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function compareWorkspaceConversations<
  T extends WorkspaceConversationSortRecord
>(left: T, right: T) {
  const pinnedOrder = Number(Boolean(right.item.pinned)) - Number(Boolean(left.item.pinned));
  if (pinnedOrder !== 0) {
    return pinnedOrder;
  }

  const leftCreatedAt = Date.parse(left.createdAt);
  const rightCreatedAt = Date.parse(right.createdAt);
  if (!Number.isNaN(leftCreatedAt) && !Number.isNaN(rightCreatedAt)) {
    const createdAtOrder = rightCreatedAt - leftCreatedAt;
    if (createdAtOrder !== 0) {
      return createdAtOrder;
    }
  } else if (!Number.isNaN(leftCreatedAt)) {
    return -1;
  } else if (!Number.isNaN(rightCreatedAt)) {
    return 1;
  }

  const sourceOrder = left.sourceIndex - right.sourceIndex;
  return sourceOrder !== 0 ? sourceOrder : left.item.id.localeCompare(right.item.id);
}

export function runtimeErrorMessage(
  code: string,
  rawMessage: string,
  fallback: string
) {
  const known: Record<string, string> = {
    workspace_not_selected: "请先选择工作区。",
    workspace_not_found: "工作区不存在或已被删除。",
    runtime_unavailable: "Runtime 当前离线，请检查 daemon 或云端服务。",
    runtime_not_ready: "Runtime 尚未就绪，请等待状态更新后重试。",
    session_workspace_mismatch: "当前会话与工作区不匹配，请重新打开对应会话。",
    permission_required: "此操作需要当前会话授权。",
    repository_clone_failed: "仓库克隆失败，请检查地址、分支和凭据。",
    repository_credentials_invalid: "仓库凭据不可用，请选择有效凭据。",
    runtime_request_conflict: "该操作正在执行或已经完成，请刷新运行详情。"
  };
  return known[code] ?? (rawMessage || fallback);
}
