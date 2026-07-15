import { randomUUID } from "node:crypto";

import {
  codingPermissionGrantCreateRequestSchema,
  codingPermissionGrantRevokeRequestSchema,
  codingToolInputSchemas,
  normalizeRuntimeMode,
  runtimeErrorCodeSchema,
  type CodingPermissionGrantAction,
  codingToolNameSchema,
  type CodingPermissionGrant,
  type CodingToolName,
  type DailyWorkArtifact,
  type RuntimeMode,
  type RuntimeOperation,
  type ToolCallRecord
} from "@seekdesk/shared";
import {
  ToolOrchestrator,
  ToolRegistry,
  createDefaultToolRegistry,
  createModelToolDefinitions,
  fromModelToolName,
  type ToolCallResult,
  type ToolDefinition
} from "@seekdesk/agent";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import { createToolActivityEvent } from "./daily-work-tool-activity.js";
import { CodingRuntimeError, LocalCodingRuntime, type CodingRuntime } from "./coding-runtime.js";

const writeOrCommandTools = new Set<CodingToolName>([
  "coding.write_file",
  "coding.edit_file",
  "coding.run_shell",
  "coding.run_tests"
]);

export function createCodingToolRuntime(options: { runtime?: CodingRuntime } = {}) {
  const runtime = options.runtime ?? new LocalCodingRuntime();
  const registry = new ToolRegistry(
    createDefaultToolRegistry()
      .list()
      .filter((definition) => definition.mode === "coding_agent")
      .map((definition) => attachRuntimeExecutor(definition, runtime))
  );

  return {
    runtime,
    registry,
    modelTools: createModelToolDefinitions(registry, "coding_agent"),
    orchestrator: new ToolOrchestrator(registry)
  };
}

export function createCodingPermissionGrant(input: {
  ownerId: string;
  sessionId: string;
  workspaceId?: string;
  runtimeMode?: RuntimeMode;
  provider?: RuntimeMode;
  action: CodingPermissionGrantAction;
  reason?: string;
}): CodingPermissionGrant {
  const now = new Date();

  return {
    id: `coding-grant-${randomUUID()}`,
    mode: "coding_agent",
    provider: input.provider ?? input.runtimeMode ?? "local_daemon",
    ownerId: input.ownerId,
    sessionId: input.sessionId,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    ...(input.runtimeMode ? { runtimeMode: input.runtimeMode } : {}),
    action: input.action,
    decision: "allow_for_session",
    status: "active",
    ...(input.reason ? { reason: input.reason } : {}),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  };
}

