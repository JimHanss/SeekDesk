import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  safeStorage,
  shell,
  Tray
} from "electron";
import started from "electron-squirrel-startup";

import { startDaemonClient, type DaemonClientStatus } from "../client.js";
import { DaemonConfigStore, type SecretProtector } from "./config-store.js";
import { findPairingDeepLink } from "./deep-link.js";
import { claimDaemonPairing } from "./pairing-client.js";
import type {
  DaemonDesktopState,
  PairingDraft,
  StoredDaemonConfig
} from "./types.js";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let configStore: DaemonConfigStore | null = null;
let currentConfig: StoredDaemonConfig | null = null;
let runtimeController: AbortController | null = null;
let runtimeGeneration = 0;
let quitting = false;
let pendingPairingDraft = findPairingDeepLink(process.argv);
let state: DaemonDesktopState = createInitialState();

if (started) {
  app.quit();
} else {
  startApplication();
}

function startApplication() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on("second-instance", (_event, commandLine) => {
    showWindow();
    const draft = findPairingDeepLink(commandLine);
    if (draft) {
      void consumePairingDraft(draft);
    }
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    const draft = findPairingDeepLink([url]);
    if (draft) {
      void consumePairingDraft(draft);
    }
  });
  app.on("before-quit", () => {
    quitting = true;
    stopRuntime(false);
  });
  app.on("window-all-closed", () => {
    // The tray process remains active until the user explicitly quits.
  });

  void app.whenReady().then(bootstrap);
}

async function bootstrap() {
  app.setAsDefaultProtocolClient("seekdesk");
  configStore = new DaemonConfigStore(
    path.join(app.getPath("userData"), "daemon-config.json"),
    createSafeStorageProtector()
  );
  try {
    currentConfig = configStore.load();
    state = stateFromConfig(currentConfig, currentConfig ? "stopped" : "unpaired");
  } catch (error) {
    state = {
      ...createInitialState(),
      phase: "error",
      message: formatError(error)
    };
  }

  registerIpcHandlers();
  createMainWindow();
  createTray();
  if (currentConfig?.autoStart) {
    applyLoginItemSetting(true);
  }
  if (currentConfig?.workspaceRoot) {
    startRuntime();
  }
  if (pendingPairingDraft) {
    const draft = pendingPairingDraft;
    pendingPairingDraft = null;
    await consumePairingDraft(draft).catch(() => undefined);
  }

  app.on("activate", showWindow);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 680,
    minWidth: 620,
    minHeight: 560,
    show: false,
    title: "SeekDesk Daemon",
    backgroundColor: "#f8fafc",
    icon: assetPath("icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../build/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
  mainWindow.once("ready-to-show", () => {
    if (!process.argv.includes("--hidden") || pendingPairingDraft) {
      showWindow();
    }
    publishState();
  });
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const image = nativeImage.createFromPath(assetPath("tray.png"));
  tray = new Tray(process.platform === "darwin" ? image.resize({ width: 18, height: 18 }) : image);
  tray.setToolTip("SeekDesk Daemon");
  tray.on("double-click", showWindow);
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: `状态：${phaseLabel(state.phase)}`,
      enabled: false
    },
    {
      label: state.workspaceName || "未选择工作区",
      enabled: false
    },
    { type: "separator" },
    { label: "打开 SeekDesk Daemon", click: showWindow },
    {
      label: "选择工作区",
      enabled: state.paired,
      click: () => void selectWorkspace()
    },
    {
      label: "开机自动启动",
      type: "checkbox",
      checked: state.autoStart,
      enabled: state.paired,
      click: (item) => void setAutoStart(item.checked)
    },
    {
      label: "重新配对",
      enabled: state.paired,
      click: () => void disconnect()
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]));
}

