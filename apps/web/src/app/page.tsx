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

interface ContextItem {
  id: string;
  title: string;
  source: string;
  sourceType: string;
  status: string;
  summary: string;
  privacy: string;
  prompt: string;
  icon: LucideIcon;
}

type ApprovalStatus = "waiting" | "allowed_once" | "denied" | "blocked";
type ApprovalRisk = "低" | "中" | "高" | "极高";

interface ApprovalRequestItem {
  id: string;
  title: string;
  requestedAction: string;
  scope: string;
  risk: ApprovalRisk;
  status: ApprovalStatus;
  detail: string;
  icon: LucideIcon;
}

const activeMode: AppMode = "daily_work";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_SEEKDESK_API_URL ?? "http://127.0.0.1:4000";

const templates: TemplateItem[] = [
  {
    id: "email-draft",
    title: "邮件起草",
    description: "把要点整理成专业、清晰的邮件",
    prompt:
      "帮我起草一封简洁专业的邮件，说明下面的进展、关键决定和下一步行动。\n\n背景：\n- 项目：\n- 收件人：\n- 关键进展：\n- 需要对方行动：\n- 语气：清晰、友好、专业",
    icon: Mail
  },
  {
    id: "meeting-summary",
    title: "会议纪要",
    description: "从记录中提取决策、待办和风险",
    prompt:
      "请把下面的会议记录整理成可分享的纪要，包含：概览、关键决策、待办事项、负责人、风险和开放问题。\n\n会议记录：\n",
    icon: Presentation
  },
  {
    id: "research-brief",
    title: "资料研究",
    description: "把调研素材压缩成一页简报",
    prompt:
      "请生成一份资料研究简报，包含：问题背景、已知信息、仍需验证的内容、可引用依据和建议下一步。\n\n研究主题：\n已收集资料：\n限制条件：\n",
    icon: Search
  },
  {
    id: "weekly-report",
    title: "周报整理",
    description: "总结进展、风险和下周优先级",
    prompt:
      "请把下面的信息整理成一份周报，结构为：本周进展、主要成果、风险/阻塞、下周优先级。\n\n项目背景：\n本周完成：\n风险：\n下周计划：\n",
    icon: CalendarClock
  },
  {
    id: "task-plan",
    title: "任务计划",
    description: "把目标拆解成可执行步骤",
    prompt:
      "请为下面的目标制定任务计划，拆成阶段、列出接下来的 5 个可执行动作，并标注依赖、风险和验收标准。\n\n目标：\n截止时间：\n约束：\n",
    icon: Target
  },
  {
    id: "knowledge-qa",
    title: "知识问答",
    description: "基于上下文回答问题并指出缺口",
    prompt:
      "请仅基于我提供的上下文回答问题。如果上下文不足，请说明缺少什么，并只追问最少必要信息。\n\n问题：\n上下文：\n",
    icon: FileText
  }
];

const contextItems: ContextItem[] = [
  {
    id: "project-brief",
    title: "项目简报",
    source: "内部周报 / 产品组",
    sourceType: "Brief",
    status: "已确认",
    summary: "本周目标、里程碑、风险和依赖已经对齐，适合扩展为日常更新。",
    privacy: "仅项目成员可见",
    prompt:
      "请基于「项目简报」帮我整理一版日常工作更新，重点说明本周目标、当前进展、风险和下一步动作。",
    icon: Target
  },
  {
    id: "meeting-notes",
    title: "会议记录",
    source: "周三例会 / 语音转写",
    sourceType: "Meeting",
    status: "待核验",
    summary: "记录了关键决策、行动项和负责人，适合继续压缩成可分享摘要。",
    privacy: "仅当前会话可用",
    prompt:
      "请基于「会议记录」整理一份可分享的会议摘要，输出关键决策、待办事项、负责人和开放问题。",
    icon: Presentation
  },
  {
    id: "customer-email",
    title: "客户邮件",
    source: "support@customer.com",
    sourceType: "Email",
    status: "需确认",
    summary: "客户询问交付时间、范围变更和验收口径，适合生成克制且专业的回复草稿。",
    privacy: "敏感信息，需确认引用范围",
    prompt:
      "请基于「客户邮件」帮我起草回复，先确认客户关心的交付时间、范围变更和验收口径，再给出专业且克制的回应。",
    icon: Mail
  },
  {
    id: "research-links",
    title: "研究链接",
    source: "公开资料 / 行业报告",
    sourceType: "Links",
    status: "已归档",
    summary: "包含竞品分析、行业报告和参考文章，适合整理成研究简报或引用清单。",
    privacy: "公开来源，可直接引用",
    prompt:
      "请基于「研究链接」整理一份研究简报，概括结论、可引用依据和仍需验证的点。",
    icon: Globe
  },
  {
    id: "team-notes",
    title: "团队备忘",
    source: "团队群 / 个人笔记",
    sourceType: "Notes",
    status: "草稿",
    summary: "散落的讨论点、待同步事项和后续跟进，适合转换成任务清单。",
    privacy: "内部草稿，不可外发",
    prompt:
      "请基于「团队备忘」整理出下一步行动清单，标出优先级、负责人和依赖关系。",
    icon: ShieldCheck
  }
];

