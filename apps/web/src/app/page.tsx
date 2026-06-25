"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  FileCode2,
  FileText,
  FolderOpen,
  GitCompare,
  MessageSquare,
  PanelLeft,
  Search,
  ShieldCheck,
  Terminal
} from "lucide-react";

import {
  getRuntimeApiBaseUrl,
  selectedContextLabel,
  statusLabel
} from "@/features/daily-work/domain";

import { useChatController } from "@/features/daily-work/chat/hooks/useChatController";
import { AgentTracePanel } from "@/features/daily-work/chat/components/ChatThread";
import {
  useActivityFeed,
  useApprovalLedger,
  useArtifacts,
  useDailyContext,
  useModelUsagePanel,
  usePersistencePanel,
  useSessionHistory,
  useTemplatePanel,
  useWorkflowPreview
} from "@/features/daily-work/hooks/useDailyWorkPanels";
import { useDailyWorkActions } from "@/features/daily-work/hooks/useDailyWorkActions";
import { useCodingWorkbench } from "@/features/daily-work/hooks/useCodingWorkbench";
import {
  useDailyWorkDerivedSelections,
  useDailyWorkSelectionState
} from "@/features/daily-work/hooks/useDailyWorkSelectionState";
import type { AgentToolCallTraceItem, ChatMessage } from "@/features/daily-work/types";
import { PersistenceStatusPanel } from "@/features/daily-work/components/DailyWorkPrimitives";
import { ActivityFeedPanel } from "@/features/daily-work/components/panels/ActivityFeedPanel";
import { ArtifactPanel } from "@/features/daily-work/components/panels/ArtifactPanel";
import { ContextPanel } from "@/features/daily-work/components/panels/ContextPanel";
import { ModeSnapshotPanel } from "@/features/daily-work/components/panels/ModeSnapshotPanel";
import { ModelUsagePanel } from "@/features/daily-work/components/panels/ModelUsagePanel";
import { SessionHistoryPanel } from "@/features/daily-work/components/panels/SessionHistoryPanel";
import { TemplateLibraryPanel } from "@/features/daily-work/components/panels/TemplateLibraryPanel";
import { WorkflowPreviewPanel } from "@/features/daily-work/components/panels/WorkflowPreviewPanel";
import {
  CodingDiffPanel,
  CodingFilesPanel,
  CodingSearchPanel,
  CodingTerminalPanel
} from "@/features/daily-work/components/panels/CodingWorkbenchPanels";
import {
  DailyWorkDashboardShell,
  type DailyWorkConversationGroup,
  type DailyWorkView,
  type DailyWorkViewConfig
} from "@/features/daily-work/components/DailyWorkDashboardShell";
import { DailyWorkAssistantView } from "@/features/daily-work/components/DailyWorkAssistantView";
import { DailyWorkModuleStack } from "@/features/daily-work/components/DailyWorkModuleStack";
import { DailyWorkSettingsSection } from "@/features/daily-work/components/DailyWorkSettingsSection";

