import {
  Activity,
  Bot,
  CheckCircle2,
  FileCode2,
  Files,
  GitBranch,
  MessageSquare,
  Play,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Terminal
} from "lucide-react";

import { Button } from "@/components/ui/button";

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

export default function Page() {
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
            <PanelHeader icon={<Files className="size-4" aria-hidden="true" />} title="工作区" />
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
                <Button variant="ghost" size="icon" aria-label="取消任务">
                  <Square className="size-4" aria-hidden="true" />
                </Button>
              }
            />

            <div className="flex-1 space-y-4 overflow-hidden px-4 pb-4">
              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-950">
                  <Bot className="size-4 text-blue-600" aria-hidden="true" />
                  DeepSeek Agent
                </div>
                <p className="text-sm leading-6 text-slate-700">
                  已完成基础架构初始化。下一阶段将接入 DeepSeek 流式响应、本地只读工具和权限确认流程。
                </p>
              </div>

              <div className="rounded-[8px] border border-slate-800 bg-slate-950 p-4 text-sm text-slate-100 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Terminal className="size-4" aria-hidden="true" />
                    <span>tool-schema.ts</span>
                  </div>
                  <span className="rounded-[6px] bg-blue-500/15 px-2 py-1 text-xs text-blue-200">
                    syntax preview
                  </span>
                </div>
                <pre className="overflow-x-auto whitespace-pre text-[13px] leading-6">
                  <code>
                    <span className="text-sky-300">export const</span>{" "}
                    <span className="text-emerald-300">toolNameSchema</span>{" "}
                    <span className="text-slate-400">=</span>{" "}
                    <span className="text-violet-300">z</span>
                    <span className="text-slate-300">.</span>
                    <span className="text-amber-300">enum</span>
                    <span className="text-slate-300">([</span>
                    <br />
                    <span className="text-slate-300">  </span>
                    <span className="text-rose-300">"read_file"</span>
                    <span className="text-slate-300">, </span>
                    <span className="text-rose-300">"grep"</span>
                    <span className="text-slate-300">, </span>
                    <span className="text-rose-300">"run_shell"</span>
                    <br />
                    <span className="text-slate-300">]);</span>
                  </code>
                </pre>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex min-h-14 items-center gap-3 rounded-[8px] border border-slate-300 bg-white px-3 py-2 shadow-inner">
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="输入编码任务，例如：总结这个仓库"
                  aria-label="输入编码任务"
                />
                <Button size="sm">
                  <Play className="size-4" aria-hidden="true" />
                  发送
                </Button>
              </div>
            </div>
          </section>

          <aside className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
            <PanelHeader icon={<Activity className="size-4" aria-hidden="true" />} title="任务状态" />
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

function PanelHeader({
  icon,
  title,
  action
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
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
