import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

import {
  activeMode,
  activityEvents,
  connectorItems,
  createFallbackApprovalPanelState,
  createFallbackArtifactPanelState,
  createFallbackContextPanelState,
  createFallbackModelUsagePanelState,
  createFallbackPersistencePanelState,
  createFallbackSessionHistoryPanelState,
  createFallbackTemplatePanelState,
  createLocalConnectorPreviewState,
  createLocalContextPreviewState,
  createLocalSessionRestorePreviewState,
  createLocalTemplatePreviewState,
  createLocalWorkflowPreviewState,
  formatActivityUpdatedAt,
  getRuntimeWebSocketUrl,
  mapApprovalRequestsResponse,
  mapArtifactResponse,
  mapArtifactsResponse,
  mapContextResponse,
  mapConnectorPreviewResponse,
  mapDailyActivitySnapshot,
  mapDailyModelUsageResponse,
  mapHealthPersistenceResponse,
  mapSessionResponse,
  mapSessionsResponse,
  mapTemplatesResponse,
  mapWorkflowPreviewResponse,
  parseDailyActivitySnapshot,
  replaceSessionHistoryItem,
  workflowActions
} from "../domain";
import type {
  ActivityConnectionStatus,
  ActivityEventItem,
  ActivityFeedSource,
  ApprovalPanelState,
  ArtifactPanelState,
  ConnectorActionPreviewResponseDto,
  ConnectorItem,
  ConnectorPreviewPanelState,
  ContextPanelState,
  DailyActivitySnapshotDto,
  DailyApprovalRequestsResponseDto,
  DailyContextResponseDto,
  DailyModelUsageResponseDto,
  DailyWorkArtifactResponseDto,
  DailyWorkArtifactsResponseDto,
  DailyWorkSessionResponseDto,
  DailyWorkSessionsResponseDto,
  DailyWorkTemplatesResponseDto,
  DailyWorkflowPreviewResponseDto,
  ModelUsagePanelState,
  PersistencePanelState,
  SessionHistoryPanelState,
  TemplatePanelState,
  WorkflowActionItem,
  WorkflowPreviewPanelState
} from "../types";

export function useTemplatePanel(apiBaseUrl: string) {
  const [templatePanel, setTemplatePanel] = useState<TemplatePanelState>(() =>
    createFallbackTemplatePanelState()
  );

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchTemplates() {
      setTemplatePanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/templates?mode=daily_work 同步模板库。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/templates?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Templates request failed: ${response.status}`);
        }

        const items = mapTemplatesResponse(
          (await response.json()) as DailyWorkTemplatesResponseDto
        );

        if (!isDisposed) {
          setTemplatePanel((current) => {
            const preview =
              current.preview.templateId &&
              items.some((item) => item.id === current.preview.templateId)
                ? current.preview
                : createLocalTemplatePreviewState(items[0] ?? null);

            return {
              items,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/templates?mode=daily_work 同步模板、产物类型、标签和启用状态。",
              preview
            };
          });
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setTemplatePanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice: "暂未从后端同步模板库，已保留本地 templates fallback。"
        }));
      }
    }

    void fetchTemplates();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { templatePanel, setTemplatePanel };
}

export function useDailyContext(
  apiBaseUrl: string,
  setSelectedContextId: Dispatch<SetStateAction<string | null>>
) {
  const [contextPanel, setContextPanel] = useState<ContextPanelState>(() =>
    createFallbackContextPanelState()
  );

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchContextItems() {
      setContextPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/context?mode=daily_work 同步会话知识上下文。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/context?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Context request failed: ${response.status}`);
        }

        const items = mapContextResponse(
          (await response.json()) as DailyContextResponseDto
        );

        if (!isDisposed) {
          setContextPanel((current) => {
            const preview =
              current.preview.contextItemId &&
              items.some((item) => item.id === current.preview.contextItemId)
                ? current.preview
                : createLocalContextPreviewState(null);

            return {
              items,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/context?mode=daily_work 同步上下文来源、权限、标签和摘要。",
              preview
            };
          });
          setSelectedContextId((current) =>
            current && items.some((item) => item.id === current) ? current : null
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setContextPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步会话知识上下文，已保留本地 context fallback。"
        }));
      }
    }

    void fetchContextItems();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { contextPanel, setContextPanel };
}

