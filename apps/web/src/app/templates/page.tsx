"use client";

import Link from "next/link";
import * as React from "react";
import {
  Copy,
  Edit3,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getRuntimeApiBaseUrl } from "@/features/daily-work/domain";
import type {
  DailyWorkTemplateDto,
  DailyWorkTemplatesResponseDto,
  ModelRouteMode
} from "@/features/daily-work/types";
import { cn } from "@/lib/utils";

type TemplateStatus = "active" | "disabled" | "archived";

interface TemplateFormState {
  id: string | null;
  title: string;
  description: string;
  category: string;
  artifactType: string;
  prompt: string;
  systemPrompt: string;
  promptTemplate: string;
  defaultModelRoute: ModelRouteMode;
  allowedToolNames: string;
  maxContextTokens: number;
  status: TemplateStatus;
  tags: string;
  enabled: boolean;
}

const emptyForm: TemplateFormState = {
  id: null,
  title: "",
  description: "",
  category: "writing",
  artifactType: "brief",
  prompt: "",
  systemPrompt: "You are SeekDesk daily_work assistant. Produce safe, reviewable drafts only.",
  promptTemplate: "{{input}}\n\nContext:\n{{context}}",
  defaultModelRoute: "fast",
  allowedToolNames: "daily.persist_artifact",
  maxContextTokens: 12000,
  status: "active",
  tags: "daily_work",
  enabled: true
};

