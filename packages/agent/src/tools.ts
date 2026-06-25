import {
  codingToolInputSchemas,
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
    const definition = resolveToolDefinition(this.registry, request.name);
    const normalizedRequest =
      definition && definition.name !== request.name
        ? {
            ...request,
            name: definition.name
          }
        : request;

    if (!definition) {
      return createToolResult(request, {
        status: "failed",
        mode: request.mode ?? "coding_agent",
        previewOnly: false,
        permissionRequired: false,
        message: `Unknown tool "${request.name}".`,
        error: "unknown_tool"
      });
    }

    const parsedInput = parseToolInput(definition, normalizedRequest);
    if (!parsedInput.success) {
      return createToolResult(normalizedRequest, {
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

    if (definition.permissionPolicy === "permission_required") {
      return createToolResult(normalizedRequest, {
        status: "permission_required",
        mode: definition.mode,
        previewOnly: false,
        permissionRequired: true,
        message: `Tool "${definition.name}" requires same-session authorization before it can run.`
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
          rawRequest: normalizedRequest
        });

        return createToolResult(normalizedRequest, {
          status: "completed",
          mode: definition.mode,
          previewOnly: false,
          permissionRequired: false,
          message: `Tool "${definition.name}" completed.`,
          outputJson
        });
      } catch (error) {
        return createToolResult(normalizedRequest, {
          status: "failed",
          mode: definition.mode,
          previewOnly: definition.permissionPolicy === "preview_only",
          permissionRequired: false,
          message: `Tool "${definition.name}" failed.`,
          error: formatToolErrorCode(error),
          outputJson: {
            message: formatToolErrorMessage(error)
          }
        });
      }
    }

    return createToolResult(normalizedRequest, {
      status,
      mode: definition.mode,
      previewOnly: definition.permissionPolicy === "preview_only",
      permissionRequired: false,
      message:
        status === "planned"
          ? `Tool "${definition.name}" was recorded as a plan only.`
          : `Tool "${definition.name}" completed as a local preview.`,
      outputJson: {
        previewOnly: definition.permissionPolicy === "preview_only",
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
      name: "daily.persist_artifact",
      mode: "daily_work",
      description:
        "Persist an AI generated local artifact for review. No external connector effects.",
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
    },
    createCodingToolDefinition({
      name: "coding.list_files",
      description: "List files under the configured workspace root.",
      inputSchema: codingToolInputSchemas["coding.list_files"],
      properties: {
        path: { type: "string", default: "." },
        maxDepth: { type: "integer", minimum: 1, maximum: 8, default: 3 },
        maxEntries: { type: "integer", minimum: 1, maximum: 500, default: 200 }
      }
    }),
    createCodingToolDefinition({
      name: "coding.read_file",
      description: "Read a text file under the configured workspace root.",
      inputSchema: codingToolInputSchemas["coding.read_file"],
      required: ["path"],
      properties: {
        path: { type: "string" },
        maxBytes: { type: "integer", minimum: 1, maximum: 500000, default: 200000 }
      }
    }),
    createCodingToolDefinition({
      name: "coding.grep",
      description: "Search text in workspace files.",
      inputSchema: codingToolInputSchemas["coding.grep"],
      required: ["query"],
      properties: {
        query: { type: "string" },
        path: { type: "string", default: "." },
        includeGlob: { type: "string" },
        maxResults: { type: "integer", minimum: 1, maximum: 200, default: 50 }
      }
    }),
    createCodingToolDefinition({
      name: "coding.git_status",
      description: "Read git status for the workspace.",
      inputSchema: codingToolInputSchemas["coding.git_status"],
      properties: {}
    }),
    createCodingToolDefinition({
      name: "coding.git_diff",
      description: "Read git diff for the workspace.",
      inputSchema: codingToolInputSchemas["coding.git_diff"],
      properties: {
        path: { type: "string" },
        staged: { type: "boolean", default: false }
      }
    }),
    createCodingToolDefinition({
      name: "coding.write_file",
      description:
        "Write a file under the workspace root. Requires same-session authorization.",
      inputSchema: codingToolInputSchemas["coding.write_file"],
      permissionPolicy: "permission_required",
      required: ["path", "content"],
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        createDirs: { type: "boolean", default: false }
      }
    }),
    createCodingToolDefinition({
      name: "coding.edit_file",
      description:
        "Replace exact text in a workspace file. Requires same-session authorization.",
      inputSchema: codingToolInputSchemas["coding.edit_file"],
      permissionPolicy: "permission_required",
      required: ["path", "search", "replace"],
      properties: {
        path: { type: "string" },
        search: { type: "string" },
        replace: { type: "string" },
        expectedReplacements: { type: "integer", minimum: 1, maximum: 100, default: 1 }
      }
    }),
    createCodingToolDefinition({
      name: "coding.run_shell",
      description:
        "Run a shell command in the workspace. Requires same-session authorization.",
      inputSchema: codingToolInputSchemas["coding.run_shell"],
      permissionPolicy: "permission_required",
      required: ["command"],
      properties: {
        command: { type: "string" },
        timeoutMs: { type: "integer", minimum: 1000, maximum: 120000, default: 30000 }
      }
    }),
    createCodingToolDefinition({
      name: "coding.run_tests",
      description:
        "Run a test command in the workspace. Requires same-session authorization.",
      inputSchema: codingToolInputSchemas["coding.run_tests"],
      permissionPolicy: "permission_required",
      properties: {
        command: { type: "string", default: "npm test" },
        timeoutMs: { type: "integer", minimum: 1000, maximum: 300000, default: 120000 }
      }
    })
  ]);
}

export function createModelToolDefinitions(
  registry: ToolRegistry,
  mode: AppMode = "coding_agent"
): ModelToolDefinition[] {
  return registry
    .list()
    .filter((definition) => definition.mode === mode)
    .filter((definition) => Boolean(definition.parametersJsonSchema))
    .map((definition) => ({
      type: "function",
      function: {
        name: toModelToolName(definition.name),
        description: definition.description,
        parameters: definition.parametersJsonSchema ?? {
          type: "object",
          properties: {},
          additionalProperties: true
        }
      }
    }));
}

export function toModelToolName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

export function fromModelToolName(
  registry: ToolRegistry,
  modelToolName: string
): string {
  const exact = registry.get(modelToolName);
  if (exact) {
    return exact.name;
  }

  const match = registry
    .list()
    .find((definition) => toModelToolName(definition.name) === modelToolName);

  return match?.name ?? modelToolName;
}

function createCodingToolDefinition(input: {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  properties: Record<string, unknown>;
  required?: string[];
  permissionPolicy?: ToolPermissionPolicy;
}): ToolDefinition {
  return {
    name: input.name,
    mode: "coding_agent",
    description: input.description,
    inputSchema: input.inputSchema,
    permissionPolicy: input.permissionPolicy ?? "preview_only",
    parametersJsonSchema: {
      type: "object",
      properties: input.properties,
      required: input.required ?? [],
      additionalProperties: false
    }
  };
}

function resolveToolDefinition(registry: ToolRegistry, name: string) {
  return registry.get(name) ?? registry.get(fromModelToolName(registry, name));
}

function normalizeToolDefinition(definition: ToolDefinition): ToolDefinition {
  const name = definition.name.trim();

  if (!name) {
    throw new Error("Tool name is required.");
  }

  const permissionPolicy =
    definition.permissionPolicy ??
    (definition.mode === "coding_agent" ? "permission_required" : "preview_only");

  return {
    ...definition,
    name,
    permissionPolicy,
    defaultResultStatus: definition.defaultResultStatus ?? "completed"
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
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
