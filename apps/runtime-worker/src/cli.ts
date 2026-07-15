#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  RuntimeWorker,
  handleRuntimeWorkerLine,
  serveRuntimeWorker,
  writeResponse
} from "./worker.js";

export async function runRuntimeWorkerCli(
  args = process.argv.slice(2),
  worker = createRuntimeWorkerFromEnv()
) {
  const command = args[0] ?? "idle";

  if (command === "health") {
    process.stdout.write(`${JSON.stringify(worker.health())}\n`);
    return;
  }
  if (command === "execute") {
    const line = (await readInput(process.stdin, worker.maxInputBytes + 1)).trim();
    writeResponse(process.stdout, await handleRuntimeWorkerLine(worker, line));
    return;
  }
  if (command === "serve") {
    installSignalHandlers(worker, () => process.stdin.destroy());
    await serveRuntimeWorker(worker, process.stdin, process.stdout);
    return;
  }
  if (command === "idle") {
    await waitForShutdown(worker);
    return;
  }
  throw new Error(`Unknown runtime-worker command: ${command}`);
}

export function createRuntimeWorkerFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return new RuntimeWorker({
    workspaceRoot: "/workspace",
    workspaceId: env.SEEKDESK_RUNTIME_WORKSPACE_ID?.trim() || "cloud-runtime-workspace",
    requestTimeoutMs: numberFromEnv(env.SEEKDESK_RUNTIME_REQUEST_TIMEOUT_MS, 125_000),
    maxInputBytes: numberFromEnv(env.SEEKDESK_RUNTIME_MAX_INPUT_BYTES, 1_000_000),
    maxOutputBytes: numberFromEnv(env.SEEKDESK_RUNTIME_MAX_OUTPUT_BYTES, 2_000_000)
  });
}

async function readInput(input: NodeJS.ReadableStream, maxBytes: number) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of input) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buffer);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      break;
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

function waitForShutdown(worker: RuntimeWorker) {
  return new Promise<void>((resolve) => {
    const interval = setInterval(() => undefined, 60_000);
    installSignalHandlers(worker, () => {
      clearInterval(interval);
      resolve();
    });
  });
}

function installSignalHandlers(worker: RuntimeWorker, onSignal: () => void) {
  const handleSignal = () => {
    worker.cancelAll();
    onSignal();
  };
  process.once("SIGTERM", handleSignal);
  process.once("SIGINT", handleSignal);
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRuntimeWorkerCli().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({
        service: "seekdesk-runtime-worker",
        error: "runtime_worker_failed",
        message: error instanceof Error ? error.message : String(error)
      })}\n`
    );
    process.exitCode = 1;
  });
}
