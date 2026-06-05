"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  activeMode,
  formatChatError,
  initialMessages,
  readAssistantResponse
} from "../../domain";
import type {
  ChatMessage,
  ChatStatus
} from "../../types";

interface UseChatControllerOptions {
  apiBaseUrl: string;
}

export function useChatController({ apiBaseUrl }: UseChatControllerOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState<string | null>(
    null
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

  function retryLastPrompt() {
    if (!lastSubmittedPrompt || isBusy) {
      return;
    }

    void submitPrompt(lastSubmittedPrompt);
  }

  return {
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
  };
}
