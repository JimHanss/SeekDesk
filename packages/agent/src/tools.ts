import {
  dailyWorkToolInputSchemas,
  type AppMode
} from "@seekdesk/shared";
import type { ModelToolDefinition } from "./provider.js";

export type ToolPermissionPolicy = "preview_only" | "permission_required";
export type DailyWorkToolStatus = "completed" | "planned";
export type ToolCallStatus =
  | DailyWorkToolStatus
  | "permission_required"
  | "failed";

export interface ToolDefinition {
  name: string;
  mode: AppMode;
  description: string;
  inputSchema?: ToolInputSchema;
  parametersJsonSchema?: Record<string, unknown>;
  permissionPolicy?: ToolPermissionPolicy;
  defaultResultStatus?: DailyWorkToolStatus;
  execute?: ToolExecutor;
}

export interface ToolCallRequest {
  name: string;
  id?: string;
  mode?: AppMode;
  inputJson?: unknown;
  planOnly?: boolean;
}

export interface ToolCallResult {
  name: string;
  status: ToolCallStatus;
  mode: AppMode;
  previewOnly: boolean;
  permissionRequired: boolean;
  message: string;
  id?: string;
  inputJson?: unknown;
  outputJson?: unknown;
  error?: string;
}

export interface ToolInputSchema {
  parse(input: unknown): unknown;
}

export type ToolExecutor = (request: {
  definition: ToolDefinition;
  input: unknown;
  rawRequest: ToolCallRequest;
}) => Promise<unknown> | unknown;

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(definitions: ToolDefinition[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: ToolDefinition): ToolDefinition {
    const normalized = normalizeToolDefinition(definition);

    if (this.tools.has(normalized.name)) {
      throw new Error(`Tool "${normalized.name}" is already registered.`);
    }

    this.tools.set(normalized.name, normalized);
    return normalized;
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }
}

export class ToolOrchestrator {
  constructor(private readonly registry: ToolRegistry = createDefaultToolRegistry()) {}

  async orchestrate(request: ToolCallRequest): Promise<ToolCallResult> {
    const definition = this.registry.get(request.name);

    if (!definition) {
      return createToolResult(request, {
        status: "failed",
        mode: request.mode ?? "daily_work",
        previewOnly: false,
        permissionRequired: false,
        message: `Unknown tool "${request.name}".`,
        error: "unknown_tool"
      });
    }

    if (definition.permissionPolicy === "permission_required") {
      return createToolResult(request, {
        status: "permission_required",
        mode: definition.mode,
        previewOnly: false,
        permissionRequired: true,
        message: `Tool "${definition.name}" requires permission before it can run.`
      });
    }

    const parsedInput = parseToolInput(definition, request);
    if (!parsedInput.success) {
      return createToolResult(request, {
        status: "failed",
        mode: definition.mode,
        previewOnly: definition.permissionPolicy === "preview_only",
        permissionRequired: false,
        message: `Tool "${definition.name}" input failed schema validation.`,
        error: "invalid_tool_input",
        outputJson: {
          issues: parsedInput.issues
        }
      });
    }

    const status = request.planOnly
      ? "planned"
      : (definition.defaultResultStatus ?? "completed");

    if (definition.execute && status !== "planned") {
      try {
        const outputJson = await definition.execute({
          definition,
          input: parsedInput.input,
          rawRequest: request
        });

        return createToolResult(request, {
          status: "completed",
          mode: definition.mode,
          previewOnly: true,
          permissionRequired: false,
          message: `Tool "${definition.name}" completed in preview-only mode.`,
          outputJson
        });
      } catch (error) {
        return createToolResult(request, {
          status: "failed",
          mode: definition.mode,
          previewOnly: true,
          permissionRequired: false,
          message: `Tool "${definition.name}" failed in preview-only mode.`,
          error: formatToolErrorCode(error),
          outputJson: {
            message: formatToolErrorMessage(error)
          }
        });
      }
    }

    return createToolResult(request, {
      status,
      mode: definition.mode,
      previewOnly: true,
      permissionRequired: false,
      message:
        status === "planned"
          ? `Tool "${definition.name}" was recorded as a plan only.`
          : `Tool "${definition.name}" completed in preview-only mode.`,
      outputJson: {
        previewOnly: true,
        planned: status === "planned"
      }
    });
  }

  async orchestrateMany(requests: ToolCallRequest[]): Promise<ToolCallResult[]> {
    return Promise.all(requests.map((request) => this.orchestrate(request)));
  }
}

