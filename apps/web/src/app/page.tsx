"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Database,
  FileText,
  Globe,
  MessageSquare,
  PanelLeft,
  ShieldCheck,
  Wand2,
  Workflow
} from "lucide-react";

import {
  getRuntimeApiBaseUrl,
  selectedContextLabel,
  statusLabel
} from "@/features/daily-work/domain";

import { useChatController } from "@/features/daily-work/chat/hooks/useChatController";
import {
  useActivityFeed,
  useApprovalLedger,
  useArtifacts,
  useConnectorPreview,
  useDailyContext,
  useGoogleConnectorStatus,
  useModelUsagePanel,
  usePersistencePanel,
  useSessionHistory,
  useTemplatePanel,
  useWorkflowPreview
} from "@/features/daily-work/hooks/useDailyWorkPanels";
import { useDailyWorkActions } from "@/features/daily-work/hooks/useDailyWorkActions";
import {
  useDailyWorkDerivedSelections,
  useDailyWorkSelectionState
} from "@/features/daily-work/hooks/useDailyWorkSelectionState";
import { PersistenceStatusPanel } from "@/features/daily-work/components/DailyWorkPrimitives";
import { ActivityFeedPanel } from "@/features/daily-work/components/panels/ActivityFeedPanel";
import { ApprovalLedgerPanel } from "@/features/daily-work/components/panels/ApprovalLedgerPanel";
import { ArtifactPanel } from "@/features/daily-work/components/panels/ArtifactPanel";
import { ConnectorDirectoryPanel } from "@/features/daily-work/components/panels/ConnectorDirectoryPanel";
import { ContextPanel } from "@/features/daily-work/components/panels/ContextPanel";
import { ModeSnapshotPanel } from "@/features/daily-work/components/panels/ModeSnapshotPanel";
import { ModelUsagePanel } from "@/features/daily-work/components/panels/ModelUsagePanel";
import { SessionHistoryPanel } from "@/features/daily-work/components/panels/SessionHistoryPanel";
import { TemplateLibraryPanel } from "@/features/daily-work/components/panels/TemplateLibraryPanel";
import { WorkflowPreviewPanel } from "@/features/daily-work/components/panels/WorkflowPreviewPanel";
import {
  DailyWorkDashboardShell,
  type DailyWorkView,
  type DailyWorkViewConfig
} from "@/features/daily-work/components/DailyWorkDashboardShell";
import { DailyWorkAssistantView } from "@/features/daily-work/components/DailyWorkAssistantView";
import { DailyWorkModuleStack } from "@/features/daily-work/components/DailyWorkModuleStack";
import { DailyWorkSettingsSection } from "@/features/daily-work/components/DailyWorkSettingsSection";

