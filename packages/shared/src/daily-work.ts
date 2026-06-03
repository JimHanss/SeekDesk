import { z } from "zod";

import { appModeSchema } from "./app-modes.js";

export const templateCategorySchema = z.enum([
  "triage",
  "planning",
  "execution",
  "review",
  "handoff"
]);

export const artifactTypeSchema = z.enum([
  "brief",
  "checklist",
  "status_update",
  "handoff_note",
  "decision_log"
]);

export const dailyWorkTemplateSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  category: templateCategorySchema,
  title: z.string(),
  description: z.string(),
  prompt: z.string(),
  artifactType: artifactTypeSchema.optional(),
  tags: z.array(z.string()).default([]),
  enabled: z.boolean().default(true)
});

export const dailyWorkArtifactSchema = z.object({
  id: z.string(),
  mode: appModeSchema.default("daily_work"),
  artifactType: artifactTypeSchema,
  title: z.string(),
  description: z.string(),
  templateId: z.string().optional(),
  summary: z.string(),
  tags: z.array(z.string()).default([])
});

export const dailyWorkTemplatesResponseSchema = z.object({
  mode: appModeSchema,
  templates: z.array(dailyWorkTemplateSchema)
});

export const dailyWorkArtifactsResponseSchema = z.object({
  mode: appModeSchema,
  artifacts: z.array(dailyWorkArtifactSchema)
});

export const defaultDailyWorkTemplates: DailyWorkTemplate[] = [
  {
    id: "morning-standup-brief",
    mode: "daily_work",
    category: "planning",
    title: "Morning standup brief",
    description:
      "Summarize the day, surface blockers, and identify the first meaningful task.",
    prompt:
      "Create a concise morning brief with priorities, blockers, and a first-step plan.",
    artifactType: "status_update",
    tags: ["daily", "standup", "priorities"],
    enabled: true
  },
  {
    id: "request-triage",
    mode: "daily_work",
    category: "triage",
    title: "Request triage",
    description:
      "Sort incoming work into urgent, scheduled, delegated, or parked items.",
    prompt:
      "Triage the incoming requests and group them into urgent, scheduled, delegated, or parked.",
    artifactType: "checklist",
    tags: ["inbox", "triage", "requests"],
    enabled: true
  },
  {
    id: "end-of-day-wrap",
    mode: "daily_work",
    category: "review",
    title: "End-of-day wrap",
    description:
      "Capture what was completed, what remains open, and the next action for tomorrow.",
    prompt:
      "Write an end-of-day wrap that records completed work, open loops, and tomorrow's top three actions.",
    artifactType: "brief",
    tags: ["wrap-up", "summary", "handoff"],
    enabled: true
  }
] as const as DailyWorkTemplate[];

export const defaultDailyWorkArtifacts: DailyWorkArtifact[] = [
  {
    id: "daily-status-brief",
    mode: "daily_work",
    artifactType: "status_update",
    title: "Daily status brief",
    description: "A short summary of today's priorities, progress, and blockers.",
    templateId: "morning-standup-brief",
    summary: "Daily snapshot for teammates and stakeholders.",
    tags: ["daily", "status", "sync"]
  },
  {
    id: "open-loops-checklist",
    mode: "daily_work",
    artifactType: "checklist",
    title: "Open loops checklist",
    description: "A lightweight checklist for unfinished items and follow-ups.",
    templateId: "request-triage",
    summary: "Tracks what still needs attention before the day ends.",
    tags: ["follow-up", "tasks", "checklist"]
  },
  {
    id: "handoff-note",
    mode: "daily_work",
    artifactType: "handoff_note",
    title: "Handoff note",
    description: "A clean handoff artifact for the next person or the next day.",
    templateId: "end-of-day-wrap",
    summary: "Records what changed, what matters next, and where to resume.",
    tags: ["handoff", "transition", "notes"]
  }
] as const as DailyWorkArtifact[];

export type DailyWorkTemplate = z.infer<typeof dailyWorkTemplateSchema>;
export type DailyWorkArtifact = z.infer<typeof dailyWorkArtifactSchema>;
export type DailyWorkTemplatesResponse = z.infer<
  typeof dailyWorkTemplatesResponseSchema
>;
export type DailyWorkArtifactsResponse = z.infer<
  typeof dailyWorkArtifactsResponseSchema
>;
export type TemplateCategory = z.infer<typeof templateCategorySchema>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;
