import { describe, expect, it } from "vitest";

import { WorkspaceExecutionQueue } from "./execution-queue.js";

describe("WorkspaceExecutionQueue", () => {
  it("runs consecutive reads concurrently and serializes writes", async () => {
    const queue = new WorkspaceExecutionQueue();
    const events: string[] = [];
    let releaseReads: () => void = () => {};
    const readsBlocked = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const read = (id: string) => queue.run("workspace-1", id, "read", async () => {
      events.push(`${id}:start`);
      await readsBlocked;
      events.push(`${id}:end`);
      return id;
    });
    const first = read("read-1");
    const second = read("read-2");
    const write = queue.run("workspace-1", "write-1", "write", async () => {
      events.push("write-1:start");
      events.push("write-1:end");
      return "write-1";
    });
    await eventually(() => events.length === 2);
    expect(events).toEqual(["read-1:start", "read-2:start"]);
    releaseReads();
    await Promise.all([first, second, write]);
    expect(events).toEqual([
      "read-1:start",
      "read-2:start",
      "read-1:end",
      "read-2:end",
      "write-1:start",
      "write-1:end"
    ]);
  });

  it("cancels queued work and rejects new work while deleting", async () => {
    const queue = new WorkspaceExecutionQueue();
    let release: () => void = () => {};
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = queue.run("workspace-1", "write-1", "write", async () => blocked);
    const pending = queue.run("workspace-1", "write-2", "write", async () => undefined);
    queue.cancelAll("workspace-1", true);
    await expect(pending).rejects.toMatchObject({ code: "runtime_request_cancelled" });
    await expect(queue.run("workspace-1", "write-3", "write", async () => undefined))
      .rejects.toMatchObject({ code: "runtime_not_ready" });
    release();
    await running;
  });
});

async function eventually(assertion: () => boolean) {
  for (let index = 0; index < 50; index += 1) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("Condition was not reached.");
}
