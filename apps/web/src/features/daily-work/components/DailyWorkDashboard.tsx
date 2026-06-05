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
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Code2,
  Database,
  FileText,
  Globe,
  Loader2,
  Lock,
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
  Target,
  Wand2,
  Workflow
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  sessionHistoryFilters,
  sessionHistoryItems,
  createLocalSessionRestorePreviewState,
  mapSessionRestorePreviewResponse,
  createLocalContextPreviewState,
  mapContextUsePreviewResponse,
  connectorFilters,
  connectorItems,
  workflowActionFilters,
  workflowActions,
  activityEvents,
  artifactFilters,
  artifacts,
  initialMessages,
  getRuntimeApiBaseUrl,
  readAssistantResponse,
  formatChatError,
  statusLabel,
  approvalStatusLabel,
  connectorPreviewApprovalStatus,
  mapApprovalDecisionStatus,
  sessionHistoryFilterCount,
  sessionHistorySourceLabel,
  sessionHistorySyncStatusLabel,
  sessionRestorePreviewSourceLabel,
  sessionRestorePreviewSyncStatusLabel,
  templatePanelSourceLabel,
  templatePanelSyncStatusLabel,
  templatePreviewSourceLabel,
  templatePreviewSyncStatusLabel,
  approvalPanelSourceLabel,
  approvalPanelSyncStatusLabel,
  templateCategoryLabel,
  templateArtifactTypeLabel,
  formatSessionLinkList,
  formatSessionRecentMessagePreview,
  artifactFilterCount,
  connectorFilterCount,
  workflowActionFilterCount,
  connectorMatchesFilter,
  activityFeedSourceLabel,
  activityConnectionStatusLabel,
  contextPanelSourceLabel,
  contextPanelSyncStatusLabel,
  contextPreviewSourceLabel,
  contextPreviewSyncStatusLabel,
  selectedContextLabel,
  modelRouteLabel,
  modelUsageSyncStatusLabel,
  budgetStateLabel,
  budgetStatePercent,
  formatTokenCount,
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
  SessionStatusPill,
  PersistenceStatusPanel,
  SessionMetric,
  SnapshotRow,
  ArtifactStatePill,
  ConnectorPermissionPill,
  ConnectorRiskPill,
  WorkflowActionStatusPill,
  ActivityEventStatusPill,
  ArtifactDetailBlock,
  ArtifactDetailRow,
  StatusPill,
  InfoRow,
  StatusRow,
  ActivityFeedMeta
} from "./DailyWorkPrimitives";

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
  const activeUsageSnapshot = modelUsagePanel.usageSnapshots[modelRouteMode];
  const usageTotalTokens = activeUsageSnapshot.totalTokens;
  const usageBudgetPercent = budgetStatePercent(activeUsageSnapshot.budgetLevel);
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
          <aside className="border-b border-teal-100 bg-white lg:border-b-0 lg:border-r">
            <PanelHeader
              icon={<Wand2 className="size-4" aria-hidden="true" />}
              title="模板库"
            />
            <div
              className="space-y-3 px-3 pb-4 pt-3"
              data-template-panel
              data-template-source={templatePanel.source}
              data-template-sync-status={templatePanel.syncStatus}
              data-template-count={templateItems.length}
              data-template-preview-source={templatePanel.preview.source}
              data-template-preview-only={
                templatePanel.preview.previewOnly ? "true" : "false"
              }
              data-template-preview-status={templatePanel.preview.syncStatus}
              data-template-preview-external-effects={templatePanel.preview.externalEffects.join(
                ","
              )}
            >
              <div className="rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-3 text-sm text-teal-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="break-words font-medium text-teal-950">
                      日常工作模式
                    </div>
                    <div className="mt-1 text-xs leading-5 text-teal-700">
                      选择模板会先生成 preview-only 草稿，你可以继续补充上下文后再发送。
                    </div>
                  </div>
                  <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
                    {templateItems.length}
                  </span>
                </div>

                <div
                  className="mt-3 rounded-[8px] border border-teal-100 bg-white px-2.5 py-2 text-xs leading-5 text-teal-700"
                  data-template-panel-notice={templatePanel.notice}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="font-medium text-teal-950">
                      {templatePanelSourceLabel(templatePanel.source)}
                    </span>
                    <span>/</span>
                    <span>{templatePanelSyncStatusLabel(templatePanel.syncStatus)}</span>
                  </div>
                  <div className="mt-1 break-words">{templatePanel.notice}</div>
                </div>

                <div
                  className="mt-2 rounded-[8px] border border-orange-100 bg-orange-50 px-2.5 py-2 text-xs leading-5 text-orange-800"
                  data-template-preview-notice={templatePanel.preview.notice}
                  data-template-preview-boundary={
                    templatePanel.preview.safetyStatement
                  }
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {templatePanel.preview.syncStatus === "syncing" ? (
                      <Loader2
                        className="size-3.5 shrink-0 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ShieldCheck
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="font-medium">
                      {templatePreviewSourceLabel(templatePanel.preview.source)}
                    </span>
                    <span>/</span>
                    <span>
                      {templatePreviewSyncStatusLabel(
                        templatePanel.preview.syncStatus
                      )}
                    </span>
                    <span>/ previewOnly=
                      {templatePanel.preview.previewOnly ? "true" : "false"}
                    </span>
                  </div>
                  <div className="mt-1 break-words">
                    {templatePanel.preview.safetyStatement}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {templateItems.map((template) => {
                  const Icon = template.icon;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => void applyTemplatePrompt(template)}
                      disabled={!template.enabled}
                      data-template-card={template.id}
                      data-template-enabled={template.enabled ? "true" : "false"}
                      className={cn(
                        "flex min-h-16 w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60",
                        template.enabled
                          ? "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                          : "border-slate-200 bg-slate-50"
                      )}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-teal-950">
                              {template.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] leading-4 text-teal-700">
                              {templateCategoryLabel(template.category)} /{" "}
                              {templateArtifactTypeLabel(template.artifactType)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-[999px] px-1.5 py-0.5 text-[10px] font-medium",
                              template.enabled
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {template.enabled ? "可用" : "停用"}
                          </span>
                        </span>
                        <span className="mt-1 block max-h-10 overflow-hidden text-xs leading-5 text-teal-700">
                          {template.description}
                        </span>
                        {template.tags.length > 0 ? (
                          <span className="mt-2 flex min-w-0 flex-wrap gap-1">
                            {template.tags.slice(0, 2).map((tag) => (
                              <span
                                key={`${template.id}-${tag}`}
                                className="max-w-full truncate rounded-[999px] bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <Code2 className="size-4" aria-hidden="true" />
                  编码模式兼容
                </div>
                <p className="text-xs leading-5">
                  架构保留 Coding Agent 能力位，当前页面只开放日常工作模式，不暴露编码工具。
                </p>
              </div>
            </div>
          </aside>

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

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
                data-model-usage-source={modelUsagePanel.source}
                data-model-usage-status={modelUsagePanel.syncStatus}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Bot className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">模型与用量</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      DeepSeek 日常工作模式快照，启动后同步后端 daily_work 模型配置与 usage 统计。
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-[999px] px-2.5 py-1 text-[11px] font-medium",
                      modelUsagePanel.syncStatus === "live"
                        ? "bg-emerald-100 text-emerald-800"
                        : modelUsagePanel.syncStatus === "syncing"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-orange-100 text-orange-800"
                    )}
                  >
                    <Activity className="size-3.5" aria-hidden="true" />
                    {modelUsageSyncStatusLabel(modelUsagePanel.syncStatus)}
                  </span>

                  <div
                    className="inline-flex w-full rounded-[8px] border border-teal-200 bg-white p-1 md:w-auto"
                    aria-label="模型展示切换"
                    role="group"
                  >
                    {(["fast", "pro"] as const).map((mode) => {
                      const isActive = modelRouteMode === mode;
                      const snapshot = modelUsagePanel.modelSnapshots[mode];

                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => switchModelRoute(mode)}
                          className={cn(
                            "min-w-0 flex-1 rounded-[6px] px-3 py-2 text-left text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 md:min-w-28",
                            isActive
                              ? "bg-teal-600 text-white shadow-sm"
                              : "text-teal-700 hover:bg-teal-50"
                          )}
                        >
                          <span className="block truncate">
                            {mode === "fast" ? "快速" : "深度"}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block truncate text-[10px]",
                              isActive ? "text-teal-50" : "text-teal-500"
                            )}
                          >
                            {snapshot.selectedModel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
                      模型快照
                    </div>
                    <div className="space-y-2">
                      <SnapshotRow
                        label="当前模式"
                        value={activeModelSnapshot.currentMode}
                      />
                      <SnapshotRow
                        label="Provider"
                        value={activeModelSnapshot.provider}
                      />
                      <SnapshotRow
                        label="Base URL"
                        value={activeModelSnapshot.baseUrl}
                      />
                      <SnapshotRow
                        label="快速模型"
                        value={activeModelSnapshot.fastModel}
                      />
                      <SnapshotRow
                        label="深度模型"
                        value={activeModelSnapshot.proModel}
                      />
                      <SnapshotRow
                        label="当前使用"
                        value={activeModelSnapshot.selectedModel}
                      />
                      <SnapshotRow
                        label="实况路由"
                        value={modelRouteLabel(activeModelSnapshot.selectedRoute)}
                      />
                      <SnapshotRow
                        label="Thinking"
                        value={
                          activeModelSnapshot.thinkingMode === "enabled"
                            ? "enabled / 后端配置"
                            : "disabled / 后端配置"
                        }
                      />
                      <SnapshotRow
                        label="Stream Usage"
                        value={activeModelSnapshot.streamUsageEnabled ? "enabled" : "disabled"}
                      />
                      <SnapshotRow
                        label="API Key"
                        value={activeModelSnapshot.configured ? "已配置 / 不展示密钥" : "未配置 / mock usage"}
                      />
                    </div>
                    <p className="mt-3 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2 text-xs leading-5 text-teal-700">
                      路由策略：{activeModelSnapshot.routingStrategy}
                    </p>
                  </div>

                  <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                      用量快照
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <SessionMetric
                        label="输入 token"
                        value={formatTokenCount(activeUsageSnapshot.inputTokens)}
                      />
                      <SessionMetric
                        label="输出 token"
                        value={formatTokenCount(activeUsageSnapshot.outputTokens)}
                      />
                      <SessionMetric
                        label="合计 token"
                        value={formatTokenCount(usageTotalTokens)}
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      <SnapshotRow
                        label="窗口"
                        value={activeUsageSnapshot.usageWindow}
                      />
                      <SnapshotRow
                        label="成本"
                        value={activeUsageSnapshot.estimatedCost}
                      />
                      <SnapshotRow
                        label="预算/安全"
                        value={activeUsageSnapshot.budgetState}
                      />
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-teal-700">
                        <span>{budgetStateLabel(activeUsageSnapshot.budgetLevel)}</span>
                        <span>{usageBudgetPercent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-[999px] bg-teal-100">
                        <div
                          className="h-full rounded-[999px] bg-orange-500"
                          style={{ width: `${usageBudgetPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5",
                    modelUsagePanel.syncStatus === "degraded"
                      ? "border-orange-200 bg-orange-50 text-orange-800"
                      : "border-teal-100 bg-white text-teal-800"
                  )}
                >
                  {modelUsagePanel.notice}
                </div>

                <div className="mt-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                  边界：当前面板只消费 daily_work；coding_agent 的模型用量路径保留为兼容说明，不在此处切换或暴露编码工具状态。
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {[...activeModelSnapshot.notes, ...activeUsageSnapshot.notes].map(
                    (note) => (
                      <div
                        key={note}
                        className="flex items-start gap-2 rounded-[8px] border border-orange-200 bg-white px-3 py-2 text-xs leading-5 text-orange-800"
                      >
                        <AlertCircle
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 break-words">{note}</span>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-3 text-[11px] leading-5 text-teal-700">
                  更新时间：{activeModelSnapshot.updatedAt} / 用量更新时间：
                  {activeUsageSnapshot.updatedAt}
                </div>
              </div>

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

              <div
                className="rounded-[8px] border border-teal-100 bg-white p-3"
                data-activity-feed
                data-activity-feed-count={activityFeedEvents.length}
                data-activity-feed-source={activityFeedSource}
                data-activity-connection-status={activityConnectionStatus}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Activity className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">实时活动流 / 状态事件</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      daily_work 的任务状态轨迹：记录会话恢复、模板填入、审批变化、工作流预演和产物复用状态。
                    </p>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">
                    <Lock className="size-3.5" aria-hidden="true" />
                    {activityFeedEvents.length} 条活动事件
                  </span>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <ActivityFeedMeta
                    label="事件来源"
                    value={activityFeedSourceLabel(activityFeedSource)}
                  />
                  <ActivityFeedMeta
                    label="连接状态"
                    value={activityConnectionStatusLabel(activityConnectionStatus)}
                  />
                  <ActivityFeedMeta label="最近更新" value={activityLastUpdated} />
                </div>

                <div
                  className={cn(
                    "mt-3 rounded-[8px] border px-3 py-2 text-xs leading-5",
                    activityConnectionStatus === "degraded"
                      ? "border-orange-200 bg-orange-50 text-orange-800"
                      : "border-teal-100 bg-teal-50 text-teal-800"
                  )}
                >
                  {activityFeedNotice}
                </div>

                <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
                  编码模式兼容提示：这些事件只描述 daily_work 日常工作自动化状态，不暴露 coding_agent 命令、仓库操作或脚本工具。
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                  <div className="space-y-2">
                    {activityFeedEvents.map((event) => {
                      const Icon = event.icon;
                      const isSelected = selectedActivityEvent?.id === event.id;

                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedActivityEventId(event.id)}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isSelected
                              ? "border-teal-400 bg-teal-50 shadow-sm"
                              : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-white text-teal-700 ring-1 ring-teal-100">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-medium text-teal-950">
                                  {event.title}
                                </span>
                                <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                  {event.time} / {event.type} / {event.relatedObject}
                                </span>
                              </span>
                              <ActivityEventStatusPill status={event.status} />
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {event.summary}
                            </span>
                            <span className="mt-2 block break-words text-[11px] leading-4 text-orange-700">
                              安全边界：{event.safetyBoundary}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedActivityEvent ? (
                    <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-teal-700">
                            选中事件
                          </div>
                          <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                            {selectedActivityEvent.title}
                          </div>
                          <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                            {selectedActivityEvent.promptFocus}
                          </div>
                        </div>
                        <ActivityEventStatusPill status={selectedActivityEvent.status} />
                      </div>

                      <div className="mt-3 grid gap-2">
                        <ArtifactDetailRow
                          label="事件类型"
                          value={selectedActivityEvent.type}
                        />
                        <ArtifactDetailRow
                          label="发生时间"
                          value={selectedActivityEvent.time}
                        />
                        <ArtifactDetailRow
                          label={`关联对象：${selectedActivityEvent.relatedObject}`}
                          value={selectedActivityEvent.relatedLabel}
                        />
                      </div>

                      <ArtifactDetailBlock
                        icon={<ShieldCheck className="size-4" aria-hidden="true" />}
                        title="安全边界"
                      >
                        {selectedActivityEvent.safetyBoundary}
                      </ArtifactDetailBlock>

                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
                        onClick={() => applyActivityEventPrompt(selectedActivityEvent)}
                      >
                        <Send className="size-4" aria-hidden="true" />
                        将事件转为 Prompt
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Workflow className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">工作流编排预演 / Action Queue</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      daily_work 当前只做自动化预演：不调用外部系统、不自动发送邮件、不写入日历或文档。
                    </p>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-white px-2.5 py-1 text-[11px] font-medium text-teal-700">
                    <Lock className="size-3.5" aria-hidden="true" />
                    预演队列 {filteredWorkflowActions.length}/{workflowActions.length}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2" aria-label="工作流动作筛选">
                  {workflowActionFilters.map((filter) => {
                    const isActive = workflowActionFilter === filter;

                    return (
                      <button
                        key={filter}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setWorkflowActionFilter(filter)}
                        className={cn(
                          "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                          isActive
                            ? "border-teal-600 bg-teal-600 text-white"
                            : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                        )}
                      >
                        <span>{filter}</span>
                        <span
                          className={cn(
                            "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                            isActive ? "bg-white/20 text-white" : "bg-teal-50 text-teal-700"
                          )}
                        >
                          {workflowActionFilterCount(filter)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="space-y-2">
                    {filteredWorkflowActions.map((action) => {
                      const Icon = action.icon;
                      const isSelected = selectedWorkflowAction?.id === action.id;

                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => setSelectedWorkflowActionId(action.id)}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isSelected
                              ? "border-teal-400 bg-white shadow-sm"
                              : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-white text-teal-700 ring-1 ring-teal-100">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-medium text-teal-950">
                                  {action.title}
                                </span>
                                <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                  {action.actionType} / {action.connector}
                                </span>
                              </span>
                              <WorkflowActionStatusPill status={action.approvalStatus} />
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {action.summary}
                            </span>
                            <span className="mt-2 flex flex-wrap items-center gap-2">
                              <ConnectorRiskPill riskLevel={action.riskLevel} />
                              <span className="inline-flex min-w-0 items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">{action.artifact}</span>
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedWorkflowAction ? (
                    <div
                      className="rounded-[8px] border border-teal-100 bg-white p-3"
                      data-workflow-preview-panel
                      data-api-workflow-id={workflowPreviewPanel.workflowId}
                      data-workflow-preview-action={workflowPreviewPanel.actionId}
                      data-workflow-preview-source={workflowPreviewPanel.source}
                      data-workflow-preview-sync-status={
                        workflowPreviewPanel.syncStatus
                      }
                      data-workflow-preview-status={
                        workflowPreviewPanel.selectedActionStatus
                      }
                      data-workflow-preview-only={String(
                        workflowPreviewPanel.previewOnly
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-teal-700">
                            选中动作
                          </div>
                          <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                            {selectedWorkflowAction.title}
                          </div>
                          <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                            {selectedWorkflowAction.nextStep}
                          </div>
                        </div>
                        <WorkflowActionStatusPill
                          status={selectedWorkflowAction.approvalStatus}
                        />
                      </div>

                      <div className="mt-3 grid gap-2">
                        <ArtifactDetailRow
                          label="关联连接器"
                          value={selectedWorkflowAction.connector}
                        />
                        <ArtifactDetailRow
                          label="上下文"
                          value={selectedWorkflowAction.context}
                        />
                        <ArtifactDetailRow
                          label="预期产物"
                          value={selectedWorkflowAction.artifact}
                        />
                      </div>

                      <div className="mt-3 rounded-[8px] border border-cyan-100 bg-cyan-50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-950">
                              <Workflow
                                className="size-4 shrink-0 text-cyan-700"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 break-words">
                                工作流 API 预演合同
                              </span>
                            </div>
                            <div className="mt-1 break-words font-mono text-[11px] text-cyan-700">
                              POST /api/daily/workflows/
                              {workflowPreviewPanel.workflowId}/preview ·{" "}
                              {workflowPreviewPanel.actionId}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-cyan-700">
                            {workflowPreviewPanel.source} /{" "}
                            {workflowPreviewPanel.syncStatus}
                          </span>
                        </div>

                        <div
                          className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-900"
                          data-workflow-preview-summary
                        >
                          {workflowPreviewPanel.summary}
                        </div>

                        <div className="mt-3 space-y-1">
                          {workflowPreviewPanel.steps.map((step) => (
                            <div
                              key={`${workflowPreviewPanel.actionId}-${step}`}
                              className="flex items-start gap-2 rounded-[8px] border border-cyan-100 bg-white px-2.5 py-2 text-xs leading-5 text-slate-700"
                              data-workflow-preview-step
                            >
                              <CheckCircle2
                                className="mt-0.5 size-3.5 shrink-0 text-cyan-700"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 break-words">{step}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 grid gap-2">
                          <ArtifactDetailRow
                            label="连接器链路"
                            value={workflowPreviewPanel.connectorLinks.join("、")}
                          />
                          <ArtifactDetailRow
                            label="上下文链路"
                            value={workflowPreviewPanel.contextLinks.join("、")}
                          />
                          <ArtifactDetailRow
                            label="产物链路"
                            value={workflowPreviewPanel.artifactLinks.join("、")}
                          />
                          <ArtifactDetailRow
                            label="审批链路"
                            value={workflowPreviewPanel.approvalLinks.join("、")}
                          />
                        </div>

                        <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                          {workflowPreviewPanel.safetyStatement}
                        </div>
                        <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-800">
                          {workflowPreviewPanel.notice}
                        </div>
                      </div>

                      <ArtifactDetailBlock
                        icon={<AlertCircle className="size-4" aria-hidden="true" />}
                        title="风险提示"
                      >
                        {selectedWorkflowAction.riskNote}
                      </ArtifactDetailBlock>

                      <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
                        这个按钮只会把所选动作转换为聊天 prompt；发送前仍由你确认，不会触发邮件、日历、文档或外部工具。
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
                        onClick={() => applyWorkflowActionPrompt(selectedWorkflowAction)}
                      >
                        <Send className="size-4" aria-hidden="true" />
                        生成预演 Prompt
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
                data-session-history-panel
                data-session-history-source={sessionHistoryPanel.source}
                data-session-history-sync-status={sessionHistoryPanel.syncStatus}
                data-session-history-count={sessionHistoryPanelItems.length}
                data-session-restore-source={sessionHistoryPanel.restorePreview.source}
                data-session-restore-sync-status={
                  sessionHistoryPanel.restorePreview.syncStatus
                }
                data-session-restore-preview-only={
                  sessionHistoryPanel.restorePreview.previewOnly
                }
                data-session-restore-external-effects={sessionHistoryPanel.restorePreview.externalEffects.join(
                  ","
                )}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Workflow className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">最近工作流 / 会话历史</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      从 daily_work sessions API 同步会话快照，并通过 restore-preview 预演把可继续工作的提示填入输入框。
                    </p>
                  </div>

                  <div
                    className="flex shrink-0 flex-wrap gap-2"
                    aria-label="会话历史筛选"
                  >
                    {sessionHistoryFilters.map((filter) => {
                      const isActive = sessionHistoryFilter === filter;

                      return (
                        <button
                          key={filter}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSessionHistoryFilter(filter)}
                          className={cn(
                            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isActive
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span>{filter}</span>
                          <span
                            className={cn(
                              "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-teal-50 text-teal-700"
                            )}
                          >
                            {sessionHistoryFilterCount(filter, sessionHistoryPanelItems)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  <InfoRow
                    label="会话同步"
                    value={`${sessionHistorySourceLabel(
                      sessionHistoryPanel.source
                    )} / ${sessionHistorySyncStatusLabel(
                      sessionHistoryPanel.syncStatus
                    )}`}
                  />
                  <InfoRow
                    label="恢复预演"
                    value={`${sessionRestorePreviewSourceLabel(
                      sessionHistoryPanel.restorePreview.source
                    )} / ${sessionRestorePreviewSyncStatusLabel(
                      sessionHistoryPanel.restorePreview.syncStatus
                    )} / previewOnly=${
                      sessionHistoryPanel.restorePreview.previewOnly ? "true" : "false"
                    } / externalEffects=${sessionHistoryPanel.restorePreview.externalEffects.join(
                      ","
                    )}`}
                  />
                </div>

                <div
                  className="mt-2 rounded-[8px] border border-teal-100 bg-white px-3 py-2 text-[11px] leading-5 text-teal-800"
                  data-session-history-notice
                >
                  {sessionHistoryPanel.notice}
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-2">
                    {filteredSessionHistory.map((item) => {
                      const Icon = item.icon;
                      const isSelected = selectedSessionHistory?.id === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-session-card={item.id}
                          onClick={() => {
                            setSelectedSessionHistoryId(item.id);
                            setSessionHistoryPanel((current) => ({
                              ...current,
                              restorePreview: createLocalSessionRestorePreviewState(item)
                            }));
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isSelected
                              ? "border-teal-400 bg-white shadow-sm"
                              : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-white text-teal-700 ring-1 ring-teal-100">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-medium text-teal-950">
                                  {item.title}
                                </span>
                                <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                  {item.updatedAt} / {item.mode}
                                </span>
                              </span>
                              <SessionStatusPill status={item.status} />
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {item.summary}
                            </span>
                            <span className="mt-2 block break-words text-[11px] leading-4 text-orange-700">
                              上次动作：{item.lastAction}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedSessionHistory ? (
                    <div
                      className="rounded-[8px] border border-teal-100 bg-white p-3"
                      data-session-detail={selectedSessionHistory.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-teal-700">
                            可恢复会话
                          </div>
                          <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                            {selectedSessionHistory.title}
                          </div>
                          <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                            {selectedSessionHistory.summary}
                          </div>
                        </div>
                        <SessionStatusPill status={selectedSessionHistory.status} />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <SessionMetric
                          label="产物"
                          value={`${selectedSessionHistory.artifactCount}`}
                        />
                        <SessionMetric
                          label="审批"
                          value={`${selectedSessionHistory.approvalCount}`}
                        />
                        <SessionMetric
                          label="上下文"
                          value={`${selectedSessionHistory.contextCount}`}
                        />
                        <SessionMetric
                          label="消息"
                          value={`${selectedSessionHistory.messageCount}`}
                        />
                      </div>

                      <ArtifactDetailBlock
                        icon={<Target className="size-4" aria-hidden="true" />}
                        title="上次动作"
                      >
                        {selectedSessionHistory.lastAction}
                      </ArtifactDetailBlock>

                      <ArtifactDetailBlock
                        icon={<Database className="size-4" aria-hidden="true" />}
                        title="关联链路"
                      >
                        {formatSessionLinkList("产物", selectedSessionHistory.artifactIds)}
                        {" / "}
                        {formatSessionLinkList(
                          "上下文",
                          selectedSessionHistory.contextItemIds
                        )}
                        {" / "}
                        {formatSessionLinkList(
                          "审批",
                          selectedSessionHistory.approvalRequestIds
                        )}
                      </ArtifactDetailBlock>

                      <ArtifactDetailBlock
                        icon={<MessageSquare className="size-4" aria-hidden="true" />}
                        title="最近消息"
                      >
                        {formatSessionRecentMessagePreview(selectedSessionHistory)}
                      </ArtifactDetailBlock>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedSessionHistory.tags.map((tag) => (
                          <span
                            key={`${selectedSessionHistory.id}-${tag}`}
                            className="max-w-full rounded-[999px] bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700"
                          >
                            <span className="break-words">{tag}</span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
                        恢复会先请求后端 restore-preview，成功后填入 API 返回的 restorePrompt；当前预演只进入输入框，由你确认后再发送，不执行外部效果。
                        <span className="mt-1 block text-[11px]">
                          {sessionHistoryPanel.restorePreview.notice}
                        </span>
                        <span className="mt-1 block text-[11px] text-orange-700">
                          {sessionHistoryPanel.restorePreview.safetyStatement}
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full cursor-pointer bg-orange-500 hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
                        disabled={
                          sessionHistoryPanel.restorePreview.syncStatus === "syncing"
                        }
                        onClick={() => void restoreSessionHistory(selectedSessionHistory)}
                      >
                        {sessionHistoryPanel.restorePreview.syncStatus === "syncing" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Play className="size-4" aria-hidden="true" />
                        )}
                        恢复到输入框
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

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
              <div
                className="rounded-[8px] border border-amber-200 bg-amber-50 p-3"
                data-approval-ledger-panel
                data-approval-ledger-source={approvalPanel.source}
                data-approval-ledger-sync-status={approvalPanel.syncStatus}
                data-approval-ledger-count={approvalRequests.length}
                data-approval-ledger-notice={approvalPanel.notice}
              >
                <div className="mb-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-amber-950">
                      <ShieldCheck className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">许可审批台账</span>
                    </div>
                    <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      {approvalRequests.length}
                    </span>
                  </div>
                  <div className="rounded-[8px] border border-amber-100 bg-white/80 px-2.5 py-2 text-[11px] leading-5 text-amber-800">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-[999px] bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                        {approvalPanelSourceLabel(approvalPanel.source)}
                      </span>
                      <span className="rounded-[999px] bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {approvalPanelSyncStatusLabel(approvalPanel.syncStatus)}
                      </span>
                    </div>
                    <p className="mt-1 break-words">{approvalPanel.notice}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {approvalRequests.map((request) => {
                    const Icon = request.icon;

                    return (
                      <div
                        key={request.id}
                        data-approval-request={request.id}
                        data-approval-status={request.status}
                        className="rounded-[8px] border border-amber-100 bg-white px-3 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-amber-50 text-amber-700">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-teal-950">
                                  {request.title}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-teal-700">
                                  {request.requestedAction}
                                </div>
                              </div>
                              <StatusPill status={request.status} />
                            </div>

                            <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-700">
                              <InfoRow label="风险等级" value={request.risk} />
                              <InfoRow label="范围边界" value={request.scope} />
                              <InfoRow label="当前状态" value={approvalStatusLabel(request.status)} />
                            </div>

                            <p className="mt-2 text-xs leading-5 text-amber-800">
                              {request.detail}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                data-approval-decision-action="allow_once"
                                data-approval-decision-target={request.id}
                                className="h-8 rounded-[8px] border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                                onClick={() =>
                                  void updateApprovalStatus(request.id, "allowed_once")
                                }
                              >
                                允许一次
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                data-approval-decision-action="deny"
                                data-approval-decision-target={request.id}
                                className="h-8 rounded-[8px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                onClick={() =>
                                  void updateApprovalStatus(request.id, "denied")
                                }
                              >
                                拒绝
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-5 text-amber-800">
                  审批按钮只写入后端 preview-only 决策回执；不会触发真实邮件、日历或外部系统操作。
                </p>
              </div>

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
                data-context-panel
                data-context-source={contextPanel.source}
                data-context-sync-status={contextPanel.syncStatus}
                data-context-count={contextPanelItems.length}
                data-context-preview-source={contextPanel.preview.source}
                data-context-preview-status={contextPanel.preview.syncStatus}
                data-context-preview-only={
                  contextPanel.preview.previewOnly ? "true" : "false"
                }
                data-context-preview-external-effects={contextPanel.preview.externalEffects.join(
                  ","
                )}
                data-selected-context-id={selectedContextId ?? ""}
              >
                <div className="mb-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <ShieldCheck className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">会话知识上下文</span>
                    </div>
                    <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
                      {contextPanelItems.length}
                    </span>
                  </div>
                  <div className="rounded-[8px] border border-teal-100 bg-white/80 px-2.5 py-2 text-[11px] leading-5 text-teal-800">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-[999px] bg-teal-100 px-2 py-0.5 font-medium text-teal-800">
                        {contextPanelSourceLabel(contextPanel.source)}
                      </span>
                      <span className="rounded-[999px] bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {contextPanelSyncStatusLabel(contextPanel.syncStatus)}
                      </span>
                    </div>
                    <div className="mt-1 break-words" data-context-panel-notice>
                      {contextPanel.notice}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {contextPanelItems.map((item) => {
                    const Icon = item.icon;
                    const isSelected = selectedContextId === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-context-card={item.id}
                        onClick={() => void useContextItem(item)}
                        className={cn(
                          "w-full cursor-pointer rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                          isSelected
                            ? "border-teal-300 bg-white shadow-sm"
                            : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-teal-950">
                                {item.title}
                              </span>
                              <span className="shrink-0 rounded-[999px] bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                                {item.status}
                              </span>
                            </span>
                            <span className="mt-1 block break-words text-xs leading-5 text-teal-700">
                              {item.source} / {item.sourceType}
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {item.summary}
                            </span>
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                <Lock className="size-3.5" aria-hidden="true" />
                                <span className="break-words">{item.privacy}</span>
                              </span>
                              {item.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={`${item.id}-${tag}`}
                                  className="rounded-[999px] bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div
                  className="mt-3 rounded-[8px] border border-orange-100 bg-orange-50 px-2.5 py-2 text-[11px] leading-5 text-orange-900"
                  data-context-preview-notice={contextPanel.preview.notice}
                  data-context-preview-safety={contextPanel.preview.safetyStatement}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-[999px] bg-white px-2 py-0.5 font-medium text-orange-800">
                      {contextPreviewSourceLabel(contextPanel.preview.source)}
                    </span>
                    <span className="rounded-[999px] bg-white px-2 py-0.5 font-medium text-slate-700">
                      {contextPreviewSyncStatusLabel(contextPanel.preview.syncStatus)}
                    </span>
                    <span className="rounded-[999px] bg-white px-2 py-0.5 font-medium text-teal-800">
                      previewOnly={contextPanel.preview.previewOnly ? "true" : "false"}
                    </span>
                    <span className="rounded-[999px] bg-white px-2 py-0.5 font-medium text-teal-800">
                      externalEffects={contextPanel.preview.externalEffects.join(",")}
                    </span>
                  </div>
                  <div className="mt-1 break-words">{contextPanel.preview.notice}</div>
                  <div className="mt-1 break-words">
                    {contextPanel.preview.safetyStatement}
                  </div>
                </div>
              </div>

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
              >
                <div className="mb-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <Globe className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">连接器目录</span>
                    </div>
                    <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
                      {filteredConnectors.length}/{connectorItems.length}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-teal-700">
                    当前只做目录和权限预演，不读取真实文档、日历、邮件、笔记或团队知识库。
                  </p>
                  <div className="flex flex-wrap gap-2" aria-label="连接器筛选">
                    {connectorFilters.map((filter) => {
                      const isActive = connectorFilter === filter;

                      return (
                        <button
                          key={filter}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setConnectorFilter(filter)}
                          className={cn(
                            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isActive
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-teal-200 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span>{filter}</span>
                          <span
                            className={cn(
                              "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                              isActive ? "bg-white/20 text-white" : "bg-teal-100 text-teal-700"
                            )}
                          >
                            {connectorFilterCount(filter)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredConnectors.map((connector) => {
                    const Icon = connector.icon;
                    const isSelected = selectedConnector?.id === connector.id;

                    return (
                      <button
                        key={connector.id}
                        type="button"
                        onClick={() => setSelectedConnectorId(connector.id)}
                        className={cn(
                          "w-full cursor-pointer rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                          isSelected
                            ? "border-teal-300 bg-white shadow-sm"
                            : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                        )}
                      >
                        <span className="flex items-start gap-3">
                          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-medium text-teal-950">
                                  {connector.name}
                                </span>
                                <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                  {connector.category} / {connector.provider}
                                </span>
                              </span>
                              <ConnectorPermissionPill state={connector.permissionState} />
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {connector.description}
                            </span>
                            <span className="mt-2 flex flex-wrap items-center gap-2">
                              <ConnectorRiskPill riskLevel={connector.riskLevel} />
                              <span className="inline-flex min-w-0 items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">{connector.status}</span>
                              </span>
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedConnector ? (
                  <div className="mt-3 border-t border-teal-100 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-teal-700">
                          {selectedConnector.category} 连接器
                        </div>
                        <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                          {selectedConnector.name}
                        </div>
                        <div className="mt-1 break-words text-xs leading-5 text-teal-700">
                          {selectedConnector.lastSyncLabel}
                        </div>
                      </div>
                      <ConnectorRiskPill riskLevel={selectedConnector.riskLevel} />
                    </div>

                    <div className="mt-3 grid gap-2">
                      <StatusRow label="权限状态" value={selectedConnector.permissionState} />
                      <StatusRow label="Provider" value={selectedConnector.provider} />
                      <StatusRow label="目录状态" value={selectedConnector.status} />
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
                        <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                        可用动作
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedConnector.availableActions.map((action) => (
                          <span
                            key={`${selectedConnector.id}-${action}`}
                            className="max-w-full rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700"
                          >
                            <span className="break-words">{action}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div
                      className="mt-3 rounded-[8px] border border-cyan-200 bg-cyan-50 px-3 py-3"
                      data-approval-preview-panel
                      data-api-connector-id={connectorPreviewPanel.connectorId}
                      data-connector-action-preview={connectorPreviewPanel.action}
                      data-connector-preview-source={connectorPreviewPanel.source}
                      data-connector-preview-sync-status={
                        connectorPreviewPanel.syncStatus
                      }
                      data-connector-preview-status={selectedConnectorPreviewStatus}
                      data-connector-preview-only={String(
                        connectorPreviewPanel.previewOnly
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-950">
                            <ShieldCheck
                              className="size-4 shrink-0 text-cyan-700"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">
                              工具调用预览 / preview-only
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-cyan-800">
                            POST /api/daily/connectors/
                            {connectorPreviewPanel.connectorId}/preview ·{" "}
                            {connectorPreviewPanel.action}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-cyan-700">
                            Source: {connectorPreviewPanel.source} · Status:{" "}
                            {connectorPreviewPanel.syncStatus}
                          </p>
                        </div>
                        <StatusPill status={selectedConnectorPreviewStatus} />
                      </div>

                      <div className="mt-3 grid gap-2">
                        <StatusRow
                          label="关联上下文"
                          value={
                            connectorPreviewPanel.relatedContextItemIds.length > 0
                              ? connectorPreviewPanel.relatedContextItemIds.join("、")
                              : "无需上下文"
                          }
                        />
                        <StatusRow
                          label="审批请求"
                          value={
                            connectorPreviewPanel.requiredApprovalRequestIds.length > 0
                              ? connectorPreviewPanel.requiredApprovalRequestIds.join("、")
                              : "无需审批"
                          }
                        />
                      </div>

                      <div
                        className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-900"
                        data-connector-preview-summary
                      >
                        {connectorPreviewPanel.summary}
                      </div>

                      <div className="mt-3 space-y-1">
                        {connectorPreviewPanel.steps.map((step) => (
                          <div
                            key={`${connectorPreviewPanel.connectorId}-${step}`}
                            className="flex items-start gap-2 rounded-[8px] border border-cyan-100 bg-white px-2.5 py-2 text-xs leading-5 text-slate-700"
                            data-connector-preview-step
                          >
                            <CheckCircle2
                              className="mt-0.5 size-3.5 shrink-0 text-cyan-700"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">{step}</span>
                          </div>
                        ))}
                      </div>

                      {selectedConnectorApprovalRequests.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {selectedConnectorApprovalRequests.map((request) => (
                            <div
                              key={`${selectedConnector.id}-${request.id}`}
                              className="flex items-center justify-between gap-3 rounded-[8px] border border-cyan-100 bg-white px-2.5 py-2"
                              data-approval-preview-request={request.id}
                              data-approval-preview-status={request.status}
                            >
                              <span className="min-w-0 break-words text-xs font-medium text-cyan-950">
                                {request.title}
                              </span>
                              <StatusPill status={request.status} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-800">
                          该连接器当前仅开放公开引用预览，不需要审批即可生成接入提示。
                        </p>
                      )}

                      <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                        {connectorPreviewPanel.safetyStatement}
                      </div>

                      <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-800">
                        {connectorPreviewPanel.notice}
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={selectedConnector.requiredApprovalIds.length === 0}
                          data-approval-decision-action="allow_once"
                          data-approval-decision-target={selectedConnector.id}
                          className="h-8 rounded-[8px] border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50"
                          onClick={() => {
                            void updateConnectorPreviewDecision(
                              selectedConnector,
                              "allowed_once"
                            );
                          }}
                        >
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          批准预览
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={selectedConnector.requiredApprovalIds.length === 0}
                          data-approval-decision-action="deny"
                          data-approval-decision-target={selectedConnector.id}
                          className="h-8 rounded-[8px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            void updateConnectorPreviewDecision(
                              selectedConnector,
                              "denied"
                            );
                          }}
                        >
                          <Square className="size-4" aria-hidden="true" />
                          拒绝预览
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-[8px] border border-teal-100 bg-white px-3 py-2">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
                        <AlertCircle className="size-4 text-orange-600" aria-hidden="true" />
                        下一步接入提示
                      </div>
                      <ul className="space-y-1">
                        {selectedConnector.notes.map((note) => (
                          <li
                            key={`${selectedConnector.id}-${note}`}
                            className="flex items-start gap-2 text-xs leading-5 text-slate-700"
                          >
                            <CheckCircle2
                              className="mt-0.5 size-3.5 shrink-0 text-teal-700"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
                      onClick={() => applyConnectorPrompt(selectedConnector)}
                    >
                      <Send className="size-4" aria-hidden="true" />
                      填入接入提示
                    </Button>
                    <p className="mt-2 text-xs leading-5 text-teal-700">
                      该操作只填充输入框，不接真实授权、登录或外部服务。
                    </p>
                  </div>
                ) : null}
              </div>

              <div
                className="rounded-[8px] border border-teal-100 bg-teal-50 p-3"
                data-artifact-panel
                data-artifact-panel-source={artifactPanel.source}
                data-artifact-panel-sync-status={artifactPanel.syncStatus}
                data-artifact-panel-notice={artifactPanel.notice}
                data-artifact-panel-count={artifactItems.length}
                data-artifacts-panel
                data-artifacts-source={artifactPanel.source}
                data-artifacts-sync-status={artifactPanel.syncStatus}
                data-artifacts-count={artifactItems.length}
                data-selected-artifact-id={selectedArtifact?.id ?? ""}
              >
                <div className="mb-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <CheckCircle2
                        className="size-4 shrink-0 text-teal-700"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 break-words">日常工作产物</span>
                    </div>
                    <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
                      {filteredArtifacts.length}/{artifactItems.length}
                    </span>
                  </div>

                  <div className="rounded-[8px] border border-teal-100 bg-white px-3 py-2 text-xs leading-5 text-teal-700">
                    <span className="font-medium text-teal-950">
                      {artifactPanel.source} / {artifactPanel.syncStatus}
                    </span>
                    <span className="ml-2">{artifactPanel.notice}</span>
                  </div>

                  <div className="flex flex-wrap gap-2" aria-label="产物筛选">
                    {artifactFilters.map((filter) => {
                      const isActive = artifactFilter === filter;

                      return (
                        <button
                          key={filter}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setArtifactFilter(filter)}
                          className={cn(
                            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isActive
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span>{filter}</span>
                          <span
                            className={cn(
                              "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-teal-50 text-teal-700"
                            )}
                          >
                            {artifactFilterCount(filter, artifactItems)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredArtifacts.map((artifact) => {
                    const Icon = artifact.icon;
                    const isSelected = selectedArtifact?.id === artifact.id;

                    return (
                      <button
                        key={artifact.id}
                        type="button"
                        onClick={() => setSelectedArtifactId(artifact.id)}
                        data-artifact-card={artifact.id}
                        data-artifact-state={artifact.state}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                          isSelected
                            ? "border-teal-400 bg-white shadow-sm"
                            : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                        )}
                      >
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block break-words text-sm font-medium text-teal-950">
                                {artifact.title}
                              </span>
                              <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                {artifact.artifactType} / {artifact.owner}
                              </span>
                            </span>
                            <ArtifactStatePill state={artifact.state} />
                          </span>
                          <span className="mt-2 block break-words text-xs leading-5 text-teal-700">
                            {artifact.description}
                          </span>
                          <span className="mt-2 block break-words text-[11px] leading-4 text-slate-500">
                            更新：{artifact.updatedAt}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedArtifact ? (
                  <div
                    className="mt-3 border-t border-teal-100 pt-3"
                    data-artifact-detail={selectedArtifact.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-teal-700">
                          {selectedArtifact.artifactType}
                        </div>
                        <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                          {selectedArtifact.title}
                        </div>
                        <div className="mt-1 break-words text-xs leading-5 text-teal-700">
                          {selectedArtifact.description}
                        </div>
                      </div>
                      <ArtifactStatePill state={selectedArtifact.state} />
                    </div>

                    <ArtifactDetailBlock
                      icon={<FileText className="size-4" aria-hidden="true" />}
                      title="摘要"
                    >
                      {selectedArtifact.summary}
                    </ArtifactDetailBlock>

                    <div className="mt-3 grid gap-2">
                      <ArtifactDetailRow label="来源模板" value={selectedArtifact.templateTitle} />
                      <ArtifactDetailRow label="来源上下文" value={selectedArtifact.source} />
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
                        <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                        上下文 / 审批追踪
                      </div>
                      <div className="space-y-2">
                        {selectedArtifact.trace.map((traceItem) => (
                          <div
                            key={`${selectedArtifact.id}-${traceItem.label}`}
                            className="rounded-[8px] border border-teal-100 bg-white px-3 py-2"
                          >
                            <div className="text-[11px] font-medium text-teal-700">
                              {traceItem.label}
                            </div>
                            <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                              {traceItem.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <ArtifactDetailBlock
                      icon={<Target className="size-4" aria-hidden="true" />}
                      title="下一步行动"
                    >
                      {selectedArtifact.nextAction}
                    </ArtifactDetailBlock>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedArtifact.tags.map((tag) => (
                        <span
                          key={`${selectedArtifact.id}-${tag}`}
                          className="max-w-full rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700"
                        >
                          <span className="break-words">{tag}</span>
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-orange-200 bg-white px-3 py-2 text-xs leading-5 text-orange-800">
                      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">
                        权限状态：{selectedArtifact.permissionStatus}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                  <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
                  模式快照
                </div>
                <div className="space-y-2 text-sm text-teal-700">
                  <StatusRow label="当前模式" value="daily_work" />
                  <StatusRow label="对话传输" value="Streaming" />
                  <StatusRow label="上下文来源" value="会话级预览" />
                  <StatusRow label="审批请求" value={`${approvalRequests.length} 项`} />
                </div>
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <Code2 className="size-4" aria-hidden="true" />
                  编码模式兼容
                </div>
                <p className="text-xs leading-5">
                  当前分支没有开放文件、Shell 或 Git 工具；后续可在同一模式契约下扩展编码能力。
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
