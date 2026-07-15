import {
  codingToolNameSchema,
  codingWorkspaceRecordSchema,
  runtimeExecuteRequestSchema,
  runtimeExecuteResponseSchema,
  runtimeOperationSchema,
  type CodingToolName,
  type CodingWorkspaceRecord,
  type RuntimeExecuteResponse,
  type RuntimeOperation
} from "@seekdesk/shared";

import type { CloudRuntimeConfig } from "./config.js";
import type { CloudContainerEngine } from "./engine.js";
import { CloudRuntimeServiceError, toCloudRuntimeServiceError } from "./errors.js";
import { WorkspaceExecutionQueue } from "./execution-queue.js";
import type { GitBootstrapper } from "./git-bootstrap.js";
import type { CloudWorkspaceStorage, StoredWorkspaceState } from "./storage.js";

const supportedCapabilities = codingToolNameSchema.options;
const readTools = new Set<CodingToolName>([
  "coding.read_file",
  "coding.list_files",
  "coding.grep",
  "coding.git_status",
  "coding.git_diff"
]);

export interface CloudLifecycleSubmission {
  ownerId: string;
  workspace: CodingWorkspaceRecord;
  operation: RuntimeOperation;
  repositoryToken?: string;
}

export interface CloudExecuteSubmission {
  requestId: string;
  ownerId: string;
  workspaceId: string;
  toolName: CodingToolName;
  inputJson: unknown;
}

