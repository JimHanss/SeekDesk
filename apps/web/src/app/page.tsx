"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  Brain,
  CalendarClock,
  CheckCircle2,
  Code2,
  FileText,
  Library,
  Loader2,
  MessageSquare,
  Network,
  Play,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  User,
  Wand2,
  Workflow
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppMode = "daily_work" | "coding_agent";
type ChatRole = "user" | "assistant";
type ChatStatus = "idle" | "submitting" | "streaming" | "error";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const activeMode: AppMode = "daily_work";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_SEEKDESK_API_URL ?? "http://127.0.0.1:4000";

const workModes = [
  { icon: FileText, label: "写作润色", detail: "邮件、方案、报告、周报" },
  { icon: Search, label: "资料研究", detail: "检索、摘要、对比、出处" },
  { icon: CalendarClock, label: "会议整理", detail: "纪要、待办、跟进提醒" },
  { icon: Workflow, label: "流程自动化", detail: "跨应用任务和模板" },
  { icon: Library, label: "知识库问答", detail: "文档、链接、个人资料库" }
];

const ecosystemSignals = [
  { label: "DeepSeek", status: "默认模型", tone: "text-teal-700" },
  { label: "日常工作模式", status: "当前开发", tone: "text-orange-700" },
  { label: "编码模式", status: "兼容预留", tone: "text-slate-600" }
];

