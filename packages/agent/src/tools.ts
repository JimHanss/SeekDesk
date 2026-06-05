import type { AppMode } from "@seekdesk/shared";

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
  inputSchema?: unknown;
  permissionPolicy?: ToolPermissionPolicy;
  defaultResultStatus?: DailyWorkToolStatus;
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

    const status = request.planOnly
      ? "planned"
      : (definition.defaultResultStatus ?? "completed");

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
    }
  ]);
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
