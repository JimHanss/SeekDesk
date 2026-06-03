"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  FileCode2,
  Files,
  GitBranch,
  Loader2,
  MessageSquare,
  Play,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Square,
  Terminal,
  User
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";
type ChatStatus = "idle" | "submitting" | "streaming" | "error";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_SEEKDESK_API_URL ?? "http://127.0.0.1:4000";

const fileItems = [
  "apps/web/src/app/page.tsx",
  "apps/api/src/server.ts",
  "apps/daemon/src/cli.ts",
  "packages/shared/src/realtime-events.ts"
];

const toolEvents = [
  { label: "list_files", status: "待读取", tone: "text-slate-600" },
  { label: "read_file", status: "需确认", tone: "text-amber-700" },
  { label: "grep", status: "已排队", tone: "text-blue-700" }
];

const initialMessages: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content:
      "已完成基础架构初始化。你可以发送一个任务，我会通过后端流式接口返回响应；下一阶段将接入 DeepSeek、只读工具和权限确认流程。"
  }
];

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isBusy = status === "submitting" || status === "streaming";
  const endpoint = useMemo(
    () => `${apiBaseUrl.replace(/\/$/, "")}/api/chat`,
    []
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = input.trim();
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

    abortRef.current = controller;
    setInput("");
    setError(null);
    setStatus("submitting");
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((message) => ({
            role: message.role,
            content: message.content
          }))
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`);
      }

      if (!response.body) {
        throw new Error("后端没有返回可读取的流。");
      }

      setStatus("streaming");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        appendAssistantDelta(assistantMessage.id, chunk);
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        appendAssistantDelta(assistantMessage.id, finalChunk);
      }

      setStatus("idle");
    } catch (requestError) {
      if (controller.signal.aborted) {
        appendAssistantDelta(assistantMessage.id, "\n\n任务已取消。");
        setStatus("idle");
      } else {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "发送请求时出现未知错误。";

        setError(message);
        setStatus("error");
        appendAssistantDelta(assistantMessage.id, `\n\n${message}`);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  function appendAssistantDelta(messageId: string, delta: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, content: `${message.content}${delta}` }
          : message
      )
    );
  }

  function cancelRequest() {
    abortRef.current?.abort();
  }

  return (
    <main className="min-h-screen px-4 py-4 text-slate-900 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_18px_70px_rgba(15,23,42,0.10)]">
        <header className="flex flex-col gap-4 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-blue-600 text-white shadow-sm">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading truncate text-xl font-semibold tracking-normal text-slate-950">
                SeekDesk
              </h1>
              <p className="truncate text-sm text-slate-600">
                DeepSeek 原生 Web 编码 Agent 工作台
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm">
              <Search className="size-4" aria-hidden="true" />
              搜索
            </Button>
            <Button variant="secondary" size="sm">
              <Settings className="size-4" aria-hidden="true" />
              设置
            </Button>
            <Button size="sm">
              <Play className="size-4" aria-hidden="true" />
              连接项目
            </Button>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 bg-slate-50 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
            <PanelHeader
              icon={<Files className="size-4" aria-hidden="true" />}
              title="工作区"
            />
            <div className="space-y-2 px-3 pb-4">
              <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="font-medium text-slate-950">本地 daemon</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className="size-2 rounded-full bg-amber-500" />
                  等待连接
                </div>
              </div>

              <div className="space-y-1">
                {fileItems.map((item) => (
                  <button
                    key={item}
                    className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 text-left text-sm text-slate-700 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                    type="button"
                  >
                    <FileCode2 className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="flex min-h-[680px] flex-col bg-white">
            <PanelHeader
              icon={<MessageSquare className="size-4" aria-hidden="true" />}
              title="Agent 会话"
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
              {messages.map((message, index) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  streaming={
                    status === "streaming" &&
                    message.role === "assistant" &&
                    index === messages.length - 1
                  }
                />
              ))}

              {error ? (
                <div className="flex items-start gap-2 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}

              <CodePreview />
            </div>

            <form className="border-t border-slate-200 bg-white p-4" onSubmit={handleSubmit}>
              <div className="flex min-h-14 items-center gap-3 rounded-[8px] border border-slate-300 bg-white px-3 py-2 shadow-inner focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="输入编码任务，例如：总结这个仓库"
                  aria-label="输入编码任务"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={isBusy}
                />
                <Button size="sm" type="submit" disabled={!input.trim() || isBusy}>
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
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>Endpoint: {endpoint}</span>
                <span>状态: {statusLabel(status)}</span>
              </div>
            </form>
          </section>

          <aside className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            <PanelHeader
              icon={<Activity className="size-4" aria-hidden="true" />}
              title="任务状态"
            />
            <div className="space-y-4 px-3 pb-4">
              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-950">
                  <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                  权限模式
                </div>
                <div className="rounded-[6px] border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
                  默认确认写入和命令
                </div>
              </div>

              <div className="space-y-2">
                {toolEvents.map((event) => (
                  <div
                    key={event.label}
                    className="flex items-center justify-between rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-slate-700">{event.label}</span>
                    <span className={event.tone}>{event.status}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-white p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-950">
                  <GitBranch className="size-4 text-blue-700" aria-hidden="true" />
                  变更审查
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="size-4 text-slate-400" aria-hidden="true" />
                  Diff review 待接入
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ChatBubble({
  message,
  streaming
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-[8px] bg-blue-50 text-blue-700">
          <Bot className="size-4" aria-hidden="true" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[min(720px,100%)] rounded-[8px] border px-4 py-3 text-sm leading-6",
          isUser
            ? "border-blue-200 bg-blue-600 text-white"
            : "border-slate-200 bg-slate-50 text-slate-700"
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-xs font-medium opacity-80">
          {isUser ? (
            <User className="size-3.5" aria-hidden="true" />
          ) : (
            <Bot className="size-3.5" aria-hidden="true" />
          )}
          {isUser ? "你" : "DeepSeek Agent"}
        </div>
        <p className="whitespace-pre-wrap break-words">
          {message.content || (streaming ? "正在生成响应" : "")}
          {streaming ? <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-blue-500 align-[-2px]" /> : null}
        </p>
      </div>
    </div>
  );
}

function CodePreview() {
  return (
    <div className="rounded-[8px] border border-slate-800 bg-slate-950 p-4 text-sm text-slate-100 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal className="size-4" aria-hidden="true" />
          <span>chat-stream.ts</span>
        </div>
        <span className="rounded-[6px] bg-blue-500/15 px-2 py-1 text-xs text-blue-200">
          syntax preview
        </span>
      </div>
      <pre className="overflow-x-auto whitespace-pre text-[13px] leading-6">
        <code>
          <span className="text-sky-300">const</span>{" "}
          <span className="text-emerald-300">reader</span>{" "}
          <span className="text-slate-400">=</span>{" "}
          <span className="text-violet-300">response</span>
          <span className="text-slate-300">.</span>
          <span className="text-amber-300">body</span>
          <span className="text-slate-300">?.</span>
          <span className="text-amber-300">getReader</span>
          <span className="text-slate-300">();</span>
          <br />
          <span className="text-sky-300">while</span>{" "}
          <span className="text-slate-300">(</span>
          <span className="text-rose-300">streaming</span>
          <span className="text-slate-300">) append(delta);</span>
        </code>
      </pre>
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  action
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
        <span className="text-slate-500">{icon}</span>
        <span className="truncate">{title}</span>
      </div>
      {action}
    </div>
  );
}

function statusLabel(status: ChatStatus) {
  switch (status) {
    case "submitting":
      return "连接后端";
    case "streaming":
      return "接收流式响应";
    case "error":
      return "请求失败";
    case "idle":
    default:
      return "空闲";
  }
}
