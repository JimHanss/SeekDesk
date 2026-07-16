import type { SeekDeskDaemonBridge } from "./types.js";

declare global {
  interface Window {
    seekDeskDaemon: SeekDeskDaemonBridge;
  }
}

export {};
