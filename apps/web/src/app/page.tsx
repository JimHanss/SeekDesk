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

type SessionHistoryStatus = "进行中" | "已完成";
type SessionHistoryFilter = "全部" | SessionHistoryStatus;

interface WorkflowSnapshotItem {
  id: string;
  title: string;
  status: SessionHistoryStatus;
  updatedAt: string;
  summary: string;
  artifactCount: number;
  approvalCount: number;
  contextCount: number;
  lastAction: string;
  mode: AppMode;
  tags: string[];
  icon: LucideIcon;
}

type SessionHistoryItem = WorkflowSnapshotItem;

type ArtifactState = "计划中" | "排队中" | "草稿" | "可复用" | "待复核";
type ArtifactFilter = "全部" | "草稿" | "可复用";

interface ArtifactTraceItem {
  label: string;
  value: string;
}

interface ArtifactItem {
  id: string;
  artifactType: string;
  title: string;
  description: string;
  summary: string;
  state: ArtifactState;
  owner: string;
  updatedAt: string;
  source: string;
  templateTitle: string;
  tags: string[];
  trace: ArtifactTraceItem[];
  nextAction: string;
  permissionStatus: string;
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
type ModelRouteMode = "fast" | "pro";
type ThinkingMode = "enabled" | "disabled";

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

interface ModelSnapshotItem {
  id: ModelRouteMode;
  currentMode: AppMode;
  provider: string;
  fastModel: string;
  proModel: string;
  selectedModel: string;
  routingStrategy: string;
  thinkingMode: ThinkingMode;
  updatedAt: string;
  notes: string[];
}

interface UsageSnapshotItem {
  id: ModelRouteMode;
  usageWindow: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: string;
  budgetState: string;
  updatedAt: string;
  notes: string[];
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

const sessionHistoryFilters: SessionHistoryFilter[] = ["全部", "进行中", "已完成"];

const sessionHistoryItems: SessionHistoryItem[] = [
  {
    id: "daily-weekly-report-risk",
    title: "周报与风险同步",
    status: "进行中",
    updatedAt: "今天 11:20",
    summary: "已把项目简报、会议记录和团队备忘合并成周报骨架，风险段落还需要补齐负责人和截止时间。",
    artifactCount: 2,
    approvalCount: 1,
    contextCount: 3,
    lastAction: "继续补齐风险说明，并把待复核会议结论标记为需要确认。",
    mode: "daily_work",
    tags: ["周报", "风险", "待复核"],
    icon: CalendarClock
  },
  {
    id: "daily-customer-email",
    title: "客户更新邮件",
    status: "进行中",
    updatedAt: "今天 09:55",
    summary: "已根据客户邮件整理交付时间线和范围变化说明，外发语气仍需审批后再润色。",
    artifactCount: 1,
    approvalCount: 2,
    contextCount: 2,
    lastAction: "确认外发授权边界，再生成克制专业的客户版回复。",
    mode: "daily_work",
    tags: ["客户沟通", "审批", "邮件"],
    icon: Mail
  },
  {
    id: "daily-meeting-summary",
    title: "例会纪要压缩",
    status: "已完成",
    updatedAt: "昨天 18:10",
    summary: "会议记录已压缩为可分享摘要，保留关键决策、负责人、开放问题和审批追踪。",
    artifactCount: 3,
    approvalCount: 1,
    contextCount: 2,
    lastAction: "将最终纪要复制到项目同步渠道，并保留上下文来源说明。",
    mode: "daily_work",
    tags: ["会议纪要", "可复用", "决策"],
    icon: Presentation
  },
  {
    id: "daily-research-brief",
    title: "资料研究简报",
    status: "已完成",
    updatedAt: "周一 16:40",
    summary: "公开资料已整理为研究简报，结论、引用依据和仍需验证的问题已经分组。",
    artifactCount: 2,
    approvalCount: 0,
    contextCount: 1,
    lastAction: "把可引用依据同步到简报，并在下一轮补充二次验证结论。",
    mode: "daily_work",
    tags: ["研究", "公开资料", "引用"],
    icon: Search
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

const artifactFilters: ArtifactFilter[] = ["全部", "草稿", "可复用"];

const artifacts: ArtifactItem[] = [
  {
    id: "meeting-summary-artifact",
    artifactType: "会议纪要",
    title: "会议摘要",
    description: "关键决策、风险和下一步行动的清晰回顾",
    summary:
      "已把周三例会压缩为项目同步版本，保留关键决策、待办负责人和两个开放风险，适合复核后分享。",
    state: "待复核",
    owner: "产品组",
    updatedAt: "今天 10:30",
    source: "会议记录 / 周三例会",
    templateTitle: "会议纪要",
    tags: ["决策", "待办", "风险"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：会议记录" },
      { label: "审批", value: "使用内部会议记录：允许一次" }
    ],
    nextAction: "复核负责人和风险措辞，确认后复制到项目同步渠道。",
    permissionStatus: "允许一次，可在本次会话内复用",
    icon: FileText
  },
  {
    id: "task-list-artifact",
    artifactType: "任务计划",
    title: "任务清单",
    description: "带负责人、时限和依赖关系的可执行事项",
    summary:
      "从团队备忘中拆出 5 个下一步行动，包含优先级、依赖和验收口径，等待补齐负责人。",
    state: "排队中",
    owner: "运营同学",
    updatedAt: "今天 09:45",
    source: "团队备忘 / 个人笔记",
    templateTitle: "任务计划",
    tags: ["行动项", "依赖", "优先级"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：团队备忘" },
      { label: "审批", value: "内部草稿，不用于外发" }
    ],
    nextAction: "补齐负责人后重新生成排序，并把阻塞项标为待确认。",
    permissionStatus: "仅内部草稿，不可外发",
    icon: Workflow
  },
  {
    id: "email-draft-artifact",
    artifactType: "客户沟通",
    title: "邮件草稿",
    description: "可继续润色或复制给利益相关人的更新",
    summary:
      "已形成客户更新邮件的初稿，包含交付时间线、范围变更说明和下一步确认事项。",
    state: "草稿",
    owner: "客户成功",
    updatedAt: "昨天 17:20",
    source: "客户邮件 / support@customer.com",
    templateTitle: "邮件起草",
    tags: ["外部回复", "交付", "需确认"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：客户邮件" },
      { label: "审批", value: "起草外部回复：已阻断" }
    ],
    nextAction: "确认外发授权边界，再把语气调整为更克制的客户版本。",
    permissionStatus: "需审批后外发",
    icon: Mail
  },
  {
    id: "research-notes-artifact",
    artifactType: "资料研究",
    title: "研究笔记",
    description: "浓缩发现、引用方向和待验证问题",
    summary:
      "公开资料已整理成一页研究笔记，列出可引用依据、竞品观察和仍需验证的问题。",
    state: "可复用",
    owner: "研究同学",
    updatedAt: "昨天 15:10",
    source: "公开资料 / 行业报告",
    templateTitle: "资料研究",
    tags: ["公开来源", "引用", "竞品"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：研究链接" },
      { label: "审批", value: "公开来源，可直接引用" }
    ],
    nextAction: "把可引用依据同步到简报，并标注仍需二次验证的结论。",
    permissionStatus: "公开来源，可在工作区复用",
    icon: Search
  },
  {
    id: "weekly-report-artifact",
    artifactType: "工作汇报",
    title: "周报框架",
    description: "围绕进展、风险和下周重点搭好的汇报结构",
    summary:
      "周报结构已经按本周进展、主要成果、风险阻塞和下周优先级搭好，等待填入最新数据。",
    state: "计划中",
    owner: "你",
    updatedAt: "今天 08:40",
    source: "项目简报 / 内部周报",
    templateTitle: "周报整理",
    tags: ["汇报", "里程碑", "下周计划"],
    trace: [
      { label: "上下文", value: "引用会话知识上下文：项目简报" },
      { label: "审批", value: "仅项目成员可见" }
    ],
    nextAction: "补充本周完成项和阻塞风险，再生成可发送版本。",
    permissionStatus: "项目成员可见，外发前需复核",
    icon: CalendarClock
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

const modelSnapshots: Record<ModelRouteMode, ModelSnapshotItem> = {
  fast: {
    id: "fast",
    currentMode: "daily_work",
    provider: "DeepSeek",
    fastModel: "deepseek-v4-flash",
    proModel: "deepseek-v4-pro",
    selectedModel: "deepseek-v4-flash",
    routingStrategy: "快速：用于邮件草稿、会议压缩、短上下文整理等日常响应。",
    thinkingMode: "disabled",
    updatedAt: "示例：今天 10:40",
    notes: [
      "本地示例快照，未连接真实 model selector。",
      "DeepSeek thinking.type 示例为 disabled，stream_options.include_usage 可返回 usage 块。"
    ]
  },
  pro: {
    id: "pro",
    currentMode: "daily_work",
    provider: "DeepSeek",
    fastModel: "deepseek-v4-flash",
    proModel: "deepseek-v4-pro",
    selectedModel: "deepseek-v4-pro",
    routingStrategy: "深度：用于复杂资料归纳、风险复核、长上下文分析等高质量输出。",
    thinkingMode: "enabled",
    updatedAt: "示例：今天 10:40",
    notes: [
      "本地示例快照，未连接真实 model selector。",
      "DeepSeek thinking.type 示例为 enabled，实际调用仍以后端为准。"
    ]
  }
};

const usageSnapshots: Record<ModelRouteMode, UsageSnapshotItem> = {
  fast: {
    id: "fast",
    usageWindow: "示例：当前会话预估",
    inputTokens: 18420,
    outputTokens: 6110,
    estimatedCost: "估算 $0.04",
    budgetState: "示例预算正常，未接真实余额",
    updatedAt: "示例：今天 10:40",
    notes: [
      "usage 字段示例包含 prompt、completion、total tokens。",
      "成本仅用于前端占位展示，不作为账单或预算依据。"
    ]
  },
  pro: {
    id: "pro",
    usageWindow: "示例：当前会话预估",
    inputTokens: 23880,
    outputTokens: 9280,
    estimatedCost: "估算 $0.18",
    budgetState: "示例预算关注，未接真实余额",
    updatedAt: "示例：今天 10:40",
    notes: [
      "深度模式示例会展示更高 token 与成本估算。",
      "余额、安全阈值和实际计费尚未接入。"
    ]
  }
};

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionHistoryFilter, setSessionHistoryFilter] =
    useState<SessionHistoryFilter>("全部");
  const [selectedSessionHistoryId, setSelectedSessionHistoryId] = useState<
    string | null
  >(sessionHistoryItems[0]?.id ?? null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    artifacts[0]?.id ?? null
  );
  const [artifactFilter, setArtifactFilter] = useState<ArtifactFilter>("全部");
  const [modelRouteMode, setModelRouteMode] = useState<ModelRouteMode>("fast");
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
  const activeModelSnapshot = modelSnapshots[modelRouteMode];
  const activeUsageSnapshot = usageSnapshots[modelRouteMode];
  const usageTotalTokens =
    activeUsageSnapshot.inputTokens + activeUsageSnapshot.outputTokens;
  const usageBudgetPercent = modelRouteMode === "fast" ? 36 : 68;
  const modelInputPlaceholder =
    modelRouteMode === "fast"
      ? "快速模式示例：适合写客户更新、整理会议纪要、把笔记转成任务计划"
      : "深度模式示例：适合复杂资料归纳、风险复核和长上下文分析";
  const filteredArtifacts = useMemo(
    () =>
      artifactFilter === "全部"
        ? artifacts
        : artifacts.filter((artifact) => artifact.state === artifactFilter),
    [artifactFilter]
  );
  const selectedArtifact = useMemo(() => {
    const selectedInFilter = filteredArtifacts.find(
      (artifact) => artifact.id === selectedArtifactId
    );

    return selectedInFilter ?? filteredArtifacts[0] ?? artifacts[0] ?? null;
  }, [filteredArtifacts, selectedArtifactId]);
  const filteredSessionHistory = useMemo(
    () =>
      sessionHistoryFilter === "全部"
        ? sessionHistoryItems
        : sessionHistoryItems.filter((item) => item.status === sessionHistoryFilter),
    [sessionHistoryFilter]
  );
  const selectedSessionHistory = useMemo(() => {
    const selectedInFilter = filteredSessionHistory.find(
      (item) => item.id === selectedSessionHistoryId
    );

    return selectedInFilter ?? filteredSessionHistory[0] ?? sessionHistoryItems[0] ?? null;
  }, [filteredSessionHistory, selectedSessionHistoryId]);

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

  function restoreSessionHistory(item: SessionHistoryItem) {
    setSelectedSessionHistoryId(item.id);
    applyPrompt(buildSessionRestorePrompt(item));
  }

  function useContextItem(item: ContextItem) {
    setSelectedContextId(item.id);
    applyPrompt(item.prompt);
  }

  function switchModelRoute(nextMode: ModelRouteMode) {
    setModelRouteMode(nextMode);
    applyPrompt(buildModelSwitchPrompt(modelSnapshots[nextMode], usageSnapshots[nextMode]));
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

              <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Bot className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">模型与用量</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      DeepSeek 日常工作模式快照，仅做前端估算 / 示例 / 未接真实余额展示。
                    </p>
                  </div>

                  <div
                    className="inline-flex w-full rounded-[8px] border border-teal-200 bg-white p-1 md:w-auto"
                    aria-label="模型展示切换"
                    role="group"
                  >
                    {(["fast", "pro"] as const).map((mode) => {
                      const isActive = modelRouteMode === mode;
                      const snapshot = modelSnapshots[mode];

                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => switchModelRoute(mode)}
                          className={cn(
                            "min-w-0 flex-1 rounded-[6px] px-3 py-2 text-left text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 md:min-w-28",
                            isActive
                              ? "bg-teal-600 text-white shadow-sm"
                              : "text-teal-700 hover:bg-teal-50"
                          )}
                        >
                          <span className="block truncate">
                            {mode === "fast" ? "快速" : "深度"}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block truncate text-[10px]",
                              isActive ? "text-teal-50" : "text-teal-500"
                            )}
                          >
                            {snapshot.selectedModel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
                      模型快照
                    </div>
                    <div className="space-y-2">
                      <SnapshotRow
                        label="当前模式"
                        value={activeModelSnapshot.currentMode}
                      />
                      <SnapshotRow
                        label="Provider"
                        value={activeModelSnapshot.provider}
                      />
                      <SnapshotRow
                        label="快速模型"
                        value={activeModelSnapshot.fastModel}
                      />
                      <SnapshotRow
                        label="深度模型"
                        value={activeModelSnapshot.proModel}
                      />
                      <SnapshotRow
                        label="当前使用"
                        value={activeModelSnapshot.selectedModel}
                      />
                      <SnapshotRow
                        label="Thinking"
                        value={
                          activeModelSnapshot.thinkingMode === "enabled"
                            ? "enabled / 示例开启"
                            : "disabled / 示例关闭"
                        }
                      />
                    </div>
                    <p className="mt-3 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2 text-xs leading-5 text-teal-700">
                      路由策略：{activeModelSnapshot.routingStrategy}
                    </p>
                  </div>

                  <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                      用量快照
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <SessionMetric
                        label="输入 token"
                        value={formatTokenCount(activeUsageSnapshot.inputTokens)}
                      />
                      <SessionMetric
                        label="输出 token"
                        value={formatTokenCount(activeUsageSnapshot.outputTokens)}
                      />
                      <SessionMetric
                        label="合计 token"
                        value={formatTokenCount(usageTotalTokens)}
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      <SnapshotRow
                        label="窗口"
                        value={activeUsageSnapshot.usageWindow}
                      />
                      <SnapshotRow
                        label="成本"
                        value={activeUsageSnapshot.estimatedCost}
                      />
                      <SnapshotRow
                        label="预算/安全"
                        value={activeUsageSnapshot.budgetState}
                      />
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-teal-700">
                        <span>示例预算占用</span>
                        <span>{usageBudgetPercent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-[999px] bg-teal-100">
                        <div
                          className="h-full rounded-[999px] bg-orange-500"
                          style={{ width: `${usageBudgetPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {[...activeModelSnapshot.notes, ...activeUsageSnapshot.notes].map(
                    (note) => (
                      <div
                        key={note}
                        className="flex items-start gap-2 rounded-[8px] border border-orange-200 bg-white px-3 py-2 text-xs leading-5 text-orange-800"
                      >
                        <AlertCircle
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 break-words">{note}</span>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-3 text-[11px] leading-5 text-teal-700">
                  更新时间：{activeModelSnapshot.updatedAt} / 用量更新时间：
                  {activeUsageSnapshot.updatedAt}
                </div>
              </div>

              <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                      <Workflow className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                      <span className="min-w-0 break-words">最近工作流 / 会话历史</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-teal-700">
                      本地示例摘要，帮助你从日常工作会话的上次状态继续，不连接真实存储。
                    </p>
                  </div>

                  <div
                    className="flex shrink-0 flex-wrap gap-2"
                    aria-label="会话历史筛选"
                  >
                    {sessionHistoryFilters.map((filter) => {
                      const isActive = sessionHistoryFilter === filter;

                      return (
                        <button
                          key={filter}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSessionHistoryFilter(filter)}
                          className={cn(
                            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isActive
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span>{filter}</span>
                          <span
                            className={cn(
                              "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-teal-50 text-teal-700"
                            )}
                          >
                            {sessionHistoryFilterCount(filter)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-2">
                    {filteredSessionHistory.map((item) => {
                      const Icon = item.icon;
                      const isSelected = selectedSessionHistory?.id === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => restoreSessionHistory(item)}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isSelected
                              ? "border-teal-400 bg-white shadow-sm"
                              : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-white text-teal-700 ring-1 ring-teal-100">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-medium text-teal-950">
                                  {item.title}
                                </span>
                                <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                  {item.updatedAt} / {item.mode}
                                </span>
                              </span>
                              <SessionStatusPill status={item.status} />
                            </span>
                            <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                              {item.summary}
                            </span>
                            <span className="mt-2 block break-words text-[11px] leading-4 text-orange-700">
                              上次动作：{item.lastAction}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedSessionHistory ? (
                    <div className="rounded-[8px] border border-teal-100 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-teal-700">
                            可恢复会话
                          </div>
                          <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                            {selectedSessionHistory.title}
                          </div>
                          <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                            {selectedSessionHistory.summary}
                          </div>
                        </div>
                        <SessionStatusPill status={selectedSessionHistory.status} />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <SessionMetric
                          label="产物"
                          value={`${selectedSessionHistory.artifactCount}`}
                        />
                        <SessionMetric
                          label="审批"
                          value={`${selectedSessionHistory.approvalCount}`}
                        />
                        <SessionMetric
                          label="上下文"
                          value={`${selectedSessionHistory.contextCount}`}
                        />
                      </div>

                      <ArtifactDetailBlock
                        icon={<Target className="size-4" aria-hidden="true" />}
                        title="上次动作"
                      >
                        {selectedSessionHistory.lastAction}
                      </ArtifactDetailBlock>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedSessionHistory.tags.map((tag) => (
                          <span
                            key={`${selectedSessionHistory.id}-${tag}`}
                            className="max-w-full rounded-[999px] bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700"
                          >
                            <span className="break-words">{tag}</span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800">
                        恢复提示会填入输入框，由你确认后再发送；当前不会读取真实历史记录。
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
                        onClick={() => restoreSessionHistory(selectedSessionHistory)}
                      >
                        <Play className="size-4" aria-hidden="true" />
                        恢复到输入框
                      </Button>
                    </div>
                  ) : null}
                </div>
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
                  placeholder={modelInputPlaceholder}
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
                <div className="mb-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-teal-950">
                      <CheckCircle2
                        className="size-4 shrink-0 text-teal-700"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 break-words">日常工作产物</span>
                    </div>
                    <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
                      {filteredArtifacts.length}/{artifacts.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2" aria-label="产物筛选">
                    {artifactFilters.map((filter) => {
                      const isActive = artifactFilter === filter;

                      return (
                        <button
                          key={filter}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setArtifactFilter(filter)}
                          className={cn(
                            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                            isActive
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-teal-100 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                          )}
                        >
                          <span>{filter}</span>
                          <span
                            className={cn(
                              "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-teal-50 text-teal-700"
                            )}
                          >
                            {artifactFilterCount(filter)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredArtifacts.map((artifact) => {
                    const Icon = artifact.icon;
                    const isSelected = selectedArtifact?.id === artifact.id;

                    return (
                      <button
                        key={artifact.id}
                        type="button"
                        onClick={() => setSelectedArtifactId(artifact.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                          isSelected
                            ? "border-teal-400 bg-white shadow-sm"
                            : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
                        )}
                      >
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block break-words text-sm font-medium text-teal-950">
                                {artifact.title}
                              </span>
                              <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                                {artifact.artifactType} / {artifact.owner}
                              </span>
                            </span>
                            <ArtifactStatePill state={artifact.state} />
                          </span>
                          <span className="mt-2 block break-words text-xs leading-5 text-teal-700">
                            {artifact.description}
                          </span>
                          <span className="mt-2 block break-words text-[11px] leading-4 text-slate-500">
                            更新：{artifact.updatedAt}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedArtifact ? (
                  <div className="mt-3 border-t border-teal-100 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-teal-700">
                          {selectedArtifact.artifactType}
                        </div>
                        <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                          {selectedArtifact.title}
                        </div>
                        <div className="mt-1 break-words text-xs leading-5 text-teal-700">
                          {selectedArtifact.description}
                        </div>
                      </div>
                      <ArtifactStatePill state={selectedArtifact.state} />
                    </div>

                    <ArtifactDetailBlock
                      icon={<FileText className="size-4" aria-hidden="true" />}
                      title="摘要"
                    >
                      {selectedArtifact.summary}
                    </ArtifactDetailBlock>

                    <div className="mt-3 grid gap-2">
                      <ArtifactDetailRow label="来源模板" value={selectedArtifact.templateTitle} />
                      <ArtifactDetailRow label="来源上下文" value={selectedArtifact.source} />
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
                        <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
                        上下文 / 审批追踪
                      </div>
                      <div className="space-y-2">
                        {selectedArtifact.trace.map((traceItem) => (
                          <div
                            key={`${selectedArtifact.id}-${traceItem.label}`}
                            className="rounded-[8px] border border-teal-100 bg-white px-3 py-2"
                          >
                            <div className="text-[11px] font-medium text-teal-700">
                              {traceItem.label}
                            </div>
                            <div className="mt-1 break-words text-xs leading-5 text-slate-700">
                              {traceItem.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <ArtifactDetailBlock
                      icon={<Target className="size-4" aria-hidden="true" />}
                      title="下一步行动"
                    >
                      {selectedArtifact.nextAction}
                    </ArtifactDetailBlock>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedArtifact.tags.map((tag) => (
                        <span
                          key={`${selectedArtifact.id}-${tag}`}
                          className="max-w-full rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700"
                        >
                          <span className="break-words">{tag}</span>
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-orange-200 bg-white px-3 py-2 text-xs leading-5 text-orange-800">
                      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">
                        权限状态：{selectedArtifact.permissionStatus}
                      </span>
                    </div>
                  </div>
                ) : null}
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

function SessionStatusPill({ status }: { status: SessionHistoryStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        sessionHistoryStatusClass(status)
      )}
    >
      {status}
    </span>
  );
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-teal-100 bg-teal-50 px-2.5 py-2 text-center">
      <div className="truncate text-[11px] font-medium text-teal-700">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-teal-950">
        {value}
      </div>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[8px] border border-teal-100 bg-teal-50 px-3 py-2">
      <span className="shrink-0 text-xs font-medium text-teal-700">{label}</span>
      <span className="min-w-0 break-words text-right text-sm text-teal-950">
        {value}
      </span>
    </div>
  );
}

function ArtifactStatePill({ state }: { state: ArtifactState }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
        artifactStateClass(state)
      )}
    >
      {state}
    </span>
  );
}

function ArtifactDetailBlock({
  icon,
  title,
  children
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-[8px] border border-teal-100 bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-teal-950">
        <span className="shrink-0 text-teal-700">{icon}</span>
        <span className="min-w-0 break-words">{title}</span>
      </div>
      <div className="mt-1 break-words text-xs leading-5 text-slate-700">
        {children}
      </div>
    </div>
  );
}

function ArtifactDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-teal-100 bg-white px-3 py-2">
      <div className="text-[11px] font-medium text-teal-700">{label}</div>
      <div className="mt-1 break-words text-xs leading-5 text-teal-950">
        {value}
      </div>
    </div>
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

function sessionHistoryFilterCount(filter: SessionHistoryFilter) {
  if (filter === "全部") {
    return sessionHistoryItems.length;
  }

  return sessionHistoryItems.filter((item) => item.status === filter).length;
}

function sessionHistoryStatusClass(status: SessionHistoryStatus) {
  switch (status) {
    case "进行中":
      return "bg-orange-100 text-orange-800";
    case "已完成":
      return "bg-emerald-100 text-emerald-800";
  }
}

function artifactFilterCount(filter: ArtifactFilter) {
  if (filter === "全部") {
    return artifacts.length;
  }

  return artifacts.filter((artifact) => artifact.state === filter).length;
}

function artifactStateClass(state: ArtifactState) {
  switch (state) {
    case "计划中":
      return "bg-teal-100 text-teal-800";
    case "排队中":
      return "bg-slate-100 text-slate-700";
    case "草稿":
      return "bg-orange-100 text-orange-800";
    case "可复用":
      return "bg-emerald-100 text-emerald-800";
    case "待复核":
      return "bg-amber-100 text-amber-800";
  }
}

function selectedContextLabel(contextId: string) {
  const item = contextItems.find((entry) => entry.id === contextId);
  return item ? item.title : "未知上下文";
}

function modelRouteLabel(mode: ModelRouteMode) {
  return mode === "fast" ? "快速" : "深度";
}

function formatTokenCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildModelSwitchPrompt(
  modelSnapshot: ModelSnapshotItem,
  usageSnapshot: UsageSnapshotItem
) {
  return [
    `请按“${modelRouteLabel(modelSnapshot.id)}”示例模式继续这个 daily_work 会话。`,
    "",
    `模型快照：Provider ${modelSnapshot.provider}，当前展示模型 ${modelSnapshot.selectedModel}，thinking ${modelSnapshot.thinkingMode}。`,
    `用量快照：${usageSnapshot.usageWindow}，输入 ${formatTokenCount(
      usageSnapshot.inputTokens
    )} tokens，输出 ${formatTokenCount(
      usageSnapshot.outputTokens
    )} tokens，${usageSnapshot.estimatedCost}。`,
    "说明：这是前端估算 / 示例 / 未接真实余额，不要作为真实计费或预算依据。"
  ].join("\n");
}

function buildSessionRestorePrompt(item: SessionHistoryItem) {
  return [
    `请帮我恢复「${item.title}」这个日常工作会话。`,
    "",
    `会话摘要：${item.summary}`,
    `上次动作：${item.lastAction}`,
    `关联产物：${item.artifactCount} 项`,
    `审批记录：${item.approvalCount} 项`,
    `上下文数量：${item.contextCount} 项`,
    `标签：${item.tags.join("、")}`,
    "",
    "请先复述当前可继续的工作状态，再建议下一步行动。"
  ].join("\n");
}