export function useConnectorPreview(
  apiBaseUrl: string,
  selectedConnector: ConnectorItem | null
) {
  const [connectorPreviewPanel, setConnectorPreviewPanel] =
    useState<ConnectorPreviewPanelState>(() =>
      createLocalConnectorPreviewState(connectorItems[0]!)
    );

  useEffect(() => {
    if (!selectedConnector) {
      return;
    }

    const connector = selectedConnector;
    let isDisposed = false;
    const controller = new AbortController();
    const fallbackState = createLocalConnectorPreviewState(connector);

    setConnectorPreviewPanel({
      ...fallbackState,
      syncStatus: "syncing",
      notice: `正在从 /api/daily/connectors/${connector.apiConnectorId}/preview 同步预览。`
    });

    async function fetchConnectorPreview() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/connectors/${connector.apiConnectorId}/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              mode: activeMode,
              action: connector.apiAction,
              contextItemIds: connector.relatedContextIds,
              prompt: `Preview ${connector.name} for daily_work.`
            }),
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Connector preview request failed: ${response.status}`);
        }

        const payload = (await response.json()) as ConnectorActionPreviewResponseDto;

        if (!isDisposed) {
          setConnectorPreviewPanel(
            mapConnectorPreviewResponse(connector, payload)
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setConnectorPreviewPanel({
          ...fallbackState,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步连接器预览，已保留本地 preview-only fallback。"
        });
      }
    }

    void fetchConnectorPreview();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedConnector])

  return { connectorPreviewPanel, setConnectorPreviewPanel };
}

export function useWorkflowPreview(
  apiBaseUrl: string,
  selectedWorkflowAction: WorkflowActionItem | null
) {
  const [workflowPreviewPanel, setWorkflowPreviewPanel] =
    useState<WorkflowPreviewPanelState>(() =>
      createLocalWorkflowPreviewState(workflowActions[0]!)
    );

  useEffect(() => {
    if (!selectedWorkflowAction) {
      return;
    }

    const action = selectedWorkflowAction;
    let isDisposed = false;
    const controller = new AbortController();
    const fallbackState = createLocalWorkflowPreviewState(action);

    setWorkflowPreviewPanel({
      ...fallbackState,
      syncStatus: "syncing",
      notice: `正在从 /api/daily/workflows/${action.apiWorkflowId}/preview 同步工作流预演。`
    });

    async function fetchWorkflowPreview() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/workflows/${action.apiWorkflowId}/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              mode: activeMode,
              actionId: action.apiActionId,
              contextItemIds: action.relatedContextIds,
              prompt: `Preview ${action.title} for daily_work.`
            }),
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Workflow preview request failed: ${response.status}`);
        }

        const payload = (await response.json()) as DailyWorkflowPreviewResponseDto;

        if (!isDisposed) {
          setWorkflowPreviewPanel(mapWorkflowPreviewResponse(action, payload));
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setWorkflowPreviewPanel({
          ...fallbackState,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步工作流预演，已保留本地 preview-only fallback。"
        });
      }
    }

    void fetchWorkflowPreview();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedWorkflowAction])

  return { workflowPreviewPanel, setWorkflowPreviewPanel };
}