function registerIpcHandlers() {
  ipcMain.handle("daemon:get-state", () => state);
  ipcMain.handle("daemon:claim-pairing", async (_event, input: PairingDraft) =>
    claimAndPersist(input)
  );
  ipcMain.handle("daemon:select-workspace", () => selectWorkspace());
  ipcMain.handle("daemon:set-auto-start", (_event, enabled: unknown) =>
    setAutoStart(enabled === true)
  );
  ipcMain.handle("daemon:disconnect", () => disconnect());
  ipcMain.handle("daemon:hide-window", () => {
    mainWindow?.hide();
  });
  ipcMain.handle("daemon:open-external", async (_event, value: unknown) => {
    const url = new URL(String(value));
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Only HTTP links can be opened.");
    }
    await shell.openExternal(url.toString());
  });
}

async function consumePairingDraft(draft: PairingDraft) {
  if (!mainWindow || !configStore) {
    pendingPairingDraft = draft;
    return state;
  }
  showWindow();
  mainWindow.webContents.send("daemon:pairing-draft", draft);
  return claimAndPersist(draft);
}

async function claimAndPersist(input: PairingDraft) {
  const store = requireConfigStore();
  const daemonId = currentConfig?.daemonId || `desktop-${randomUUID()}`;
  setState({
    phase: "connecting",
    message: "正在验证一次性配对码…"
  });
  try {
    const claimed = await claimDaemonPairing({
      ...input,
      daemonId,
      machineName: os.hostname(),
      platform: process.platform
    });
    const previousWorkspace = currentConfig?.workspaceRoot;
    currentConfig = store.save({
      version: 1,
      apiUrl: claimed.apiUrl,
      daemonId,
      encryptedToken: store.encryptToken(claimed.deviceToken),
      tokenExpiresAt: claimed.tokenExpiresAt,
      ...(previousWorkspace ? { workspaceRoot: previousWorkspace } : {}),
      autoStart: currentConfig?.autoStart ?? false,
      pairedAt: new Date().toISOString()
    });
    state = stateFromConfig(currentConfig, "paired", "配对成功，请选择本机项目文件夹。");
    publishState();
    if (currentConfig.workspaceRoot) {
      startRuntime();
    }
    return state;
  } catch (error) {
    setState({ phase: "error", message: formatError(error) });
    throw error;
  }
}

async function selectWorkspace() {
  if (!currentConfig) {
    throw new Error("请先完成设备配对。");
  }
  const options: Electron.OpenDialogOptions = {
    title: "选择 SeekDesk 工作区",
    buttonLabel: "选择此文件夹",
    properties: ["openDirectory", "createDirectory"]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  const workspaceRoot = result.filePaths[0];
  if (result.canceled || !workspaceRoot) {
    return state;
  }
  currentConfig = requireConfigStore().save({
    ...currentConfig,
    workspaceRoot
  });
  state = stateFromConfig(currentConfig, "stopped", "正在连接所选工作区…");
  publishState();
  startRuntime();
  return state;
}

async function setAutoStart(enabled: boolean) {
  if (!currentConfig) {
    throw new Error("请先完成设备配对。");
  }
  applyLoginItemSetting(enabled);
  currentConfig = requireConfigStore().save({ ...currentConfig, autoStart: enabled });
  setState({ autoStart: enabled, message: enabled ? "已启用开机自动启动。" : "已关闭开机自动启动。" });
  return state;
}

async function disconnect() {
  stopRuntime(false);
  applyLoginItemSetting(false);
  requireConfigStore().clear();
  currentConfig = null;
  state = {
    ...createInitialState(),
    message: "设备已解除配对，可从 SeekDesk Web 重新生成配对码。"
  };
  publishState();
  return state;
}

function startRuntime() {
  if (!currentConfig?.workspaceRoot) {
    return;
  }
  if (Date.parse(currentConfig.tokenExpiresAt) <= Date.now()) {
    setState({ phase: "error", message: "设备凭据已过期，请重新配对。" });
    return;
  }
  let token: string;
  try {
    token = requireConfigStore().decryptToken(currentConfig);
  } catch {
    setState({ phase: "error", message: "无法解密设备凭据，请重新配对。" });
    return;
  }

  stopRuntime(false);
  const generation = ++runtimeGeneration;
  runtimeController = new AbortController();
  setState({ phase: "connecting", attempt: 0, message: "正在连接 SeekDesk…" });
  void startDaemonClient({
    apiUrl: currentConfig.apiUrl,
    token,
    workspaceRoot: currentConfig.workspaceRoot,
    daemonId: currentConfig.daemonId,
    signal: runtimeController.signal,
    onStatus: (next) => {
      if (generation !== runtimeGeneration) {
        return;
      }
      applyDaemonStatus(next);
    }
  }).catch((error) => {
    if (generation === runtimeGeneration) {
      setState({ phase: "error", message: formatError(error) });
    }
  });
}

function stopRuntime(publish = true) {
  runtimeGeneration += 1;
  runtimeController?.abort();
  runtimeController = null;
  if (publish && currentConfig) {
    setState({ phase: "stopped", message: "Daemon 已停止。" });
  }
}

function applyDaemonStatus(next: DaemonClientStatus) {
  const workspace = next.workspace;
  setState({
    phase: next.phase,
    attempt: next.attempt,
    message: statusMessage(next),
    ...(workspace
      ? {
          workspaceId: workspace.workspaceId,
          workspaceName: workspace.name,
          workspaceRoot: workspace.rootPath
        }
      : {})
  });
}

function setState(patch: Partial<DaemonDesktopState>) {
  state = { ...state, ...patch };
  publishState();
}

function publishState() {
  refreshTrayMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("daemon:state", state);
  }
}

