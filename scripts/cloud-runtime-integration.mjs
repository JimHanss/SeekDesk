import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { DockerCliContainerEngine } from "../apps/cloud-runtime/dist/engine.js";
import { ProcessGitBootstrapper } from "../apps/cloud-runtime/dist/git-bootstrap.js";
import { CloudRuntimeLifecycleService } from "../apps/cloud-runtime/dist/lifecycle-service.js";
import { CloudWorkspaceStorage } from "../apps/cloud-runtime/dist/storage.js";

const runtimeImage = process.env.SEEKDESK_RUNTIME_IMAGE?.trim() || "seekdesk-runtime:node22";
const repositoryUrl = process.env.SEEKDESK_CLOUD_SMOKE_REPOSITORY?.trim()
  || "https://github.com/octocat/Hello-World.git";
const repositoryBranch = process.env.SEEKDESK_CLOUD_SMOKE_BRANCH?.trim() || "master";
const suffix = `${process.pid}-${randomUUID().slice(0, 8)}`;
const ownerId = `cloud-smoke-owner-${suffix}`;
const workspaceId = `cloud-smoke-workspace-${suffix}`;
const storageRoot = await mkdtemp(join(homedir(), ".seekdesk-runtime-smoke-"));
const createdAt = new Date().toISOString();
const dockerBinary = process.env.SEEKDESK_DOCKER_BINARY?.trim() || "docker";
let service;
let containerRef;

const config = {
  host: "127.0.0.1",
  port: 4100,
  serviceToken: "cloud-smoke-service-token",
  dockerBinary,
  runtimeImage,
  storageRoot,
  workspaceQuotaBytes: 128 * 1024 * 1024,
  idleTimeoutMs: 30 * 60 * 1000,
  reconcileIntervalMs: 60_000,
  cloneTimeoutMs: 300_000,
  executeTimeoutMs: 30_000,
  maxCommandOutputBytes: 2_000_000,
  cpuLimit: 2,
  memoryLimit: "4g",
  pidsLimit: 256,
  tmpfsSize: "256m",
  runtimeUid: process.getuid?.() ?? 10001,
  runtimeGid: process.getgid?.() ?? 10001
};

const workspace = {
  workspaceId,
  ownerId,
  name: "Cloud runtime integration",
  runtimeMode: "cloud_runtime",
  status: "provisioning",
  rootPath: "/workspace",
  connected: false,
  repository: { url: repositoryUrl, branch: repositoryBranch },
  imageProfile: "node22",
  supportedCapabilities: [],
  createdAt,
  updatedAt: createdAt
};

