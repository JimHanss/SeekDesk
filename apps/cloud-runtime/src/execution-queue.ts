import { CloudRuntimeServiceError } from "./errors.js";

export type RuntimeExecutionKind = "read" | "write";

interface QueueJob<T = unknown> {
  requestId: string;
  kind: RuntimeExecutionKind;
  controller: AbortController;
  task: (signal: AbortSignal) => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

interface WorkspaceQueueState {
  accepting: boolean;
  runningReads: number;
  runningWrite: boolean;
  pending: QueueJob[];
  running: Map<string, QueueJob>;
}

export class WorkspaceExecutionQueue {
  private readonly workspaces = new Map<string, WorkspaceQueueState>();

  run<T>(
    workspaceId: string,
    requestId: string,
    kind: RuntimeExecutionKind,
    task: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const state = this.getState(workspaceId);
    if (!state.accepting) {
      return Promise.reject(new CloudRuntimeServiceError(
        "Workspace is not accepting new runtime requests.",
        "runtime_not_ready"
      ));
    }
    if (
      state.running.has(requestId) ||
      state.pending.some((job) => job.requestId === requestId)
    ) {
      return Promise.reject(new CloudRuntimeServiceError(
        "A runtime request with this requestId already exists.",
        "runtime_request_conflict"
      ));
    }
    return new Promise<T>((resolve, reject) => {
      state.pending.push({
        requestId,
        kind,
        controller: new AbortController(),
        task,
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this.schedule(workspaceId, state);
    });
  }

  cancel(workspaceId: string, requestId: string) {
    const state = this.workspaces.get(workspaceId);
    if (!state) return false;
    const pendingIndex = state.pending.findIndex((job) => job.requestId === requestId);
    if (pendingIndex >= 0) {
      const [job] = state.pending.splice(pendingIndex, 1);
      job?.reject(cancelledError());
      return true;
    }
    const running = state.running.get(requestId);
    running?.controller.abort("remote_cancelled");
    return Boolean(running);
  }

  cancelAll(workspaceId: string, rejectNew = false) {
    const state = this.getState(workspaceId);
    if (rejectNew) state.accepting = false;
    for (const job of state.pending.splice(0)) job.reject(cancelledError());
    for (const job of state.running.values()) job.controller.abort("workspace_stopping");
  }

  setAccepting(workspaceId: string, accepting: boolean) {
    this.getState(workspaceId).accepting = accepting;
  }

  counts(workspaceId: string) {
    const state = this.getState(workspaceId);
    return {
      pending: state.pending.length,
      running: state.running.size,
      accepting: state.accepting
    };
  }

  private schedule(workspaceId: string, state: WorkspaceQueueState) {
    if (state.runningWrite || state.pending.length === 0) return;
    const first = state.pending[0];
    if (!first) return;
    if (first.kind === "write") {
      if (state.runningReads > 0) return;
      state.pending.shift();
      state.runningWrite = true;
      this.start(workspaceId, state, first);
      return;
    }
    while (state.pending[0]?.kind === "read" && !state.runningWrite) {
      const job = state.pending.shift();
      if (!job) break;
      state.runningReads += 1;
      this.start(workspaceId, state, job);
    }
  }

  private start(workspaceId: string, state: WorkspaceQueueState, job: QueueJob) {
    state.running.set(job.requestId, job);
    void job.task(job.controller.signal)
      .then(job.resolve, job.reject)
      .finally(() => {
        state.running.delete(job.requestId);
        if (job.kind === "write") state.runningWrite = false;
        else state.runningReads = Math.max(0, state.runningReads - 1);
        this.schedule(workspaceId, state);
      });
  }

  private getState(workspaceId: string) {
    let state = this.workspaces.get(workspaceId);
    if (!state) {
      state = {
        accepting: true,
        runningReads: 0,
        runningWrite: false,
        pending: [],
        running: new Map()
      };
      this.workspaces.set(workspaceId, state);
    }
    return state;
  }
}

function cancelledError() {
  return new CloudRuntimeServiceError(
    "Runtime request was cancelled.",
    "runtime_request_cancelled"
  );
}
