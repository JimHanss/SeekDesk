"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Code2,
  FileText,
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
  Target,
  User,
  Wand2,
  Workflow,
  type LucideIcon
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

interface TemplateItem {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
}

interface ArtifactItem {
  title: string;
  description: string;
  state: string;
  icon: LucideIcon;
}

const activeMode: AppMode = "daily_work";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_SEEKDESK_API_URL ?? "http://127.0.0.1:4000";

const templates: TemplateItem[] = [
  {
    id: "email-draft",
    title: "Email Draft",
    description: "Polished note to a client or teammate",
    prompt:
      "Draft a concise, professional email that summarizes the update below, highlights the main decision, and ends with a clear next step.\n\nContext:\n- Project:\n- Audience:\n- Key update:\n- Action requested:\n- Tone: clear, warm, professional",
    icon: Mail
  },
  {
    id: "meeting-summary",
    title: "Meeting Summary",
    description: "Turn notes into decisions and action items",
    prompt:
      "Turn these meeting notes into a structured summary with sections for overview, key decisions, open questions, and action items. Make it ready to share with the team.\n\nNotes:\n",
    icon: Presentation
  },
  {
    id: "research-brief",
    title: "Research Brief",
    description: "Condense findings into a one-page brief",
    prompt:
      "Create a research brief with the problem statement, what we know, what we still need to verify, and a recommended next step. Keep it concise and decision-oriented.\n\nResearch topic:\nEvidence:\nConstraints:\n",
    icon: Search
  },
  {
    id: "weekly-report",
    title: "Weekly Report",
    description: "Summarize progress, risks, and priorities",
    prompt:
      "Write a weekly report for the team using this structure: progress this week, blockers or risks, notable wins, and priorities for next week.\n\nProject context:\nWins:\nRisks:\nNext priorities:\n",
    icon: CalendarClock
  },
  {
    id: "task-plan",
    title: "Task Plan",
    description: "Break a goal into practical next actions",
    prompt:
      "Create a task plan for the goal below. Break it into phases, list the next 5 actionable tasks, and call out dependencies or risks.\n\nGoal:\nDeadline:\nConstraints:\n",
    icon: Target
  },
  {
    id: "knowledge-qa",
    title: "Knowledge Q&A",
    description: "Answer from notes, docs, or context",
    prompt:
      "Answer the question below using only the provided context. If the context is incomplete, say what is missing and ask for the minimum extra detail needed.\n\nQuestion:\nContext:\n",
    icon: FileText
  }
];

const artifacts: ArtifactItem[] = [
  {
    title: "Summary",
    description: "A clean recap with decisions and next steps",
    state: "planned",
    icon: FileText
  },
  {
    title: "Task list",
    description: "Actionable follow-up items with owners and timing",
    state: "queued",
    icon: Workflow
  },
  {
    title: "Email draft",
    description: "A ready-to-send update for stakeholders",
    state: "draft",
    icon: Mail
  },
  {
    title: "Research note",
    description: "Concise findings and open questions",
    state: "ready",
    icon: Search
  }
];