try {
  docker(["image", "inspect", runtimeImage]);
  service = await createService();

  const provision = operation("provision");
  await service.submitLifecycle({ ownerId, workspace, operation: provision });
  const provisioned = await waitForOperation(service, provision.id);
  assertCompleted(provisioned.operation, "provision operation");
  assertEqual(provisioned.workspace.status, "ready", "provisioned workspace");
  containerRef = provisioned.workspace.containerRef;
  if (!containerRef) throw new Error("Provisioned workspace has no container reference.");

  const inspection = JSON.parse(docker(["inspect", containerRef]).stdout)[0];
  assertEqual(inspection.HostConfig.ReadonlyRootfs, true, "read-only rootfs");
  assertEqual(inspection.HostConfig.NetworkMode, "none", "execution network");
  assertEqual(inspection.HostConfig.PidsLimit, 256, "PID limit");
  assertEqual(inspection.HostConfig.NanoCpus, 2_000_000_000, "CPU limit");
  assertEqual(inspection.HostConfig.Memory, 4 * 1024 * 1024 * 1024, "memory limit");
  assertIncludes(inspection.HostConfig.CapDrop, "ALL", "capability drop");
  assertIncludes(inspection.HostConfig.SecurityOpt, "no-new-privileges=true", "security options");
  assertEqual(
    inspection.Mounts.some((mount) => String(mount.Destination).includes("docker.sock")),
    false,
    "Docker socket mount"
  );

  const read = await execute("coding.read_file", { path: "README", maxBytes: 20_000 });
  assertEqual(typeof read.content, "string", "cloned repository read");
  const tree = await execute("coding.list_files", { path: ".", maxDepth: 2, maxEntries: 100 });
  assertEqual(tree.entries.length > 0, true, "cloned repository tree");
  await execute("coding.write_file", {
    path: "seekdesk-cloud-smoke.txt",
    content: "cloud runtime before\n",
    createDirs: true
  });
  await execute("coding.edit_file", {
    path: "seekdesk-cloud-smoke.txt",
    search: "before",
    replace: "after",
    expectedReplacements: 1
  });
  await execute("coding.edit_file", {
    path: "README",
    search: read.content,
    replace: `${read.content.trimEnd()}\nSeekDesk cloud runtime smoke\n`,
    expectedReplacements: 1
  });
  const status = await execute("coding.git_status", {});
  assertEqual(status.stdout.includes("seekdesk-cloud-smoke.txt"), true, "cloud Git status");
  const diff = await execute("coding.git_diff", { staged: false });
  assertEqual(diff.stdout.includes("SeekDesk cloud runtime smoke"), true, "cloud Git diff");
  const shell = await execute("coding.run_shell", {
    command: "node -e \"console.log('cloud-shell-ok')\"",
    timeoutMs: 10_000
  });
  assertEqual(shell.exitCode, 0, "cloud shell exit code");
  assertEqual(shell.stdout.includes("cloud-shell-ok"), true, "cloud shell output");
  const network = await execute("coding.run_shell", {
    command: "node -e \"fetch('https://example.com',{signal:AbortSignal.timeout(1500)}).then(()=>{console.error('network-unexpected');process.exit(2)}).catch(()=>console.log('network-blocked'))\"",
    timeoutMs: 10_000
  });
  assertEqual(network.exitCode, 0, "cloud network isolation command");
  assertEqual(network.stdout.includes("network-blocked"), true, "cloud network isolation");

  const stop = operation("stop");
  await service.submitLifecycle({
    ownerId,
    workspace: service.getStatus(ownerId, workspaceId).workspace,
    operation: stop
  });
  const stopped = await waitForOperation(service, stop.id);
  assertCompleted(stopped.operation, "stop operation");
  assertEqual(stopped.workspace.status, "stopped", "stopped workspace");

  service.close();
  service = await createService();
  assertEqual(service.getStatus(ownerId, workspaceId).workspace.status, "stopped", "restart recovery");

  const start = operation("start");
  await service.submitLifecycle({
    ownerId,
    workspace: service.getStatus(ownerId, workspaceId).workspace,
    operation: start
  });
  const restarted = await waitForOperation(service, start.id);
  assertCompleted(restarted.operation, "start operation");
  assertEqual(restarted.workspace.status, "ready", "restarted workspace");
  const reread = await execute("coding.read_file", { path: "seekdesk-cloud-smoke.txt", maxBytes: 10_000 });
  assertEqual(reread.content.includes("after"), true, "workspace persistence after restart");

  const deletion = operation("delete");
  await service.submitLifecycle({
    ownerId,
    workspace: service.getStatus(ownerId, workspaceId).workspace,
    operation: deletion
  });
  const deleted = await waitForOperation(service, deletion.id);
  assertCompleted(deleted.operation, "delete operation");
  assertEqual(deleted.workspace.status, "deleted", "deleted workspace");
  assertEqual(findManagedContainers().length, 0, "managed container cleanup");
  await assertMissing(
    new CloudWorkspaceStorage(storageRoot, config.workspaceQuotaBytes)
      .getRef(ownerId, workspaceId).workspaceDirectory,
    "workspace directory cleanup"
  );
  containerRef = undefined;

  process.stdout.write(`${JSON.stringify({
    status: "ok",
    image: runtimeImage,
    repository: { url: repositoryUrl, branch: repositoryBranch },
    lifecycle: ["provision", "execute", "stop", "service_restart", "start", "delete"],
    security: {
      executionNetwork: "none",
      readOnlyRootfs: true,
      cpuLimit: 2,
      memoryLimit: "4g",
      pidsLimit: 256,
      capabilitiesDropped: "ALL",
      noNewPrivileges: true,
      dockerSocketMounted: false
    },
    workspacePersistedAcrossRestart: true,
    residualManagedContainers: 0,
    workspaceDirectoryRemoved: true
  }, null, 2)}\n`);
} finally {
  service?.close();
  for (const ref of findManagedContainers()) {
    docker(["rm", "--force", ref], { allowFailure: true });
  }
  if (containerRef) {
    docker(["rm", "--force", containerRef], { allowFailure: true });
  }
  await rm(storageRoot, { recursive: true, force: true });
}

async function createService() {
  const storage = new CloudWorkspaceStorage(storageRoot, config.workspaceQuotaBytes);
  const engine = new DockerCliContainerEngine(config);
  const lifecycle = new CloudRuntimeLifecycleService(
    config,
    storage,
    engine,
    new ProcessGitBootstrapper()
  );
  await lifecycle.initialize();
  return lifecycle;
}

async function execute(toolName, inputJson) {
  const response = await service.execute({
    requestId: `${toolName}-${randomUUID()}`,
    ownerId,
    workspaceId,
    toolName,
    inputJson
  });
  if (!response.ok) {
    throw new Error(`${toolName} failed: ${response.error.code} ${response.error.message}`);
  }
  return response.result;
}

function operation(type) {
  const id = `${type}-${randomUUID()}`;
  return {
    id,
    ownerId,
    workspaceId,
    type,
    status: "queued",
    idempotencyKey: id,
    requestPayload: {},
    createdAt: new Date().toISOString()
  };
}

async function waitForOperation(lifecycle, operationId) {
  for (let index = 0; index < 600; index += 1) {
    const state = lifecycle.getStatus(ownerId, workspaceId);
    const current = state.operations.find((candidate) => candidate.id === operationId);
    if (current && ["completed", "failed"].includes(current.status)) {
      return { ...state, operation: current };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Lifecycle operation ${operationId} did not finish.`);
}

function findManagedContainers() {
  return docker([
    "ps", "--all",
    "--filter", "label=seekdesk.managed=true",
    "--filter", `label=seekdesk.workspace-id=${workspaceId}`,
    "--format", "{{.ID}}"
  ]).stdout.split(/\r?\n/).filter(Boolean);
}

function docker(args, options = {}) {
  const result = spawnSync(dockerBinary, args, {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

async function assertMissing(path, label) {
  try {
    await access(path);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${label} failed: ${path} still exists.`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(values, expected, label) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${label} does not include ${JSON.stringify(expected)}.`);
  }
}

function assertCompleted(operation, label) {
  if (operation.status !== "completed") {
    throw new Error(
      `${label} failed: ${operation.errorCode ?? "unknown"} ${operation.errorMessage ?? ""}`
    );
  }
}
