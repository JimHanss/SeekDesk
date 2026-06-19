import { randomUUID } from "node:crypto";

import {
  codingPermissionGrantCreateRequestSchema,
  codingPermissionGrantRevokeRequestSchema,
  codingToolInputSchemas,
  type CodingPermissionGrantAction,
  codingToolNameSchema,
  type CodingPermissionGrant,
  type CodingToolName,
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
import { CodingRuntimeError, LocalCodingRuntime } from "./coding-runtime.js";

const writeOrCommandTools = new Set<CodingToolName>([
  "coding.write_file",
  "coding.edit_file",
  "coding.run_shell",
  "coding.run_tests"
]);

export function createCodingToolRuntime() {
  const runtime = new LocalCodingRuntime();
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
  sessionId: string;
  action: CodingPermissionGrantAction;
  reason?: string;
}): CodingPermissionGrant {
  const now = new Date();

  return {
    id: `coding-grant-${randomUUID()}`,
    mode: "coding_agent",
    provider: "local_daemon",
    sessionId: input.sessionId,
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
  toolCallId: string;
  sessionId: string;
}) {
  const toolCall = (
    await input.repository.listToolCalls({ sessionId: input.sessionId, limit: 200 })
  ).find((candidate) => candidate.id === input.toolCallId);

  if (!toolCall) {
    throw new CodingRuntimeError("Coding tool call was not found.", "tool_call_not_found", {
      toolCallId: input.toolCallId
    });
  }

  const toolName = normalizeCodingToolName(toolCall.name);
  if (!toolName) {
    throw new CodingRuntimeError("Tool call is not a coding tool.", "not_coding_tool", {
      toolName: toolCall.name
    });
  }

  if (writeOrCommandTools.has(toolName)) {
    const grants = await input.repository.listPermissionGrants({
      sessionId: input.sessionId,
      provider: "local_daemon",
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
  const runtime = new LocalCodingRuntime();
  const startedAt = new Date().toISOString();
  await input.repository.recordToolCall({
    ...toolCall,
    status: "running",
    permissionRequired: writeOrCommandTools.has(toolName),
    previewOnly: false
  });
  await input.repository.upsertActivityEvent(
    createToolActivityEvent({
      sessionId: input.sessionId,
      toolName,
      status: "queued",
      timestamp: startedAt,
      inputJson: parsedInput,
      toolCallId: input.toolCallId,
      phase: "requested"
    })
  );

  try {
    const outputJson = await runtime.execute(toolName, parsedInput);
    const completedAt = new Date().toISOString();
    const completedRecord: ToolCallRecord = {
      ...toolCall,
      name: toolName,
      status: "completed",
      inputJson: parsedInput,
      outputJson,
      previewOnly: false,
      permissionRequired: writeOrCommandTools.has(toolName),
      createdAt: toolCall.createdAt,
      completedAt
    };

    await input.repository.recordToolCall(completedRecord);
    await input.repository.upsertActivityEvent(
      createToolActivityEvent({
        sessionId: input.sessionId,
        toolName,
        status: "completed",
        timestamp: completedAt,
        inputJson: parsedInput,
        outputJson,
        toolCallId: input.toolCallId,
        phase: "completed"
      })
    );

    return {
      mode: "coding_agent" as const,
      toolCall: completedRecord,
      result: outputJson
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const failedRecord: ToolCallRecord = {
      ...toolCall,
      name: toolName,
      status: "failed",
      inputJson: parsedInput,
      outputJson: formatCodingRuntimeError(error),
      previewOnly: false,
      permissionRequired: writeOrCommandTools.has(toolName),
      error: formatCodingRuntimeErrorCode(error),
      createdAt: toolCall.createdAt,
      completedAt
    };

    await input.repository.recordToolCall(failedRecord);
    await input.repository.upsertActivityEvent(
      createToolActivityEvent({
        sessionId: input.sessionId,
        toolName,
        status: "failed",
        timestamp: completedAt,
        inputJson: parsedInput,
        outputJson: failedRecord.outputJson,
        ...(failedRecord.error ? { error: failedRecord.error } : {}),
        toolCallId: input.toolCallId,
        phase: "completed"
      })
    );
    throw error;
  }
}

export { codingPermissionGrantCreateRequestSchema, codingPermissionGrantRevokeRequestSchema };

function attachRuntimeExecutor(
  definition: ToolDefinition,
  runtime: LocalCodingRuntime
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