export default function Page() {
  const [activeView, setActiveView] = useState<DailyWorkView>("assistant");
  const selectionState = useDailyWorkSelectionState();
  const {
    artifactFilter,
    connectorFilter,
    modelRouteMode,
    selectedArtifactId,
    selectedContextId,
    selectedConnectorId,
    selectedSessionHistoryId,
    selectedTemplateId,
    selectedWorkflowActionId,
    sessionHistoryFilter,
    setArtifactFilter,
    setConnectorFilter,
    setModelRouteMode,
    setSelectedActivityEventId,
    setSelectedArtifactId,
    setSelectedConnectorId,
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
    agentTrace,
    applyPrompt,
    cancelRequest,
    endpoint,
    error,
    handleSubmit,
    input,
    inputRef,
    isBusy,
    lastSubmittedPrompt,
    messages,
    messagesEndRef,
    retryLastPrompt,
    setError,
    setInput,
    status
  } = useChatController({
    apiBaseUrl,
    requestContext: {
      templateId: selectedTemplateId,
      contextItemIds: selectedContextId ? [selectedContextId] : [],
      artifactIds: selectedArtifactId ? [selectedArtifactId] : [],
      connectorIds: selectedConnectorId ? [selectedConnectorId] : [],
      workflowIds: selectedWorkflowActionId ? [selectedWorkflowActionId] : []
    },
    onActivityChanged: refreshActivityFeed
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
    refreshSessionDetail,
    refreshSessionHistory,
    sessionHistoryPanel,
    setSessionHistoryPanel
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
  const {
    googleConnectorStatus,
    googleOAuthStartNotice,
    googleOAuthStartStatus,
    microsoftConnectorStatus,
    microsoftOAuthStartNotice,
    microsoftOAuthStartStatus,
    refreshGoogleConnectorStatus,
    refreshMicrosoftConnectorStatus,
    startGoogleOAuth,
    startMicrosoftOAuth
  } = useGoogleConnectorStatus(apiBaseUrl);
  const activeModelSnapshot = modelUsagePanel.modelSnapshots[modelRouteMode];
  const modelInputPlaceholder =
    modelRouteMode === "fast"
      ? "例如：帮我写一封客户更新邮件，整理当前结果、时间线、风险和下一步。"
      : "例如：归纳这批资料，复核风险并列出还需要补充的上下文。";
  const templateItems = templatePanel.items;
  const selectedTemplate =
    templateItems.find((template) => template.id === selectedTemplateId) ?? null;
  const contextPanelItems = contextPanel.items;
  const approvalRequests = approvalPanel.items;
  const artifactItems = artifactPanel.items;
  const sessionHistoryPanelItems = sessionHistoryPanel.items;
  const {
    filteredArtifacts,
    filteredConnectors,
    filteredSessionHistory,
    filteredWorkflowActions,
    selectedActivityEvent,
    selectedArtifact,
    selectedConnector,
    selectedConnectorApprovalRequests,
    selectedConnectorPreviewStatus,
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
  const { connectorPreviewPanel, setConnectorPreviewPanel } =
    useConnectorPreview(apiBaseUrl, selectedConnector, refreshActivityFeed);
  const { workflowPreviewPanel } = useWorkflowPreview(
    apiBaseUrl,
    selectedWorkflowAction,
    refreshActivityFeed
  );
  const {
    applyActivityEventPrompt,
    applyConnectorPrompt,
    applyTemplatePrompt,
    applyWorkflowActionPrompt,
    restoreSessionHistory,
    selectSessionHistory,
    switchModelRoute,
    updateApprovalStatus,
    updateConnectorPreviewDecision,
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
    setSelectedConnectorId,
    setSelectedContextId,
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
  const applyConnectorAndOpenAssistant = openAssistantAfter(applyConnectorPrompt);
  const applyEventAndOpenAssistant = openAssistantAfter(applyActivityEventPrompt);
  const restoreSessionAndOpenAssistant = openAssistantAfter(restoreSessionHistory);
  const useContextAndOpenAssistant = openAssistantAfter(useContextItem);

  const primaryViews: DailyWorkViewConfig[] = [
    {
      id: "assistant",
      label: "对话工作台",
      description: "保留真正高频的写作、归纳和追问，其他能力移到独立模块。",
      icon: <MessageSquare className="size-4" aria-hidden="true" />,
      badge: statusLabel(status)
    },
    {
      id: "templates",
      label: "模板库",
      description: "从固定工作模式开始，不让模板列表挤占聊天区。",
      icon: <Wand2 className="size-4" aria-hidden="true" />,
      badge: String(templateItems.length)
    },
    {
      id: "knowledge",
      label: "上下文",
      description: "管理可引用的会话知识、资料上传和数据层状态。",
      icon: <Database className="size-4" aria-hidden="true" />,
      badge: String(contextPanelItems.length)
    },
    {
      id: "workflows",
      label: "工作流",
      description: "预演自动化动作，把流程编排从聊天主屏拆出来。",
      icon: <Workflow className="size-4" aria-hidden="true" />,
      badge: String(filteredWorkflowActions.length)
    },
    {
      id: "artifacts",
      label: "产物",
      description: "把文档、摘要和可复用成果放到独立资产视图。",
      icon: <FileText className="size-4" aria-hidden="true" />,
      badge: String(filteredArtifacts.length)
    },
    {
      id: "sessions",
      label: "历史",
      description: "恢复最近会话和工作流，不塞在当前对话下方。",
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
      id: "connectors",
      label: "连接器",
      description: "集中查看外部系统授权、权限状态和调用预览。",
      icon: <Globe className="size-4" aria-hidden="true" />,
      badge: String(filteredConnectors.length)
    },
    {
      id: "approvals",
      label: "审批与权限",
      description: "把风险决策和模式快照收束在治理视图。",
      icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      badge: String(approvalRequests.length)
    },
    {
      id: "activity",
      label: "活动审计",
      description: "查看实时事件流、同步来源和最近状态。",
      icon: <Activity className="size-4" aria-hidden="true" />,
      badge: String(activityFeedEvents.length)
    }
  ];

  const isSettingsView = settingsViews.some((view) => view.id === activeView);
  const selectedContextTitle = selectedContextId
    ? selectedContextItem?.title ??
      selectedContextLabel(selectedContextId, contextPanelItems)
    : null;
  const sidebarConversationItems = sessionHistoryPanelItems.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    status: item.status,
    updatedAt: item.updatedAt,
    messageCount: item.messageCount
  }));

  const selectSidebarConversation = (conversationId: string) => {
    const conversation = sessionHistoryPanelItems.find(
      (item) => item.id === conversationId
    );

    if (conversation) {
      selectSessionHistory(conversation);
    }

    setActiveView("assistant");
  };

  return (
    <DailyWorkDashboardShell
      activeConversationId={activeView === "assistant" ? selectedSessionHistoryId : null}
      activeView={activeView}
      conversationItems={sidebarConversationItems}
      primaryViews={primaryViews}
      settingsViews={settingsViews}
      onConversationSelect={selectSidebarConversation}
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
                modelInputPlaceholder={modelInputPlaceholder}
                selectedContextTitle={selectedContextTitle}
                selectedTemplateTitle={selectedTemplate?.title ?? null}
                status={status}
                onApplyPrompt={applyPrompt}
                onCancelRequest={cancelRequest}
                onDismissError={() => setError(null)}
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
                  {activeView === "connectors" ? (
                    <ConnectorDirectoryPanel
                      connectorFilter={connectorFilter}
                      connectorPreviewPanel={connectorPreviewPanel}
                      filteredConnectors={filteredConnectors}
                      googleConnectorStatus={googleConnectorStatus}
                      googleOAuthStartNotice={googleOAuthStartNotice}
                      googleOAuthStartStatus={googleOAuthStartStatus}
                      microsoftConnectorStatus={microsoftConnectorStatus}
                      microsoftOAuthStartNotice={microsoftOAuthStartNotice}
                      microsoftOAuthStartStatus={microsoftOAuthStartStatus}
                      selectedConnector={selectedConnector}
                      selectedConnectorApprovalRequests={selectedConnectorApprovalRequests}
                      selectedConnectorPreviewStatus={selectedConnectorPreviewStatus}
                      onApplyConnectorPrompt={applyConnectorAndOpenAssistant}
                      onFilterChange={setConnectorFilter}
                      onRefreshGoogleStatus={() => {
                        void refreshGoogleConnectorStatus();
                      }}
                      onRefreshMicrosoftStatus={() => {
                        void refreshMicrosoftConnectorStatus();
                      }}
                      onSelectConnector={setSelectedConnectorId}
                      onStartGoogleOAuth={startGoogleOAuth}
                      onStartMicrosoftOAuth={startMicrosoftOAuth}
                      onUpdateConnectorPreviewDecision={updateConnectorPreviewDecision}
                    />
                  ) : null}

                  {activeView === "approvals" ? (
                    <>
                      <ApprovalLedgerPanel
                        approvalPanel={approvalPanel}
                        approvalRequests={approvalRequests}
                        onUpdateApprovalStatus={updateApprovalStatus}
                      />
                      <ModeSnapshotPanel approvalCount={approvalRequests.length} />
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
  );
}
