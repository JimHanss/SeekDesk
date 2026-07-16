import type {
  DaemonDesktopState,
  PairingDraft
} from "./types.js";

const pairForm = element<HTMLFormElement>("pair-form");
const apiUrlInput = element<HTMLInputElement>("api-url");
const pairingCodeInput = element<HTMLInputElement>("pairing-code");
const pairButton = element<HTMLButtonElement>("pair-button");
const pairedSummary = element<HTMLDivElement>("paired-summary");
const pairedApi = element<HTMLElement>("paired-api");
const pairedDevice = element<HTMLElement>("paired-device");
const disconnectButton = element<HTMLButtonElement>("disconnect-button");
const selectWorkspaceButton = element<HTMLButtonElement>("select-workspace-button");
const workspacePath = element<HTMLElement>("workspace-path");
const workspaceId = element<HTMLElement>("workspace-id");
const runtimeStatus = element<HTMLElement>("runtime-status");
const autoStart = element<HTMLInputElement>("auto-start");
const hideButton = element<HTMLButtonElement>("hide-button");
const message = element<HTMLDivElement>("message");
const statusPill = element<HTMLDivElement>("status-pill");
const statusLabel = element<HTMLElement>("status-label");
const versionLabel = element<HTMLElement>("version-label");
const stepIndicators = [1, 2, 3].map((step) => element<HTMLElement>(`step-indicator-${step}`));

let state: DaemonDesktopState | null = null;
let busy = false;

pairForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void runAction(async () => {
    state = await window.seekDeskDaemon.claimPairing({
      apiUrl: apiUrlInput.value.trim(),
      code: pairingCodeInput.value.trim().toUpperCase()
    });
    render();
  });
});

pairingCodeInput.addEventListener("input", () => {
  const compact = pairingCodeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 12);
  pairingCodeInput.value = [compact.slice(0, 4), compact.slice(4, 8), compact.slice(8, 12)]
    .filter(Boolean)
    .join("-");
});

selectWorkspaceButton.addEventListener("click", () => {
  void runAction(async () => {
    state = await window.seekDeskDaemon.selectWorkspace();
    render();
  });
});

autoStart.addEventListener("change", () => {
  const enabled = autoStart.checked;
  void runAction(async () => {
    state = await window.seekDeskDaemon.setAutoStart(enabled);
    render();
  }, () => {
    autoStart.checked = !enabled;
  });
});

disconnectButton.addEventListener("click", () => {
  if (!window.confirm("解除配对后，需要从 SeekDesk Web 生成新的配对码。继续吗？")) {
    return;
  }
  void runAction(async () => {
    state = await window.seekDeskDaemon.disconnect();
    apiUrlInput.value = "";
    pairingCodeInput.value = "";
    render();
  });
});

hideButton.addEventListener("click", () => {
  void window.seekDeskDaemon.hideWindow();
});

window.seekDeskDaemon.onState((next) => {
  state = next;
  render();
});

window.seekDeskDaemon.onPairingDraft((draft: PairingDraft) => {
  apiUrlInput.value = draft.apiUrl;
  pairingCodeInput.value = draft.code;
  setMessage("已接收浏览器配对请求，正在验证…", false);
});

void window.seekDeskDaemon.getState().then((next) => {
  state = next;
  if (next.apiUrl) {
    apiUrlInput.value = next.apiUrl;
  }
  render();
});

function render() {
  if (!state) {
    return;
  }
  statusPill.dataset.phase = state.phase;
  statusLabel.textContent = phaseLabel(state.phase);
  versionLabel.textContent = `SeekDesk Daemon ${state.appVersion} · ${state.platform}`;
  pairForm.classList.toggle("is-hidden", state.paired);
  pairedSummary.classList.toggle("is-hidden", !state.paired);
  pairedApi.textContent = state.apiUrl || "—";
  pairedDevice.textContent = state.daemonId;
  workspacePath.textContent = state.workspaceRoot || "尚未选择";
  workspaceId.textContent = state.workspaceId || "—";
  runtimeStatus.textContent = phaseLabel(state.phase);
  autoStart.checked = state.autoStart;
  autoStart.disabled = !state.paired || busy;
  selectWorkspaceButton.disabled = !state.paired || busy;
  disconnectButton.disabled = busy;
  pairButton.disabled = busy;
  pairButton.textContent = busy ? "正在配对…" : "完成配对";
  hideButton.disabled = !state.paired || busy;

  const completedSteps = state.phase === "connected"
    ? 3
    : state.workspaceRoot
      ? 2
      : state.paired
        ? 1
        : 0;
  const activeStep = Math.min(completedSteps + 1, 3);
  stepIndicators.forEach((indicator, index) => {
    const step = index + 1;
    indicator.classList.toggle("is-complete", step <= completedSteps);
    indicator.classList.toggle("is-active", step === activeStep && completedSteps < 3);
    const number = indicator.querySelector("span");
    if (number) {
      number.textContent = step <= completedSteps ? "✓" : String(step);
    }
  });

  setMessage(state.message, state.phase === "error");
}

async function runAction(action: () => Promise<void>, onError?: () => void) {
  if (busy) {
    return;
  }
  busy = true;
  render();
  try {
    await action();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), true);
    onError?.();
  } finally {
    busy = false;
    render();
  }
}

function setMessage(value: string, error: boolean) {
  message.textContent = value;
  message.classList.toggle("is-error", error);
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

function element<T extends HTMLElement>(id: string) {
  const value = document.getElementById(id);
  if (!value) {
    throw new Error(`Missing desktop element #${id}.`);
  }
  return value as T;
}
