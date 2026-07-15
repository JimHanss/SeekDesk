"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RuntimeMode } from "@seekdesk/shared";

import {
  activeMode,
  createAgentTraceDegradedState,
  createEmptyAgentTraceState,
  formatChatError,
  initialMessages,
  mapAgentTraceResponse,
  readAssistantResponse
} from "../../domain";
import type {
  AgentToolCallTraceItem,
  AgentTraceResponseDto,
  AgentTraceState,
  ChatMessage,
  ChatStatus
} from "../../types";

interface ChatRequestContext {
  templateId?: string | null;
  generateSessionTitle?: boolean;
  contextItemIds?: string[];
  artifactIds?: string[];
  approvalRequestIds?: string[];
  connectorIds?: string[];
  workflowIds?: string[];
  workspaceId?: string;
  runtimeMode?: RuntimeMode;
}

interface UseChatControllerOptions {
  apiBaseUrl: string;
  requestContext?: ChatRequestContext;
  onActivityChanged?: () => Promise<void> | void;
  onSessionTitleChanged?: (session: { sessionId: string; title: string }) => void;
}

export function useChatController({
  apiBaseUrl,
  requestContext,
  onActivityChanged,
  onSessionTitleChanged
}: UseChatControllerOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState<string | null>(
    null
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [agentTrace, setAgentTrace] = useState<AgentTraceState>(
    createEmptyAgentTraceState()
  );
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const endpoint = useMemo(() => `${apiBaseUrl}/api/chat`, [apiBaseUrl]);
  const isBusy = status === "submitting" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await submitCurrentInput();
  }

  async function submitCurrentInput() {
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

    if (!requestContext?.workspaceId || !requestContext.runtimeMode) {
      setError("请先新建对话并选择一个已就绪的工作区。");
      return;
    }

    const userMessage: ChatMessage = {
      id: createClientId(),
      role: "user",
      content: prompt
    };
    const assistantMessage: ChatMessage = {
      id: createClientId(),
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
    setAgentTrace(
      createEmptyAgentTraceState({
        sessionId: activeSessionId,
        syncStatus: "syncing",
        notice: "正在等待模型生成运行计划。"
      })
    );
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const requestContextPayload = createRequestContextPayload({
        ...requestContext,
        generateSessionTitle: !activeSessionId
      });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: activeMode,
          ...(activeSessionId ? { sessionId: activeSessionId } : {}),
          ...(requestContext?.templateId ? { templateId: requestContext.templateId } : {}),
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content
          })),
          ...(requestContextPayload ? { context: requestContextPayload } : {})
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(await formatChatError(response));
      }

      const responseSessionId =
        response.headers.get("x-seekdesk-chat-session-id")?.trim() ??
        activeSessionId;
      const responseProvider =
        response.headers.get("x-seekdesk-chat-provider")?.trim() ?? null;
      const responseSessionTitle = readEncodedHeader(
        response.headers.get("x-seekdesk-chat-session-title")
      );

      if (responseSessionId && responseSessionTitle) {
        onSessionTitleChanged?.({
          sessionId: responseSessionId,
          title: responseSessionTitle
        });
      }

      if (responseSessionId) {
        setActiveSessionId(responseSessionId);
        setAgentTrace(
          createEmptyAgentTraceState({
            sessionId: responseSessionId,
            provider: responseProvider,
            syncStatus: "syncing",
            notice: "模型流已连接，完成后同步运行详情。"
          })
        );
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
      if (responseSessionId) {
        void refreshAgentTrace(responseSessionId, responseProvider).finally(() => {
          void onActivityChanged?.();
        });
      } else {
        void onActivityChanged?.();
      }
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

  function retryLastPrompt() {
    if (!lastSubmittedPrompt || isBusy) {
      return;
    }

    void submitPrompt(lastSubmittedPrompt);
  }

  const refreshAgentTrace = useCallback(async (
    sessionId: string | null = null,
    provider: string | null = null
  ) => {
    if (!sessionId) {
      return;
    }

    setAgentTrace((current) => ({
      ...current,
      sessionId,
      provider,
      syncStatus: "syncing",
      notice: "Refreshing agent trace from the API."
    }));

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/chat/sessions/${encodeURIComponent(sessionId)}/trace`
      );

      if (!response.ok) {
        throw new Error(`Trace API returned ${response.status}`);
      }

      const payload = (await response.json()) as AgentTraceResponseDto;
      setAgentTrace(mapAgentTraceResponse(payload, { sessionId, provider }));
    } catch (traceError) {
      setAgentTrace(
        createAgentTraceDegradedState({
          sessionId,
          provider,
          reason: traceError instanceof Error ? traceError.message : "unknown error"
        })
      );
    }
  }, [apiBaseUrl]);

  const authorizeToolCallForSession = useCallback(async (
    toolCall: AgentToolCallTraceItem
  ) => {
    if (!activeSessionId) {
      return;
    }

    const response = await fetch(apiBaseUrl + "/api/coding/permission-grants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: activeMode,
        provider: requestContext?.runtimeMode,
        sessionId: activeSessionId,
        ...(requestContext?.workspaceId
          ? { workspaceId: requestContext.workspaceId }
          : {}),
        ...(requestContext?.runtimeMode
          ? { runtimeMode: requestContext.runtimeMode }
          : {}),
        action: toolCall.name,
        reason: "User allowed this coding tool for the current session."
      })
    });

    if (!response.ok) {
      throw new Error(await formatChatError(response));
    }

    await refreshAgentTrace(activeSessionId, agentTrace.provider);
    await onActivityChanged?.();
  }, [activeSessionId, agentTrace.provider, apiBaseUrl, onActivityChanged, refreshAgentTrace, requestContext?.runtimeMode, requestContext?.workspaceId]);

  const executeToolCall = useCallback(async (toolCall: AgentToolCallTraceItem) => {
    if (!activeSessionId) {
      return;
    }

    const response = await fetch(
      apiBaseUrl + "/api/coding/tool-calls/" + encodeURIComponent(toolCall.id) + "/execute",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: activeMode,
          sessionId: activeSessionId,
          ...(requestContext?.workspaceId
            ? { workspaceId: requestContext.workspaceId }
            : {}),
          ...(requestContext?.runtimeMode
            ? { runtimeMode: requestContext.runtimeMode }
            : {})
        })
      }
    );

    if (!response.ok) {
      throw new Error(await formatChatError(response));
    }

    await refreshAgentTrace(activeSessionId, agentTrace.provider);
    await onActivityChanged?.();
  }, [activeSessionId, agentTrace.provider, apiBaseUrl, onActivityChanged, refreshAgentTrace, requestContext?.runtimeMode, requestContext?.workspaceId]);

  const startCurrentConversation = useCallback(() => {
    abortRef.current?.abort();
    setActiveSessionId(null);
    setMessages(initialMessages);
    setInput("");
    setError(null);
    setLastSubmittedPrompt(null);
    setStatus("idle");
    setAgentTrace(createEmptyAgentTraceState());
  }, []);

  const loadSessionMessages = useCallback(
    (sessionId: string, sessionMessages: ChatMessage[]) => {
      abortRef.current?.abort();
      setActiveSessionId(sessionId);
      setMessages(sessionMessages);
      setError(null);
      setLastSubmittedPrompt(null);
      setStatus("idle");
      setAgentTrace(
        createEmptyAgentTraceState({
          sessionId,
          syncStatus: "syncing",
          notice: "Loaded session history; syncing agent trace for the selected conversation."
        })
      );
      void refreshAgentTrace(sessionId);
    },
    [refreshAgentTrace]
  );

  return {
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
    refreshAgentTrace,
    retryLastPrompt,
    setError,
    setInput,
    startCurrentConversation,
    submitCurrentInput,
    status
  };
}


function readEncodedHeader(value: string | null) {
  if (!value?.trim()) {
    return null;
  }

  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
}

function createRequestContextPayload(context: ChatRequestContext | undefined) {
  const locale = typeof navigator !== "undefined" ? navigator.language : undefined;
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined;
  const payload: Record<string, unknown> = {};

  assignIds(payload, "contextItemIds", context?.contextItemIds);
  assignIds(payload, "artifactIds", context?.artifactIds);
  assignIds(payload, "approvalRequestIds", context?.approvalRequestIds);
  assignIds(payload, "connectorIds", context?.connectorIds);
  assignIds(payload, "workflowIds", context?.workflowIds);

  if (context?.generateSessionTitle) {
    payload["generateSessionTitle"] = true;
  }

  if (locale) {
    payload["locale"] = locale;
  }

  if (timezone) {
    payload["timezone"] = timezone;
  }

  if (context?.workspaceId) {
    payload["workspaceId"] = context.workspaceId;
  }

  if (context?.runtimeMode) {
    payload["runtimeMode"] = context.runtimeMode;
  }

  return Object.keys(payload).length ? payload : undefined;
}

function assignIds(
  payload: Record<string, unknown>,
  key:
    | "contextItemIds"
    | "artifactIds"
    | "approvalRequestIds"
    | "connectorIds"
    | "workflowIds",
  values: string[] | undefined
) {
  const ids = Array.from(
    new Set(values?.map((value) => value.trim()).filter(Boolean) ?? [])
  );
  if (ids.length) {
    payload[key] = ids;
  }
}

function createClientId() {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function") {
    return randomUuid.call(globalThis.crypto);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
