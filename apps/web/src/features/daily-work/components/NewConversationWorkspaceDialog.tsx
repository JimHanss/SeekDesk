"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  KeyRound,
  Laptop,
  LoaderCircle,
  Play,
  RefreshCw,
  Square,
  Trash2,
  X
} from "lucide-react";

import type {
  CodingWorkspaceSummary,
  UserSelectableRuntimeMode
} from "@seekdesk/shared";

import {
  type CodingWorkbenchController
} from "../hooks/useCodingWorkbench";
import { useDaemonPairing } from "../hooks/useDaemonPairing";
import {
  createWorkspaceSessionBinding,
  isWorkspaceReady,
  validateCloudWorkspaceDraft,
  workspaceStatusMessage
} from "../domain/workspace-runtime";

interface NewConversationWorkspaceDialogProps {
  apiBaseUrl: string;
  controller: CodingWorkbenchController;
  open: boolean;
  onClose: () => void;
  onCreate: (workspace: CodingWorkspaceSummary) => Promise<void>;
}

interface CloudWorkspaceDraft {
  name: string;
  repositoryUrl: string;
  branch: string;
  imageProfile: "node22";
  credentialId: string;
}

const emptyCloudDraft: CloudWorkspaceDraft = {
  name: "",
  repositoryUrl: "",
  branch: "main",
  imageProfile: "node22",
  credentialId: ""
};

const windowsInstallerUrl = process.env.NEXT_PUBLIC_SEEKDESK_DAEMON_WINDOWS_URL ?? "";
const macosInstallerUrl = process.env.NEXT_PUBLIC_SEEKDESK_DAEMON_MACOS_URL ?? "";

