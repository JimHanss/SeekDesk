import type { RefObject } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Loader2,
  MessageSquare,
  Play,
  ShieldCheck,
  Sparkles,
  User,
  Wrench
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { statusLabel } from "../../domain";
import type {
  AgentToolActivityTraceItem,
  AgentToolCallTraceItem,
  AgentTraceState,
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
  agentTrace,
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
  agentTrace: AgentTraceState;
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
            <MessageSquare
              className="size-4 shrink-0 text-teal-700"
              aria-hidden="true"
            />
            <span className="min-w-0 break-words">Daily Work Chat</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            Messages stream through /api/chat. Model responses, tool plans, tool
            results, usage, and local artifacts are attached to this session.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[999px] bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">
          <Activity className="size-3.5" aria-hidden="true" />
          {statusLabel(status)}
        </span>
      </div>

      <div className="space-y-3">
        <AgentTracePanel agentTrace={agentTrace} modelName={modelName} />

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

function AgentTracePanel({
  agentTrace,
  modelName
}: {
  agentTrace: AgentTraceState;
  modelName: string;
}) {
  const hasToolCalls = agentTrace.toolCalls.length > 0;
  const hasToolActivityEvents = agentTrace.toolActivityEvents.length > 0;
  const usage = agentTrace.modelUsageSummary;
  const boundary = agentTrace.permissionBoundary.previewOnly
    ? "preview-only"
    : "requires-approval";

  return (
    <div
      className="border-y border-slate-100 bg-slate-50/70 px-3 py-3"
      data-agent-trace-panel
      data-agent-trace-status={agentTrace.syncStatus}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-600">
            <Cpu className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            Real Agent Trace
          </div>
          <div className="mt-1 grid gap-1 text-xs leading-5 text-slate-700 md:grid-cols-2">
            <span className="min-w-0 break-words" data-agent-trace-session>
              Session: {agentTrace.sessionId ?? "waiting"}
            </span>
            <span className="min-w-0 break-words">
              Provider: {agentTrace.provider ?? usage.provider} /{" "}
              {usage.model === "unknown" ? modelName : usage.model}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-[999px] px-2.5 py-1 text-[11px] font-medium",
            traceStatusClass(agentTrace.syncStatus)
          )}
        >
          {agentTrace.syncStatus === "syncing" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
          )}
          {traceStatusLabel(agentTrace.syncStatus)}
        </span>
      </div>

      <div
        className="mt-3 grid gap-2 md:grid-cols-4"
        data-agent-model-usage-count={usage.recordCount}
        data-agent-permission-boundary={boundary}
      >
        <TraceMetric
          icon={Wrench}
          label="Tool plans"
          value={`${agentTrace.toolCalls.length}`}
          dataAttr="agent-tool-count"
        />
        <TraceMetric
          icon={Database}
          label="Usage records"
          value={`${usage.recordCount}`}
          dataAttr="agent-model-usage-count"
        />
        <TraceMetric
          icon={Cpu}
          label="Tokens"
          value={`${usage.totalTokens}`}
          dataAttr="agent-token-count"
        />
        <TraceMetric
          icon={ShieldCheck}
          label="Boundary"
          value={boundary}
          dataAttr="agent-permission-boundary"
        />
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-600">
        {agentTrace.notice}
      </p>

      <div className="mt-3 space-y-2">
        {hasToolCalls ? (
          agentTrace.toolCalls.map((toolCall) => (
            <ToolCallRow key={toolCall.id} toolCall={toolCall} />
          ))
        ) : (
          <div className="rounded-[8px] border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            No tools have been called in this turn yet. DeepSeek can plan Gmail,
            Calendar, and local preview tools when the task requires context or
            a reviewable artifact.
          </div>
        )}
      </div>

      {hasToolActivityEvents ? (
        <ToolActivityTimeline events={agentTrace.toolActivityEvents} />
      ) : null}

      <div
        className="mt-3 rounded-[8px] border border-teal-100 bg-white px-3 py-2 text-xs leading-5 text-teal-800"
        data-agent-permission-statement
      >
        {agentTrace.permissionBoundary.statement}
      </div>
    </div>
  );
}