export function createDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry([
    {
      name: "daily_work.preview",
      mode: "daily_work",
      description:
        "Preview a daily-work action without connector, workflow, document, or calendar side effects."
    },
    {
      name: "daily_work.plan",
      mode: "daily_work",
      description:
        "Record a daily-work tool action as an execution plan without performing it.",
      defaultResultStatus: "planned"
    },
    {
      name: "coding.shell",
      mode: "coding_agent",
      description:
        "Reserved coding-agent shell access. The skeleton only returns permission_required."
    },
    {
      name: "coding.file_edit",
      mode: "coding_agent",
      description:
        "Reserved coding-agent file editing access. The skeleton only returns permission_required."
    },
    {
      name: "gmail.search_threads",
      mode: "daily_work",
      description:
        "Search authorized Gmail threads and return metadata only. Preview-only: no email is sent or modified.",
      inputSchema: dailyWorkToolInputSchemas["gmail.search_threads"],
      parametersJsonSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Gmail search query." },
          maxResults: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            default: 10
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    },
    {
      name: "gmail.read_thread",
      mode: "daily_work",
      description:
        "Read metadata and snippets for an authorized Gmail thread. Preview-only: attachments and sends are disabled.",
      inputSchema: dailyWorkToolInputSchemas["gmail.read_thread"],
      parametersJsonSchema: {
        type: "object",
        properties: {
          threadId: { type: "string" }
        },
        required: ["threadId"],
        additionalProperties: false
      }
    },
    {
      name: "gmail.create_draft_preview",
      mode: "daily_work",
      description:
        "Create a local Gmail draft payload preview. Does not call Gmail drafts.create or send.",
      inputSchema: dailyWorkToolInputSchemas["gmail.create_draft_preview"],
      parametersJsonSchema: {
        type: "object",
        properties: {
          to: { type: "array", items: { type: "string", format: "email" } },
          cc: { type: "array", items: { type: "string", format: "email" } },
          subject: { type: "string" },
          bodyText: { type: "string" },
          threadId: { type: "string" }
        },
        required: ["to", "subject", "bodyText"],
        additionalProperties: false
      }
    },
    {
      name: "calendar.list_events",
      mode: "daily_work",
      description:
        "List authorized Google Calendar event metadata. Preview-only: no event is created or changed.",
      inputSchema: dailyWorkToolInputSchemas["calendar.list_events"],
      parametersJsonSchema: {
        type: "object",
        properties: {
          calendarId: { type: "string", default: "primary" },
          timeMin: { type: "string", format: "date-time" },
          timeMax: { type: "string", format: "date-time" },
          maxResults: {
            type: "integer",
            minimum: 1,
            maximum: 50,
            default: 10
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "calendar.propose_event_preview",
      mode: "daily_work",
      description:
        "Create a local Google Calendar event payload preview. Does not call events.insert.",
      inputSchema: dailyWorkToolInputSchemas["calendar.propose_event_preview"],
      parametersJsonSchema: {
        type: "object",
        properties: {
          calendarId: { type: "string", default: "primary" },
          summary: { type: "string" },
          description: { type: "string" },
          startDateTime: { type: "string", format: "date-time" },
          endDateTime: { type: "string", format: "date-time" },
          attendeeEmails: {
            type: "array",
            items: { type: "string", format: "email" }
          }
        },
        required: ["summary", "startDateTime", "endDateTime"],
        additionalProperties: false
      }
    },
    {
      name: "daily.persist_artifact",
      mode: "daily_work",
      description:
        "Persist an AI generated daily-work artifact locally for review. Preview-only external boundary: no provider write.",
      inputSchema: dailyWorkToolInputSchemas["daily.persist_artifact"],
      parametersJsonSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          artifactType: { type: "string", default: "ai_generated_note" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } }
        },
        required: ["title", "content"],
        additionalProperties: false
      }
    }
  ]);
}

export function createModelToolDefinitions(
  registry: ToolRegistry,
  mode: AppMode = "daily_work"
): ModelToolDefinition[] {
  return registry
    .list()
    .filter((definition) => definition.mode === mode)
    .filter((definition) => definition.permissionPolicy !== "permission_required")
    .filter((definition) => Boolean(definition.parametersJsonSchema))
    .map((definition) => ({
      type: "function",
      function: {
        name: definition.name,
        description: definition.description,
        parameters: definition.parametersJsonSchema ?? {
          type: "object",
          properties: {},
          additionalProperties: true
        }
      }
    }));
}

function normalizeToolDefinition(definition: ToolDefinition): ToolDefinition {
  const name = definition.name.trim();

  if (!name) {
    throw new Error("Tool name is required.");
  }

  const permissionPolicy =
    definition.permissionPolicy ??
    (definition.mode === "coding_agent" ? "permission_required" : "preview_only");

  if (definition.mode === "daily_work") {
    return {
      ...definition,
      name,
      permissionPolicy,
      defaultResultStatus: definition.defaultResultStatus ?? "completed"
    };
  }

  return {
    ...definition,
    name,
    permissionPolicy
  };
}

function createToolResult(
  request: ToolCallRequest,
  result: Omit<ToolCallResult, "name" | "id" | "inputJson">
): ToolCallResult {
  const base: ToolCallResult = {
    ...result,
    name: request.name
  };

  if (request.id) {
    base.id = request.id;
  }

  if ("inputJson" in request) {
    base.inputJson = request.inputJson;
  }

  return base;
}

function parseToolInput(
  definition: ToolDefinition,
  request: ToolCallRequest
):
  | {
      success: true;
      input: unknown;
    }
  | {
      success: false;
      issues: unknown;
    } {
  if (!definition.inputSchema) {
    return {
      success: true,
      input: request.inputJson ?? {}
    };
  }

  try {
    return {
      success: true,
      input: definition.inputSchema.parse(request.inputJson ?? {})
    };
  } catch (error) {
    return {
      success: false,
      issues: formatToolInputIssues(error)
    };
  }
}

function formatToolInputIssues(error: unknown) {
  if (hasIssues(error)) {
    return error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message
    }));
  }

  return [
    {
      path: "",
      message: formatToolErrorMessage(error)
    }
  ];
}

function hasIssues(error: unknown): error is {
  issues: Array<{ path: Array<string | number>; message: string }>;
} {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues: unknown }).issues)
  );
}

function formatToolErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }

  if (error instanceof Error && error.name) {
    return error.name;
  }

  return "tool_execution_failed";
}

function formatToolErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