export function useApprovalLedger(apiBaseUrl: string) {
  const [approvalPanel, setApprovalPanel] = useState<ApprovalPanelState>(
    createFallbackApprovalPanelState
  );

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchApprovalRequests() {
      setApprovalPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/approvals?mode=daily_work 同步审批台账。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/approvals?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Approval requests failed: ${response.status}`);
        }

        const items = mapApprovalRequestsResponse(
          (await response.json()) as DailyApprovalRequestsResponseDto
        );

        if (!isDisposed) {
          setApprovalPanel({
            items,
            source: "api",
            syncStatus: "live",
            notice:
              "已从 /api/daily/approvals?mode=daily_work 同步审批请求、风险等级、权限模式和上下文链路。"
          });
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setApprovalPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步审批台账，已保留本地 approval fallback。"
        }));
      }
    }

    void fetchApprovalRequests();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { approvalPanel, setApprovalPanel };
}

export function useSessionHistory(
  apiBaseUrl: string,
  selectedSessionHistoryId: string | null,
  setSelectedSessionHistoryId: Dispatch<SetStateAction<string | null>>
) {
  const [sessionHistoryPanel, setSessionHistoryPanel] =
    useState<SessionHistoryPanelState>(() =>
      createFallbackSessionHistoryPanelState()
    );

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchSessionHistory() {
      setSessionHistoryPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/sessions?mode=daily_work 同步会话列表。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Sessions request failed: ${response.status}`);
        }

        const items = mapSessionsResponse(
          (await response.json()) as DailyWorkSessionsResponseDto
        );

        if (!isDisposed) {
          setSessionHistoryPanel((current) => {
            const restorePreview =
              current.restorePreview.sessionId &&
              items.some((item) => item.id === current.restorePreview.sessionId)
                ? current.restorePreview
                : createLocalSessionRestorePreviewState(items[0] ?? null);

            return {
              items,
              source: "api",
              syncStatus: "live",
              notice:
                "已从 /api/daily/sessions?mode=daily_work 同步会话列表、状态、关联产物、上下文和审批链路。",
              restorePreview
            };
          });
          setSelectedSessionHistoryId((current) =>
            current && items.some((item) => item.id === current)
              ? current
              : items[0]?.id ?? null
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步会话列表，已保留本地 session history fallback。"
        }));
      }
    }

    void fetchSessionHistory();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  useEffect(() => {
    if (!selectedSessionHistoryId) {
      return;
    }

    let isDisposed = false;
    const controller = new AbortController();

    async function fetchSessionDetail() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/sessions/${selectedSessionHistoryId}?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Session detail request failed: ${response.status}`);
        }

        const nextItem = mapSessionResponse(
          (await response.json()) as DailyWorkSessionResponseDto
        );

        if (!isDisposed) {
          setSessionHistoryPanel((current) => ({
            ...current,
            source: "api",
            syncStatus: "live",
            items: replaceSessionHistoryItem(current.items, nextItem),
            notice: `已从 /api/daily/sessions/${nextItem.id}?mode=daily_work 同步会话详情与最近消息。`,
            restorePreview:
              current.restorePreview.sessionId === nextItem.id
                ? current.restorePreview
                : createLocalSessionRestorePreviewState(nextItem)
          }));
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setSessionHistoryPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步选中会话详情，继续展示当前会话快照。"
        }));
      }
    }

    void fetchSessionDetail();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedSessionHistoryId])

  return { sessionHistoryPanel, setSessionHistoryPanel };
}

export function useArtifacts(
  apiBaseUrl: string,
  selectedArtifactId: string | null,
  setSelectedArtifactId: Dispatch<SetStateAction<string | null>>
) {
  const [artifactPanel, setArtifactPanel] = useState<ArtifactPanelState>(() =>
    createFallbackArtifactPanelState()
  );

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchArtifacts() {
      setArtifactPanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/artifacts?mode=daily_work 同步产物列表。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/artifacts?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Artifacts request failed: ${response.status}`);
        }

        const items = mapArtifactsResponse(
          (await response.json()) as DailyWorkArtifactsResponseDto
        );

        if (!isDisposed) {
          setArtifactPanel({
            items,
            source: "api",
            syncStatus: "live",
            notice:
              "已从 /api/daily/artifacts?mode=daily_work 同步产物、上下文追踪、审批链路和 lifecycle。"
          });
          setSelectedArtifactId((current) =>
            current && items.some((item) => item.id === current)
              ? current
              : items[0]?.id ?? null
          );
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setArtifactPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步产物列表，已保留本地 artifacts fallback。"
        }));
      }
    }

    void fetchArtifacts();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  useEffect(() => {
    if (!selectedArtifactId) {
      return;
    }

    let isDisposed = false;
    const controller = new AbortController();

    async function fetchArtifactDetail() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/artifacts/${selectedArtifactId}?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Artifact detail request failed: ${response.status}`);
        }

        const nextItem = mapArtifactResponse(
          (await response.json()) as DailyWorkArtifactResponseDto
        );

        if (!isDisposed) {
          setArtifactPanel((current) => ({
            ...current,
            source: "api",
            syncStatus: "live",
            items: current.items.map((item) =>
              item.id === nextItem.id ? nextItem : item
            ),
            notice: `已从 /api/daily/artifacts/${nextItem.id}?mode=daily_work 同步产物详情。`
          }));
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setArtifactPanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从后端同步选中产物详情，继续展示当前产物快照。"
        }));
      }
    }

    void fetchArtifactDetail();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl, selectedArtifactId])

  return { artifactPanel, setArtifactPanel };
}

export function usePersistencePanel(apiBaseUrl: string) {
  const [persistencePanel, setPersistencePanel] =
    useState<PersistencePanelState>(() => createFallbackPersistencePanelState());

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchPersistenceStatus() {
      setPersistencePanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在读取 /health 的数据层状态。"
      }));

      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Health request failed: ${response.status}`);
        }

        const nextState = mapHealthPersistenceResponse(await response.json());

        if (!isDisposed) {
          setPersistencePanel(nextState);
        }
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setPersistencePanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未从 /health 读取到数据层状态；工作台继续使用 seed/mock fallback。"
        }));
      }
    }

    void fetchPersistenceStatus();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { persistencePanel };
}

