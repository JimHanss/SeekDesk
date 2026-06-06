import type { FormEventHandler, RefObject } from "react";
import {
  Mail,
  MessageSquare,
  Presentation,
  Search,
  Send,
  Sparkles,
  Square
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { statusLabel } from "../domain";
import type { ChatMessage, ChatStatus } from "../types";
import { ChatThread } from "../chat/components/ChatThread";
import { PanelHeader, PromptCard } from "./DailyWorkPrimitives";

interface AssistantWorkspacePanelProps {
  activeModelName: string;
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
  selectedContextLabel: string | null;
  status: ChatStatus;
  onApplyPrompt: (prompt: string) => void;
  onCancelRequest: () => void;
  onDismissError: () => void;
  onInputChange: (value: string) => void;
  onRetry: () => void;
}

export function AssistantWorkspacePanel({
  activeModelName,
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
  selectedContextLabel,
  status,
  onApplyPrompt,
  onCancelRequest,
  onDismissError,
  onInputChange,
  onRetry
}: AssistantWorkspacePanelProps) {
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <PromptCard
          icon={<Mail className="size-4" aria-hidden="true" />}
          title="客户更新"
          text="帮我写一封客户更新邮件，交代当前结果、时间线、风险和下一步。"
          onClick={onApplyPrompt}
        />
        <PromptCard
          icon={<Presentation className="size-4" aria-hidden="true" />}
          title="会议纪要"
          text="把这些会议记录整理成可分享的纪要，标出决策、负责人、风险和待补信息。"
          onClick={onApplyPrompt}
        />
        <PromptCard
          icon={<Search className="size-4" aria-hidden="true" />}
          title="研究简报"
          text="把最新资料整理成一页简报，区分已知信息、信息缺口和建议下一步。"
          onClick={onApplyPrompt}
        />
      </div>

      <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[8px] border border-slate-200 bg-white">
        <PanelHeader
          icon={<MessageSquare className="size-4" aria-hidden="true" />}
          title="日常工作助手"
          action={
            <Button
              variant="ghost"
              size="icon"
              aria-label="停止当前回复"
              disabled={!isBusy}
              onClick={onCancelRequest}
            >
              <Square className="size-4" aria-hidden="true" />
            </Button>
          }
        />

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
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>接口: {endpoint}</span>
            <span>模型: {activeModelName}</span>
            <span>状态: {statusLabel(status)}</span>
            {selectedContextLabel ? <span>上下文: {selectedContextLabel}</span> : null}
          </div>
        </form>
      </section>
    </div>
  );
}
