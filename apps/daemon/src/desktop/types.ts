export type DesktopConnectionPhase =
  | "unpaired"
  | "paired"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "stopped";

export interface StoredDaemonConfig {
  version: 1;
  apiUrl: string;
  daemonId: string;
  encryptedToken: string;
  tokenExpiresAt: string;
  workspaceRoot?: string;
  autoStart: boolean;
  pairedAt: string;
}

export interface DaemonDesktopState {
  phase: DesktopConnectionPhase;
  paired: boolean;
  apiUrl: string;
  daemonId: string;
  tokenExpiresAt: string;
  workspaceRoot: string;
  workspaceId: string;
  workspaceName: string;
  autoStart: boolean;
  attempt: number;
  message: string;
  appVersion: string;
  platform: string;
}

export interface PairingDraft {
  apiUrl: string;
  code: string;
}

export interface SeekDeskDaemonBridge {
  getState(): Promise<DaemonDesktopState>;
  claimPairing(input: PairingDraft): Promise<DaemonDesktopState>;
  selectWorkspace(): Promise<DaemonDesktopState>;
  setAutoStart(enabled: boolean): Promise<DaemonDesktopState>;
  disconnect(): Promise<DaemonDesktopState>;
  hideWindow(): Promise<void>;
  openExternal(url: string): Promise<void>;
  onState(listener: (state: DaemonDesktopState) => void): () => void;
  onPairingDraft(listener: (draft: PairingDraft) => void): () => void;
}