const initialMessages: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content:
      "Welcome to SeekDesk daily work mode. Use a template on the left to prefill the composer, then refine the prompt and stream the result into the chat. The coding-agent experience remains reserved in the architecture, but it is not exposed in this milestone."
  }
];

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
        throw new Error(`Request failed with status ${response.status}.`);
      }

      if (!response.body) {
        throw new Error("The backend did not return a readable stream.");
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
        appendAssistantDelta(assistantMessage.id, "\n\nRequest canceled.");
        setStatus("idle");
      } else {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unknown error occurred while sending the request.";

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
    inputRef.current?.focus();
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
                Daily work templates, streaming chat, and reusable outputs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm">
              <Search className="size-4" aria-hidden="true" />
              Search
            </Button>
            <Button variant="secondary" size="sm">
              <PanelLeft className="size-4" aria-hidden="true" />
              Templates
            </Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
              <Play className="size-4" aria-hidden="true" />
              New work run
            </Button>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 bg-teal-50/40 lg:grid-cols-[304px_minmax(0,1fr)_336px]">
          <aside className="border-b border-teal-100 bg-white lg:border-b-0 lg:border-r">
            <PanelHeader
              icon={<Wand2 className="size-4" aria-hidden="true" />}
              title="Template Library"
            />
            <div className="space-y-3 px-3 pb-4 pt-3">
              <div className="rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-3 text-sm text-teal-900">
                <div className="font-medium text-teal-950">Daily work mode</div>
                <div className="mt-1 text-xs leading-5 text-teal-700">
                  Pick a template to seed the composer with a realistic prompt, then edit it for the task at hand.
                </div>
              </div>

              <div className="space-y-2">
                {templates.map((template) => {
                  const Icon = template.icon;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => usePrompt(template.prompt)}
                      className="flex min-h-16 w-full items-start gap-3 rounded-[8px] border border-teal-100 bg-white px-3 py-3 text-left transition-colors duration-200 hover:border-teal-300 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-teal-950">
                          {template.title}
                        </span>
                        <span className="block text-xs leading-5 text-teal-700">
                          {template.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <Code2 className="size-4" aria-hidden="true" />
                  Coding agent compatibility
                </div>
                <p className="text-xs leading-5">
                  The coding-agent mode remains part of the product architecture, but this branch only exposes daily work.
                </p>
              </div>
            </div>
          </aside>

          <section className="flex min-h-[680px] min-w-0 flex-col bg-white">
            <PanelHeader
              icon={<MessageSquare className="size-4" aria-hidden="true" />}
              title="Daily Work Chat"
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Cancel request"
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
                  title="Email draft"
                  text="Write a concise status email for a client update, including the result, the timeline, and a clear next step."
                  onClick={usePrompt}
                />
                <PromptCard
                  icon={<Presentation className="size-4" aria-hidden="true" />}
                  title="Meeting summary"
                  text="Turn these notes into a shareable summary with decisions, owners, risks, and follow-up actions."
                  onClick={usePrompt}
                />
                <PromptCard
                  icon={<Search className="size-4" aria-hidden="true" />}
                  title="Research brief"
                  text="Condense the latest findings into a crisp brief that calls out what is known, what is missing, and the recommended next step."
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
            </div>

            <form className="border-t border-teal-100 bg-white p-4" onSubmit={handleSubmit}>
              <div className="flex min-h-14 items-center gap-3 rounded-[8px] border border-teal-200 bg-white px-3 py-2 shadow-inner focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                <input
                  ref={inputRef}
                  className="min-w-0 flex-1 bg-transparent text-sm text-teal-950 outline-none placeholder:text-teal-500"
                  placeholder="Type a daily work request, for example: draft a client update, summarize a meeting, or turn notes into a task plan"
                  aria-label="Daily work prompt"
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
                    ? "Connecting"
                    : status === "streaming"
                      ? "Receiving"
                      : "Send"}
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-teal-600">
                <span>Endpoint: {endpoint}</span>
                <span>Mode: daily_work</span>
                <span>Status: {statusLabel(status)}</span>
              </div>
            </form>
          </section>

          <aside className="border-t border-teal-100 bg-white lg:border-l lg:border-t-0">
            <PanelHeader
              icon={<Workflow className="size-4" aria-hidden="true" />}
              title="Artifacts & Status"
            />
            <div className="space-y-4 px-3 pb-4 pt-3">
              <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                  <CheckCircle2 className="size-4 text-teal-700" aria-hidden="true" />
                  Planned outputs
                </div>
              <div className="space-y-2">
                  {artifacts.map((artifact) => {
                    const Icon = artifact.icon;

                    return (
                      <div
                        key={artifact.title}
                        className="flex items-start gap-3 rounded-[8px] border border-teal-100 bg-white px-3 py-2"
                      >
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-teal-950">
                              {artifact.title}
                            </span>
                            <span className="shrink-0 rounded-[999px] bg-teal-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-teal-700">
                              {artifact.state}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-teal-700">
                            {artifact.description}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                  <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
                  Mode snapshot
                </div>
                <div className="space-y-2 text-sm text-teal-700">
                  <StatusRow label="Current mode" value="daily_work" />
                  <StatusRow label="Chat transport" value="Streaming" />
                  <StatusRow label="Artifact source" value="Client-side preview" />
                </div>
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <Code2 className="size-4" aria-hidden="true" />
                  Coding mode compatibility
                </div>
                <p className="text-xs leading-5">
                  The app architecture still reserves space for coding-agent mode, but there are no exposed tools or controls in this daily-work branch.
                </p>
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
          {isUser ? "You" : "SeekDesk"}
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

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2">
      <span className="text-xs font-medium text-teal-700">{label}</span>
      <span className="truncate text-sm text-teal-950">{value}</span>
    </div>
  );
}

function statusLabel(status: ChatStatus) {
  switch (status) {
    case "idle":
      return "Idle";
    case "submitting":
      return "Connecting";
    case "streaming":
      return "Streaming";
    case "error":
      return "Error";
  }
}
