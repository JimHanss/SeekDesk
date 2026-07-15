import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const dockerBinary = process.env.SEEKDESK_DOCKER_BINARY?.trim() || "docker";
const runtimeImage = process.env.SEEKDESK_RUNTIME_IMAGE?.trim() || "seekdesk-runtime:node22";
const suffix = `${process.pid}-${randomUUID().slice(0, 8)}`;
const containerName = `seekdesk-runtime-smoke-${suffix}`;
const workspaceId = `runtime-smoke-${suffix}`;
const workerCli = "/opt/seekdesk/apps/runtime-worker/dist/cli.js";
let containerCreated = false;

try {
  docker(["image", "inspect", runtimeImage]);
  docker([
    "create",
    "--name", containerName,
    "--label", "seekdesk.smoke=runtime-container",
    "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m",
    "--tmpfs", "/workspace:rw,nosuid,size=128m,uid=10001,gid=10001",
    "--network", "none",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges=true",
    "--pids-limit", "256",
    "--cpus", "2",
    "--memory", "4g",
    "--user", "10001:10001",
    "--env", `SEEKDESK_RUNTIME_WORKSPACE_ID=${workspaceId}`,
    runtimeImage,
    "idle"
  ]);
  containerCreated = true;
  docker(["start", containerName]);

  const inspection = JSON.parse(docker(["inspect", containerName]).stdout)[0];
  assertEqual(inspection.Config.User, "10001:10001", "runtime user");
  assertEqual(inspection.HostConfig.ReadonlyRootfs, true, "read-only rootfs");
  assertEqual(inspection.HostConfig.NetworkMode, "none", "network mode");
  assertEqual(inspection.HostConfig.PidsLimit, 256, "PID limit");
  assertEqual(inspection.HostConfig.NanoCpus, 2_000_000_000, "CPU limit");
  assertEqual(inspection.HostConfig.Memory, 4 * 1024 * 1024 * 1024, "memory limit");
  assertIncludes(inspection.HostConfig.CapDrop, "ALL", "capability drop");
  assertIncludes(inspection.HostConfig.SecurityOpt, "no-new-privileges=true", "security options");
  assertEqual(
    inspection.HostConfig.Tmpfs["/workspace"].includes("uid=10001"),
    true,
    "workspace tmpfs owner"
  );
  assertEqual(
    inspection.Mounts.some((mount) => String(mount.Destination).includes("docker.sock")),
    false,
    "Docker socket mount"
  );

  const health = JSON.parse(docker([
    "exec", containerName, "node", workerCli, "health"
  ]).stdout.trim());
  assertEqual(health.status, "ok", "worker health");
  assertEqual(health.workspaceId, workspaceId, "worker workspace");

  execute("coding.write_file", {
    path: "package.json",
    content: JSON.stringify({
      name: "seekdesk-runtime-smoke",
      private: true,
      scripts: { test: "node -e \"console.log('runtime-tests-ok')\"" }
    }, null, 2),
    createDirs: true
  });
  execute("coding.write_file", {
    path: "README.md",
    content: "SeekDesk runtime container fixture\n",
    createDirs: true
  });
  execute("coding.write_file", {
    path: "src/index.ts",
    content: "export const runtimeValue = 'before';\n",
    createDirs: true
  });
  const gitInit = execute("coding.run_shell", {
    command: "git init && git config user.email runtime@example.test && git config user.name 'Runtime Smoke' && git add . && git commit -m fixture",
    timeoutMs: 30_000
  });
  assertEqual(gitInit.exitCode, 0, "Git fixture initialization");

  const tree = execute("coding.list_files", { path: ".", maxDepth: 3, maxEntries: 100 });
  assertEqual(tree.entries.some((entry) => entry.path === "README.md"), true, "file listing");
  const read = execute("coding.read_file", { path: "README.md", maxBytes: 10_000 });
  assertEqual(read.content.includes("runtime container fixture"), true, "file read");
  const search = execute("coding.grep", {
    query: "runtime container fixture",
    path: ".",
    maxResults: 20
  });
  assertEqual(search.matches.some((match) => match.path === "README.md"), true, "workspace search");
  execute("coding.git_status", {});

  execute("coding.write_file", {
    path: "src/generated.ts",
    content: "export const generated = true;\n",
    createDirs: true
  });
  execute("coding.edit_file", {
    path: "src/index.ts",
    search: "before",
    replace: "after",
    expectedReplacements: 1
  });
  const diff = execute("coding.git_diff", { staged: false });
  assertEqual(diff.stdout.includes("after"), true, "Git diff");

  const shell = execute("coding.run_shell", {
    command: "node -e \"console.log('runtime-shell-ok')\"",
    timeoutMs: 10_000
  });
  assertEqual(shell.exitCode, 0, "shell exit code");
  assertEqual(shell.stdout.includes("runtime-shell-ok"), true, "shell output");

  const tests = execute("coding.run_tests", { command: "npm test", timeoutMs: 30_000 });
  assertEqual(tests.exitCode, 0, "test exit code");
  assertEqual(tests.stdout.includes("runtime-tests-ok"), true, "test output");

  const network = execute("coding.run_shell", {
    command: "node -e \"fetch('https://example.com',{signal:AbortSignal.timeout(1500)}).then(()=>{console.error('network-unexpected');process.exit(2)}).catch(()=>console.log('network-blocked'))\"",
    timeoutMs: 10_000
  });
  assertEqual(network.exitCode, 0, "network isolation command");
  assertEqual(network.stdout.includes("network-blocked"), true, "network isolation");

  process.stdout.write(`${JSON.stringify({
    status: "ok",
    image: runtimeImage,
    workspaceId,
    security: {
      readOnlyRootfs: true,
      networkMode: "none",
      cpuLimit: 2,
      memoryLimit: "4g",
      pidsLimit: 256,
      capabilitiesDropped: "ALL",
      noNewPrivileges: true,
      dockerSocketMounted: false
    },
    tools: [
      "coding.list_files",
      "coding.read_file",
      "coding.grep",
      "coding.git_status",
      "coding.git_diff",
      "coding.write_file",
      "coding.edit_file",
      "coding.run_shell",
      "coding.run_tests"
    ],
    networkBlocked: true
  }, null, 2)}\n`);
} finally {
  if (containerCreated) {
    docker(["rm", "--force", containerName], { allowFailure: true });
  }
}

function execute(toolName, inputJson) {
  const request = {
    requestId: `${toolName}-${randomUUID()}`,
    ownerId: "runtime-smoke-owner",
    workspaceId,
    toolName,
    inputJson
  };
  const result = docker([
    "exec", "--interactive", containerName, "node", workerCli, "execute"
  ], { input: `${JSON.stringify(request)}\n` });
  const response = JSON.parse(result.stdout.trim());
  if (!response.ok) {
    throw new Error(`${toolName} failed: ${response.error?.code ?? "unknown"} ${response.error?.message ?? ""}`);
  }
  return response.result;
}

function docker(args, options = {}) {
  const result = spawnSync(dockerBinary, args, {
    encoding: "utf8",
    input: options.input,
    maxBuffer: 4 * 1024 * 1024,
    env: process.env
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
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