function ToolActivityTimeline({
  events
}: {
  events: AgentToolActivityTraceItem[];
}) {
  return (
    <div
      className="mt-3 rounded-[8px] border border-slate-200 bg-white px-3 py-2"
      data-agent-tool-timeline
      data-agent-tool-timeline-count={events.length}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
        <Activity className="size-3.5 shrink-0 text-teal-700" aria-hidden="true" />
        Tool activity timeline
      </div>
      <div className="mt-2 space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-[8px] border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs"
            data-agent-tool-timeline-row={event.toolName}
            data-agent-tool-timeline-phase={event.toolPhase}
            data-agent-tool-timeline-status={event.status}
            data-agent-tool-timeline-reference={event.reference ?? ""}
          >
            <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="font-mono font-semibold text-slate-900">
                  {event.toolName}
                </div>
                <div className="mt-1 text-slate-600">
                  {event.toolPhase} · {event.time} ·{" "}
                  {event.previewOnly ? "preview-only" : "external action"}
                </div>
              </div>
              <span className="inline-flex shrink-0 rounded-[999px] bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700">
                {event.status}
              </span>
            </div>
            <p className="mt-2 leading-5 text-slate-700">
              {event.externalDataSummary}
            </p>
            {event.reference ? (
              <div className="mt-1 break-words text-[11px] font-medium text-teal-700">
                Reference: {event.reference}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolCallRow({ toolCall }: { toolCall: AgentToolCallTraceItem }) {
  const resultSummary = summarizeToolResult(toolCall);
  const reference = summarizeToolReference(toolCall.outputJson);

  return (
    <div
      className="rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs"
      data-agent-tool-call={toolCall.name}
      data-agent-tool-plan={toolCall.name}
      data-agent-tool-execution={toolCall.status}
      data-agent-tool-result={resultSummary}
      data-agent-tool-reference={reference ?? ""}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono font-semibold text-slate-900">
            {toolCall.name}
          </div>
          <div className="mt-1 text-slate-600">
            {toolCall.previewOnly ? "preview-only" : "external action"} path,{" "}
            {toolCall.permissionRequired
              ? "permission required"
              : "no extra approval"}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 rounded-[999px] px-2 py-1 font-medium",
            toolStatusClass(toolCall.status)
          )}
          data-agent-tool-status={toolCall.status}
        >
          {toolCall.status}
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <ToolStep
          icon={Wrench}
          label="Plan"
          value={summarizeToolPlan(toolCall)}
        />
        <ToolStep
          icon={Activity}
          label="Execution"
          value={summarizeToolExecution(toolCall)}
        />
        <ToolStep
          icon={FileText}
          label="Result"
          value={resultSummary}
        />
      </div>

      {reference ? (
        <div className="mt-2 rounded-[8px] border border-teal-100 bg-teal-50 px-2.5 py-2 text-teal-800">
          <span className="font-medium">Reference: </span>
          {reference}
        </div>
      ) : null}

      {toolCall.error ? (
        <div className="mt-2 rounded-[8px] bg-red-50 px-2 py-1 text-red-700">
          {toolCall.error}
        </div>
      ) : null}

      {toolCall.outputJson !== undefined ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-medium text-slate-500">
            Raw tool result
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-[8px] bg-slate-950 px-2.5 py-2 font-mono text-[11px] leading-5 text-slate-100">
            {formatJsonPreview(toolCall.outputJson)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function ToolStep({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Wrench;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[8px] border border-slate-100 bg-slate-50 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-normal text-slate-500">
        <Icon className="size-3.5 shrink-0 text-teal-700" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 break-words text-xs leading-5 text-slate-700">
        {value}
      </div>
    </div>
  );
}

function TraceMetric({
  dataAttr,
  icon: Icon,
  label,
  value
}: {
  dataAttr: string;
  icon: typeof Wrench;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[8px] border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-normal text-slate-500">
        <Icon className="size-3.5 shrink-0 text-teal-700" aria-hidden="true" />
        {label}
      </div>
      <div
        className="mt-1 break-words text-sm font-semibold text-slate-900"
        data-agent-metric={dataAttr}
      >
        {value}
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
            <span className="min-w-0 break-words">
              Ready for a daily-work task
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-teal-700">
            The current conversation keeps a preview-only boundary while it can
            produce prose, checklists, highlighted code, and reviewable local
            artifacts.
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
      ? "Connecting to the daily-work model..."
      : "Receiving the streaming response...";

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
          Retry
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDismiss}>
          Dismiss
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
          {isUser ? "You" : "SeekDesk"}
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
        </div>
        {hasContent ? (
          <MessageContent content={message.content} />
        ) : (
          <div className="flex items-center gap-2 text-sm text-teal-700">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>Building the response...</span>
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

function traceStatusLabel(status: AgentTraceState["syncStatus"]) {
  switch (status) {
    case "idle":
      return "Idle";
    case "syncing":
      return "Syncing";
    case "live":
      return "Live";
    case "degraded":
      return "Degraded";
  }
}

function traceStatusClass(status: AgentTraceState["syncStatus"]) {
  switch (status) {
    case "syncing":
      return "bg-sky-100 text-sky-800";
    case "live":
      return "bg-emerald-100 text-emerald-800";
    case "degraded":
      return "bg-red-100 text-red-800";
    case "idle":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function toolStatusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "requested":
    case "running":
      return "bg-sky-100 text-sky-800";
    case "permission_required":
      return "bg-orange-100 text-orange-800";
    case "failed":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function summarizeToolPlan(toolCall: AgentToolCallTraceItem) {
  return `${toolCall.name} with ${summarizeJsonShape(toolCall.inputJson)}`;
}

function summarizeToolExecution(toolCall: AgentToolCallTraceItem) {
  const timing = toolCall.completedAt
    ? `${formatTraceTime(toolCall.createdAt)} to ${formatTraceTime(toolCall.completedAt)}`
    : `started ${formatTraceTime(toolCall.createdAt)}`;

  return `${toolCall.status}; ${timing}`;
}

function summarizeToolResult(toolCall: AgentToolCallTraceItem) {
  if (toolCall.error) {
    return `Failed with ${toolCall.error}`;
  }

  const output = asRecord(toolCall.outputJson);
  if (!output) {
    return "No structured result yet";
  }

  if (Array.isArray(output.threads)) {
    return `${output.threads.length} Gmail thread result(s)`;
  }

  if (Array.isArray(output.messages)) {
    return `${output.messages.length} Gmail message metadata record(s)`;
  }

  if (Array.isArray(output.events)) {
    return `${output.events.length} calendar event result(s)`;
  }

  if (output.draftPayloadPreview) {
    return "Local Gmail draft payload preview";
  }

  if (output.eventPayloadPreview) {
    return "Local Calendar event payload preview";
  }

  if (typeof output.artifactId === "string") {
    return "Local review artifact persisted";
  }

  return "Structured tool result captured";
}

function summarizeToolReference(outputJson: unknown) {
  const output = asRecord(outputJson);
  if (!output) {
    return null;
  }

  if (typeof output.artifactId === "string" && output.artifactId.trim()) {
    return `artifact ${output.artifactId}`;
  }

  if (typeof output.threadId === "string" && output.threadId.trim()) {
    return `Gmail thread ${output.threadId}`;
  }

  if (Array.isArray(output.threads) && output.threads.length > 0) {
    const first = asRecord(output.threads[0]);
    return typeof first?.id === "string" ? `Gmail thread ${first.id}` : null;
  }

  if (Array.isArray(output.events) && output.events.length > 0) {
    const first = asRecord(output.events[0]);
    return typeof first?.id === "string" ? `Calendar event ${first.id}` : null;
  }

  if (typeof output.calendarId === "string" && output.calendarId.trim()) {
    return `calendar ${output.calendarId}`;
  }

  return null;
}

function summarizeJsonShape(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return "no structured input";
  }

  const keys = Object.keys(record);
  return keys.length ? `fields ${keys.join(", ")}` : "empty input";
}

function formatTraceTime(value: string) {
  if (!value) {
    return "unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatJsonPreview(value: unknown) {
  try {
    return JSON.stringify(value, null, 2).slice(0, 800);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
