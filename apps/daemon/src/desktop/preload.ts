import { contextBridge, ipcRenderer } from "electron";

import type {
  DaemonDesktopState,
  PairingDraft,
  SeekDeskDaemonBridge
} from "./types.js";

const bridge: SeekDeskDaemonBridge = {
  getState: () => ipcRenderer.invoke("daemon:get-state") as Promise<DaemonDesktopState>,
  claimPairing: (input) => ipcRenderer.invoke("daemon:claim-pairing", input) as Promise<DaemonDesktopState>,
  selectWorkspace: () => ipcRenderer.invoke("daemon:select-workspace") as Promise<DaemonDesktopState>,
  setAutoStart: (enabled) => ipcRenderer.invoke("daemon:set-auto-start", enabled) as Promise<DaemonDesktopState>,
  disconnect: () => ipcRenderer.invoke("daemon:disconnect") as Promise<DaemonDesktopState>,
  hideWindow: () => ipcRenderer.invoke("daemon:hide-window") as Promise<void>,
  openExternal: (url) => ipcRenderer.invoke("daemon:open-external", url) as Promise<void>,
  onState: (listener) => subscribe<DaemonDesktopState>("daemon:state", listener),
  onPairingDraft: (listener) => subscribe<PairingDraft>("daemon:pairing-draft", listener)
};

contextBridge.exposeInMainWorld("seekDeskDaemon", bridge);

function subscribe<T>(channel: string, listener: (value: T) => void) {
  const handler = (_event: Electron.IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