export class CloudRuntimeLifecycleService {
  private readonly states = new Map<string, StoredWorkspaceState>();
  private readonly volatileTokens = new Map<string, string>();
  private readonly lifecycleTails = new Map<string, Promise<void>>();
  private readonly activeExecutions = new Map<string, number>();
  private readonly queue = new WorkspaceExecutionQueue();
  private maintenanceTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly config: CloudRuntimeConfig,
    private readonly storage: CloudWorkspaceStorage,
    private readonly engine: CloudContainerEngine,
    private readonly git: GitBootstrapper,
    private readonly now: () => Date = () => new Date()
  ) {}

  async initialize() {
    await this.storage.initialize();
    for (const state of await this.storage.listStates()) {
      const normalized = normalizeInterruptedState(state, this.isoNow());
      this.states.set(this.key(normalized.workspace.ownerId, normalized.workspace.workspaceId), normalized);
      await this.storage.saveState(normalized);
    }
    try {
      await this.reconcile();
    } catch {
      // Persisted state remains queryable while Docker is temporarily unavailable.
    }
  }

  startMaintenance() {
    if (this.maintenanceTimer) return;
    this.maintenanceTimer = setInterval(() => {
      void this.runMaintenance();
    }, this.config.reconcileIntervalMs);
    this.maintenanceTimer.unref();
  }

  close() {
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
    this.maintenanceTimer = undefined;
    for (const state of this.states.values()) {
      this.queue.cancelAll(state.workspace.workspaceId, true);
    }
  }

  async submitLifecycle(input: CloudLifecycleSubmission) {
    const workspace = codingWorkspaceRecordSchema.parse(input.workspace);
    const operation = runtimeOperationSchema.parse(input.operation);
    assertSubmissionIdentity(input.ownerId, workspace, operation);
    const duplicate = this.findByIdempotency(input.ownerId, operation.idempotencyKey);
    if (duplicate) {
      if (duplicate.workspaceId !== operation.workspaceId || duplicate.type !== operation.type) {
        throw new CloudRuntimeServiceError(
          "Idempotency key is already bound to another runtime operation.",
          "workspace_operation_conflict"
        );
      }
      return duplicate;
    }

    const stateKey = this.key(input.ownerId, workspace.workspaceId);
    let state = this.states.get(stateKey);
    if (!state) {
      if (operation.type !== "provision") {
        throw new CloudRuntimeServiceError(
          "Cloud workspace was not found.",
          "workspace_not_found",
          { workspaceId: workspace.workspaceId },
          404
        );
      }
      state = {
        workspace: { ...workspace, status: "provisioning", connected: false },
        operations: [],
        updatedAt: this.isoNow()
      };
      this.states.set(stateKey, state);
    } else {
      this.assertOwner(state, input.ownerId);
    }
    const persistedOperation = sanitizeOperation(operation);
    state.operations.unshift(persistedOperation);
    state.workspace = {
      ...state.workspace,
      ...workspace,
      ownerId: state.workspace.ownerId,
      status: lifecyclePendingStatus(operation.type),
      connected: false,
      updatedAt: this.isoNow()
    };
    state.updatedAt = this.isoNow();
    if (input.repositoryToken) this.volatileTokens.set(operation.id, input.repositoryToken);
    await this.storage.saveState(state);
    this.enqueueLifecycle(stateKey, operation.id);
    return persistedOperation;
  }

  getStatus(ownerId: string, workspaceId: string) {
    const state = this.requireState(ownerId, workspaceId);
    return cloneState(state);
  }

  listStatuses(ownerId?: string) {
    return [...this.states.values()]
      .filter((state) => !ownerId || state.workspace.ownerId === ownerId)
      .map(cloneState);
  }

  async execute(input: CloudExecuteSubmission): Promise<RuntimeExecuteResponse> {
    const request = runtimeExecuteRequestSchema.parse(input);
    const toolName = codingToolNameSchema.parse(request.toolName);
    const state = this.requireState(request.ownerId, request.workspaceId);
    if (!state.workspace.containerRef || !["ready", "busy"].includes(state.workspace.status)) {
      throw new CloudRuntimeServiceError(
        "Cloud workspace runtime is not ready.",
        "runtime_not_ready",
        { workspaceId: request.workspaceId }
      );
    }
    const result = await this.queue.run(
      request.workspaceId,
      request.requestId,
      readTools.has(toolName) ? "read" : "write",
      async (signal) => {
        await this.markExecutionStarted(state);
        try {
          const value = await this.engine.execute(state.workspace.containerRef!, {
            ...request,
            toolName
          }, signal);
          await this.storage.assertWithinQuota(
            this.storage.getRef(request.ownerId, request.workspaceId)
          );
          return runtimeExecuteResponseSchema.parse({
            ok: true,
            requestId: request.requestId,
            result: value
          });
        } catch (error) {
          const formatted = toCloudRuntimeServiceError(error);
          return runtimeExecuteResponseSchema.parse({
            ok: false,
            requestId: request.requestId,
            error: {
              code: formatted.code,
              message: formatted.message,
              details: formatted.details
            }
          });
        } finally {
          await this.markExecutionFinished(state);
        }
      }
    );
    return runtimeExecuteResponseSchema.parse(result);
  }

  cancel(ownerId: string, workspaceId: string, requestId: string) {
    this.requireState(ownerId, workspaceId);
    return this.queue.cancel(workspaceId, requestId);
  }

  async reconcile() {
    const managed = await this.engine.listManagedContainers();
    const byWorkspace = new Map(managed.map((container) => [container.workspaceId, container]));
    const knownWorkspaceIds = new Set<string>();
    for (const state of this.states.values()) {
      knownWorkspaceIds.add(state.workspace.workspaceId);
      if (["deleted", "deleting", "provisioning", "cloning", "retrying"].includes(state.workspace.status)) {
        continue;
      }
      const container = state.workspace.containerRef
        ? await this.engine.inspect(state.workspace.containerRef)
        : byWorkspace.get(state.workspace.workspaceId);
      if (!container?.exists) {
        if (!state.workspace.containerRef && ["stopped", "offline", "error"].includes(state.workspace.status)) {
          continue;
        }
        state.workspace = {
          ...state.workspace,
          status: "error",
          connected: false,
          errorCode: "runtime_unavailable",
          errorMessage: "Cloud runtime container is missing.",
          updatedAt: this.isoNow()
        };
      } else {
        state.workspace = {
          ...state.workspace,
          containerRef: container.containerRef,
          status: container.running ? "ready" : "stopped",
          connected: container.running,
          errorCode: undefined,
          errorMessage: undefined,
          updatedAt: this.isoNow()
        };
        this.queue.setAccepting(state.workspace.workspaceId, container.running);
      }
      state.updatedAt = this.isoNow();
      await this.storage.saveState(state);
    }
    for (const container of managed) {
      if (!knownWorkspaceIds.has(container.workspaceId)) {
        await this.engine.delete(container.containerRef).catch(() => undefined);
      }
    }
  }

  async stopIdleWorkspaces() {
    const now = this.now().getTime();
    for (const state of this.states.values()) {
      if (state.workspace.status !== "ready" || !state.workspace.containerRef) continue;
      const lastActive = Date.parse(state.workspace.lastActiveAt ?? state.workspace.updatedAt);
      if (Number.isFinite(lastActive) && now - lastActive >= this.config.idleTimeoutMs) {
        this.queue.cancelAll(state.workspace.workspaceId, true);
        await this.engine.stop(state.workspace.containerRef);
        state.workspace = {
          ...state.workspace,
          status: "stopped",
          connected: false,
          stoppedAt: this.isoNow(),
          updatedAt: this.isoNow()
        };
        state.updatedAt = this.isoNow();
        await this.storage.saveState(state);
      }
    }
  }

  private async runMaintenance() {
    try {
      await this.reconcile();
      await this.stopIdleWorkspaces();
    } catch {
      // A failed maintenance pass must not terminate the service timer.
    }
  }

  private enqueueLifecycle(stateKey: string, operationId: string) {
    const previous = this.lifecycleTails.get(stateKey) ?? Promise.resolve();
    const execution = previous
      .catch(() => undefined)
      .then(() => this.processLifecycle(stateKey, operationId));
    const next = execution
      .catch(() => undefined)
      .finally(() => {
        if (this.lifecycleTails.get(stateKey) === next) this.lifecycleTails.delete(stateKey);
      });
    this.lifecycleTails.set(stateKey, next);
  }

  private async processLifecycle(stateKey: string, operationId: string) {
    const state = this.states.get(stateKey);
    const operation = state?.operations.find((item) => item.id === operationId);
    if (!state || !operation) return;
    operation.status = "running";
    operation.startedAt = this.isoNow();
    state.updatedAt = this.isoNow();
    await this.storage.saveState(state);
    try {
      switch (operation.type) {
        case "provision":
        case "retry":
          await this.provision(state, operation);
          break;
        case "start":
          await this.start(state);
          break;
        case "stop":
          await this.stop(state);
          break;
        case "delete":
          await this.delete(state);
          break;
        default:
          throw new CloudRuntimeServiceError(
            "Unsupported lifecycle operation.",
            "invalid_runtime_request",
            {},
            400
          );
      }
      operation.status = "completed";
      operation.resultPayload = { status: state.workspace.status };
      operation.completedAt = this.isoNow();
    } catch (error) {
      const formatted = toCloudRuntimeServiceError(error);
      operation.status = "failed";
      operation.errorCode = formatted.code;
      operation.errorMessage = formatted.message;
      operation.completedAt = this.isoNow();
      state.workspace = {
        ...state.workspace,
        status: "error",
        connected: false,
        errorCode: formatted.code,
        errorMessage: formatted.message,
        updatedAt: this.isoNow()
      };
    } finally {
      this.volatileTokens.delete(operationId);
      state.updatedAt = this.isoNow();
      await this.storage.saveState(state);
    }
  }

  private async provision(state: StoredWorkspaceState, operation: RuntimeOperation) {
    if (state.workspace.containerRef) {
      await this.engine.delete(state.workspace.containerRef).catch(() => undefined);
    }
    const ref = operation.type === "retry"
      ? await this.storage.resetWorkspaceData(state.workspace.ownerId, state.workspace.workspaceId)
      : await this.storage.create(state.workspace.ownerId, state.workspace.workspaceId);
    state.workspace = {
      ...state.workspace,
      status: "cloning",
      connected: false,
      containerRef: undefined,
      storageRef: ref.baseDirectory,
      errorCode: undefined,
      errorMessage: undefined,
      updatedAt: this.isoNow()
    };
    await this.storage.saveState(state);
    const repository = state.workspace.repository;
    if (!repository) {
      throw new CloudRuntimeServiceError(
        "Cloud workspace repository configuration is missing.",
        "invalid_runtime_request"
      );
    }
    const clone = await this.git.clone({
      repositoryUrl: repository.url,
      branch: repository.branch,
      storage: ref,
      ...(this.volatileTokens.get(operation.id)
        ? { token: this.volatileTokens.get(operation.id)! }
        : {}),
      timeoutMs: this.config.cloneTimeoutMs
    });
    await this.storage.assertWithinQuota(ref);
    await this.storage.prepareRuntimeOwnership(
      ref,
      this.config.runtimeUid,
      this.config.runtimeGid
    );
    const containerRef = await this.engine.provision({
      ownerId: state.workspace.ownerId,
      workspaceId: state.workspace.workspaceId,
      workspacePath: ref.workspaceDirectory,
      image: this.config.runtimeImage
    });
    await this.engine.start(containerRef);
    state.workspace = {
      ...state.workspace,
      repository: { ...repository, revision: clone.revision },
      containerRef,
      storageRef: ref.baseDirectory,
      status: "ready",
      connected: true,
      supportedCapabilities: [...supportedCapabilities],
      safetyBoundary: cloudSafetyBoundary(),
      lastActiveAt: this.isoNow(),
      updatedAt: this.isoNow()
    };
    this.queue.setAccepting(state.workspace.workspaceId, true);
  }

  private async start(state: StoredWorkspaceState) {
    let containerRef = state.workspace.containerRef;
    if (containerRef) {
      const inspection = await this.engine.inspect(containerRef);
      if (!inspection.exists) containerRef = undefined;
    }
    if (!containerRef) {
      const ref = this.storage.getRef(state.workspace.ownerId, state.workspace.workspaceId);
      containerRef = await this.engine.provision({
        ownerId: state.workspace.ownerId,
        workspaceId: state.workspace.workspaceId,
        workspacePath: ref.workspaceDirectory,
        image: this.config.runtimeImage
      });
    }
    await this.engine.start(containerRef);
    state.workspace = {
      ...state.workspace,
      containerRef,
      status: "ready",
      connected: true,
      stoppedAt: undefined,
      lastActiveAt: this.isoNow(),
      updatedAt: this.isoNow()
    };
    this.queue.setAccepting(state.workspace.workspaceId, true);
  }

  private async stop(state: StoredWorkspaceState) {
    this.queue.cancelAll(state.workspace.workspaceId, true);
    if (state.workspace.containerRef) await this.engine.stop(state.workspace.containerRef);
    state.workspace = {
      ...state.workspace,
      status: "stopped",
      connected: false,
      stoppedAt: this.isoNow(),
      updatedAt: this.isoNow()
    };
  }

  private async delete(state: StoredWorkspaceState) {
    this.queue.cancelAll(state.workspace.workspaceId, true);
    if (state.workspace.containerRef) {
      await this.engine.stop(state.workspace.containerRef).catch(() => undefined);
      await this.engine.delete(state.workspace.containerRef);
    }
    await this.storage.deleteWorkspaceData(state.workspace.ownerId, state.workspace.workspaceId);
    state.workspace = {
      ...state.workspace,
      status: "deleted",
      connected: false,
      containerRef: undefined,
      deletedAt: this.isoNow(),
      updatedAt: this.isoNow()
    };
  }

  private async markExecutionStarted(state: StoredWorkspaceState) {
    const workspaceId = state.workspace.workspaceId;
    this.activeExecutions.set(workspaceId, (this.activeExecutions.get(workspaceId) ?? 0) + 1);
    state.workspace = {
      ...state.workspace,
      status: "busy",
      connected: true,
      lastActiveAt: this.isoNow(),
      updatedAt: this.isoNow()
    };
    state.updatedAt = this.isoNow();
    await this.storage.saveState(state);
  }

  private async markExecutionFinished(state: StoredWorkspaceState) {
    const workspaceId = state.workspace.workspaceId;
    const active = Math.max(0, (this.activeExecutions.get(workspaceId) ?? 1) - 1);
    if (active === 0) this.activeExecutions.delete(workspaceId);
    else this.activeExecutions.set(workspaceId, active);
    const lifecycleOwnsStatus = [
      "stopping",
      "stopped",
      "deleting",
      "deleted",
      "error"
    ].includes(state.workspace.status);
    state.workspace = {
      ...state.workspace,
      ...(lifecycleOwnsStatus
        ? {}
        : { status: active > 0 ? "busy" as const : "ready" as const, connected: true }),
      lastActiveAt: this.isoNow(),
      updatedAt: this.isoNow()
    };
    state.updatedAt = this.isoNow();
    await this.storage.saveState(state);
  }

  private requireState(ownerId: string, workspaceId: string) {
    const state = this.states.get(this.key(ownerId, workspaceId));
    if (!state) {
      const anyOwner = [...this.states.values()].some(
        (candidate) => candidate.workspace.workspaceId === workspaceId
      );
      throw new CloudRuntimeServiceError(
        anyOwner ? "Cloud workspace access was denied." : "Cloud workspace was not found.",
        anyOwner ? "workspace_access_denied" : "workspace_not_found",
        { workspaceId },
        anyOwner ? 403 : 404
      );
    }
    this.assertOwner(state, ownerId);
    return state;
  }

  private assertOwner(state: StoredWorkspaceState, ownerId: string) {
    if (state.workspace.ownerId !== ownerId) {
      throw new CloudRuntimeServiceError(
        "Cloud workspace access was denied.",
        "workspace_access_denied",
        {},
        403
      );
    }
  }

  private findByIdempotency(ownerId: string, idempotencyKey: string) {
    for (const state of this.states.values()) {
      if (state.workspace.ownerId !== ownerId) continue;
      const operation = state.operations.find((item) => item.idempotencyKey === idempotencyKey);
      if (operation) return operation;
    }
    return undefined;
  }

  private key(ownerId: string, workspaceId: string) {
    return `${ownerId}:${workspaceId}`;
  }

  private isoNow() {
    return this.now().toISOString();
  }
}

