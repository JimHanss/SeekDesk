"use client";

import type { FormEventHandler, ReactNode, RefObject } from "react";
import { useState } from "react";
import {
  Activity,
  Info,
  Mail,
  MessageSquare,
  Presentation,
  Search,
  Send,
  Square,
  Sparkles,
  Wand2,
  X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AgentTracePanel,
  ChatThread
} from "@/features/daily-work/chat/components/ChatThread";
import { statusLabel } from "@/features/daily-work/domain";
import { PromptCard } from "@/features/daily-work/components/DailyWorkPrimitives";
import type {
  AgentTraceState,
  ChatMessage,
  ChatStatus
} from "@/features/daily-work/types";
import { cn } from "@/lib/utils";

interface DailyWorkAssistantViewProps {
  activeModelName: string;
  agentTrace: AgentTraceState;
  endpoint: string;
  error: string | null;
  handleSubmit: FormEventHandler<HTMLFormElement>;
  input: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isBusy: boolean;
  lastSubmittedPrompt: string | null;
  messages: ChatMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  modelInputPlaceholder: string;
  selectedContextTitle?: string | null;
  selectedTemplateTitle?: string | null;
  status: ChatStatus;
  onApplyPrompt: (prompt: string) => void;
  onCancelRequest: () => void;
  onDismissError: () => void;
  onInputChange: (value: string) => void;
  onRetry: () => void;
}

type AssistantPanel = "prompts" | "runtime" | "trace" | null;

const primaryPrompt = {
  icon: Mail,
  title: "客户更新",
  text: "帮我写一封客户更新邮件，整理当前结果、时间线、风险和下一步。"
};

const promptCards = [
  primaryPrompt,
  {
    icon: Presentation,
    title: "会议纪要",
    text: "把这些会议记录整理成可分享的纪要，标出决策、负责人、风险和待补信息。"
  },
  {
    icon: Search,
    title: "研究简报",
    text: "把最新资料整理成一页简报，区分已知信息、信息缺口和建议下一步。"
  }
];

export function DailyWorkAssistantView({
  activeModelName,
  agentTrace,
  endpoint,
  error,
  handleSubmit,
  input,
  inputRef,
  isBusy,
  lastSubmittedPrompt,
  messages,
  messagesEndRef,
  modelInputPlaceholder,
  selectedContextTitle,
  selectedTemplateTitle,
  status,
  onApplyPrompt,
  onCancelRequest,
  onDismissError,
  onInputChange,
  onRetry
}: DailyWorkAssistantViewProps) {
  const [activePanel, setActivePanel] = useState<AssistantPanel>(null);

  const togglePanel = (panel: Exclude<AssistantPanel, null>) => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 md:px-4">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
            <span className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-teal-50 text-teal-700">
              <MessageSquare className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 truncate">日常工作助手</span>
            <span className="shrink-0 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {statusLabel(status)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ToolbarButton
              active={activePanel === "prompts"}
              icon={<Wand2 className="size-4" aria-hidden="true" />}
              label="提示"
              onClick={() => togglePanel("prompts")}
            />
            <ToolbarButton
              active={activePanel === "runtime"}
              icon={<Info className="size-4" aria-hidden="true" />}
              label="运行"
              onClick={() => togglePanel("runtime")}
            />
            <ToolbarButton
              active={activePanel === "trace"}
              icon={<Activity className="size-4" aria-hidden="true" />}
              label="Trace"
              onClick={() => togglePanel("trace")}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="停止当前回复"
              disabled={!isBusy}
              onClick={onCancelRequest}
            >
              <Square className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="sr-only" data-assistant-compact-status>
          接口: {endpoint} 状态: {statusLabel(status)}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4">
          <ChatThread
            error={error}
            lastSubmittedPrompt={lastSubmittedPrompt}
            messages={messages}
            messagesEndRef={messagesEndRef}
            onDismissError={onDismissError}
            onRetry={onRetry}
            status={status}
          />
        </div>

        <form className="border-t border-slate-200 bg-white p-3 md:p-4" onSubmit={handleSubmit}>
          <button
            type="button"
            onClick={() => onApplyPrompt(primaryPrompt.text)}
            className="mb-2 flex w-full cursor-pointer items-center gap-2 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2 text-left text-xs leading-5 text-teal-900 transition-colors duration-200 hover:border-teal-300 hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            <Mail className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">
              <span className="font-semibold">{primaryPrompt.title}：</span>
              {primaryPrompt.text}
            </span>
          </button>

          <div className="flex min-h-16 items-end gap-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2 shadow-inner focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
            <textarea
              ref={inputRef}
              className="max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-slate-950 outline-none placeholder:text-slate-400"
              placeholder={modelInputPlaceholder}
              aria-label="输入日常工作请求"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
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
                <Sparkles className="size-4 animate-pulse" aria-hidden="true" />
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
        </form>
      </section>

      <aside
        className={cn(
          "overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm",
          activePanel
            ? "fixed inset-x-3 bottom-3 top-20 z-30 flex flex-col xl:static xl:z-auto xl:h-full xl:min-h-0"
            : "hidden"
        )}
        data-assistant-side-panel={activePanel ?? "closed"}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <div className="text-sm font-semibold text-slate-950">
            {activePanel === "prompts"
              ? "提示"
              : activePanel === "runtime"
                ? "运行"
                : "Trace"}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="关闭详情面板"
            onClick={() => setActivePanel(null)}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activePanel === "prompts" ? (
            <div className="grid gap-3" data-assistant-prompt-panel>
              {promptCards.map((prompt) => {
                const Icon = prompt.icon;

                return (
                  <PromptCard
                    key={prompt.title}
                    icon={<Icon className="size-4" aria-hidden="true" />}
                    title={prompt.title}
                    text={prompt.text}
                    onClick={onApplyPrompt}
                  />
                );
              })}
            </div>
          ) : null}

          {activePanel === "runtime" ? (
            <div className="grid gap-2" data-assistant-runtime-details>
              <RuntimeDetail label="接口" value={endpoint} />
              <RuntimeDetail label="模型" value={activeModelName} />
              <RuntimeDetail label="状态" value={statusLabel(status)} />
              {selectedContextTitle ? (
                <RuntimeDetail label="上下文" value={selectedContextTitle} />
              ) : null}
              {selectedTemplateTitle ? (
                <RuntimeDetail label="模板" value={selectedTemplateTitle} />
              ) : null}
            </div>
          ) : null}

          <div className={activePanel === "trace" ? "block" : "hidden"}>
            <AgentTracePanel agentTrace={agentTrace} modelName={activeModelName} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function ToolbarButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      className={active ? "border-teal-200 bg-teal-50 text-teal-800" : undefined}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

function RuntimeDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 break-words text-xs font-medium text-slate-800">{value}</div>
    </div>
  );
}