export default function Page() {
  const [activeView, setActiveView] = useState<DailyWorkView>("assistant");
  const [currentConversationTitle, setCurrentConversationTitle] =
    useState("\u65b0\u5bf9\u8bdd");
  const [conversationTitleOverrides, setConversationTitleOverrides] = useState<
    Record<string, string>
  >({});
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const handleSessionTitleChanged = useCallback(
    (session: { sessionId: string; title: string }) => {
      setCurrentConversationTitle(session.title);
      setConversationTitleOverrides((current) => ({
        ...current,
        [session.sessionId]: session.title
      }));
    },
    []
  );
  const selectionState = useDailyWorkSelectionState();
  const {
    artifactFilter,
    modelRouteMode,
    selectedArtifactId,
    selectedContextId,
    selectedSessionHistoryId,
    selectedTemplateId,
    selectedWorkflowActionId,
    sessionHistoryFilter,
    setArtifactFilter,
    setModelRouteMode,
    setSelectedActivityEventId,
    setSelectedArtifactId,
    setSelectedContextId,
    setSelectedSessionHistoryId,
    setSelectedTemplateId,
    setSelectedWorkflowActionId,
    setSessionHistoryFilter,
    setWorkflowActionFilter,
    workflowActionFilter
  } = selectionState;

  const apiBaseUrl = useMemo(() => getRuntimeApiBaseUrl().replace(/\/$/, ""), []);
  const {
    activityConnectionStatus,
    activityFeedEvents,
    activityFeedNotice,
    activityFeedSource,
    activityLastUpdated,
    refreshActivityFeed
  } = useActivityFeed(apiBaseUrl, setSelectedActivityEventId);
  const {
    activeSessionId,
    agentTrace,
    applyPrompt,
    authorizeToolCallForSession,
    cancelRequest,
    endpoint,
    error,
    handleSubmit,
    input,
    inputRef,
    isBusy,
    lastSubmittedPrompt,
    loadSessionMessages,
    messages,
    executeToolCall,
    messagesEndRef,
    retryLastPrompt,
    setError,
    setInput,
    startCurrentConversation,
    status
  } = useChatController({
    apiBaseUrl,
    requestContext: {
      templateId: selectedTemplateId,
      contextItemIds: selectedContextId ? [selectedContextId] : [],
      artifactIds: selectedArtifactId ? [selectedArtifactId] : [],
      workflowIds: selectedWorkflowActionId ? [selectedWorkflowActionId] : [],
      ...(selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : {})
    },
    onActivityChanged: refreshActivityFeed,
    onSessionTitleChanged: handleSessionTitleChanged
  });
  const { templatePanel, setTemplatePanel } = useTemplatePanel(apiBaseUrl);
  const {
    contextPanel,
    contextUploadState,
    setContextPanel,
    uploadContextFile
  } = useDailyContext(apiBaseUrl, setSelectedContextId);
  const { approvalPanel, refreshApprovalLedger, setApprovalPanel } =
    useApprovalLedger(apiBaseUrl);
  const {
    deleteSession,
    refreshSessionDetail,
    refreshSessionHistory,
    sessionHistoryPanel,
    setSessionHistoryPanel,
    updateSessionMetadata
  } = useSessionHistory(
    apiBaseUrl,
    selectedSessionHistoryId,
    setSelectedSessionHistoryId
  );
  const { artifactPanel } = useArtifacts(
    apiBaseUrl,
    selectedArtifactId,
    setSelectedArtifactId
  );
  const { modelUsagePanel } = useModelUsagePanel(
    apiBaseUrl,
    agentTrace.sessionId
  );
  const { persistencePanel } = usePersistencePanel(apiBaseUrl);
  const codingWorkbench = useCodingWorkbench(
    apiBaseUrl,
    agentTrace,
    selectedWorkspaceId,
    setSelectedWorkspaceId
  );
  const activeModelSnapshot = modelUsagePanel.modelSnapshots[modelRouteMode];
  const modelInputPlaceholder =
    modelRouteMode === "fast"
      ? "例如：阅读 src 目录，找出登录流程的入口文件并说明调用链。"
      : "例如：生成一个修复计划，先展示 diff 方案，等我批准后再应用。";
  const templateItems = templatePanel.items;
  const selectedTemplate =
    templateItems.find((template) => template.id === selectedTemplateId) ?? null;
  const contextPanelItems = contextPanel.items;
  const approvalRequests = approvalPanel.items;
  const pendingCodingToolCount =
    codingWorkbench.state.pendingWriteOrCommandToolCalls.length;
  const artifactItems = artifactPanel.items;
  const sessionHistoryPanelItems = sessionHistoryPanel.items;
  const {
    filteredArtifacts,
    filteredSessionHistory,
    filteredWorkflowActions,
    selectedActivityEvent,
    selectedArtifact,
    selectedContextItem,
    selectedSessionHistory,
    selectedWorkflowAction
  } = useDailyWorkDerivedSelections({
    ...selectionState,
    activityFeedEvents,
    approvalRequests,
    artifactItems,
    contextPanelItems,
    sessionHistoryPanelItems
  });
  const setConnectorPreviewPanel = useCallback(() => undefined, []);
  const setSelectedConnectorId = useCallback(() => undefined, []);
  const { workflowPreviewPanel } = useWorkflowPreview(
    apiBaseUrl,
    selectedWorkflowActionId ? selectedWorkflowAction : null,
    refreshActivityFeed
  );
  const {
    applyActivityEventPrompt,
    applyTemplatePrompt,
    applyWorkflowActionPrompt,
    restoreSessionHistory,
    selectSessionHistory,
    switchModelRoute,
    useContextItem
  } = useDailyWorkActions({
    apiBaseUrl,
    applyPrompt,
    modelUsagePanel,
    refreshActivityFeed,
    refreshApprovalLedger,
    refreshSessionDetail,
    refreshSessionHistory,
    setApprovalPanel,
    setConnectorPreviewPanel,
    setContextPanel,
    setModelRouteMode,
    setSelectedActivityEventId,
    setSelectedContextId,
    setSelectedConnectorId,
    setSelectedSessionHistoryId,
    setSelectedTemplateId,
    setSelectedWorkflowActionId,
    setSessionHistoryPanel,
    setTemplatePanel,
    workflowPreviewPanel
  });

  const openAssistantAfter =
    <T extends unknown[]>(action: (...args: T) => void) =>
    (...args: T) => {
      action(...args);
      setActiveView("assistant");
    };

  const applyTemplateAndOpenAssistant = openAssistantAfter(applyTemplatePrompt);
  const applyWorkflowAndOpenAssistant = openAssistantAfter(applyWorkflowActionPrompt);
  const applyEventAndOpenAssistant = openAssistantAfter(applyActivityEventPrompt);
  const restoreSessionAndOpenAssistant = openAssistantAfter(restoreSessionHistory);
  const useContextAndOpenAssistant = openAssistantAfter(useContextItem);

  const openCodingFile = useCallback(
    (path: string) => {
      void codingWorkbench.actions.readFile(path);
      setActiveView("files");
    },
    [codingWorkbench.actions]
  );

  const approveAndApplyFileToolCall = useCallback(
    async (toolCall: AgentToolCallTraceItem) => {
      await authorizeToolCallForSession(toolCall);
      await executeToolCall(toolCall);
      await codingWorkbench.actions.refreshGit();
      await refreshActivityFeed();
    },
    [
      authorizeToolCallForSession,
      codingWorkbench.actions,
      executeToolCall,
      refreshActivityFeed
    ]
  );

  const primaryViews: DailyWorkViewConfig[] = [
    {
      id: "assistant",
      label: "AI 编程",
      description: "通过对话规划、读取代码、生成工具计划并执行授权动作。",
      icon: <MessageSquare className="size-4" aria-hidden="true" />,
      badge: statusLabel(status)
    },
    {
      id: "files",
      label: "文件",
      description: "查看 workspace 文件树并读取文本文件。",
      icon: <FileCode2 className="size-4" aria-hidden="true" />,
      badge: String(codingWorkbench.state.treeEntries.length)
    },
    {
      id: "search",
      label: "搜索",
      description: "搜索代码和文档内容，并跳转到文件。",
      icon: <Search className="size-4" aria-hidden="true" />,
      badge: String(codingWorkbench.state.search.matches.length)
    },
    {
      id: "diff",
      label: "Diff",
      description: "查看 git status 和未暂存 diff。",
      icon: <GitCompare className="size-4" aria-hidden="true" />,
      badge: codingWorkbench.state.git.diffText ? "有变更" : "只读"
    },
    {
      id: "terminal",
      label: "终端",
      description: "查看已授权 shell 和测试输出。",
      icon: <Terminal className="size-4" aria-hidden="true" />,
      badge: String(codingWorkbench.state.terminalToolCalls.length)
    },
    {
      id: "trace",
      label: "运行详情",
      description: "查看工具计划、审批、活动和 token 记录。",
      icon: <Activity className="size-4" aria-hidden="true" />,
      badge: String(agentTrace.toolCalls.length)
    },
    {
      id: "artifacts",
      label: "产物",
      description: "查看当前会话生成的文档、补丁说明和执行记录。",
      icon: <FileText className="size-4" aria-hidden="true" />,
      badge: String(filteredArtifacts.length)
    },
    {
      id: "sessions",
      label: "历史",
      description: "恢复最近会话并保持创建时间倒序。",
      icon: <PanelLeft className="size-4" aria-hidden="true" />,
      badge: String(filteredSessionHistory.length)
    }
  ];

  const settingsViews: DailyWorkViewConfig[] = [
    {
      id: "models",
      label: "模型与用量",
      description: "查看模型路由、token 用量和持久化状态。",
      icon: <Bot className="size-4" aria-hidden="true" />,
      badge: modelRouteMode === "fast" ? "快速" : "深度"
    },
    {
      id: "approvals",
      label: "审批与权限",
      description: "查看会话授权、审批策略和安全边界。",
      icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      badge: String(pendingCodingToolCount)
    },
    {
      id: "activity",
      label: "活动审计",
      description: "查看工具计划、执行结果和审计事件。",
      icon: <Activity className="size-4" aria-hidden="true" />,
      badge: String(activityFeedEvents.length)
    }
  ];

  const isSettingsView = settingsViews.some((view) => view.id === activeView);
  const selectedContextTitle = selectedContextId
    ? selectedContextItem?.title ??
      selectedContextLabel(selectedContextId, contextPanelItems)
    : null;
  const activeSessionHistoryTitle = selectedSessionHistory
    ? conversationTitleOverrides[selectedSessionHistory.id] ??
      selectedSessionHistory.title
    : null;
  const isViewingHistorySession = Boolean(selectedSessionHistoryId);
  const currentConversationId =
    !isViewingHistorySession && activeSessionId
      ? activeSessionId
      : "current-conversation";
  const currentConversation = {
    id: currentConversationId,
    title: currentConversationTitle,
    summary: activeSessionId && !isViewingHistorySession
      ? "\u5f53\u524d\u4f1a\u8bdd"
      : "\u53d1\u9001\u7b2c\u4e00\u6761\u6d88\u606f\u540e\u81ea\u52a8\u751f\u6210\u6807\u9898",
    status: statusLabel(status),
    updatedAt: "\u73b0\u5728",
    messageCount: isViewingHistorySession
      ? 0
      : Math.max(messages.length, activeSessionId ? 1 : 0)
  };
  const sidebarConversationRecords = sessionHistoryPanelItems
    .filter((item) => item.status !== "已归档")
    .map((item, sourceIndex) => ({
      workspaceId: item.workspaceId,
      workspaceName: item.workspaceName ?? workspaceLabelFromPath(item.workspaceRoot) ?? item.workspaceId,
      workspaceRoot: item.workspaceRoot ?? item.workspaceId,
      createdAt: item.createdAt,
      sourceIndex,
      item: {
        id: item.id,
        title: conversationTitleOverrides[item.id] ?? item.title,
        summary: item.summary,
        status: item.status,
        updatedAt: item.updatedAt,
        messageCount: item.messageCount,
        pinned: Boolean(item.pinned)
      }
    }))
    .sort((left, right) => {
      const leftPinned = left.item.pinned ? 1 : 0;
      const rightPinned = right.item.pinned ? 1 : 0;

      if (leftPinned !== rightPinned) {
        return rightPinned - leftPinned;
      }

      const createdAtOrder =
        parseConversationCreatedAt(right.createdAt, right.sourceIndex) -
        parseConversationCreatedAt(left.createdAt, left.sourceIndex);
      if (createdAtOrder !== 0) {
        return createdAtOrder;
      }

      return left.sourceIndex - right.sourceIndex;
    });
  const sidebarConversationItems = sidebarConversationRecords.map((record) => record.item);
  const sidebarConversationGroups = buildConversationGroups(sidebarConversationRecords);
  const assistantConversationTitle =
    activeSessionHistoryTitle ?? currentConversation.title;

  const selectedSessionMessageKey = selectedSessionHistory
    ? selectedSessionHistory.recentMessages
        .map((message) => message.id + ":" + message.createdAt)
        .join("|")
    : "";

  useEffect(() => {
    if (activeView !== "assistant" || !selectedSessionHistory) {
      return;
    }

    const historyMessages: ChatMessage[] =
      selectedSessionHistory.recentMessages.length > 0
        ? selectedSessionHistory.recentMessages.map((message, index) => ({
            id:
              "session-" +
              selectedSessionHistory.id +
              "-" +
              message.id +
              "-" +
              index,
            role: message.role === "user" ? "user" : "assistant",
            content: message.content
          }))
        : [
            {
              id: "session-" + selectedSessionHistory.id + "-summary",
              role: "assistant",
              content:
                "\u5df2\u6253\u5f00\u4f1a\u8bdd\u300c" +
                selectedSessionHistory.title +
                "\u300d\n\n\u72b6\u6001\uff1a" +
                selectedSessionHistory.status +
                " / " +
                selectedSessionHistory.updatedAt +
                "\n\n\u6458\u8981\uff1a" +
                selectedSessionHistory.summary +
                "\n\n\u540e\u7aef\u6682\u672a\u8fd4\u56de\u8fd9\u6761\u4f1a\u8bdd\u7684 recentMessages\uff0c\u5f53\u524d\u5148\u5c55\u793a\u4f1a\u8bdd\u6458\u8981\u3002"
            }
          ];

    loadSessionMessages(selectedSessionHistory.id, historyMessages);
  }, [
    activeView,
    loadSessionMessages,
    selectedSessionHistory,
    selectedSessionMessageKey
  ]);

  const selectCurrentConversation = () => {
    setSelectedSessionHistoryId(null);
    setCurrentConversationTitle("\u65b0\u5bf9\u8bdd");
    startCurrentConversation();
    setActiveView("assistant");
  };

  const selectSidebarConversation = (conversationId: string) => {
    const conversation = sessionHistoryPanelItems.find(
      (item) => item.id === conversationId
    );

    if (conversation) {
      selectSessionHistory(conversation);
    }

    setActiveView("assistant");
  };

  const renameSidebarConversation = async (conversationId: string) => {
    const conversation = sessionHistoryPanelItems.find(
      (item) => item.id === conversationId
    );
    const currentTitle =
      conversationTitleOverrides[conversationId] ?? conversation?.title ?? "";
    const nextTitle = window.prompt("\u91cd\u547d\u540d\u5bf9\u8bdd", currentTitle)?.trim();

    if (!nextTitle) {
      return;
    }

    const nextItem = await updateSessionMetadata(conversationId, {
      title: nextTitle
    });
    setConversationTitleOverrides((current) => ({
      ...current,
      [conversationId]: nextItem.title
    }));
  };

  const deleteSidebarConversation = async (conversationId: string) => {
    if (!window.confirm("\u5220\u9664\u8fd9\u4e2a\u5bf9\u8bdd\uff1f")) {
      return;
    }

    await deleteSession(conversationId);

    if (selectedSessionHistoryId === conversationId) {
      selectCurrentConversation();
    }
  };

  const toggleSidebarConversationPin = async (conversationId: string) => {
    const conversation = sessionHistoryPanelItems.find(
      (item) => item.id === conversationId
    );
    await updateSessionMetadata(conversationId, {
      pinned: !conversation?.pinned
    });
  };

  const archiveSidebarConversation = async (conversationId: string) => {
    await updateSessionMetadata(conversationId, {
      status: "archived"
    });

    if (selectedSessionHistoryId === conversationId) {
      selectCurrentConversation();
    }
  };

  return (
    <>
    <DailyWorkDashboardShell
      activeConversationId={activeView === "assistant" ? selectedSessionHistoryId : null}
      activeView={activeView}
      currentConversation={currentConversation}
      conversationItems={sidebarConversationItems}
      conversationGroups={sidebarConversationGroups}
      primaryViews={primaryViews}
      settingsViews={settingsViews}
      onConversationArchive={archiveSidebarConversation}
      onConversationDelete={deleteSidebarConversation}
      onConversationPinToggle={toggleSidebarConversationPin}
      onConversationRename={renameSidebarConversation}
      onConversationSelect={selectSidebarConversation}
      onCurrentConversationSelect={selectCurrentConversation}
      onNewConversationSelect={() => {
        void codingWorkbench.actions.refreshWorkspaces();
        setNewConversationDialogOpen(true);
      }}
      onViewChange={setActiveView}
    >
            {activeView === "assistant" ? (
              <DailyWorkAssistantView
                activeModelName={activeModelSnapshot.selectedModel}
                agentTrace={agentTrace}
                endpoint={endpoint}
                error={error}
                handleSubmit={handleSubmit}
                input={input}
                inputRef={inputRef}
                isBusy={isBusy}
                lastSubmittedPrompt={lastSubmittedPrompt}
                messages={messages}
                messagesEndRef={messagesEndRef}
                conversationTitle={assistantConversationTitle}
                modelInputPlaceholder={modelInputPlaceholder}
                selectedContextTitle={selectedContextTitle}
                selectedTemplateTitle={selectedTemplate?.title ?? null}
                status={status}
                onApplyPrompt={applyPrompt}
                onAuthorizeToolCall={authorizeToolCallForSession}
                onCancelRequest={cancelRequest}
                onDismissError={() => setError(null)}
                onExecuteToolCall={executeToolCall}
                onInputChange={setInput}
                onRetry={retryLastPrompt}
              />
            ) : null}

            {activeView === "templates" ? (
              <DailyWorkModuleStack>
                <TemplateLibraryPanel
                  templateItems={templateItems}
                  templatePanel={templatePanel}
                  onApplyTemplate={applyTemplateAndOpenAssistant}
                />
              </DailyWorkModuleStack>
            ) : null}

            {activeView === "knowledge" ? (
              <DailyWorkModuleStack>
                <PersistenceStatusPanel state={persistencePanel} />
                <ContextPanel
                  contextItems={contextPanelItems}
                  contextPanel={contextPanel}
                  contextUploadState={contextUploadState}
                  selectedContextId={selectedContextId}
                  onUploadContextFile={uploadContextFile}
                  onUseContextItem={useContextAndOpenAssistant}
                />
              </DailyWorkModuleStack>
            ) : null}

            {activeView === "workflows" ? (
              <DailyWorkModuleStack>
                <WorkflowPreviewPanel
                  filter={workflowActionFilter}
                  filteredActions={filteredWorkflowActions}
                  previewPanel={workflowPreviewPanel}
                  selectedAction={selectedWorkflowAction}
                  onApplyWorkflowActionPrompt={applyWorkflowAndOpenAssistant}
                  onFilterChange={setWorkflowActionFilter}
                  onSelectAction={setSelectedWorkflowActionId}
                />
              </DailyWorkModuleStack>
            ) : null}

            {activeView === "files" ? (
              <DailyWorkModuleStack>
                <CodingFilesPanel
                  state={codingWorkbench.state}
                  onOpenFile={openCodingFile}
                  onRefreshTree={() => void codingWorkbench.actions.refreshFileTree()}
                />
              </DailyWorkModuleStack>
            ) : null}

            {activeView === "search" ? (
              <DailyWorkModuleStack>
                <CodingSearchPanel
                  state={codingWorkbench.state}
                  onOpenFile={openCodingFile}
                  onRunSearch={() => void codingWorkbench.actions.runSearch()}
                  onUpdateSearch={codingWorkbench.actions.updateSearchDraft}
                />
              </DailyWorkModuleStack>
            ) : null}

            {activeView === "diff" ? (
              <DailyWorkModuleStack>
                <CodingDiffPanel
                  state={codingWorkbench.state}
                  onApproveAndApplyToolCall={(toolCall) => {
                    void approveAndApplyFileToolCall(toolCall);
                  }}
                  onRefreshGit={() => void codingWorkbench.actions.refreshGit()}
                />
              </DailyWorkModuleStack>
            ) : null}

            {activeView === "terminal" ? (
              <DailyWorkModuleStack>
                <CodingTerminalPanel state={codingWorkbench.state} />
              </DailyWorkModuleStack>
            ) : null}

            {activeView === "trace" ? (
              <DailyWorkModuleStack>
                <AgentTracePanel
                  agentTrace={agentTrace}
                  modelName={activeModelSnapshot.selectedModel}
                  onAuthorizeToolCall={authorizeToolCallForSession}
                  onExecuteToolCall={executeToolCall}
                />
              </DailyWorkModuleStack>
            ) : null}

            {activeView === "artifacts" ? (
              <DailyWorkModuleStack>
                <ArtifactPanel
                  artifactFilter={artifactFilter}
                  artifactItems={artifactItems}
                  artifactPanel={artifactPanel}
                  filteredArtifacts={filteredArtifacts}
                  selectedArtifact={selectedArtifact}
                  onFilterChange={setArtifactFilter}
                  onSelectArtifact={setSelectedArtifactId}
                />
              </DailyWorkModuleStack>
            ) : null}

            {activeView === "sessions" ? (
              <DailyWorkModuleStack>
                <SessionHistoryPanel
                  filteredItems={filteredSessionHistory}
                  filter={sessionHistoryFilter}
                  panel={sessionHistoryPanel}
                  panelItems={sessionHistoryPanelItems}
                  selectedItem={selectedSessionHistory}
                  onFilterChange={setSessionHistoryFilter}
                  onRestoreItem={restoreSessionAndOpenAssistant}
                  onSelectItem={selectSessionHistory}
                />
              </DailyWorkModuleStack>
            ) : null}

            {isSettingsView ? (
              <DailyWorkSettingsSection
                activeView={activeView}
                settingsViews={settingsViews}
                onViewChange={setActiveView}
              >

                  {activeView === "approvals" ? (
                    <>
                      <AgentTracePanel
                        agentTrace={agentTrace}
                        modelName={activeModelSnapshot.selectedModel}
                        onAuthorizeToolCall={authorizeToolCallForSession}
                        onExecuteToolCall={executeToolCall}
                      />
                      <ModeSnapshotPanel
                        pendingToolCount={pendingCodingToolCount}
                        runtimeMode={codingWorkbench.state.workspace?.runtimeMode}
                        workspaceName={codingWorkbench.state.workspace?.workspaceName}
                      />
                    </>
                  ) : null}

                  {activeView === "activity" ? (
                    <ActivityFeedPanel
                      connectionStatus={activityConnectionStatus}
                      events={activityFeedEvents}
                      lastUpdated={activityLastUpdated}
                      notice={activityFeedNotice}
                      selectedEvent={selectedActivityEvent}
                      source={activityFeedSource}
                      onApplyEventPrompt={applyEventAndOpenAssistant}
                      onSelectEvent={setSelectedActivityEventId}
                    />
                  ) : null}

                  {activeView === "models" ? (
                    <>
                      <ModelUsagePanel
                        modelRouteMode={modelRouteMode}
                        modelUsagePanel={modelUsagePanel}
                        onSwitchModelRoute={switchModelRoute}
                      />
                      <PersistenceStatusPanel state={persistencePanel} />
                    </>
                  ) : null}
              </DailyWorkSettingsSection>
            ) : null}
    </DailyWorkDashboardShell>
    <NewConversationWorkspaceDialog
      apiBaseUrl={apiBaseUrl}
      open={newConversationDialogOpen}
      state={codingWorkbench.state}
      onBrowseWorkspace={(path) => void codingWorkbench.actions.browseWorkspace(path)}
      onClose={() => setNewConversationDialogOpen(false)}
      onCreate={async () => {
        const manualPath = codingWorkbench.state.workspaceBrowser.manualPath.trim();
        if (manualPath) {
          await codingWorkbench.actions.selectWorkspace(manualPath);
        } else if (!selectedWorkspaceId && codingWorkbench.state.workspaces[0]) {
          setSelectedWorkspaceId(codingWorkbench.state.workspaces[0].workspaceId);
        }
        selectCurrentConversation();
        setNewConversationDialogOpen(false);
      }}
      onPickWorkspace={() => void codingWorkbench.actions.pickWorkspace()}
      onSelectExistingWorkspace={(workspaceId) => {
        codingWorkbench.actions.setActiveWorkspace(workspaceId);
      }}
      onUpdateWorkspacePath={codingWorkbench.actions.updateWorkspacePathDraft}
    />
    </>
  );
}