export default function TemplatesPage() {
  const apiBaseUrl = React.useMemo(() => getRuntimeApiBaseUrl().replace(/\/$/, ""), []);
  const [templates, setTemplates] = React.useState<DailyWorkTemplateDto[]>([]);
  const [form, setForm] = React.useState<TemplateFormState>(emptyForm);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | TemplateStatus>("all");
  const [syncStatus, setSyncStatus] = React.useState<"syncing" | "ready" | "saving" | "error">("syncing");
  const [notice, setNotice] = React.useState("Loading template manager...");

  const loadTemplates = React.useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const response = await fetch(`${apiBaseUrl}/api/daily/templates?mode=daily_work`);
      if (!response.ok) {
        throw new Error(`Template list failed: ${response.status}`);
      }
      const payload = (await response.json()) as DailyWorkTemplatesResponseDto;
      setTemplates(payload.templates ?? []);
      setNotice("Template catalog synced from the daily_work API.");
      setSyncStatus("ready");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Template sync failed.");
      setSyncStatus("error");
    }
  }, [apiBaseUrl]);

  React.useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const filteredTemplates = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return templates.filter((template) => {
      const status = normalizeTemplateStatus(template.status, template.enabled);
      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [
        template.title,
        template.description,
        template.category,
        template.artifactType,
        ...(template.tags ?? [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, statusFilter, templates]);

  async function saveTemplate() {
    setSyncStatus("saving");
    try {
      const body = templatePayloadFromForm(form);
      const response = await fetch(
        form.id
          ? `${apiBaseUrl}/api/daily/templates/${encodeURIComponent(form.id)}?mode=daily_work`
          : `${apiBaseUrl}/api/daily/templates?mode=daily_work`,
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setNotice(form.id ? "Template updated." : "Template created.");
      setForm(emptyForm);
      await loadTemplates();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Template save failed.");
      setSyncStatus("error");
    }
  }

  async function duplicateTemplate(templateId: string) {
    setSyncStatus("saving");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/templates/${encodeURIComponent(templateId)}/duplicate?mode=daily_work`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ titleSuffix: "copy" })
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setNotice("Template duplicated.");
      await loadTemplates();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Duplicate failed.");
      setSyncStatus("error");
    }
  }

  async function patchTemplateStatus(template: DailyWorkTemplateDto, status: TemplateStatus) {
    if (!template.id) {
      return;
    }
    setSyncStatus("saving");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/templates/${encodeURIComponent(template.id)}?mode=daily_work`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status,
            enabled: status === "active"
          })
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setNotice(`Template marked ${status}.`);
      await loadTemplates();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Status update failed.");
      setSyncStatus("error");
    }
  }

  async function archiveTemplate(templateId: string) {
    setSyncStatus("saving");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/daily/templates/${encodeURIComponent(templateId)}?mode=daily_work`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setNotice("Template archived.");
      await loadTemplates();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Archive failed.");
      setSyncStatus("error");
    }
  }

  return (
    <main
      className="min-h-screen bg-slate-100 px-3 py-3 text-slate-950 md:px-4"
      data-template-manager-page
      data-template-manager-status={syncStatus}
    >
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] gap-3 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_18px_70px_rgba(15,23,42,0.10)]">
          <header className="border-b border-slate-200 px-4 py-4 md:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-[999px] bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  daily_work templates
                </div>
                <h1 className="mt-3 font-heading text-2xl font-semibold tracking-normal text-slate-950">
                  Agent Template Manager
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Manage reusable system prompts, prompt templates, tool boundaries and context budgets for daily work mode.
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex h-9 items-center justify-center rounded-[6px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Back to workspace
              </Link>
            </div>
          </header>

          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 md:px-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <label className="flex min-h-10 flex-1 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-600">
                <Search className="size-4 shrink-0" aria-hidden="true" />
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search templates, tags or artifact types"
                />
              </label>
              <select
                className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | TemplateStatus)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="mt-2 rounded-[8px] border border-teal-100 bg-white px-3 py-2 text-xs leading-5 text-teal-800">
              {notice}
            </div>
          </div>

          <div className="grid gap-3 p-3 md:p-4" data-template-manager-list>
            {filteredTemplates.map((template) => {
              const status = normalizeTemplateStatus(template.status, template.enabled);
              return (
                <article
                  key={template.id}
                  className="rounded-[8px] border border-slate-200 bg-white p-3"
                  data-template-manager-card={template.id ?? "unknown"}
                  data-template-status={status}
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words text-sm font-semibold text-slate-950">
                          {template.title ?? "Untitled template"}
                        </h2>
                        <span className={cn(
                          "rounded-[999px] px-2 py-0.5 text-[11px] font-medium",
                          status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : status === "disabled"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-slate-100 text-slate-600"
                        )}>
                          {status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {template.description ?? "No description yet."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
                        <span className="rounded-[999px] bg-teal-50 px-2 py-0.5 text-teal-800">
                          {template.category ?? "knowledge"}
                        </span>
                        <span className="rounded-[999px] bg-orange-50 px-2 py-0.5 text-orange-800">
                          {template.artifactType ?? "brief"}
                        </span>
                        <span className="rounded-[999px] bg-slate-100 px-2 py-0.5 text-slate-700">
                          {template.defaultModelRoute ?? "fast"}
                        </span>
                        {(template.tags ?? []).slice(0, 4).map((tag) => (
                          <span key={`${template.id}-${tag}`} className="rounded-[999px] bg-slate-100 px-2 py-0.5 text-slate-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <IconButton label="Edit" onClick={() => setForm(formFromTemplate(template))}>
                        <Edit3 className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton label="Duplicate" onClick={() => template.id && void duplicateTemplate(template.id)}>
                        <Copy className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={status === "active" ? "Disable" : "Activate"}
                        onClick={() => void patchTemplateStatus(template, status === "active" ? "disabled" : "active")}
                      >
                        {status === "active" ? (
                          <ToggleRight className="size-4" aria-hidden="true" />
                        ) : (
                          <ToggleLeft className="size-4" aria-hidden="true" />
                        )}
                      </IconButton>
                      <IconButton label="Archive" onClick={() => template.id && void archiveTemplate(template.id)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                </article>
              );
            })}
            {filteredTemplates.length === 0 ? (
              <div className="rounded-[8px] border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-500">
                No templates match the current filters.
              </div>
            ) : null}
          </div>
        </section>

        <aside className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-[0_18px_70px_rgba(15,23,42,0.08)]" data-template-manager-form>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                {form.id ? "Edit template" : "New template"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Keep tools preview-only and set a deterministic context budget.
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Reset form" onClick={() => setForm(emptyForm)}>
              <RotateCcw className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="space-y-3">
            <TextField label="Title" value={form.title} onChange={(value) => updateForm(setForm, { title: value })} />
            <TextField label="Description" value={form.description} onChange={(value) => updateForm(setForm, { description: value })} />
            <div className="grid gap-2 md:grid-cols-2">
              <TextField label="Category" value={form.category} onChange={(value) => updateForm(setForm, { category: value })} />
              <TextField label="Artifact type" value={form.artifactType} onChange={(value) => updateForm(setForm, { artifactType: value })} />
            </div>
            <TextareaField label="System prompt" value={form.systemPrompt} onChange={(value) => updateForm(setForm, { systemPrompt: value })} rows={4} />
            <TextareaField label="User prompt" value={form.prompt} onChange={(value) => updateForm(setForm, { prompt: value })} rows={5} />
            <TextareaField label="Prompt template" value={form.promptTemplate} onChange={(value) => updateForm(setForm, { promptTemplate: value })} rows={4} />
            <TextField label="Allowed tools" value={form.allowedToolNames} onChange={(value) => updateForm(setForm, { allowedToolNames: value })} />
            <TextField label="Tags" value={form.tags} onChange={(value) => updateForm(setForm, { tags: value })} />
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs font-medium text-slate-700">
                Model route
                <select
                  className="mt-1 h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                  value={form.defaultModelRoute}
                  onChange={(event) => updateForm(setForm, { defaultModelRoute: event.target.value as ModelRouteMode })}
                >
                  <option value="fast">fast</option>
                  <option value="pro">pro</option>
                </select>
              </label>
              <TextField
                label="Context budget"
                type="number"
                value={String(form.maxContextTokens)}
                onChange={(value) => updateForm(setForm, { maxContextTokens: Number(value) || 12000 })}
              />
            </div>
            <label className="flex items-center gap-2 rounded-[8px] border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled && form.status === "active"}
                onChange={(event) => updateForm(setForm, {
                  enabled: event.target.checked,
                  status: event.target.checked ? "active" : "disabled"
                })}
              />
              Active template
            </label>
            <Button type="button" className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => void saveTemplate()}>
              {form.id ? <Save className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
              {form.id ? "Save changes" : "Create template"}
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function IconButton({
  children,
  label,
  onClick
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="secondary" size="icon" aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  );
}

function TextField({
  label,
  onChange,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-700">
      {label}
      <input
        className="mt-1 h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextareaField({
  label,
  onChange,
  rows,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-700">
      {label}
      <textarea
        className="mt-1 w-full resize-y rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-teal-500"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function normalizeTemplateStatus(
  status: string | undefined,
  enabled: boolean | undefined
): TemplateStatus {
  if (status === "archived" || status === "disabled") {
    return status;
  }
  return enabled === false ? "disabled" : "active";
}

function formFromTemplate(template: DailyWorkTemplateDto): TemplateFormState {
  return {
    id: template.id ?? null,
    title: template.title ?? "",
    description: template.description ?? "",
    category: template.category ?? "writing",
    artifactType: template.artifactType ?? "brief",
    prompt: template.prompt ?? "",
    systemPrompt: template.systemPrompt ?? emptyForm.systemPrompt,
    promptTemplate: template.promptTemplate ?? emptyForm.promptTemplate,
    defaultModelRoute: template.defaultModelRoute ?? "fast",
    allowedToolNames: (template.allowedToolNames ?? ["daily.persist_artifact"]).join(", "),
    maxContextTokens: template.contextPolicy?.maxContextTokens ?? 12000,
    status: normalizeTemplateStatus(template.status, template.enabled),
    tags: (template.tags ?? []).join(", "),
    enabled: template.enabled !== false && template.status !== "disabled" && template.status !== "archived"
  };
}

function templatePayloadFromForm(form: TemplateFormState) {
  return {
    category: form.category.trim() || "writing",
    title: form.title.trim() || "Untitled template",
    description: form.description.trim() || "Reusable daily_work template.",
    prompt: form.prompt.trim() || "Please continue this daily_work task.",
    systemPrompt: form.systemPrompt.trim(),
    promptTemplate: form.promptTemplate.trim(),
    defaultModelRoute: form.defaultModelRoute,
    allowedToolNames: splitList(form.allowedToolNames),
    contextPolicy: {
      maxContextTokens: form.maxContextTokens,
      includeSelectedContext: true,
      includeRecentSession: true,
      includeArtifacts: true
    },
    status: form.enabled ? form.status : "disabled",
    artifactType: form.artifactType.trim() || "brief",
    tags: splitList(form.tags),
    enabled: form.enabled && form.status === "active"
  };
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function updateForm(
  setForm: React.Dispatch<React.SetStateAction<TemplateFormState>>,
  patch: Partial<TemplateFormState>
) {
  setForm((current) => ({ ...current, ...patch }));
}
