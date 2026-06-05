"use client";
import type {
  FormEvent
} from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
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
import type {
  ChatStatus,
  ChatMessage,
  TemplateItem,
  DailyWorkTemplateApplyPreviewResponseDto,
  TemplatePreviewPanelState,
  SessionHistoryFilter,
  SessionHistoryItem,
  DailyWorkSessionRestorePreviewResponseDto,
  SessionRestorePreviewPanelState,
  ArtifactFilter,
  ContextItem,
  DailyContextUsePreviewResponseDto,
  ContextPreviewPanelState,
  ConnectorFilter,
  ConnectorItem,
  WorkflowActionFilter,
  WorkflowActionItem,
  ActivityEventItem,
  ApprovalStatus,
  ModelRouteMode,
  DailyApprovalDecisionResponseDto
} from "../types";
import {
  activeMode,
  createLocalTemplatePreviewState,
  mapTemplatePreviewResponse,
  sessionHistoryItems,
  createLocalSessionRestorePreviewState,
  mapSessionRestorePreviewResponse,
  createLocalContextPreviewState,
  mapContextUsePreviewResponse,
  connectorItems,
  workflowActions,
  activityEvents,
  artifacts,
  initialMessages,
  getRuntimeApiBaseUrl,
  readAssistantResponse,
  formatChatError,
  statusLabel,
  connectorPreviewApprovalStatus,
  mapApprovalDecisionStatus,
  connectorMatchesFilter,
  selectedContextLabel,
  buildModelSwitchPrompt,
  buildConnectorAccessPrompt,
  buildWorkflowPreviewPrompt,
  buildActivityEventPrompt
} from "../domain";

import { ChatThread } from "../chat/components/ChatThread";
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
} from "../hooks/useDailyWorkPanels";
import {
  PanelHeader,
  PromptCard,
  PersistenceStatusPanel
} from "./DailyWorkPrimitives";
import { ActivityFeedPanel } from "./panels/ActivityFeedPanel";
import { ApprovalLedgerPanel } from "./panels/ApprovalLedgerPanel";
import { ArtifactPanel } from "./panels/ArtifactPanel";
import { ConnectorDirectoryPanel } from "./panels/ConnectorDirectoryPanel";
import { ContextPanel } from "./panels/ContextPanel";
import { ModeSnapshotPanel } from "./panels/ModeSnapshotPanel";
import { ModelUsagePanel } from "./panels/ModelUsagePanel";
import { SessionHistoryPanel } from "./panels/SessionHistoryPanel";
import { TemplateLibraryPanel } from "./panels/TemplateLibraryPanel";
import { WorkflowPreviewPanel } from "./panels/WorkflowPreviewPanel";