export function useModelUsagePanel(apiBaseUrl: string) {
  const [modelUsagePanel, setModelUsagePanel] = useState<ModelUsagePanelState>(
    () => createFallbackModelUsagePanelState()
  );

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    async function fetchModelUsage() {
      setModelUsagePanel((current) => ({
        ...current,
        syncStatus: "syncing",
        notice: "正在从 /api/daily/model-usage?mode=daily_work 同步 DeepSeek 模型与用量。"
      }));

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/model-usage?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Model usage request failed: ${response.status}`);
        }

        const payload = (await response.json()) as DailyModelUsageResponseDto;

        if (isDisposed) {
          return;
        }

        setModelUsagePanel(mapDailyModelUsageResponse(payload));
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setModelUsagePanel((current) => ({
          ...current,
          source: "degraded",
          syncStatus: "degraded",
          notice:
            "暂未取到后端模型与用量，已降级保留前端示例快照；页面可继续用于 daily_work。"
        }));
      }
    }

    void fetchModelUsage();

    return () => {
      isDisposed = true;
      controller.abort();
    };
  }, [apiBaseUrl])

  return { modelUsagePanel };
}

export function useActivityFeed(
  apiBaseUrl: string,
  setSelectedActivityEventId: Dispatch<SetStateAction<string | null>>
) {
  const [activityFeedEvents, setActivityFeedEvents] =
    useState<ActivityEventItem[]>(activityEvents);
  const [activityFeedSource, setActivityFeedSource] =
    useState<ActivityFeedSource>("fallback");
  const [activityConnectionStatus, setActivityConnectionStatus] =
    useState<ActivityConnectionStatus>("connecting");
  const [activityLastUpdated, setActivityLastUpdated] =
    useState("鍓嶇 fallback 绀轰緥");
  const [activityFeedNotice, setActivityFeedNotice] = useState(
    "Connecting to the backend activity feed; showing frontend fallback data for now."
  );

  useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    const applySnapshot = (
      payload: DailyActivitySnapshotDto,
      source: Exclude<ActivityFeedSource, "fallback">
    ) => {
      const nextEvents = mapDailyActivitySnapshot(payload);

      if (isDisposed || nextEvents.length === 0) {
        return;
      }

      setActivityFeedEvents(nextEvents);
      setActivityFeedSource(source);
      setActivityLastUpdated(formatActivityUpdatedAt(new Date()));
      setActivityFeedNotice(
        source === "websocket"
          ? "已从 WebSocket 收到 daily.activity.snapshot，活动流保持实时同步。"
          : "已从 /api/daily/events?mode=daily_work 同步活动流。"
      );
      setSelectedActivityEventId((currentId) =>
        nextEvents.some((event) => event.id === currentId)
          ? currentId
          : nextEvents[0]?.id ?? null
      );
    };

    async function fetchActivityEvents() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/events?mode=${activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Activity events request failed: ${response.status}`);
        }

        applySnapshot((await response.json()) as DailyActivitySnapshotDto, "api");
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setActivityConnectionStatus("degraded");
        setActivityFeedNotice(
          "暂未取到后端活动列表，页面会继续保留前端 fallback 示例。"
        );
      }
    }

    function connectActivitySocket() {
      const socketUrl = getRuntimeWebSocketUrl(apiBaseUrl);

      if (!socketUrl) {
        setActivityConnectionStatus("degraded");
        setActivityFeedNotice("WebSocket 地址不可用，活动流继续使用当前快照。");
        return undefined;
      }

      const socket = new WebSocket(socketUrl);

      socket.addEventListener("open", () => {
        if (!isDisposed) {
          setActivityConnectionStatus("live");
        }
      });

      socket.addEventListener("message", (event) => {
        const payload = parseDailyActivitySnapshot(event.data);

        if (payload?.type === "daily.activity.snapshot") {
          applySnapshot(payload, "websocket");
        }
      });

      socket.addEventListener("error", () => {
        if (!isDisposed) {
          setActivityConnectionStatus("degraded");
          setActivityFeedNotice("WebSocket 连接失败，活动流继续使用当前快照。");
        }
      });

      socket.addEventListener("close", () => {
        if (!isDisposed) {
          setActivityConnectionStatus((currentStatus) =>
            currentStatus === "live" ? "closed" : "degraded"
          );
        }
      });

      return socket;
    }

    setActivityConnectionStatus("connecting");
    void fetchActivityEvents();
    const socket = connectActivitySocket();

    return () => {
      isDisposed = true;
      controller.abort();
      socket?.close();
    };
  }, [apiBaseUrl])

  return {
    activityConnectionStatus,
    activityFeedEvents,
    activityFeedNotice,
    activityFeedSource,
    activityLastUpdated
  };
}
