#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const requireArtifacts = process.argv.includes("--require-artifacts");
const root = process.cwd();
const daemonRoot = path.join(root, "apps", "daemon");
const forgeConfigPath = path.join(daemonRoot, "forge.config.cjs");
const packagePath = path.join(daemonRoot, "package.json");
const outRoot = path.join(daemonRoot, "out");
const checks = [];

assertFile(forgeConfigPath, "Forge configuration");
assertFile(path.join(daemonRoot, "assets", "icon.ico"), "Windows icon");
assertFile(path.join(daemonRoot, "assets", "icon.icns"), "macOS icon");
assertFile(path.join(daemonRoot, "assets", "tray.png"), "tray icon");

const forgeConfig = readFileSync(forgeConfigPath, "utf8");
for (const marker of [
  "@electron-forge/maker-squirrel",
  "@electron-forge/maker-dmg",
  "@electron-forge/maker-zip",
  "@electron-forge/plugin-fuses",
  "seekdesk"
]) {
  assert(forgeConfig.includes(marker), `Forge configuration includes ${marker}`);
}

const daemonPackage = JSON.parse(readFileSync(packagePath, "utf8"));
assert(daemonPackage.main === ".vite/main/main.js", "desktop main entry is configured");
assert(Boolean(daemonPackage.scripts?.["desktop:make"]), "desktop make script is configured");

const artifacts = existsSync(outRoot) ? walkFiles(outRoot) : [];
if (requireArtifacts) {
  if (process.platform === "darwin") {
    verifyMacArtifacts(artifacts);
  } else if (process.platform === "win32") {
    verifyWindowsArtifacts(artifacts);
  } else {
    throw new Error("Installer artifacts can only be required on macOS or Windows hosts.");
  }
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  platform: process.platform,
  requireArtifacts,
  checks,
  artifacts: artifacts
    .filter((file) => /\.(dmg|zip|exe|nupkg)$/i.test(file))
    .map((file) => path.relative(root, file))
}, null, 2)}\n`);

function verifyMacArtifacts(files) {
  const dmg = files.find((file) => file.endsWith(".dmg"));
  const zip = files.find((file) => file.endsWith(".zip"));
  const app = findDirectory(outRoot, (entry) => entry.endsWith(".app"));
  assert(Boolean(dmg), "macOS DMG exists");
  assert(Boolean(zip), "macOS ZIP exists");
  assert(Boolean(app), "macOS app bundle exists");
  const resources = path.join(app, "Contents", "Resources");
  assertFile(path.join(resources, "app.asar"), "application ASAR");
  assert(statSync(path.join(resources, "app.asar")).size > 50_000, "application ASAR is not empty");

  run("codesign", ["--verify", "--deep", "--strict", app]);
  const protocol = run("/usr/libexec/PlistBuddy", [
    "-c",
    "Print :CFBundleURLTypes:0:CFBundleURLSchemes:0",
    path.join(app, "Contents", "Info.plist")
  ]).stdout.trim();
  assert(protocol === "seekdesk", "seekdesk URL protocol is registered");

  const fuseResult = run(npxBinary(), ["@electron/fuses", "read", "--app", app]).stdout;
  for (const marker of [
    "RunAsNode is Disabled",
    "EnableCookieEncryption is Enabled",
    "OnlyLoadAppFromAsar is Enabled"
  ]) {
    assert(fuseResult.includes(marker), `Electron fuse ${marker}`);
  }
}

function verifyWindowsArtifacts(files) {
  assert(files.some((file) => /SeekDesk-Daemon-Setup\.exe$/i.test(file)), "Windows setup executable exists");
  assert(files.some((file) => /\.nupkg$/i.test(file)), "Windows NuGet package exists");
}

function assertFile(file, label) {
  assert(existsSync(file) && statSync(file).isFile(), `${label} exists`);
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(`Installer smoke failed: ${label}`);
  }
  checks.push(label);
}

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function findDirectory(directory, predicate) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && predicate(entry.name)) {
      return absolute;
    }
    if (entry.isDirectory()) {
      const found = findDirectory(absolute, predicate);
      if (found) {
        return found;
      }
    }
  }
  return "";
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function npxBinary() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}