const artifacts: ArtifactItem[] = [
  {
    title: "会议摘要",
    description: "关键决策、风险和下一步行动的清晰回顾",
    state: "planned",
    icon: FileText
  },
  {
    title: "任务清单",
    description: "带负责人、时限和依赖关系的可执行事项",
    state: "queued",
    icon: Workflow
  },
  {
    title: "邮件草稿",
    description: "可继续润色或复制给利益相关人的更新",
    state: "draft",
    icon: Mail
  },
  {
    title: "研究笔记",
    description: "浓缩发现、引用方向和待验证问题",
    state: "ready",
    icon: Search
  }
];

const initialMessages: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content:
      "SeekDesk 当前运行在日常工作模式。你可以从左侧模板快速开始，也可以从右侧选择会话知识上下文；当前版本只引用会话级示例，不读取真实文件或外部文档。"
  }
];

const initialApprovalRequests: ApprovalRequestItem[] = [
  {
    id: "read-customer-email",
    title: "读取客户邮件上下文",
    requestedAction: "查看客户诉求并提炼回复要点",
    scope: "仅限本次会话中已确认的客户邮件摘要，不扩散到其他联系人。",
    risk: "高",
    status: "waiting",
    detail:
      "涉及外部客户信息，建议先确认范围，再决定是否用于草拟回复。",
    icon: Mail
  },
  {
    id: "use-meeting-notes",
    title: "使用内部会议记录",
    requestedAction: "压缩会议记录为可分享纪要",
    scope: "仅限当前项目会议纪要，不读取其他项目或私人笔记。",
    risk: "中",
    status: "allowed_once",
    detail: "适合一次性整理为工作产物，输出后仍保留可回溯说明。",
    icon: Presentation
  },
  {
    id: "draft-external-reply",
    title: "起草外部回复",
    requestedAction: "生成可发送给客户的专业草稿",
    scope: "仅使用已批准上下文，不触发外部发送或自动化动作。",
    risk: "极高",
    status: "blocked",
    detail: "一旦进入外发语境，需要明确授权边界，避免误发敏感信息。",
    icon: AlertCircle
  },
  {
    id: "schedule-follow-up",
    title: "安排日历跟进",
    requestedAction: "为后续沟通创建跟进提醒",
    scope: "仅生成日历建议，不直接访问真实日历或联系人列表。",
    risk: "低",
    status: "denied",
    detail: "可以保留为手动执行建议，但当前不做自动排程。",
    icon: CalendarClock
  }
];

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequestItem[]>(
    initialApprovalRequests
  );
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
    const nextMessages = [...messages, userMessage];

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
          messages: nextMessages.map((message) => ({
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

  function applyPrompt(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  function useContextItem(item: ContextItem) {
    setSelectedContextId(item.id);
    applyPrompt(item.prompt);
  }

  function updateApprovalStatus(
    approvalId: string,
    nextStatus: Exclude<ApprovalStatus, "waiting">
  ) {
    setApprovalRequests((current) =>
      current.map((item) =>
        item.id === approvalId ? { ...item, status: nextStatus } : item
      )
    );
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
            <div className="space-y-3 px-3 pb-4 pt-3">
              <div className="rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-3 text-sm text-teal-900">
                <div className="font-medium text-teal-950">日常工作模式</div>
                <div className="mt-1 text-xs leading-5 text-teal-700">
                  选择模板会自动填入输入框，你可以继续补充上下文后再发送。
                </div>
              </div>

              <div className="space-y-2">
                {templates.map((template) => {
                  const Icon = template.icon;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyPrompt(template.prompt)}
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
                  placeholder="输入日常工作请求，例如：写客户更新、整理会议纪要、把笔记转成任务计划"
                  aria-label="日常工作输入"
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
                <span>模式: daily_work</span>
                <span>状态: {statusLabel(status)}</span>
                {selectedContextId ? (
                  <span>上下文: {selectedContextLabel(selectedContextId)}</span>
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
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-950">
                  <ShieldCheck className="size-4 text-amber-700" aria-hidden="true" />
                  许可审批台账
                </div>
                <div className="space-y-2">
                  {approvalRequests.map((request) => {
                    const Icon = request.icon;

                    return (
                      <div
                        key={request.id}
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
                                size="sm"
                                variant="secondary"
                                className="h-8 rounded-[8px] border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                                onClick={() =>
                                  updateApprovalStatus(request.id, "allowed_once")
                                }
                              >
                                允许一次
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 rounded-[8px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                onClick={() => updateApprovalStatus(request.id, "denied")}
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
                  这里只做本地状态流转，不会触发真实邮件、日历或外部系统操作。
                </p>
              </div>

              <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                  <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                  会话知识上下文
                </div>
                <div className="space-y-2">
                  {contextItems.map((item) => {
                    const Icon = item.icon;
                    const isSelected = selectedContextId === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => useContextItem(item)}
                        className={cn(
                          "w-full rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
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
                            <span className="mt-1 block text-xs leading-5 text-teal-700">
                              {item.source} / {item.sourceType}
                            </span>
                            <span className="mt-2 block text-xs leading-5 text-slate-700">
                              {item.summary}
                            </span>
                            <span className="mt-2 inline-flex items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              <Lock className="size-3.5" aria-hidden="true" />
                              {item.privacy}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-5 text-teal-700">
                  点击任一上下文会把它带入输入框。当前版本只做会话级示意，不读取真实文件或文档内容。
                </p>
              </div>

              <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                  <CheckCircle2 className="size-4 text-teal-700" aria-hidden="true" />
                  计划产物
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

function StatusPill({ status }: { status: ApprovalStatus }) {
  const config = approvalStatusConfig(status);

  return (
    <span
      className={cn(
        "shrink-0 rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[8px] border border-amber-100 bg-amber-50 px-2.5 py-2">
      <span className="shrink-0 text-[11px] font-medium text-amber-700">{label}</span>
      <span className="min-w-0 text-right text-[11px] text-slate-700">{value}</span>
    </div>
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
      return "空闲";
    case "submitting":
      return "连接中";
    case "streaming":
      return "接收中";
    case "error":
      return "出错";
  }
}

function approvalStatusLabel(status: ApprovalStatus) {
  switch (status) {
    case "waiting":
      return "等待审批";
    case "allowed_once":
      return "允许一次";
    case "denied":
      return "拒绝";
    case "blocked":
      return "阻断";
  }
}

function approvalStatusConfig(status: ApprovalStatus) {
  switch (status) {
    case "waiting":
      return {
        label: "等待中",
        className: "bg-amber-100 text-amber-800"
      };
    case "allowed_once":
      return {
        label: "允许一次",
        className: "bg-emerald-100 text-emerald-800"
      };
    case "denied":
      return {
        label: "已拒绝",
        className: "bg-slate-100 text-slate-700"
      };
    case "blocked":
      return {
        label: "已阻断",
        className: "bg-red-100 text-red-800"
      };
  }
}

function selectedContextLabel(contextId: string) {
  const item = contextItems.find((entry) => entry.id === contextId);
  return item ? item.title : "未知上下文";
}