export function NewConversationWorkspaceDialog({
  apiBaseUrl,
  controller,
  open,
  onClose,
  onCreate
}: NewConversationWorkspaceDialogProps) {
  const { state, actions } = controller;
  const refreshWorkspaces = actions.refreshWorkspaces;
  const setActiveWorkspace = actions.setActiveWorkspace;
  const [runtimeMode, setRuntimeMode] = useState<UserSelectableRuntimeMode>(
    state.preferredRuntimeMode
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [cloudDraft, setCloudDraft] = useState<CloudWorkspaceDraft>(emptyCloudDraft);
  const [formError, setFormError] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);

  const handleDaemonClaimed = useCallback(async (daemonId: string | undefined) => {
    const workspaces = await refreshWorkspaces();
    const pairedWorkspace = workspaces.find(
      (workspace) => workspace.runtimeMode === "local_daemon" && workspace.daemonId === daemonId
    );
    if (pairedWorkspace) {
      setSelectedWorkspaceId(pairedWorkspace.workspaceId);
      setActiveWorkspace(pairedWorkspace.workspaceId);
    }
  }, [refreshWorkspaces, setActiveWorkspace]);
  const daemonPairing = useDaemonPairing(
    apiBaseUrl,
    open && runtimeMode === "local_daemon",
    (status) => void handleDaemonClaimed(status.device?.daemonId)
  );
  const pairedDaemonWorkspace = state.workspaces.find(
    (workspace) =>
      workspace.runtimeMode === "local_daemon" &&
      workspace.daemonId === daemonPairing.state.device?.daemonId &&
      workspace.connected
  );

  const selectableWorkspaces = useMemo(
    () => state.workspaces.filter((workspace) => workspace.runtimeMode === runtimeMode),
    [runtimeMode, state.workspaces]
  );
  const selectedWorkspace = state.workspaces.find(
    (workspace) => workspace.workspaceId === selectedWorkspaceId
  );
  const selectedLocalWorkspace =
    selectedWorkspace?.runtimeMode === "local_daemon"
      ? selectedWorkspace
      : selectableWorkspaces[0];
  const canCreateConversation = Boolean(
    createWorkspaceSessionBinding(selectedWorkspace)
  ) && !creatingConversation;

  useEffect(() => {
    if (!open) {
      return;
    }
    const preferred = state.preferredRuntimeMode;
    setRuntimeMode(preferred);
    const active = state.workspaces.find(
      (workspace) =>
        workspace.workspaceId === state.activeWorkspaceId &&
        workspace.runtimeMode === preferred
    );
    const firstReady = state.workspaces.find(
      (workspace) => workspace.runtimeMode === preferred && isWorkspaceReady(workspace)
    );
    setSelectedWorkspaceId(active?.workspaceId ?? firstReady?.workspaceId ?? "");
    setFormError("");
  }, [open, state.activeWorkspaceId, state.preferredRuntimeMode, state.workspaces]);

  useEffect(() => {
    const daemonId = daemonPairing.state.device?.daemonId;
    if (
      !open ||
      runtimeMode !== "local_daemon" ||
      daemonPairing.state.status !== "claimed" ||
      !daemonId ||
      pairedDaemonWorkspace
    ) {
      return;
    }
    const refresh = async () => {
      const workspaces = await refreshWorkspaces();
      const next = workspaces.find(
        (workspace) =>
          workspace.runtimeMode === "local_daemon" &&
          workspace.daemonId === daemonId &&
          workspace.connected
      );
      if (next) {
        setSelectedWorkspaceId(next.workspaceId);
        setActiveWorkspace(next.workspaceId);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => window.clearInterval(timer);
  }, [daemonPairing.state.device?.daemonId, daemonPairing.state.status, open, pairedDaemonWorkspace, refreshWorkspaces, runtimeMode, setActiveWorkspace]);

  if (!open) {
    return null;
  }

  function selectRuntime(nextMode: UserSelectableRuntimeMode) {
    setRuntimeMode(nextMode);
    const next = state.workspaces.find(
      (workspace) => workspace.runtimeMode === nextMode && isWorkspaceReady(workspace)
    );
    setSelectedWorkspaceId(next?.workspaceId ?? "");
    setFormError("");
  }

  function selectWorkspace(workspace: CodingWorkspaceSummary) {
    setSelectedWorkspaceId(workspace.workspaceId);
    actions.setActiveWorkspace(workspace.workspaceId);
    setFormError("");
  }

  async function pickLocalFolder() {
    const workspace = await actions.pickWorkspace(selectedLocalWorkspace?.workspaceId);
    if (workspace) {
      setSelectedWorkspaceId(workspace.workspaceId);
    }
  }

  async function bindManualLocalFolder() {
    const path = state.workspaceBrowser.manualPath.trim();
    if (!path) {
      setFormError("请输入要绑定的本机目录路径。");
      return;
    }
    const workspace = await actions.selectWorkspace(path, selectedLocalWorkspace?.workspaceId);
    if (workspace) {
      setSelectedWorkspaceId(workspace.workspaceId);
      setFormError("");
    }
  }

  async function createCloudWorkspace() {
    const validationError = validateCloudWorkspaceDraft(cloudDraft);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const workspace = await actions.createCloudWorkspace({
      name: cloudDraft.name.trim(),
      repositoryUrl: cloudDraft.repositoryUrl.trim(),
      branch: cloudDraft.branch.trim(),
      imageProfile: cloudDraft.imageProfile,
      ...(cloudDraft.credentialId ? { credentialId: cloudDraft.credentialId } : {})
    });
    if (workspace) {
      setSelectedWorkspaceId(workspace.workspaceId);
      setCloudDraft(emptyCloudDraft);
      setFormError("");
    }
  }

  async function createConversation() {
    if (!selectedWorkspace) {
      setFormError("请选择一个工作区。");
      return;
    }
    if (!isWorkspaceReady(selectedWorkspace)) {
      setFormError(workspaceStatusMessage(selectedWorkspace));
      return;
    }
    setCreatingConversation(true);
    setFormError("");
    try {
      actions.rememberRuntimeMode(
        selectedWorkspace.runtimeMode === "cloud_runtime" ? "cloud_runtime" : "local_daemon"
      );
      await onCreate(selectedWorkspace);
    } finally {
      setCreatingConversation(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
        className="flex max-h-[min(880px,calc(100vh-32px))] w-full max-w-4xl flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="new-conversation-title" className="text-base font-semibold text-slate-950">
              新建对话
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              选择本机项目，或从 Git 仓库创建隔离的云端工作区。
            </p>
          </div>
          <button
            type="button"
            title="关闭"
            aria-label="关闭"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-[6px] border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="shrink-0 border-b border-slate-200 px-5 py-3">
          <div className="grid h-10 grid-cols-2 rounded-[7px] bg-slate-100 p-1" role="tablist">
            <RuntimeModeButton
              active={runtimeMode === "local_daemon"}
              icon={<Laptop className="size-4" aria-hidden="true" />}
              label="本机项目"
              onClick={() => selectRuntime("local_daemon")}
            />
            <RuntimeModeButton
              active={runtimeMode === "cloud_runtime"}
              icon={<Cloud className="size-4" aria-hidden="true" />}
              label="云端工作区"
              onClick={() => selectRuntime("cloud_runtime")}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {runtimeMode === "local_daemon" ? (
            <LocalRuntimeContent
              controller={controller}
              pairing={daemonPairing}
              selectedWorkspaceId={selectedWorkspaceId}
              onBindManual={() => void bindManualLocalFolder()}
              onPick={() => void pickLocalFolder()}
              onSelect={selectWorkspace}
            />
          ) : (
            <CloudRuntimeContent
              controller={controller}
              draft={cloudDraft}
              selectedWorkspaceId={selectedWorkspaceId}
              onCreate={() => void createCloudWorkspace()}
              onDraftChange={setCloudDraft}
              onSelect={selectWorkspace}
            />
          )}
        </div>

        <footer className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <div className="min-w-0 text-sm text-rose-700" role="status">
            {formError || state.runtimeError?.message || ""}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 min-w-20 rounded-[6px] border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              data-coding-dialog-create
              disabled={!canCreateConversation}
              onClick={() => void createConversation()}
              className="h-9 min-w-28 rounded-[6px] border border-orange-500 bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
            >
              {creatingConversation ? "正在创建..." : "创建对话"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function LocalRuntimeContent({
  controller,
  pairing,
  selectedWorkspaceId,
  onBindManual,
  onPick,
  onSelect
}: {
  controller: CodingWorkbenchController;
  pairing: ReturnType<typeof useDaemonPairing>;
  selectedWorkspaceId: string;
  onBindManual: () => void;
  onPick: () => void;
  onSelect: (workspace: CodingWorkspaceSummary) => void;
}) {
  const { state, actions } = controller;
  const localWorkspaces = state.workspaces.filter(
    (workspace) => workspace.runtimeMode === "local_daemon"
  );
  const hasOnlineDaemon = localWorkspaces.some((workspace) => workspace.connected);
  const [copiedCode, setCopiedCode] = useState(false);

  async function copyPairingCode() {
    if (!pairing.state.pairing?.code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pairing.state.pairing.code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1_500);
    } catch {
      setCopiedCode(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section data-daemon-onboarding>
        <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-950">连接这台电脑</h3>
          <span data-daemon-status className={hasOnlineDaemon ? "text-xs text-emerald-700" : "text-xs text-amber-700"}>
            {hasOnlineDaemon ? "Daemon 已在线" : "等待连接"}
          </span>
        </div>

        <div className="divide-y divide-slate-200 border-y border-slate-200">
          <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-3">
            <span className="grid size-7 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">1</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">安装本机 Daemon</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Daemon 只访问你随后选择的项目目录。</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <InstallerLink href={windowsInstallerUrl} label="Windows" />
                <InstallerLink href={macosInstallerUrl} label="macOS" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-3">
            <span className="grid size-7 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">2</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">安全配对</div>
              {hasOnlineDaemon ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  已连接，可直接选择工作区
                </div>
              ) : pairing.state.status === "pending" && pairing.state.pairing ? (
                <div className="mt-2">
                  <div className="flex min-h-12 items-center justify-between gap-2 border border-teal-200 bg-teal-50 px-3">
                    <code data-daemon-pairing-code className="select-all font-mono text-base font-semibold tracking-[0.08em] text-teal-950">
                      {pairing.state.pairing.code}
                    </code>
                    <button
                      type="button"
                      title="复制配对码"
                      aria-label="复制配对码"
                      onClick={() => void copyPairingCode()}
                      className="grid size-8 shrink-0 place-items-center rounded-[5px] border border-transparent text-teal-800 hover:border-teal-200 hover:bg-white"
                    >
                      {copiedCode ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                    </button>
                  </div>
                  <div className="mt-2 flex min-h-9 items-center justify-between gap-3 text-xs text-slate-500">
                    <span>剩余 {pairing.expiresLabel}</span>
                    <a
                      href={pairing.state.pairing.deepLink}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[5px] border border-teal-200 px-2.5 font-semibold text-teal-800 hover:bg-teal-50"
                    >
                      打开 Daemon
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              ) : pairing.state.status === "claimed" ? (
                <div className="mt-2 text-sm text-emerald-700">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {pairing.state.device?.machineName || "设备"} 已配对
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">请在 Daemon 中选择项目文件夹，页面会自动发现工作区。</p>
                </div>
              ) : (
                <div className="mt-2">
                  <button
                    type="button"
                    data-daemon-pairing-create
                    onClick={() => void pairing.actions.createPairing()}
                    disabled={pairing.state.status === "creating"}
                    className="inline-flex h-9 min-w-32 items-center justify-center gap-2 rounded-[6px] border border-teal-600 bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-wait disabled:border-slate-300 disabled:bg-slate-300"
                  >
                    {pairing.state.status === "creating" ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
                    {pairing.state.status === "creating" ? "正在生成..." : pairing.state.status === "expired" ? "重新生成配对码" : "生成配对码"}
                  </button>
                </div>
              )}
              {pairing.state.error ? (
                <p className="mt-2 text-xs leading-5 text-rose-700">{pairing.state.error}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-950">选择项目文件夹</h3>
          <button
            type="button"
            title="刷新本机工作区"
            aria-label="刷新本机工作区"
            onClick={() => void actions.refreshWorkspaces()}
            className="grid size-8 place-items-center rounded-[6px] border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-2">
          {localWorkspaces.map((workspace) => (
            <WorkspaceOption
              key={workspace.workspaceId}
              workspace={workspace}
              active={selectedWorkspaceId === workspace.workspaceId}
              onClick={() => onSelect(workspace)}
            />
          ))}
          {localWorkspaces.length === 0 ? (
            <p className="border-y border-slate-200 py-5 text-center text-sm text-slate-500">
              配对后，在 Daemon 中选择一个本机项目。
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPick}
            disabled={!hasOnlineDaemon || state.workspaceBrowser.status === "selecting"}
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <FolderOpen className="size-4" aria-hidden="true" />
            系统选择器
          </button>
          <button
            type="button"
            onClick={() => void actions.browseWorkspace(
              state.workspaceBrowser.currentPath || localWorkspaces[0]?.rootPath,
              localWorkspaces[0]?.workspaceId
            )}
            disabled={!hasOnlineDaemon}
            className="h-9 min-w-24 rounded-[6px] border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            浏览目录
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={state.workspaceBrowser.manualPath}
            onChange={(event) => actions.updateWorkspacePathDraft(event.target.value)}
            placeholder="输入本机绝对路径"
            className="h-10 min-w-0 flex-1 rounded-[6px] border border-slate-200 px-3 text-sm outline-none focus:border-teal-400"
          />
          <button
            type="button"
            onClick={onBindManual}
            disabled={!hasOnlineDaemon || state.workspaceBrowser.status === "selecting"}
            className="h-10 min-w-20 rounded-[6px] border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            绑定
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">{state.workspaceBrowser.notice}</p>

        {state.workspaceBrowser.suggestedRoots.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {state.workspaceBrowser.suggestedRoots.map((path) => (
              <button
                key={path}
                type="button"
                title={path}
                onClick={() => actions.updateWorkspacePathDraft(path)}
                className="max-w-full truncate rounded-[5px] border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                {path}
              </button>
            ))}
          </div>
        ) : null}

        {state.workspaceBrowser.entries.length > 0 ? (
          <div className="mt-3 max-h-52 overflow-y-auto border border-slate-200">
            {state.workspaceBrowser.parentPath ? (
              <button
                type="button"
                onClick={() => void actions.browseWorkspace(
                  state.workspaceBrowser.parentPath ?? undefined,
                  localWorkspaces[0]?.workspaceId
                )}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                ../
              </button>
            ) : null}
            {state.workspaceBrowser.entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => void actions.browseWorkspace(entry.path, localWorkspaces[0]?.workspaceId)}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
              >
                {entry.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CloudRuntimeContent({
  controller,
  draft,
  selectedWorkspaceId,
  onCreate,
  onDraftChange,
  onSelect
}: {
  controller: CodingWorkbenchController;
  draft: CloudWorkspaceDraft;
  selectedWorkspaceId: string;
  onCreate: () => void;
  onDraftChange: (draft: CloudWorkspaceDraft) => void;
  onSelect: (workspace: CodingWorkspaceSummary) => void;
}) {
  const { state, actions } = controller;
  const cloudWorkspaces = state.workspaces.filter(
    (workspace) => workspace.runtimeMode === "cloud_runtime"
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-950">云端工作区</h3>
          <button
            type="button"
            title="刷新"
            aria-label="刷新云端工作区"
            onClick={() => void actions.refreshWorkspaces()}
            className="grid size-8 place-items-center rounded-[6px] border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-2">
          {cloudWorkspaces.map((workspace) => {
            const busy = state.cloudBusyWorkspaceId === workspace.workspaceId;
            return (
              <div key={workspace.workspaceId} className="border-b border-slate-200 pb-3 last:border-b-0">
                <WorkspaceOption
                  workspace={workspace}
                  active={selectedWorkspaceId === workspace.workspaceId}
                  onClick={() => onSelect(workspace)}
                />
                <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                  {workspace.status === "stopped" ? (
                    <LifecycleButton
                      icon={<Play className="size-3.5" aria-hidden="true" />}
                      label="启动"
                      busy={busy && state.cloudBusyAction === "start"}
                      onClick={() => void actions.runCloudLifecycle(workspace.workspaceId, "start")}
                    />
                  ) : null}
                  {workspace.status === "ready" || workspace.status === "busy" ? (
                    <LifecycleButton
                      icon={<Square className="size-3.5" aria-hidden="true" />}
                      label="停止"
                      busy={busy && state.cloudBusyAction === "stop"}
                      onClick={() => void actions.runCloudLifecycle(workspace.workspaceId, "stop")}
                    />
                  ) : null}
                  {workspace.status === "error" ? (
                    <LifecycleButton
                      icon={<RefreshCw className="size-3.5" aria-hidden="true" />}
                      label="重试"
                      busy={busy && state.cloudBusyAction === "retry"}
                      onClick={() => void actions.runCloudLifecycle(workspace.workspaceId, "retry")}
                    />
                  ) : null}
                  <LifecycleButton
                    danger
                    icon={<Trash2 className="size-3.5" aria-hidden="true" />}
                    label="删除"
                    busy={busy && state.cloudBusyAction === "delete"}
                    onClick={() => {
                      if (window.confirm(`删除云端工作区“${workspace.name}”？关联容器和工作目录将被清理。`)) {
                        void actions.runCloudLifecycle(workspace.workspaceId, "delete");
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
          {cloudWorkspaces.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">还没有云端工作区。</p>
          ) : null}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <h3 className="text-sm font-semibold text-slate-950">从 Git 仓库创建</h3>
        <div className="mt-3 space-y-3">
          <LabeledInput
            label="名称"
            value={draft.name}
            placeholder="例如：SeekDesk Web"
            onChange={(name) => onDraftChange({ ...draft, name })}
          />
          <LabeledInput
            label="HTTPS 仓库地址"
            value={draft.repositoryUrl}
            placeholder="https://github.com/org/repo.git"
            onChange={(repositoryUrl) => onDraftChange({ ...draft, repositoryUrl })}
          />
          <LabeledInput
            label="分支"
            value={draft.branch}
            placeholder="main"
            onChange={(branch) => onDraftChange({ ...draft, branch })}
          />
          <label className="block text-xs font-medium text-slate-700">
            Runtime 镜像
            <select
              value={draft.imageProfile}
              onChange={(event) => onDraftChange({ ...draft, imageProfile: event.target.value as "node22" })}
              className="mt-1 h-10 w-full rounded-[6px] border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-400"
            >
              <option value="node22">Node.js 22</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            仓库凭据（可选）
            <select
              value={draft.credentialId}
              onChange={(event) => onDraftChange({ ...draft, credentialId: event.target.value })}
              className="mt-1 h-10 w-full rounded-[6px] border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-400"
            >
              <option value="">公开仓库，无需凭据</option>
              {state.repositoryCredentials.map((credential) => (
                <option key={credential.id} value={credential.id}>
                  {credential.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onCreate}
            disabled={state.cloudBusyAction === "create"}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-600 bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            {state.cloudBusyAction === "create" ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Cloud className="size-4" aria-hidden="true" />
            )}
            {state.cloudBusyAction === "create" ? "正在创建..." : "创建云端工作区"}
          </button>
          <p className="text-xs leading-5 text-slate-500">
            凭据只由服务端保存和解密，浏览器不会读取或回显 token。
          </p>
        </div>
      </section>
    </div>
  );
}

function InstallerLink({ href, label }: { href: string; label: string }) {
  const className =
    "inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-[6px] border px-3 text-sm font-semibold " +
    (href
      ? "border-slate-200 text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
      : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400");
  if (!href) {
    return (
      <span data-daemon-installer={label.toLowerCase()} className={className} title={`${label} 安装包地址尚未配置`}>
        <Download className="size-4" aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <a data-daemon-installer={label.toLowerCase()} className={className} href={href} target="_blank" rel="noreferrer">
      <Download className="size-4" aria-hidden="true" />
      {label}
    </a>
  );
}

function RuntimeModeButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "inline-flex h-8 items-center justify-center gap-2 rounded-[5px] border text-sm font-semibold transition-colors " +
        (active
          ? "border-slate-200 bg-white text-slate-950 shadow-sm"
          : "border-transparent text-slate-600 hover:text-slate-900")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function WorkspaceOption({
  active,
  onClick,
  workspace
}: {
  active: boolean;
  onClick: () => void;
  workspace: CodingWorkspaceSummary;
}) {
  const runtimeLabel = workspace.runtimeMode === "cloud_runtime" ? "云端" : "本机";
  return (
    <button
      type="button"
      data-coding-dialog-workspace={workspace.workspaceId}
      onClick={onClick}
      className={
        "w-full rounded-[7px] border px-3 py-2 text-left transition-colors " +
        (active
          ? "border-teal-300 bg-teal-50 text-teal-950"
          : "border-slate-200 text-slate-700 hover:border-teal-200 hover:bg-teal-50/60")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold">{workspace.name}</span>
        <span className="shrink-0 text-[11px] text-slate-500">{runtimeLabel}</span>
      </div>
      <div className="mt-1 truncate text-xs text-slate-500">
        {workspace.repository
          ? `${workspace.repository.url} · ${workspace.repository.branch}`
          : workspace.rootPath}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span className="truncate">
          {workspace.machineName || workspace.imageProfile || "Runtime"}
        </span>
        <span className={workspace.connected && workspace.status === "ready" ? "text-emerald-700" : "text-amber-700"}>
          {workspaceStatusMessage(workspace)}
        </span>
      </div>
    </button>
  );
}

function LifecycleButton({
  busy,
  danger = false,
  icon,
  label,
  onClick
}: {
  busy: boolean;
  danger?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={
        "inline-flex h-8 min-w-20 items-center justify-center gap-1.5 rounded-[6px] border px-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-60 " +
        (danger
          ? "border-rose-200 text-rose-700 hover:bg-rose-50"
          : "border-slate-200 text-slate-700 hover:bg-slate-50")
      }
    >
      {busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : icon}
      {busy ? "处理中" : label}
    </button>
  );
}

function LabeledInput({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-700">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-[6px] border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-400"
      />
    </label>
  );
}
