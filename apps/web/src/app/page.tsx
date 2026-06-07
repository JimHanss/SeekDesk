"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Bot,
  Database,
  FileText,
  Globe,
  Mail,
  MessageSquare,
  PanelLeft,
  Play,
  Presentation,
  Search,
  Send,
  ShieldCheck,
  Square,
  Sparkles,
  Wand2,
  Workflow
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getRuntimeApiBaseUrl,
  selectedContextLabel,
  statusLabel
} from "@/features/daily-work/domain";

import { ChatThread } from "@/features/daily-work/chat/components/ChatThread";
import { useChatController } from "@/features/daily-work/chat/hooks/useChatController";
import {
  useActivityFeed,
  useApprovalLedger,
  useArtifacts,
  useConnectorPreview,
  useDailyContext,
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
import {
  PanelHeader,
  PromptCard,
  PersistenceStatusPanel
} from "@/features/daily-work/components/DailyWorkPrimitives";
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

type DailyWorkView =
  | "assistant"
  | "templates"
  | "knowledge"
  | "workflows"
  | "connectors"
  | "artifacts"
  | "approvals"
  | "activity"
  | "sessions"
  | "models";

interface ViewConfig {
  id: DailyWorkView;
  label: string;
  description: string;
  icon: ReactNode;
  badge?: string;
}

export default function Page() {
  const [activeView, setActiveView] = useState<DailyWorkView>("assistant");
  const selectionState = useDailyWorkSelectionState();
  const {
    artifactFilter,
    connectorFilter,
    modelRouteMode,
    selectedArtifactId,
    selectedContextId,
    selectedSessionHistoryId,
    sessionHistoryFilter,
    setArtifactFilter,
    setConnectorFilter,
    setModelRouteMode,
    setSelectedActivityEventId,
    setSelectedArtifactId,
    setSelectedConnectorId,
    setSelectedContextId,
    setSelectedSessionHistoryId,
    setSelectedWorkflowActionId,
    setSessionHistoryFilter,
    setWorkflowActionFilter,
    workflowActionFilter
  } = selectionState;

  const apiBaseUrl = useMemo(() => getRuntimeApiBaseUrl().replace(/\/$/, ""), []);
  const {
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
  } = useChatController({ apiBaseUrl });
  const { templatePanel, setTemplatePanel } = useTemplatePanel(apiBaseUrl);
  const { contextPanel, setContextPanel } = useDailyContext(
    apiBaseUrl,
    setSelectedContextId
  );
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
  const { modelUsagePanel } = useModelUsagePanel(apiBaseUrl);
  const { persistencePanel } = usePersistencePanel(apiBaseUrl);
  const {
    activityConnectionStatus,
    activityFeedEvents,
    activityFeedNotice,
    activityFeedSource,
    activityLastUpdated,
    refreshActivityFeed
  } = useActivityFeed(apiBaseUrl, setSelectedActivityEventId);

  const activeModelSnapshot = modelUsagePanel.modelSnapshots[modelRouteMode];
  const modelInputPlaceholder =
    modelRouteMode === "fast"
      ? "例如：帮我写一封客户更新邮件，整理当前结果、时间线、风险和下一步。"
      : "例如：归纳这批资料，复核风险并列出还需要补充的上下文。";
  const templateItems = templatePanel.items;
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

  const views: ViewConfig[] = [
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
      badge: `${templateItems.length}`
    },
    {
      id: "knowledge",
      label: "上下文",
      description: "管理可引用的会话知识、数据层和同步状态。",
      icon: <Database className="size-4" aria-hidden="true" />,
      badge: `${contextPanelItems.length}`
    },
    {
      id: "workflows",
      label: "工作流",
      description: "预演自动化动作，把流程编排从聊天主屏拆出来。",
      icon: <Workflow className="size-4" aria-hidden="true" />,
      badge: `${filteredWorkflowActions.length}`
    },
    {
      id: "connectors",
      label: "连接器",
      description: "集中查看外部系统目录、权限状态和调用预览。",
      icon: <Globe className="size-4" aria-hidden="true" />,
      badge: `${filteredConnectors.length}`
    },
    {
      id: "artifacts",
      label: "产物",
      description: "把文档、摘要和可复用成果放到独立资产视图。",
      icon: <FileText className="size-4" aria-hidden="true" />,
      badge: `${filteredArtifacts.length}`
    },
    {
      id: "approvals",
      label: "审批",
      description: "把风险决策和模式快照收束在治理视图。",
      icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      badge: `${approvalRequests.length}`
    },
    {
      id: "activity",
      label: "活动",
      description: "查看实时事件流、同步来源和最近状态。",
      icon: <Activity className="size-4" aria-hidden="true" />,
      badge: `${activityFeedEvents.length}`
    },
    {
      id: "sessions",
      label: "历史",
      description: "恢复最近会话和工作流，不塞在当前对话下方。",
      icon: <PanelLeft className="size-4" aria-hidden="true" />,
      badge: `${filteredSessionHistory.length}`
    },
    {
      id: "models",
      label: "模型",
      description: "查看模型路由、用量预算和同步状态。",
      icon: <Bot className="size-4" aria-hidden="true" />,
      badge: modelRouteMode === "fast" ? "快速" : "深度"
    }
  ];

  const currentView = views.find((view) => view.id === activeView) ?? views[0]!;

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-slate-100 px-3 py-3 text-slate-950 md:px-4"
      data-daily-active-view={activeView}
    >
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1440px] overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_18px_70px_rgba(15,23,42,0.12)] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-950 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-teal-500 text-white shadow-sm">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-semibold tracking-normal">
                SeekDesk
              </h1>
              <p className="truncate text-xs text-slate-300">Daily AI workspace</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:border-t-0">
            {views.map((view) => {
              const isActive = activeView === view.id;

              return (
                <button
                  key={view.id}
                  type="button"
                  data-daily-view-nav={view.id}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActiveView(view.id)}
                  className={cn(
                    "flex min-w-[148px] cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300 lg:min-w-0",
                    isActive
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-[8px]",
                      isActive ? "bg-teal-50 text-teal-700" : "bg-white/10"
                    )}
                  >
                    {view.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{view.label}</span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[11px]",
                        isActive ? "text-slate-500" : "text-slate-400"
                      )}
                    >
                      {view.description}
                    </span>
                  </span>
                  {view.badge ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
                        isActive
                          ? "bg-slate-100 text-slate-600"
                          : "bg-white/10 text-slate-300"
                      )}
                    >
                      {view.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-h-0 flex-col bg-slate-50">
          <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-teal-700">
                  <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-teal-50">
                    {currentView.icon}
                  </span>
                  <span>daily_work</span>
                </div>
                <h2 className="mt-2 break-words font-heading text-2xl font-semibold tracking-normal text-slate-950">
                  {currentView.label}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  {currentView.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveView("knowledge")}
                >
                  <Search className="size-4" aria-hidden="true" />
                  上下文
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveView("templates")}
                >
                  <Wand2 className="size-4" aria-hidden="true" />
                  模板
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={() => setActiveView("workflows")}
                >
                  <Play className="size-4" aria-hidden="true" />
                  新建流程
                </Button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-5 md:py-4">
            {activeView === "assistant" ? (
              <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <PromptCard
                    icon={<Mail className="size-4" aria-hidden="true" />}
                    title="客户更新"
                    text="帮我写一封客户更新邮件，交代当前结果、时间线、风险和下一步。"
                    onClick={applyPrompt}
                  />
                  <PromptCard
                    icon={<Presentation className="size-4" aria-hidden="true" />}
                    title="会议纪要"
                    text="把这些会议记录整理成可分享的纪要，标出决策、负责人、风险和待补信息。"
                    onClick={applyPrompt}
                  />
                  <PromptCard
                    icon={<Search className="size-4" aria-hidden="true" />}
                    title="研究简报"
                    text="把最新资料整理成一页简报，区分已知信息、信息缺口和建议下一步。"
                    onClick={applyPrompt}
                  />
                </div>

                <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white">
                  <PanelHeader
                    icon={<MessageSquare className="size-4" aria-hidden="true" />}
                    title="日常工作助手"
                    action={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="停止当前回复"
                        disabled={!isBusy}
                        onClick={cancelRequest}
                      >
                        <Square className="size-4" aria-hidden="true" />
                      </Button>
                    }
                  />

                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4">
                    <ChatThread
                      endpoint={endpoint}
                      error={error}
                      lastSubmittedPrompt={lastSubmittedPrompt}
                      messages={messages}
                      messagesEndRef={messagesEndRef}
                      modelName={activeModelSnapshot.selectedModel}
                      onDismissError={() => setError(null)}
                      onRetry={retryLastPrompt}
                      status={status}
                    />
                  </div>

                  <form
                    className="border-t border-slate-200 bg-white p-3 md:p-4"
                    onSubmit={handleSubmit}
                  >
                    <div className="flex min-h-16 items-end gap-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2 shadow-inner focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                      <textarea
                        ref={inputRef}
                        className="max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-slate-950 outline-none placeholder:text-slate-400"
                        placeholder={modelInputPlaceholder}
                        aria-label="输入日常工作请求"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        disabled={isBusy}
                        rows={1}
                      />
                      <Button
                        size="sm"
                        type="submit"
                        disabled={!input.trim() || isBusy}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        {isBusy ? (
                          <Sparkles
                            className="size-4 animate-pulse"
                            aria-hidden="true"
                          />
                        ) : (
                          <Send className="size-4" aria-hidden="true" />
                        )}
                        {status === "submitting"
                          ? "连接中"
                          : status === "streaming"
                            ? "接收中"
                            : "发送"}
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>接口: {endpoint}</span>
                      <span>模型: {activeModelSnapshot.selectedModel}</span>
                      <span>状态: {statusLabel(status)}</span>
                      {selectedContextId ? (
                        <span>
                          上下文:{" "}
                          {selectedContextItem?.title ??
                            selectedContextLabel(
                              selectedContextId,
                              contextPanelItems
                            )}
                        </span>
                      ) : null}
                    </div>
                  </form>
                </section>
              </div>
            ) : null}

            {activeView === "templates" ? (
              <ModuleStack>
                <TemplateLibraryPanel
                  templateItems={templateItems}
                  templatePanel={templatePanel}
                  onApplyTemplate={applyTemplateAndOpenAssistant}
                />
              </ModuleStack>
            ) : null}

            {activeView === "knowledge" ? (
              <ModuleStack>
                <PersistenceStatusPanel state={persistencePanel} />
                <ContextPanel
                  contextItems={contextPanelItems}
                  contextPanel={contextPanel}
                  selectedContextId={selectedContextId}
                  onUseContextItem={useContextAndOpenAssistant}
                />
              </ModuleStack>
            ) : null}

            {activeView === "workflows" ? (
              <ModuleStack>
                <WorkflowPreviewPanel
                  filter={workflowActionFilter}
                  filteredActions={filteredWorkflowActions}
                  previewPanel={workflowPreviewPanel}
                  selectedAction={selectedWorkflowAction}
                  onApplyWorkflowActionPrompt={applyWorkflowAndOpenAssistant}
                  onFilterChange={setWorkflowActionFilter}
                  onSelectAction={setSelectedWorkflowActionId}
                />
              </ModuleStack>
            ) : null}

            {activeView === "connectors" ? (
              <ModuleStack>
                <ConnectorDirectoryPanel
                  connectorFilter={connectorFilter}
                  connectorPreviewPanel={connectorPreviewPanel}
                  filteredConnectors={filteredConnectors}
                  selectedConnector={selectedConnector}
                  selectedConnectorApprovalRequests={selectedConnectorApprovalRequests}
                  selectedConnectorPreviewStatus={selectedConnectorPreviewStatus}
                  onApplyConnectorPrompt={applyConnectorAndOpenAssistant}
                  onFilterChange={setConnectorFilter}
                  onSelectConnector={setSelectedConnectorId}
                  onUpdateConnectorPreviewDecision={updateConnectorPreviewDecision}
                />
              </ModuleStack>
            ) : null}

            {activeView === "artifacts" ? (
              <ModuleStack>
                <ArtifactPanel
                  artifactFilter={artifactFilter}
                  artifactItems={artifactItems}
                  artifactPanel={artifactPanel}
                  filteredArtifacts={filteredArtifacts}
                  selectedArtifact={selectedArtifact}
                  onFilterChange={setArtifactFilter}
                  onSelectArtifact={setSelectedArtifactId}
                />
              </ModuleStack>
            ) : null}

            {activeView === "approvals" ? (
              <ModuleStack>
                <ApprovalLedgerPanel
                  approvalPanel={approvalPanel}
                  approvalRequests={approvalRequests}
                  onUpdateApprovalStatus={updateApprovalStatus}
                />
                <ModeSnapshotPanel approvalCount={approvalRequests.length} />
              </ModuleStack>
            ) : null}

            {activeView === "activity" ? (
              <ModuleStack>
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
              </ModuleStack>
            ) : null}

            {activeView === "sessions" ? (
              <ModuleStack>
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
              </ModuleStack>
            ) : null}

            {activeView === "models" ? (
              <ModuleStack>
                <ModelUsagePanel
                  modelRouteMode={modelRouteMode}
                  modelUsagePanel={modelUsagePanel}
                  onSwitchModelRoute={switchModelRoute}
                />
              </ModuleStack>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function ModuleStack({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">{children}</div>;
}
