import { createHash, randomUUID } from "node:crypto";
import { chown, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import {
  codingWorkspaceRecordSchema,
  runtimeOperationSchema
} from "@seekdesk/shared";
import { z } from "zod";

import { CloudRuntimeServiceError } from "./errors.js";

const stateFileName = "runtime-state.json";
const markerFileName = ".seekdesk-storage-marker.json";

const storedStateSchema = z.object({
  workspace: codingWorkspaceRecordSchema,
  operations: z.array(runtimeOperationSchema),
  updatedAt: z.string().datetime()
});

export type StoredWorkspaceState = z.infer<typeof storedStateSchema>;

export interface WorkspaceStorageRef {
  baseDirectory: string;
  workspaceDirectory: string;
  tempDirectory: string;
  stateFile: string;
}

export class CloudWorkspaceStorage {
  readonly root: string;

  constructor(root: string, private readonly quotaBytes: number) {
    this.root = resolve(root);
  }

  async initialize() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }

  getRef(ownerId: string, workspaceId: string): WorkspaceStorageRef {
    assertIdentifier(workspaceId, "workspaceId");
    const ownerDirectory = createHash("sha256").update(ownerId).digest("hex").slice(0, 32);
    const baseDirectory = resolve(this.root, ownerDirectory, workspaceId);
    assertInside(this.root, baseDirectory);
    return {
      baseDirectory,
      workspaceDirectory: join(baseDirectory, "workspace"),
      tempDirectory: join(baseDirectory, "tmp"),
      stateFile: join(baseDirectory, stateFileName)
    };
  }

  async create(ownerId: string, workspaceId: string) {
    const ref = await this.ensureRecord(ownerId, workspaceId);
    await mkdir(ref.workspaceDirectory, { recursive: true, mode: 0o700 });
    await mkdir(ref.tempDirectory, { recursive: true, mode: 0o700 });
    return ref;
  }

  async saveState(state: StoredWorkspaceState) {
    const ref = await this.ensureRecord(state.workspace.ownerId, state.workspace.workspaceId);
    const temporaryFile = `${ref.stateFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(
        temporaryFile,
        `${JSON.stringify(storedStateSchema.parse(state), null, 2)}\n`,
        { encoding: "utf8", mode: 0o600 }
      );
      await rename(temporaryFile, ref.stateFile);
    } finally {
      await rm(temporaryFile, { force: true });
    }
  }

  async loadState(ownerId: string, workspaceId: string) {
    const ref = this.getRef(ownerId, workspaceId);
    try {
      return storedStateSchema.parse(JSON.parse(await readFile(ref.stateFile, "utf8")));
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw new CloudRuntimeServiceError(
        "Stored cloud workspace state is invalid.",
        "runtime_protocol_mismatch",
        { workspaceId }
      );
    }
  }

  async listStates() {
    await this.initialize();
    const states: StoredWorkspaceState[] = [];
    for (const ownerEntry of await readdir(this.root, { withFileTypes: true })) {
      if (!ownerEntry.isDirectory() || ownerEntry.isSymbolicLink()) continue;
      const ownerPath = join(this.root, ownerEntry.name);
      for (const workspaceEntry of await readdir(ownerPath, { withFileTypes: true })) {
        if (!workspaceEntry.isDirectory() || workspaceEntry.isSymbolicLink()) continue;
        const stateFile = join(ownerPath, workspaceEntry.name, stateFileName);
        try {
          states.push(storedStateSchema.parse(JSON.parse(await readFile(stateFile, "utf8"))));
        } catch (error) {
          if (!isMissingFile(error)) {
            throw new CloudRuntimeServiceError(
              "Stored cloud workspace state is invalid.",
              "runtime_protocol_mismatch",
              { workspaceId: workspaceEntry.name }
            );
          }
        }
      }
    }
    return states;
  }

  async assertWithinQuota(ref: WorkspaceStorageRef) {
    const usedBytes = await directorySize(ref.workspaceDirectory);
    if (usedBytes > this.quotaBytes) {
      throw new CloudRuntimeServiceError(
        "Cloud workspace exceeds its storage quota.",
        "workspace_limit_exceeded",
        { usedBytes, quotaBytes: this.quotaBytes }
      );
    }
    return usedBytes;
  }

  async prepareRuntimeOwnership(ref: WorkspaceStorageRef, uid: number, gid: number) {
    if (process.getuid?.() !== 0) return;
    await changeOwnership(ref.workspaceDirectory, uid, gid);
  }

  async resetWorkspaceData(ownerId: string, workspaceId: string) {
    const ref = this.getRef(ownerId, workspaceId);
    await this.assertMarker(ownerId, workspaceId, ref);
    await safeRemoveDirectory(this.root, ref.workspaceDirectory);
    await safeRemoveDirectory(this.root, ref.tempDirectory);
    await mkdir(ref.workspaceDirectory, { recursive: true, mode: 0o700 });
    await mkdir(ref.tempDirectory, { recursive: true, mode: 0o700 });
    return ref;
  }

  async deleteWorkspaceData(ownerId: string, workspaceId: string) {
    const ref = this.getRef(ownerId, workspaceId);
    await this.assertMarker(ownerId, workspaceId, ref);
    await safeRemoveDirectory(this.root, ref.workspaceDirectory);
    await safeRemoveDirectory(this.root, ref.tempDirectory);
  }

  async removeWorkspaceRecord(ownerId: string, workspaceId: string) {
    const ref = this.getRef(ownerId, workspaceId);
    await this.assertMarker(ownerId, workspaceId, ref);
    await safeRemoveDirectory(this.root, ref.baseDirectory);
  }

  private async assertMarker(ownerId: string, workspaceId: string, ref: WorkspaceStorageRef) {
    let marker: { ownerHash?: string; workspaceId?: string };
    try {
      marker = JSON.parse(await readFile(join(ref.baseDirectory, markerFileName), "utf8"));
    } catch {
      throw new CloudRuntimeServiceError(
        "Workspace storage marker is missing or invalid; cleanup was refused.",
        "workspace_access_denied",
        { workspaceId },
        403
      );
    }
    if (marker.ownerHash !== ownerHash(ownerId) || marker.workspaceId !== workspaceId) {
      throw new CloudRuntimeServiceError(
        "Workspace storage ownership does not match; cleanup was refused.",
        "workspace_access_denied",
        { workspaceId },
        403
      );
    }
  }

  private async ensureRecord(ownerId: string, workspaceId: string) {
    const ref = this.getRef(ownerId, workspaceId);
    await mkdir(ref.baseDirectory, { recursive: true, mode: 0o700 });
    await writeFile(
      join(ref.baseDirectory, markerFileName),
      JSON.stringify({ ownerHash: ownerHash(ownerId), workspaceId }),
      { encoding: "utf8", mode: 0o600 }
    );
    return ref;
  }
}

async function directorySize(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name);
    const metadata = await lstat(path);
    if (metadata.isDirectory()) total += await directorySize(path);
    else if (metadata.isFile()) total += metadata.size;
  }
  return total;
}

async function changeOwnership(path: string, uid: number, gid: number): Promise<void> {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink()) return;
  await chown(path, uid, gid);
  if (!metadata.isDirectory()) return;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    await changeOwnership(join(path, entry.name), uid, gid);
  }
}

async function safeRemoveDirectory(root: string, target: string) {
  const resolvedRoot = await realpath(root);
  const parent = await realpath(dirname(target));
  const resolvedTarget = resolve(parent, target.slice(dirname(target).length + 1));
  assertInside(resolvedRoot, resolvedTarget);
  if (resolvedTarget === resolvedRoot) {
    throw new CloudRuntimeServiceError(
      "Refused to remove an unsafe storage path.",
      "workspace_access_denied",
      {},
      403
    );
  }
  try {
    if ((await stat(resolvedTarget)).isDirectory()) {
      await rm(resolvedTarget, { recursive: true, force: true });
    }
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}

function assertInside(root: string, target: string) {
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new CloudRuntimeServiceError(
      "Workspace storage path escapes the configured root.",
      "workspace_access_denied",
      {},
      403
    );
  }
}

function assertIdentifier(value: string, field: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value)) {
    throw new CloudRuntimeServiceError(
      `${field} is invalid.`,
      "invalid_runtime_request",
      {},
      400
    );
  }
}

function ownerHash(ownerId: string) {
  return createHash("sha256").update(ownerId).digest("hex");
}

function isMissingFile(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
