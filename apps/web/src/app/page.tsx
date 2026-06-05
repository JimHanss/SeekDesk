"use client";
import { useMemo } from "react";
import {
  Loader2,
  Mail,
  MessageSquare,
  PanelLeft,
  Play,
  Presentation,
  Search,
  Send,
  Square,
  Sparkles,
  Workflow
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getRuntimeApiBaseUrl,
  statusLabel,
  selectedContextLabel
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

export default function Page() {
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
  const { approvalPanel, setApprovalPanel } = useApprovalLedger(apiBaseUrl);
  const { sessionHistoryPanel, setSessionHistoryPanel } = useSessionHistory(
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
    activityLastUpdated
  } = useActivityFeed(apiBaseUrl, setSelectedActivityEventId);

  const activeModelSnapshot = modelUsagePanel.modelSnapshots[modelRouteMode];
  const modelInputPlaceholder =
    modelRouteMode === "fast"
      ? "快速模式示例：适合写客户更新、整理会议纪要、把笔记转成任务计划"
      : "深度模式示例：适合复杂资料归纳、风险复核和长上下文分析";
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
    useConnectorPreview(apiBaseUrl, selectedConnector);
  const { workflowPreviewPanel } = useWorkflowPreview(
    apiBaseUrl,
    selectedWorkflowAction
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

  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-4 text-teal-950 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[8px] border border-teal-100 bg-white shadow-[0_18px_70px_rgba(15,118,110,0.12)]">
        <header className="flex flex-col gap-4 border-b border-teal-100 bg-white/95 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-teal-600 text-white shadow-sm">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-xl font-semibold tracking-normal text-teal-950">
                SeekDesk
              </h1>
              <p className="truncate text-sm text-teal-700">
                日常工作模板、会话知识上下文与流式 AI 对话
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm">
              <Search className="size-4" aria-hidden="true" />
              搜索
            </Button>
            <Button variant="secondary" size="sm">
              <PanelLeft className="size-4" aria-hidden="true" />
              模板
            </Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
              <Play className="size-4" aria-hidden="true" />
              新建工作流
            </Button>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 bg-teal-50/40 lg:grid-cols-[304px_minmax(0,1fr)_336px]">
          <TemplateLibraryPanel
            templateItems={templateItems}
            templatePanel={templatePanel}
            onApplyTemplate={applyTemplatePrompt}
          />

          <section className="flex min-h-[680px] min-w-0 flex-col bg-white">
            <PanelHeader
              icon={<MessageSquare className="size-4" aria-hidden="true" />}
              title="日常工作对话"
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="取消任务"
                  disabled={!isBusy}
                  onClick={cancelRequest}
                >
                  <Square className="size-4" aria-hidden="true" />
                </Button>
              }
            />

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-4">
              <div className="grid gap-3 md:grid-cols-3">
                <PromptCard
                  icon={<Mail className="size-4" aria-hidden="true" />}
                  title="邮件起草"
                  text="帮我写一封给客户的更新邮件，包含结果、时间线和下一步。"
                  onClick={applyPrompt}
                />
                <PromptCard
                  icon={<Presentation className="size-4" aria-hidden="true" />}
                  title="会议纪要"
                  text="把这些会议记录整理成可分享纪要，包含决策、负责人和风险。"
                  onClick={applyPrompt}
                />
                <PromptCard
                  icon={<Search className="size-4" aria-hidden="true" />}
                  title="研究简报"
                  text="把最新资料整理成简报，指出已知信息、缺口和建议下一步。"
                  onClick={applyPrompt}
                />
              </div>

              <PersistenceStatusPanel state={persistencePanel} />

              <ModelUsagePanel
                modelRouteMode={modelRouteMode}
                modelUsagePanel={modelUsagePanel}
                onSwitchModelRoute={switchModelRoute}
              />

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

              <ActivityFeedPanel
                connectionStatus={activityConnectionStatus}
                events={activityFeedEvents}
                lastUpdated={activityLastUpdated}
                notice={activityFeedNotice}
                selectedEvent={selectedActivityEvent}
                source={activityFeedSource}
                onApplyEventPrompt={applyActivityEventPrompt}
                onSelectEvent={setSelectedActivityEventId}
              />

              <WorkflowPreviewPanel
                filter={workflowActionFilter}
                filteredActions={filteredWorkflowActions}
                previewPanel={workflowPreviewPanel}
                selectedAction={selectedWorkflowAction}
                onApplyWorkflowActionPrompt={applyWorkflowActionPrompt}
                onFilterChange={setWorkflowActionFilter}
                onSelectAction={setSelectedWorkflowActionId}
              />

              <SessionHistoryPanel
                filteredItems={filteredSessionHistory}
                filter={sessionHistoryFilter}
                panel={sessionHistoryPanel}
                panelItems={sessionHistoryPanelItems}
                selectedItem={selectedSessionHistory}
                onFilterChange={setSessionHistoryFilter}
                onRestoreItem={restoreSessionHistory}
                onSelectItem={selectSessionHistory}
              />

            </div>

            <form className="border-t border-teal-100 bg-white p-4" onSubmit={handleSubmit}>
              <div className="flex min-h-16 items-end gap-3 rounded-[8px] border border-teal-200 bg-white px-3 py-2 shadow-inner focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                <textarea
                  ref={inputRef}
                  className="max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-teal-950 outline-none placeholder:text-teal-500"
                  placeholder={modelInputPlaceholder}
                  aria-label="日常工作输入"
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
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
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
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-teal-600">
                <span>Endpoint: {endpoint}</span>
                <span>模式: daily_work</span>
                <span>状态: {statusLabel(status)}</span>
                {selectedContextId ? (
                  <span>
                    上下文:{" "}
                    {selectedContextItem?.title ??
                      selectedContextLabel(selectedContextId, contextPanelItems)}
                  </span>
                ) : null}
              </div>
            </form>
          </section>

          <aside className="border-t border-teal-100 bg-white lg:border-l lg:border-t-0">
            <PanelHeader
              icon={<Workflow className="size-4" aria-hidden="true" />}
              title="审批 / 上下文 / 产物"
            />
            <div className="space-y-4 px-3 pb-4 pt-3">
              <ApprovalLedgerPanel
                approvalPanel={approvalPanel}
                approvalRequests={approvalRequests}
                onUpdateApprovalStatus={updateApprovalStatus}
              />

              <ContextPanel
                contextItems={contextPanelItems}
                contextPanel={contextPanel}
                selectedContextId={selectedContextId}
                onUseContextItem={useContextItem}
              />

              <ConnectorDirectoryPanel
                connectorFilter={connectorFilter}
                connectorPreviewPanel={connectorPreviewPanel}
                filteredConnectors={filteredConnectors}
                selectedConnector={selectedConnector}
                selectedConnectorApprovalRequests={selectedConnectorApprovalRequests}
                selectedConnectorPreviewStatus={selectedConnectorPreviewStatus}
                onApplyConnectorPrompt={applyConnectorPrompt}
                onFilterChange={setConnectorFilter}
                onSelectConnector={setSelectedConnectorId}
                onUpdateConnectorPreviewDecision={updateConnectorPreviewDecision}
              />

              <ArtifactPanel
                artifactFilter={artifactFilter}
                artifactItems={artifactItems}
                artifactPanel={artifactPanel}
                filteredArtifacts={filteredArtifacts}
                selectedArtifact={selectedArtifact}
                onFilterChange={setArtifactFilter}
                onSelectArtifact={setSelectedArtifactId}
              />

              <ModeSnapshotPanel approvalCount={approvalRequests.length} />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