function stateFromConfig(
  config: StoredDaemonConfig | null,
  phase: DaemonDesktopState["phase"],
  message = ""
): DaemonDesktopState {
  return {
    ...createInitialState(),
    phase,
    paired: Boolean(config),
    apiUrl: config?.apiUrl ?? "",
    daemonId: config?.daemonId ?? "",
    tokenExpiresAt: config?.tokenExpiresAt ?? "",
    workspaceRoot: config?.workspaceRoot ?? "",
    autoStart: config?.autoStart ?? false,
    message
  };
}

function createInitialState(): DaemonDesktopState {
  return {
    phase: "unpaired",
    paired: false,
    apiUrl: "",
    daemonId: "",
    tokenExpiresAt: "",
    workspaceRoot: "",
    workspaceId: "",
    workspaceName: "",
    autoStart: false,
    attempt: 0,
    message: "",
    appVersion: app.getVersion(),
    platform: process.platform
  };
}

function createSafeStorageProtector(): SecretProtector {
  return {
    encrypt(value) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("系统凭据加密不可用，无法安全保存设备 token。");
      }
      return safeStorage.encryptString(value).toString("base64");
    },
    decrypt(value) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("系统凭据加密不可用。");
      }
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    }
  };
}

function applyLoginItemSetting(enabled: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    ...(process.platform === "win32"
      ? { path: process.execPath, args: ["--hidden"] }
      : {})
  });
}

function requireConfigStore() {
  if (!configStore) {
    throw new Error("Daemon configuration is not initialized.");
  }
  return configStore;
}

function showWindow() {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function assetPath(name: string) {
  const root = app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.resolve(__dirname, "../../assets");
  return path.join(root, name);
}

function statusMessage(next: DaemonClientStatus) {
  switch (next.phase) {
    case "connecting":
      return "正在连接 SeekDesk…";
    case "connected":
      return "已连接，可在 Web 中选择此工作区。";
    case "reconnecting":
      return "连接中断，正在自动重连…";
    case "stopped":
      return "Daemon 已停止。";
    case "error":
      return next.message || "Daemon 连接失败。";
  }
}

function phaseLabel(phase: DaemonDesktopState["phase"]) {
  return {
    unpaired: "未配对",
    paired: "已配对",
    connecting: "连接中",
    connected: "已连接",
    reconnecting: "重连中",
    error: "需要处理",
    stopped: "已停止"
  }[phase];
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