function buildConversationGroups(
  records: Array<{
    workspaceId: string;
    workspaceName: string;
    workspaceRoot: string;
    item: {
      id: string;
      title: string;
      summary: string;
      status: string;
      updatedAt: string;
      messageCount: number;
      pinned: boolean;
    };
  }>
): DailyWorkConversationGroup[] {
  const groups = new Map<string, DailyWorkConversationGroup>();

  for (const record of records) {
    const group = groups.get(record.workspaceId) ?? {
      id: record.workspaceId,
      label: record.workspaceName,
      description: record.workspaceRoot,
      items: []
    };
    group.items.push(record.item);
    groups.set(record.workspaceId, group);
  }

  return [...groups.values()];
}

function workspaceLabelFromPath(pathValue: string | undefined) {
  if (!pathValue) {
    return null;
  }

  const normalized = pathValue.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? normalized;
}

type CodingWorkbenchController = ReturnType<typeof useCodingWorkbench>;

function NewConversationWorkspaceDialog({
  apiBaseUrl,
  open,
  state,
  onBrowseWorkspace,
  onClose,
  onCreate,
  onPickWorkspace,
  onSelectExistingWorkspace,
  onUpdateWorkspacePath
}: {
  apiBaseUrl: string;
  open: boolean;
  state: CodingWorkbenchController["state"];
  onBrowseWorkspace: (path?: string) => void;
  onClose: () => void;
  onCreate: () => Promise<void>;
  onPickWorkspace: () => void;
  onSelectExistingWorkspace: (workspaceId: string) => void;
  onUpdateWorkspacePath: (path: string) => void;
}) {
  if (!open) {
    return null;
  }

  const activeWorkspaceId = state.activeWorkspaceId || state.workspace?.workspaceId || "";
  const hasConnectedLocalDaemon = state.workspaces.some(
    (workspace) => workspace.runtimeMode === "local_daemon"
  );
  const daemonStartCommand =
    'seekdesk-daemon start --api ' +
    apiBaseUrl +
    ' --token seekdesk-local-dev --workspace "C:\\path\\to\\project"';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-3xl rounded-[10px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-heading text-base font-semibold text-slate-950">新建编程对话</h2>
            <p className="mt-1 text-sm text-slate-600">先绑定一个本机工作区，后续文件、搜索、Diff、终端都会限定在该目录。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-[6px] border border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50">
            关闭
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-[8px] border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FolderOpen className="size-4 text-teal-600" aria-hidden="true" />
              已连接工作区
            </div>
            {!hasConnectedLocalDaemon ? (
              <div className="mb-3 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="font-semibold">未检测到本机 daemon</div>
                <p className="mt-1 leading-5">先在本机项目目录启动 daemon，再回到这里选择本机工作区。</p>
                <code className="mt-2 block select-all break-all rounded-[6px] bg-white/80 px-2 py-1 font-mono text-[11px] text-slate-800">
                  {daemonStartCommand}
                </code>
              </div>
            ) : null}
            <div className="space-y-2">
              {state.workspaces.map((workspace) => {
                const active = activeWorkspaceId === workspace.workspaceId;
                return (
                  <button
                    key={workspace.workspaceId}
                    type="button"
                    data-coding-dialog-workspace={workspace.workspaceId}
                    onClick={() => onSelectExistingWorkspace(workspace.workspaceId)}
                    className={
                      "w-full rounded-[8px] border px-3 py-2 text-left transition-colors " +
                      (active
                        ? "border-teal-300 bg-teal-50 text-teal-950"
                        : "border-slate-200 text-slate-700 hover:border-teal-200 hover:bg-teal-50/60")
                    }
                  >
                    <div className="truncate text-sm font-semibold">{workspace.name}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{workspace.rootPath}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {workspace.runtimeMode === "local_daemon" ? "本机 daemon" : "远程 fallback"}
                      {workspace.machineName ? " / " + workspace.machineName : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[8px] border border-slate-200 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">选择文件夹</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onPickWorkspace}
                disabled={!hasConnectedLocalDaemon}
                className={
                  "h-9 rounded-[6px] border px-3 text-sm font-semibold " +
                  (hasConnectedLocalDaemon
                    ? "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100"
                    : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400")
                }
              >
                打开本机选择器
              </button>
              <button type="button" onClick={() => onBrowseWorkspace(state.workspaceBrowser.currentPath || state.workspace?.workspaceRoot)} className="h-9 rounded-[6px] border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                浏览目录
              </button>
            </div>
            <input
              value={state.workspaceBrowser.manualPath ?? ""}
              onChange={(event) => onUpdateWorkspacePath(event.target.value)}
              placeholder="输入本机工作区路径"
              className="mt-3 h-10 w-full rounded-[6px] border border-slate-200 px-3 text-sm outline-none focus:border-teal-400"
            />
            <div className="mt-2 text-xs text-slate-500">
              {state.workspaceBrowser.notice ||
                (!hasConnectedLocalDaemon
                  ? "本机选择器需要已连接的本机 daemon；远程 fallback 只能浏览服务器目录。"
                  : "")}
            </div>

            <div className="mt-3 max-h-48 overflow-y-auto rounded-[8px] border border-slate-100">
              {state.workspaceBrowser.parentPath ? (
                <button type="button" onClick={() => onBrowseWorkspace(state.workspaceBrowser.parentPath ?? undefined)} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                  ../
                </button>
              ) : null}
              {state.workspaceBrowser.entries.map((entry) => (
                <button key={entry.path} type="button" onClick={() => onBrowseWorkspace(entry.path)} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50">
                  {entry.name}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="h-9 rounded-[6px] border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            取消
          </button>
          <button type="button" data-coding-dialog-create onClick={() => void onCreate()} className="h-9 rounded-[6px] border border-orange-500 bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600">
            创建对话
          </button>
        </div>
      </div>
    </div>
  );
}
function parseConversationCreatedAt(value: string, fallbackIndex: number) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? fallbackIndex : timestamp;
}
