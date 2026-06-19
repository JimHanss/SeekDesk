"use client";

import type { FormEventHandler, RefObject } from "react";
import { useState } from "react";
import {
  Info,
  Mail,
  MessageSquare,
  Presentation,
  Search,
  Send,
  Square,
  Sparkles,
  Wand2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChatThread } from "@/features/daily-work/chat/components/ChatThread";
import { statusLabel } from "@/features/daily-work/domain";
import {
  PanelHeader,
  PromptCard
} from "@/features/daily-work/components/DailyWorkPrimitives";
import type {
  AgentTraceState,
  ChatMessage,
  ChatStatus
} from "@/features/daily-work/types";

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
  const [showPromptPanel, setShowPromptPanel] = useState(false);
  const [showRuntimePanel, setShowRuntimePanel] = useState(false);
  const PrimaryIcon = primaryPrompt.icon;

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-3">
      <div className="rounded-[8px] border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <button
            type="button"
            onClick={() => onApplyPrompt(primaryPrompt.text)}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2 text-left text-sm text-teal-950 transition-colors duration-200 hover:border-teal-300 hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-white text-teal-700">
              <PrimaryIcon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 break-words">
              <span className="font-semibold">{primaryPrompt.title}：</span>
              {primaryPrompt.text}
            </span>
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowPromptPanel((current) => !current)}
          >
            <Wand2 className="size-4" aria-hidden="true" />
            {showPromptPanel ? "收起提示" : "更多提示"}
          </Button>
        </div>

        {showPromptPanel ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3" data-assistant-prompt-panel>
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
      </div>

      <section className="flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white">
        <PanelHeader
          icon={<MessageSquare className="size-4" aria-hidden="true" />}
          title="日常工作助手"
          action={
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRuntimePanel((current) => !current)}
              >
                <Info className="size-4" aria-hidden="true" />
                运行信息
              </Button>
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
          }
        />

        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500"
          data-assistant-compact-status
        >
          <span className="min-w-0 break-words">接口: {endpoint}</span>
          <span>状态: {statusLabel(status)}</span>
        </div>

        {showRuntimePanel ? (
          <div
            className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"
            data-assistant-runtime-details
          >
            <div className="grid gap-2 md:grid-cols-3">
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
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4">
          <ChatThread
            endpoint={endpoint}
            error={error}
            lastSubmittedPrompt={lastSubmittedPrompt}
            messages={messages}
            messagesEndRef={messagesEndRef}
            modelName={activeModelName}
            onDismissError={onDismissError}
            onRetry={onRetry}
            agentTrace={agentTrace}
            status={status}
          />
        </div>

        <form className="border-t border-slate-200 bg-white p-3 md:p-4" onSubmit={handleSubmit}>
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
    </div>
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