export function DailyWorkDashboard() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState<string | null>(
    null
  );
  const [sessionHistoryFilter, setSessionHistoryFilter] =
    useState<SessionHistoryFilter>("全部");
  const [selectedSessionHistoryId, setSelectedSessionHistoryId] = useState<
    string | null
  >(sessionHistoryItems[0]?.id ?? null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [connectorFilter, setConnectorFilter] = useState<ConnectorFilter>("全部");
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    connectorItems[0]?.id ?? null
  );
  const [workflowActionFilter, setWorkflowActionFilter] =
    useState<WorkflowActionFilter>("全部");
  const [selectedWorkflowActionId, setSelectedWorkflowActionId] = useState<
    string | null
  >(workflowActions[0]?.id ?? null);
  const [selectedActivityEventId, setSelectedActivityEventId] = useState<
    string | null
  >(activityEvents[0]?.id ?? null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    artifacts[0]?.id ?? null
  );
  const [artifactFilter, setArtifactFilter] = useState<ArtifactFilter>("全部");
  const [modelRouteMode, setModelRouteMode] = useState<ModelRouteMode>("fast");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isBusy = status === "submitting" || status === "streaming";
  const apiBaseUrl = useMemo(() => getRuntimeApiBaseUrl().replace(/\/$/, ""), []);
  const endpoint = useMemo(
    () => `${apiBaseUrl}/api/chat`,
    [apiBaseUrl]
  );
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
  const selectedContextItem = useMemo(
    () =>
      contextPanelItems.find((item) => item.id === selectedContextId) ?? null,
    [contextPanelItems, selectedContextId]
  );
  const filteredConnectors = useMemo(
    () =>
      connectorFilter === "全部"
        ? connectorItems
        : connectorItems.filter((item) =>
            connectorMatchesFilter(item, connectorFilter)
          ),
    [connectorFilter]
  );
  const selectedConnector = useMemo(() => {
    const selectedInFilter = filteredConnectors.find(
      (connector) => connector.id === selectedConnectorId
    );

    return selectedInFilter ?? filteredConnectors[0] ?? connectorItems[0] ?? null;
  }, [filteredConnectors, selectedConnectorId]);
  const selectedConnectorApprovalRequests = useMemo(() => {
    if (!selectedConnector) {
      return [];
    }

    return approvalRequests.filter((request) =>
      selectedConnector.requiredApprovalIds.includes(request.id)
    );
  }, [approvalRequests, selectedConnector]);
  const { connectorPreviewPanel, setConnectorPreviewPanel } =
    useConnectorPreview(apiBaseUrl, selectedConnector);

  const selectedConnectorPreviewStatus = useMemo(
    () =>
      connectorPreviewApprovalStatus(
        selectedConnector,
        selectedConnectorApprovalRequests
      ),
    [selectedConnector, selectedConnectorApprovalRequests]
  );
  const filteredWorkflowActions = useMemo(
    () =>
      workflowActionFilter === "全部"
        ? workflowActions
        : workflowActions.filter(
            (item) => item.approvalStatus === workflowActionFilter
          ),
    [workflowActionFilter]
  );
  const selectedWorkflowAction = useMemo(() => {
    const selectedInFilter = filteredWorkflowActions.find(
      (item) => item.id === selectedWorkflowActionId
    );

    return selectedInFilter ?? filteredWorkflowActions[0] ?? workflowActions[0] ?? null;
  }, [filteredWorkflowActions, selectedWorkflowActionId]);
  const { workflowPreviewPanel } = useWorkflowPreview(
    apiBaseUrl,
    selectedWorkflowAction
  );

  const selectedActivityEvent = useMemo(
    () =>
      activityFeedEvents.find((event) => event.id === selectedActivityEventId) ??
      activityFeedEvents[0] ??
      null,
    [activityFeedEvents, selectedActivityEventId]
  );
  const artifactItems = artifactPanel.items;
  const filteredArtifacts = useMemo(
    () =>
      artifactFilter === "全部"
        ? artifactItems
        : artifactItems.filter((artifact) => artifact.state === artifactFilter),
    [artifactFilter, artifactItems]
  );
  const selectedArtifact = useMemo(() => {
    const selectedInFilter = filteredArtifacts.find(
      (artifact) => artifact.id === selectedArtifactId
    );

    return selectedInFilter ?? filteredArtifacts[0] ?? artifactItems[0] ?? null;
  }, [artifactItems, filteredArtifacts, selectedArtifactId]);
  const sessionHistoryPanelItems = sessionHistoryPanel.items;
  const filteredSessionHistory = useMemo(
    () =>
      sessionHistoryFilter === "全部"
        ? sessionHistoryPanelItems
        : sessionHistoryPanelItems.filter(
            (item) => item.status === sessionHistoryFilter
          ),
    [sessionHistoryFilter, sessionHistoryPanelItems]
  );
  const selectedSessionHistory = useMemo(() => {
    const selectedInFilter = filteredSessionHistory.find(
      (item) => item.id === selectedSessionHistoryId
    );

    return selectedInFilter ?? filteredSessionHistory[0] ?? sessionHistoryPanelItems[0] ?? null;
  }, [filteredSessionHistory, selectedSessionHistoryId, sessionHistoryPanelItems]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = input.trim();
    if (!prompt) {
      return;
    }

    await submitPrompt(prompt);
  }

  async function submitPrompt(prompt: string) {
    if (!prompt || isBusy) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: ""
    };
    const controller = new AbortController();
    const nextMessages = [...messages, userMessage];
    let receivedContent = "";

    abortRef.current = controller;
    setInput("");
    setError(null);
    setLastSubmittedPrompt(prompt);
    setStatus("submitting");
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: activeMode,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(await formatChatError(response));
      }

      setStatus("streaming");
      await readAssistantResponse(response, (delta) => {
        receivedContent += delta;
        appendAssistantDelta(assistantMessage.id, delta);
      });

      if (!receivedContent.trim()) {
        setAssistantMessageContent(
          assistantMessage.id,
          "后端返回了空响应。请补充上下文后重试，或检查当前模型服务是否可用。"
        );
      }

      setStatus("idle");
    } catch (requestError) {
      if (controller.signal.aborted) {
        appendAssistantDelta(
          assistantMessage.id,
          receivedContent.trim() ? "\n\n已停止生成。" : "已停止生成。"
        );
        setStatus("idle");
      } else {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "发送请求时出现未知错误。";

        setError(message);
        setStatus("error");
        if (receivedContent.trim()) {
          appendAssistantDelta(assistantMessage.id, `\n\n请求中断：${message}`);
        } else {
          setAssistantMessageContent(
            assistantMessage.id,
            `请求没有完成。\n\n${message}`
          );
        }
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  function appendAssistantDelta(messageId: string, delta: string) {
    if (!delta) {
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, content: `${message.content}${delta}` }
          : message
      )
    );
  }

  function setAssistantMessageContent(messageId: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, content } : message
      )
    );
  }

  function cancelRequest() {
    abortRef.current?.abort();
  }

  function applyPrompt(prompt: string) {
    setError(null);
    setInput(prompt);
    inputRef.current?.focus();
  }

  async function applyTemplatePrompt(template: TemplateItem) {
    if (!template.enabled) {
      return;
    }

    const pendingPreview = createLocalTemplatePreviewState(
      template,
      "syncing",
      "正在请求 /api/daily/templates/:templateId/apply-preview，成功后会把后端 promptDraft 填入输入框。"
    );

    setTemplatePanel((current) => ({
      ...current,
      preview: pendingPreview
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/templates/${template.id}/apply-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Template apply-preview failed: ${response.status}`);
      }

      const preview = mapTemplatePreviewResponse(
        template,
        (await response.json()) as DailyWorkTemplateApplyPreviewResponseDto
      );

      applyPrompt(preview.promptDraft);
      setTemplatePanel((current) => ({
        ...current,
        preview
      }));
    } catch {
      const fallbackPreview: TemplatePreviewPanelState = {
        ...createLocalTemplatePreviewState(
          template,
          "degraded",
          "暂未从后端生成 template apply-preview，已回退到本地 preview-only 模板提示。"
        ),
        source: "degraded"
      };

      applyPrompt(fallbackPreview.promptDraft);
      setTemplatePanel((current) => ({
        ...current,
        preview: fallbackPreview
      }));
    }
  }

  function retryLastPrompt() {
    if (!lastSubmittedPrompt || isBusy) {
      return;
    }

    void submitPrompt(lastSubmittedPrompt);
  }

  function selectSessionHistory(item: SessionHistoryItem) {
    setSelectedSessionHistoryId(item.id);
    setSessionHistoryPanel((current) => ({
      ...current,
      restorePreview: createLocalSessionRestorePreviewState(item)
    }));
  }

  async function restoreSessionHistory(item: SessionHistoryItem) {
    setSelectedSessionHistoryId(item.id);
    setSessionHistoryPanel((current) => ({
      ...current,
      restorePreview: createLocalSessionRestorePreviewState(
        item,
        "syncing",
        "正在请求 /api/daily/sessions/:sessionId/restore-preview，成功后会把后端 restorePrompt 填入输入框。"
      )
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/sessions/${item.id}/restore-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode,
            includeRecentMessages: true
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Session restore preview failed: ${response.status}`);
      }

      const restorePreview = mapSessionRestorePreviewResponse(
        item,
        (await response.json()) as DailyWorkSessionRestorePreviewResponseDto
      );

      applyPrompt(restorePreview.restorePrompt);
      setSessionHistoryPanel((current) => ({
        ...current,
        restorePreview
      }));
    } catch {
      const fallbackPreview: SessionRestorePreviewPanelState = {
        ...createLocalSessionRestorePreviewState(
          item,
          "degraded",
          "暂未从后端生成 restore-preview，已回退到本地 preview-only 恢复提示。"
        ),
        source: "degraded"
      };

      applyPrompt(fallbackPreview.restorePrompt);
      setSessionHistoryPanel((current) => ({
        ...current,
        restorePreview: fallbackPreview
      }));
    }
  }

  async function useContextItem(item: ContextItem) {
    setSelectedContextId(item.id);
    setContextPanel((current) => ({
      ...current,
      preview: createLocalContextPreviewState(
        item,
        "syncing",
        "正在请求 /api/daily/context/:contextItemId/use-preview，成功后会把后端 promptDraft 填入输入框。"
      )
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/context/${item.id}/use-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Context use-preview failed: ${response.status}`);
      }

      const preview = mapContextUsePreviewResponse(
        item,
        (await response.json()) as DailyContextUsePreviewResponseDto
      );

      applyPrompt(preview.promptDraft);
      setContextPanel((current) => ({
        ...current,
        preview
      }));
    } catch {
      const fallbackPreview: ContextPreviewPanelState = {
        ...createLocalContextPreviewState(
          item,
          "degraded",
          "暂未从后端生成 context use-preview，已回退到本地 preview-only 上下文提示。"
        ),
        source: "degraded"
      };

      applyPrompt(fallbackPreview.promptDraft);
      setContextPanel((current) => ({
        ...current,
        preview: fallbackPreview
      }));
    }
  }

  function applyConnectorPrompt(item: ConnectorItem) {
    setSelectedConnectorId(item.id);
    applyPrompt(buildConnectorAccessPrompt(item));
  }

  function applyWorkflowActionPrompt(item: WorkflowActionItem) {
    setSelectedWorkflowActionId(item.id);
    const panelMatches =
      workflowPreviewPanel.workflowId === item.apiWorkflowId &&
      workflowPreviewPanel.actionId === item.apiActionId;

    applyPrompt(
      panelMatches
        ? buildWorkflowPreviewPrompt(item, workflowPreviewPanel)
        : item.prompt
    );
  }

  function applyActivityEventPrompt(item: ActivityEventItem) {
    setSelectedActivityEventId(item.id);
    applyPrompt(buildActivityEventPrompt(item));
  }

  function switchModelRoute(nextMode: ModelRouteMode) {
    setModelRouteMode(nextMode);
    applyPrompt(
      buildModelSwitchPrompt(
        modelUsagePanel.modelSnapshots[nextMode],
        modelUsagePanel.usageSnapshots[nextMode]
      )
    );
  }

  async function updateApprovalStatus(
    approvalId: string,
    nextStatus: Exclude<ApprovalStatus, "waiting">
  ) {
    const applyLocalStatus = () => {
      setApprovalPanel((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === approvalId ? { ...item, status: nextStatus } : item
        )
      }));
    };

    applyLocalStatus();
    setApprovalPanel((current) => ({
      ...current,
      syncStatus: "syncing",
      notice:
        "正在向 /api/daily/approvals/:approvalRequestId/decision 写入 preview-only 审批决策。"
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/approvals/${approvalId}/decision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: activeMode,
            decision: nextStatus === "denied" ? "deny" : "approved",
            reason: `Preview decision from approval ledger for ${approvalId}.`
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Approval decision failed: ${response.status}`);
      }

      const payload = (await response.json()) as DailyApprovalDecisionResponseDto;

      setApprovalPanel((current) => ({
        ...current,
        source: "api",
        syncStatus: "live",
        items: current.items.map((item) =>
          item.id === approvalId
            ? { ...item, status: mapApprovalDecisionStatus(payload) }
            : item
        ),
        notice:
          "已从 /api/daily/approvals/:approvalRequestId/decision 返回 preview-only 决策；externalEffects=['none']。"
      }));
    } catch {
      applyLocalStatus();
      setApprovalPanel((current) => ({
        ...current,
        source: "degraded",
        syncStatus: "degraded",
        notice:
          "审批 decision API 暂不可用；已保留本地 preview-only 决策状态。"
      }));
    }
  }

  async function updateConnectorPreviewDecision(
    connector: ConnectorItem,
    nextStatus: Exclude<ApprovalStatus, "waiting">
  ) {
    if (connector.requiredApprovalIds.length === 0) {
      return;
    }

    const applyLocalStatus = () => {
      setApprovalPanel((current) => ({
        ...current,
        items: current.items.map((item) =>
          connector.requiredApprovalIds.includes(item.id)
            ? { ...item, status: nextStatus }
            : item
        )
      }));
    };

    applyLocalStatus();
    setConnectorPreviewPanel((current) =>
      current.connectorId === connector.apiConnectorId
        ? {
            ...current,
            syncStatus: "syncing",
            notice: "正在向审批 decision API 写入 preview-only 决策。"
          }
        : current
    );

    try {
      const decision = nextStatus === "denied" ? "deny" : "approved";
      const responses = await Promise.all(
        connector.requiredApprovalIds.map(async (approvalId) => {
          const response = await fetch(
            `${apiBaseUrl}/api/daily/approvals/${approvalId}/decision`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                mode: activeMode,
                decision,
                reason: `Preview decision from ${connector.name}.`
              })
            }
          );

          if (!response.ok) {
            throw new Error(`Approval decision failed: ${response.status}`);
          }

          return (await response.json()) as DailyApprovalDecisionResponseDto;
        })
      );

      setApprovalPanel((current) => ({
        ...current,
        source: "api",
        syncStatus: "live",
        items: current.items.map((item) => {
          const response = responses.find(
            (entry) => entry.request?.id === item.id
          );

          return response
            ? { ...item, status: mapApprovalDecisionStatus(response) }
            : item;
        }),
        notice:
          "已从 /api/daily/approvals/:approvalRequestId/decision 同步连接器关联审批结果。"
      }));
      setConnectorPreviewPanel((current) =>
        current.connectorId === connector.apiConnectorId
          ? {
              ...current,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/approvals/:approvalRequestId/decision 返回 preview-only 审批结果。"
            }
          : current
      );
    } catch {
      applyLocalStatus();
      setConnectorPreviewPanel((current) =>
        current.connectorId === connector.apiConnectorId
          ? {
              ...current,
              source: "degraded",
              syncStatus: "degraded",
              notice:
                "审批 decision API 暂不可用；已保留本地 preview-only 决策状态。"
            }
          : current
      );
    }
  }

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