function normalizeInterruptedState(state: StoredWorkspaceState, now: string): StoredWorkspaceState {
  return {
    ...state,
    workspace: codingWorkspaceRecordSchema.parse(state.workspace),
    operations: state.operations.map((operation) => (
      ["queued", "running"].includes(operation.status)
        ? {
            ...operation,
            status: "failed" as const,
            errorCode: "runtime_unavailable" as const,
            errorMessage: "Cloud runtime service restarted before the operation completed.",
            completedAt: now
          }
        : operation
    )),
    updatedAt: now
  };
}

function sanitizeOperation(operation: RuntimeOperation): RuntimeOperation {
  return runtimeOperationSchema.parse({
    ...operation,
    requestPayload: redactTokenFields(operation.requestPayload)
  });
}

function redactTokenFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactTokenFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => (
    /token|secret|password|credentialvalue/i.test(key)
      ? [key, "[redacted]"]
      : [key, redactTokenFields(item)]
  )));
}

function assertSubmissionIdentity(
  ownerId: string,
  workspace: CodingWorkspaceRecord,
  operation: RuntimeOperation
) {
  if (
    workspace.ownerId !== ownerId ||
    operation.ownerId !== ownerId ||
    operation.workspaceId !== workspace.workspaceId
  ) {
    throw new CloudRuntimeServiceError(
      "Lifecycle request identity does not match its workspace and operation.",
      "workspace_access_denied",
      {},
      403
    );
  }
}

function lifecyclePendingStatus(type: RuntimeOperation["type"]): CodingWorkspaceRecord["status"] {
  if (type === "start") return "starting";
  if (type === "stop") return "stopping";
  if (type === "retry") return "retrying";
  if (type === "delete") return "deleting";
  return "provisioning";
}

function cloudSafetyBoundary() {
  return {
    readsUserFiles: false,
    writesUserFiles: true,
    executesShell: true,
    workspaceRootLocked: true as const,
    requiresApprovalForWritesAndCommands: true as const,
    networkAccess: "none" as const
  };
}

function cloneState(state: StoredWorkspaceState): StoredWorkspaceState {
  return structuredClone(state);
}