export async function executeAuthorizedCodingToolCall(input: {
  repository: DailyWorkRepository;
  ownerId: string;
  toolCallId: string;
  sessionId: string;
  workspaceId: string;
  runtimeMode: RuntimeMode;
  runtime: CodingRuntime;
}) {
  const toolCall = (
    await input.repository.listToolCalls({
      ownerId: input.ownerId,
      sessionId: input.sessionId,
      limit: 200
    })
  ).find((candidate) => candidate.id === input.toolCallId);

  if (!toolCall) {
    throw new CodingRuntimeError("Coding tool call was not found.", "tool_call_not_found", {
      toolCallId: input.toolCallId
    });
  }

  if (
    !toolCall.ownerId ||
    !toolCall.workspaceId ||
    !toolCall.runtimeMode ||
    !toolCall.requestId ||
    toolCall.ownerId !== input.ownerId ||
    toolCall.sessionId !== input.sessionId ||
    toolCall.workspaceId !== input.workspaceId ||
    normalizeRuntimeMode(toolCall.runtimeMode) !== input.runtimeMode
  ) {
    throw new CodingRuntimeError(
      "Tool call scope does not match the current session and Runtime.",
      "session_workspace_mismatch",
      {
        toolCallId: input.toolCallId,
        expected: {
          ownerId: input.ownerId,
          sessionId: input.sessionId,
          workspaceId: input.workspaceId,
          runtimeMode: input.runtimeMode
        }
      }
    );
  }

  const toolName = normalizeCodingToolName(toolCall.name);
  if (!toolName) {
    throw new CodingRuntimeError("Tool call is not a coding tool.", "not_coding_tool", {
      toolName: toolCall.name
    });
  }

  if (writeOrCommandTools.has(toolName)) {
    const grants = await input.repository.listPermissionGrants({
      ownerId: input.ownerId,
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      runtimeMode: input.runtimeMode,
      provider: input.runtimeMode,
      action: toolName,
      activeOnly: true,
      limit: 100
    });

    if (!grants.length) {
      throw new CodingRuntimeError(
        "This coding tool requires same-session authorization.",
        "permission_required",
        { toolName }
      );
    }
  }

  const parsedInput = codingToolInputSchemas[toolName].parse(toolCall.inputJson ?? {});
  assertRuntimeBinding(input.runtime, input.workspaceId, input.runtimeMode);
  const startedAt = new Date().toISOString();
  const claimedToolCall = await input.repository.claimToolCallExecution({
    ownerId: input.ownerId,
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    runtimeMode: input.runtimeMode,
    toolCallId: input.toolCallId,
    startedAt
  });
  if (!claimedToolCall) {
    throw new CodingRuntimeError(
      "This tool call is no longer pending or is already running.",
      "runtime_request_conflict",
      { toolCallId: input.toolCallId }
    );
  }
  if (!claimedToolCall.requestId) {
    throw new CodingRuntimeError(
      "Coding tool call is missing its persisted requestId.",
      "runtime_request_conflict",
      { toolCallId: input.toolCallId }
    );
  }
  const operation = createToolRuntimeOperation({
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    toolCall: claimedToolCall,
    toolName,
    inputJson: parsedInput,
    startedAt
  });
  await input.repository.upsertRuntimeOperation(operation);
  await input.repository.upsertActivityEvent(
    createToolActivityEvent({
      sessionId: input.sessionId,
      toolName,
      status: "in_progress",
      timestamp: startedAt,
      inputJson: parsedInput,
      toolCallId: input.toolCallId,
      runtimeMode: input.runtimeMode,
      requestId: claimedToolCall.requestId,
      phase: "running"
    }),
    createToolScope(input.ownerId, claimedToolCall)
  );

  try {
    const runtimeOutput = await input.runtime.execute(toolName, parsedInput, {
      requestId: claimedToolCall.requestId
    });
    let outputJson = normalizeCodingToolOutput({
      toolName,
      inputJson: parsedInput,
      outputJson: runtimeOutput,
      workspaceId: input.workspaceId,
      runtimeMode: input.runtimeMode,
      requestId: claimedToolCall.requestId,
      workspaceRoot: input.runtime.status().workspaceRoot
    });
    if (toolName === "coding.write_file" || toolName === "coding.edit_file") {
      outputJson = await persistCodingWriteArtifact({
        repository: input.repository,
        ownerId: input.ownerId,
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        runtimeMode: input.runtimeMode,
        toolCall: claimedToolCall,
        toolName,
        inputJson: parsedInput,
        outputJson,
        runtime: input.runtime
      });
    }
    const completedAt = new Date().toISOString();
    const completedRecord: ToolCallRecord = {
      ...claimedToolCall,
      name: toolName,
      status: "completed",
      inputJson: parsedInput,
      outputJson,
      previewOnly: false,
      permissionRequired: writeOrCommandTools.has(toolName),
      createdAt: claimedToolCall.createdAt,
      startedAt,
      completedAt
    };

    await input.repository.recordToolCall(completedRecord);
    await input.repository.upsertRuntimeOperation({
      ...operation,
      status: "completed",
      resultPayload: outputJson,
      completedAt
    });
    await input.repository.upsertActivityEvent(
      createToolActivityEvent({
        sessionId: input.sessionId,
        toolName,
        status: "completed",
        timestamp: completedAt,
        inputJson: parsedInput,
        outputJson,
        toolCallId: input.toolCallId,
        runtimeMode: input.runtimeMode,
        requestId: claimedToolCall.requestId,
        phase: "completed"
      }),
      createToolScope(input.ownerId, completedRecord)
    );

    return {
      mode: "coding_agent" as const,
      toolCall: completedRecord,
      result: outputJson
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const cancelled = isRuntimeCancellation(error);
    const failedRecord: ToolCallRecord = {
      ...claimedToolCall,
      name: toolName,
      status: cancelled ? "cancelled" : "failed",
      inputJson: parsedInput,
      outputJson: formatCodingRuntimeError(error),
      previewOnly: false,
      permissionRequired: writeOrCommandTools.has(toolName),
      error: formatCodingRuntimeErrorCode(error),
      createdAt: claimedToolCall.createdAt,
      startedAt,
      completedAt
    };

    await input.repository.recordToolCall(failedRecord);
    await input.repository.upsertRuntimeOperation({
      ...operation,
      status: cancelled ? "cancelled" : "failed",
      errorCode: normalizeRuntimeOperationErrorCode(error),
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt
    });
    await input.repository.upsertActivityEvent(
      createToolActivityEvent({
        sessionId: input.sessionId,
        toolName,
        status: cancelled ? "cancelled" : "failed",
        timestamp: completedAt,
        inputJson: parsedInput,
        outputJson: failedRecord.outputJson,
        ...(failedRecord.error ? { error: failedRecord.error } : {}),
        toolCallId: input.toolCallId,
        runtimeMode: input.runtimeMode,
        requestId: claimedToolCall.requestId,
        phase: cancelled ? "cancelled" : "failed"
      }),
      createToolScope(input.ownerId, failedRecord)
    );
    throw error;
  }
}

export { codingPermissionGrantCreateRequestSchema, codingPermissionGrantRevokeRequestSchema };

function assertRuntimeBinding(
  runtime: CodingRuntime,
  workspaceId: string,
  runtimeMode: RuntimeMode
) {
  const status = runtime.status();
  if (
    status.workspaceId !== workspaceId ||
    normalizeRuntimeMode(status.runtimeMode) !== runtimeMode
  ) {
    throw new CodingRuntimeError(
      "Resolved Runtime does not match the tool call workspace binding.",
      "session_workspace_mismatch",
      {
        expected: { workspaceId, runtimeMode },
        actual: {
          workspaceId: status.workspaceId,
          runtimeMode: status.runtimeMode
        }
      }
    );
  }
}

function createToolRuntimeOperation(input: {
  ownerId: string;
  workspaceId: string;
  toolCall: ToolCallRecord;
  toolName: CodingToolName;
  inputJson: unknown;
  startedAt: string;
}): RuntimeOperation {
  return {
    id: `runtime-tool-${input.toolCall.id}`,
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    type: "execute",
    status: "running",
    idempotencyKey: `tool-call:${input.toolCall.id}`,
    requestPayload: {
      toolCallId: input.toolCall.id,
      requestId: input.toolCall.requestId,
      runtimeMode: input.toolCall.runtimeMode,
      toolName: input.toolName,
      inputJson: input.inputJson
    },
    createdAt: input.startedAt,
    startedAt: input.startedAt
  };
}

function normalizeCodingToolOutput(input: {
  toolName: CodingToolName;
  inputJson: unknown;
  outputJson: unknown;
  workspaceId: string;
  runtimeMode: RuntimeMode;
  requestId: string;
  workspaceRoot: string;
}): Record<string, unknown> {
  const output = isRecord(input.outputJson)
    ? input.outputJson
    : { result: input.outputJson };
  const base = {
    ...output,
    workspaceId: input.workspaceId,
    runtimeMode: input.runtimeMode,
    requestId: input.requestId
  };
  if (input.toolName !== "coding.run_shell" && input.toolName !== "coding.run_tests") {
    return base;
  }
  const toolInput = isRecord(input.inputJson) ? input.inputJson : {};
  const timedOut = output.timedOut === true;
  return {
    ...base,
    command: stringOutput(output.command) ?? stringOutput(toolInput.command) ?? "",
    cwd: stringOutput(output.cwd) ?? input.workspaceRoot,
    stdout: stringOutput(output.stdout) ?? "",
    stderr: stringOutput(output.stderr) ?? "",
    exitCode: typeof output.exitCode === "number" ? output.exitCode : 1,
    timeout: timedOut,
    timedOut,
    truncated: output.truncated === true
  };
}

async function persistCodingWriteArtifact(input: {
  repository: DailyWorkRepository;
  ownerId: string;
  sessionId: string;
  workspaceId: string;
  runtimeMode: RuntimeMode;
  toolCall: ToolCallRecord;
  toolName: "coding.write_file" | "coding.edit_file";
  inputJson: unknown;
  outputJson: Record<string, unknown>;
  runtime: CodingRuntime;
}) {
  const path = stringOutput(isRecord(input.inputJson) ? input.inputJson.path : undefined) ?? "workspace file";
  const gitDiff = await captureGitDiff(input.runtime, path);
  const now = new Date().toISOString();
  const artifactId = `coding-artifact-${input.toolCall.id}`;
  const artifact: DailyWorkArtifact = {
    id: artifactId,
    ownerId: input.ownerId,
    mode: "coding_agent",
    artifactType: "status_update",
    title: `Code change: ${path}`,
    description: `Workspace change created by ${input.toolName}.`,
    summary: summarizeGitDiff(gitDiff, path),
    status: "ready",
    owner: {
      id: input.ownerId,
      displayName: "Coding Agent"
    },
    updatedAt: now,
    sourceContextIds: [input.workspaceId],
    approvalRequestIds: [],
    version: 1,
    reusable: false,
    nextAction: null,
    permissionState: "workspace_shared",
    trace: {
      origin: "coding_tool",
      createdAt: now,
      createdBy: "coding-agent",
      events: [{
        at: now,
        actor: "coding-agent",
        type: "created",
        summary: `Created from tool call ${input.toolCall.id}.`
      }]
    },
    lifecycle: [],
    tags: ["coding", "workspace-write", input.runtimeMode],
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    runtimeMode: input.runtimeMode,
    toolCallId: input.toolCall.id,
    requestId: input.toolCall.requestId,
    path
  };
  await input.repository.upsertArtifact(artifact, {
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    runtimeMode: input.runtimeMode
  });
  const session = (await input.repository.listSessionDetails({
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    runtimeMode: input.runtimeMode
  })).find((candidate) => candidate.id === input.sessionId);
  if (session) {
    await input.repository.updateSessionDetail({
      ...session,
      artifactIds: [...new Set([...session.artifactIds, artifactId])],
      updatedAt: now,
      lastAction: {
        at: now,
        actor: "coding-agent",
        label: `Updated ${path}`
      }
    });
  }
  return {
    ...input.outputJson,
    artifactId,
    gitDiff
  };
}

async function captureGitDiff(runtime: CodingRuntime, path: string) {
  try {
    return await runtime.gitDiff({ path, staged: false });
  } catch (error) {
    return {
      unavailable: true,
      error: formatCodingRuntimeError(error)
    };
  }
}

function summarizeGitDiff(diff: unknown, path: string) {
  if (isRecord(diff)) {
    const stdout = stringOutput(diff.stdout);
    if (stdout?.trim()) {
      return stdout.length > 2000 ? `${stdout.slice(0, 2000)}\n[diff truncated]` : stdout;
    }
  }
  return `Workspace file ${path} was updated. Git diff is unavailable or empty.`;
}

function isRuntimeCancellation(error: unknown) {
  return error instanceof CodingRuntimeError && (
    error.code === "runtime_request_cancelled" ||
    error.code === "daemon_request_cancelled"
  );
}

function normalizeRuntimeOperationErrorCode(error: unknown) {
  const rawCode = error instanceof CodingRuntimeError ? error.code : "runtime_execution_failed";
  const normalizedCode = rawCode === "daemon_request_timeout"
    ? "runtime_request_timeout"
    : rawCode === "daemon_request_cancelled"
      ? "runtime_request_cancelled"
      : rawCode;
  const parsed = runtimeErrorCodeSchema.safeParse(normalizedCode);
  return parsed.success ? parsed.data : "runtime_execution_failed";
}

function stringOutput(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function attachRuntimeExecutor(
  definition: ToolDefinition,
  runtime: CodingRuntime
): ToolDefinition {
  const toolName = normalizeCodingToolName(definition.name);
  if (!toolName || writeOrCommandTools.has(toolName)) {
    return definition;
  }

  return {
    ...definition,
    execute: ({ input }) => runtime.execute(toolName, input)
  };
}

function normalizeCodingToolName(name: string) {
  const parsed = codingToolNameSchema.safeParse(name);
  if (parsed.success) {
    return parsed.data;
  }

  const mapped = fromModelToolName(createDefaultToolRegistry(), name);
  const mappedParsed = codingToolNameSchema.safeParse(mapped);
  return mappedParsed.success ? mappedParsed.data : null;
}

function formatCodingRuntimeError(error: unknown) {
  if (error instanceof CodingRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  return {
    code: "coding_tool_failed",
    message: error instanceof Error ? error.message : String(error)
  };
}

function formatCodingRuntimeErrorCode(error: unknown) {
  return error instanceof CodingRuntimeError ? error.code : "coding_tool_failed";
}

export function isWriteOrCommandCodingTool(name: string) {
  const parsed = codingToolNameSchema.safeParse(name);
  return parsed.success && writeOrCommandTools.has(parsed.data);
}

export function createPermissionRequiredCodingResult(input: {
  id?: string;
  name: CodingToolName;
  inputJson: unknown;
}): ToolCallResult {
  return {
    ...(input.id ? { id: input.id } : {}),
    name: input.name,
    status: "permission_required",
    mode: "coding_agent",
    previewOnly: false,
    permissionRequired: true,
    message: `Tool "${input.name}" requires same-session authorization before it can run.`,
    inputJson: input.inputJson
  };
}

function createToolScope(ownerId: string, toolCall: ToolCallRecord) {
  return {
    ownerId,
    workspaceId: toolCall.workspaceId ?? "workspace-seekdesk",
    runtimeMode: toolCall.runtimeMode ?? ("server_local" as const)
  };
}
