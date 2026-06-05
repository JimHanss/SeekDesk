import type { RefObject } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Play,
  Sparkles,
  User
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { statusLabel } from "../../domain";
import type {
  ChatMessage,
  ChatStatus
} from "../../types";
import {
  normalizeCodeLanguage,
  parseMessageSegments,
  syntaxTokenClass,
  tokenizeCode
} from "../mappers/message-content";

export function ChatThread({
  endpoint,
  error,
  lastSubmittedPrompt,
  messages,
  messagesEndRef,
  modelName,
  onDismissError,
  onRetry,
  status
}: {
  endpoint: string;
  error: string | null;
  lastSubmittedPrompt: string | null;
  messages: ChatMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  modelName: string;
  onDismissError: () => void;
  onRetry: () => void;
  status: ChatStatus;
}) {
  const isBusy = status === "submitting" || status === "streaming";

  return (
    <div
      className="rounded-[8px] border border-teal-100 bg-white p-3 shadow-sm"
      data-chat-message-count={messages.length}
      data-chat-status={status}
      data-chat-thread
    >
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
            <MessageSquare className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">对话工作区</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            daily_work 消息发送到 /api/chat，模型响应会在此增量写入。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">
          <Activity className="size-3.5" aria-hidden="true" />
          {statusLabel(status)}
        </span>
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <ChatEmptyState endpoint={endpoint} modelName={modelName} />
        ) : (
          messages.map((message, index) => (
            <ChatBubble
              key={message.id}
              message={message}
              pending={
                isBusy &&
                message.role === "assistant" &&
                index === messages.length - 1
              }
            />
          ))
        )}

        {isBusy ? <ChatProgress status={status} /> : null}

        {error ? (
          <ChatErrorState
            canRetry={Boolean(lastSubmittedPrompt) && !isBusy}
            error={error}
            onDismiss={onDismissError}
            onRetry={onRetry}
          />
        ) : null}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function ChatEmptyState({
  endpoint,
  modelName
}: {
  endpoint: string;
  modelName: string;
}) {
  return (
    <div
      className="rounded-[8px] border border-dashed border-teal-200 bg-teal-50/70 px-4 py-4"
      data-chat-empty-state
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
            <Bot className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">等待第一条日常工作任务</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            当前会话保持审批边界，输出可包含正文、清单和高亮代码块。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-white px-2.5 py-1 text-[11px] font-medium text-teal-700">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          API ready
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <ChatInfoRow label="Endpoint" value={endpoint} />
        <ChatInfoRow label="Model" value={modelName} />
      </div>
    </div>
  );
}

function ChatProgress({ status }: { status: ChatStatus }) {
  const label =
    status === "submitting"
      ? "正在连接日常工作模型..."
      : "正在接收增量响应...";

  return (
    <div
      className="flex items-center gap-2 rounded-[8px] border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800"
      data-chat-progress
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      <span className="min-w-0 break-words">{label}</span>
    </div>
  );
}

function ChatErrorState({
  canRetry,
  error,
  onDismiss,
  onRetry
}: {
  canRetry: boolean;
  error: string;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{error}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="bg-red-600 hover:bg-red-700"
          disabled={!canRetry}
          onClick={onRetry}
        >
          <Play className="size-4" aria-hidden="true" />
          重新发送
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDismiss}>
          清除错误
        </Button>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  pending
}: {
  message: ChatMessage;
  pending: boolean;
}) {
  const isUser = message.role === "user";
  const hasContent = message.content.trim().length > 0;

  return (
    <div
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
      data-chat-message-role={message.role}
    >
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
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
        </div>
        {hasContent ? (
          <MessageContent content={message.content} />
        ) : (
          <div className="flex items-center gap-2 text-sm text-teal-700">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>正在建立响应...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const segments = parseMessageSegments(content);

  return (
    <div className="space-y-3">
      {segments.map((segment, index) =>
        segment.type === "code" ? (
          <CodeBlock
            key={`${segment.type}-${index}`}
            code={segment.content}
            language={segment.language}
          />
        ) : (
          <p
            key={`${segment.type}-${index}`}
            className="whitespace-pre-wrap break-words"
          >
            {segment.content}
          </p>
        )
      )}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const tokens = tokenizeCode(code, normalizedLanguage);

  return (
    <div
      className="min-w-0 overflow-hidden rounded-[8px] border border-slate-700/80 bg-slate-950 text-slate-100 shadow-sm"
      data-code-block={normalizedLanguage || "code"}
      data-language={normalizedLanguage || "code"}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-3 py-2">
        <span
          className="min-w-0 truncate font-mono text-[11px] font-semibold uppercase tracking-normal text-teal-200"
          data-code-language={normalizedLanguage || "code"}
        >
          {normalizedLanguage || "code"}
        </span>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 text-[13px] leading-6 [scrollbar-color:#475569_transparent]">
        <code className="block min-w-max font-mono">
          {tokens.map((token, index) => (
            <span
              key={`${token.kind}-${index}`}
              className={syntaxTokenClass(token.kind)}
              data-token={token.kind}
            >
              {token.value}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function ChatInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-white px-3 py-2 text-xs">
      <div className="font-medium text-teal-950">{label}</div>
      <div className="mt-1 break-words text-teal-700">{value}</div>
    </div>
  );
}