const initialMessages: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content:
      "SeekDesk 当前运行在日常工作模式。你可以让我起草邮件、整理会议纪要、研究主题、拆解任务，或规划一个跨工具的工作流。编码模式会保留在架构中，后续再扩展。"
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
          mode: activeMode,
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

  function usePrompt(prompt: string) {
    setInput(prompt);
  }

  return (
    <main className="min-h-screen px-4 py-4 text-teal-950 md:px-6">
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
                面向日常工作的 AI 生态工作台
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
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
              <Play className="size-4" aria-hidden="true" />
              新建工作流
            </Button>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 bg-teal-50/40 lg:grid-cols-[290px_minmax(0,1fr)_320px]">
          <aside className="border-b border-teal-100 bg-white lg:border-b-0 lg:border-r">
            <PanelHeader
              icon={<Network className="size-4" aria-hidden="true" />}
              title="AI 生态"
            />
            <div className="space-y-3 px-3 pb-4">
              <div className="rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-3 text-sm text-teal-900">
                <div className="font-medium text-teal-950">日常工作空间</div>
                <div className="mt-1 text-xs text-teal-700">
                  汇聚模型、知识、工具与自动化流程
                </div>
              </div>

              <div className="space-y-1">
                {workModes.map((mode) => (
                  <button
                    key={mode.label}
                    className="flex min-h-12 w-full cursor-pointer items-start gap-2 rounded-[6px] px-2 py-2 text-left text-sm text-teal-900 transition-colors duration-200 hover:bg-teal-50 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                    type="button"
                    onClick={() => usePrompt(`帮我处理一个${mode.label}任务：`)}
                  >
                    <mode.icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-medium">{mode.label}</span>
                      <span className="block truncate text-xs text-teal-600">
                        {mode.detail}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <Code2 className="size-4" aria-hidden="true" />
                  编码模式
                </div>
                <p className="text-xs leading-5">
                  架构保留 Coding Agent 能力位，当前版本只开发日常工作模式。
                </p>
              </div>
            </div>
          </aside>

          <section className="flex min-h-[680px] flex-col bg-white">
            <PanelHeader
              icon={<MessageSquare className="size-4" aria-hidden="true" />}
              title="AI 工作助理"
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
                  icon={<Wand2 className="size-4" aria-hidden="true" />}
                  title="起草邮件"
                  text="帮我写一封给客户的项目进展邮件，语气专业、简洁。"
                  onClick={usePrompt}
                />
                <PromptCard
                  icon={<Brain className="size-4" aria-hidden="true" />}
                  title="研究主题"
                  text="帮我梳理一个新行业主题，给出关键问题、资料方向和行动清单。"
                  onClick={usePrompt}
                />
                <PromptCard
                  icon={<CalendarClock className="size-4" aria-hidden="true" />}
                  title="整理会议"
                  text="把这段会议记录整理成纪要、决策和待办事项。"
                  onClick={usePrompt}
                />
              </div>

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

              <WorkflowPreview />
            </div>

            <form className="border-t border-teal-100 bg-white p-4" onSubmit={handleSubmit}>
              <div className="flex min-h-14 items-center gap-3 rounded-[8px] border border-teal-200 bg-white px-3 py-2 shadow-inner focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-teal-950 outline-none placeholder:text-teal-500"
                  placeholder="输入日常工作任务，例如：整理会议纪要、写邮件、做资料研究"
                  aria-label="输入日常工作任务"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={isBusy}
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
                <span>模式: 日常工作</span>
                <span>状态: {statusLabel(status)}</span>
              </div>
            </form>
          </section>

          <aside className="border-t border-teal-100 bg-white lg:border-l lg:border-t-0">
            <PanelHeader
              icon={<Activity className="size-4" aria-hidden="true" />}
              title="生态状态"
            />
            <div className="space-y-4 px-3 pb-4">
              <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                  <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                  工作数据边界
                </div>
                <div className="rounded-[6px] border border-teal-200 bg-white px-3 py-2 text-sm text-teal-900">
                  默认仅处理当前会话输入，连接器需要单独授权。
                </div>
              </div>

              <div className="space-y-2">
                {ecosystemSignals.map((event) => (
                  <div
                    key={event.label}
                    className="flex items-center justify-between rounded-[8px] border border-teal-100 bg-white px-3 py-2 text-sm"
                  >
                    <span className="text-teal-900">{event.label}</span>
                    <span className={event.tone}>{event.status}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                  <CheckCircle2 className="size-4 text-orange-600" aria-hidden="true" />
                  下一步能力
                </div>
                <div className="space-y-2 text-sm text-teal-700">
                  <p>个人知识库导入</p>
                  <p>常用工作流模板</p>
                  <p>会议、邮件、日程连接器</p>
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
        <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
          <Bot className="size-4" aria-hidden="true" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[min(720px,100%)] rounded-[8px] border px-4 py-3 text-sm leading-6",
          isUser
            ? "border-orange-200 bg-orange-500 text-white"
            : "border-teal-100 bg-teal-50 text-teal-900"
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-xs font-medium opacity-80">
          {isUser ? (
            <User className="size-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="size-3.5" aria-hidden="true" />
          )}
          {isUser ? "你" : "SeekDesk"}
          {streaming ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
        </div>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
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
    <div className="flex h-14 items-center justify-between border-b border-teal-100 px-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
        <span className="text-teal-700">{icon}</span>
        {title}
      </div>
      {action}
    </div>
  );
}

function PromptCard({
  icon,
  title,
  text,
  onClick
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: (prompt: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="min-h-28 rounded-[8px] border border-teal-100 bg-white p-3 text-left text-sm shadow-sm transition-colors duration-200 hover:border-teal-300 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
    >
      <span className="mb-3 flex items-center gap-2 font-medium text-teal-950">
        <span className="grid size-7 place-items-center rounded-[6px] bg-teal-50 text-teal-700">
          {icon}
        </span>
        {title}
      </span>
      <span className="block text-xs leading-5 text-teal-700">{text}</span>
    </button>
  );
}

function WorkflowPreview() {
  const codeLines = [
    { token: "const", text: "const workflow = createDailyWorkflow({" },
    { token: "key", text: "  mode: " },
    { token: "string", text: "\"daily_work\"," },
    { token: "key", text: "  inputs: " },
    { token: "string", text: "[\"meeting_notes\", \"customer_email\"]," },
    { token: "key", text: "  outputs: " },
    { token: "string", text: "[\"summary\", \"tasks\", \"reply_draft\"]" },
    { token: "plain", text: "});" }
  ];

  return (
    <div className="rounded-[8px] border border-teal-100 bg-slate-950 p-4 text-sm text-slate-100 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
        <span>daily-workflow.ts</span>
        <span>syntax highlighted</span>
      </div>
      <pre className="overflow-x-auto">
        <code>
          {codeLines.map((line, index) => (
            <span key={`${line.text}-${index}`} className="block">
              <span className="mr-4 select-none text-slate-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  line.token === "const" && "text-orange-300",
                  line.token === "key" && "text-teal-300",
                  line.token === "string" && "text-lime-300",
                  line.token === "plain" && "text-slate-200"
                )}
              >
                {line.text}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function statusLabel(status: ChatStatus) {
  switch (status) {
    case "idle":
      return "空闲";
    case "submitting":
      return "连接中";
    case "streaming":
      return "接收中";
    case "error":
      return "出错";
  }
}
