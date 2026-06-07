import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { google, type gmail_v1, type calendar_v3 } from "googleapis";

import type {
  CalendarListEventsInput,
  CalendarProposeEventPreviewInput,
  GmailCreateDraftPreviewInput,
  GmailReadThreadInput,
  GmailSearchThreadsInput
} from "@seekdesk/shared";
import type {
  DailyWorkConnectorAccount,
  DailyWorkRepository
} from "../repositories/daily-work-repository.js";

export const googleConnectorScopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly"
] as const;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  stateSecret: string;
}

export interface GoogleConnectionStatus {
  provider: "google";
  connected: boolean;
  scopes: string[];
  accountEmail?: string;
  connectedAt?: string;
  updatedAt?: string;
  requiresSetup?: boolean;
  missingConfig?: string[];
}

export type GoogleOAuthClient = ReturnType<typeof createGoogleOAuthClient>;

export class GoogleConnectorNotConnectedError extends Error {
  constructor() {
    super("Google connector is not connected.");
    this.name = "GoogleConnectorNotConnectedError";
  }
}

export class GoogleConnectorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleConnectorConfigurationError";
  }
}

export function getGoogleOAuthConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): GoogleOAuthConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim();
  const tokenEncryptionKey = env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  const stateSecret =
    env.GOOGLE_OAUTH_STATE_SECRET?.trim() ??
    env.SEEKDESK_OAUTH_STATE_SECRET?.trim() ??
    tokenEncryptionKey;

  if (!clientId || !clientSecret || !redirectUri || !tokenEncryptionKey || !stateSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    tokenEncryptionKey,
    stateSecret
  };
}

export function getMissingGoogleOAuthConfig(
  env: NodeJS.ProcessEnv = process.env
) {
  return [
    ["GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID],
    ["GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET],
    ["GOOGLE_REDIRECT_URI", env.GOOGLE_REDIRECT_URI],
    ["GOOGLE_TOKEN_ENCRYPTION_KEY", env.GOOGLE_TOKEN_ENCRYPTION_KEY]
  ]
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([name]) => String(name));
}

export function createGoogleOAuthClient(config: GoogleOAuthConfig) {
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
}

export function createGoogleAuthUrl(input: {
  config: GoogleOAuthConfig;
  workspaceId?: string;
}) {
  const state = createOAuthState({
    secret: input.config.stateSecret,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {})
  });
  const client = createGoogleOAuthClient(input.config);

  return {
    authorizationUrl: client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: [...googleConnectorScopes],
      state
    }),
    state,
    scopes: [...googleConnectorScopes]
  };
}

export async function exchangeGoogleOAuthCode(input: {
  code: string;
  state?: string;
  config: GoogleOAuthConfig;
  repository: DailyWorkRepository;
}) {
  if (input.state) {
    verifyOAuthState({
      state: input.state,
      secret: input.config.stateSecret
    });
  }

  const client = createGoogleOAuthClient(input.config);
  const { tokens } = await client.getToken(input.code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({
    version: "v2",
    auth: client
  });
  const userInfo = await oauth2.userinfo.get();
  const now = new Date().toISOString();
  const account: DailyWorkConnectorAccount = {
    id: `google:${userInfo.data.email ?? "connected"}`,
    provider: "google",
    ...(userInfo.data.email ? { accountEmail: userInfo.data.email } : {}),
    encryptedTokens: encryptJson(tokens, input.config.tokenEncryptionKey),
    scopes: normalizeScopes(tokens.scope),
    connectedAt: now,
    updatedAt: now
  };

  return input.repository.upsertConnectorAccount(account);
}

export async function getGoogleConnectionStatus(input: {
  repository: DailyWorkRepository;
  env?: NodeJS.ProcessEnv;
}): Promise<GoogleConnectionStatus> {
  const missingConfig = getMissingGoogleOAuthConfig(input.env);
  const account = await input.repository.getConnectorAccount("google");

  if (!account) {
    return {
      provider: "google",
      connected: false,
      scopes: [...googleConnectorScopes],
      requiresSetup: true,
      ...(missingConfig.length > 0 ? { missingConfig } : {})
    };
  }

  return {
    provider: "google",
    connected: true,
    scopes: account.scopes,
    ...(account.accountEmail ? { accountEmail: account.accountEmail } : {}),
    connectedAt: account.connectedAt,
    updatedAt: account.updatedAt,
    ...(missingConfig.length > 0 ? { missingConfig } : {})
  };
}

export async function createGoogleAuthenticatedClient(input: {
  repository: DailyWorkRepository;
  config: GoogleOAuthConfig;
}) {
  const account = await input.repository.getConnectorAccount("google");
  if (!account) {
    throw new GoogleConnectorNotConnectedError();
  }

  const client = createGoogleOAuthClient(input.config);
  client.setCredentials(decryptJson(account.encryptedTokens, input.config.tokenEncryptionKey));

  return client;
}

export async function searchGmailThreads(input: {
  auth: GoogleOAuthClient;
  params: GmailSearchThreadsInput;
}) {
  const gmail = google.gmail({
    version: "v1",
    auth: input.auth
  });
  const response = await gmail.users.threads.list({
    userId: "me",
    q: input.params.query,
    maxResults: input.params.maxResults
  });

  return {
    provider: "gmail",
    previewOnly: true,
    query: input.params.query,
    threads:
      response.data.threads?.map((thread) => ({
        id: thread.id ?? "",
        snippet: thread.snippet ?? "",
        historyId: thread.historyId ?? ""
      })) ?? [],
    resultSizeEstimate: response.data.resultSizeEstimate ?? 0
  };
}

export async function readGmailThread(input: {
  auth: GoogleOAuthClient;
  params: GmailReadThreadInput;
}) {
  const gmail = google.gmail({
    version: "v1",
    auth: input.auth
  });
  const response = await gmail.users.threads.get({
    userId: "me",
    id: input.params.threadId,
    format: "metadata",
    metadataHeaders: ["From", "To", "Cc", "Subject", "Date"]
  });

  return {
    provider: "gmail",
    previewOnly: true,
    threadId: response.data.id ?? input.params.threadId,
    historyId: response.data.historyId ?? "",
    messages:
      response.data.messages?.map((message) => mapGmailMessageMetadata(message)) ??
      []
  };
}

export function createGmailDraftPreview(input: GmailCreateDraftPreviewInput) {
  const raw = createEmailRawPreview(input);

  return {
    provider: "gmail",
    previewOnly: true,
    externalEffects: ["none"],
    draftPayloadPreview: {
      message: {
        ...(input.threadId ? { threadId: input.threadId } : {}),
        raw
      }
    },
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    bodyText: input.bodyText,
    safetyBoundary:
      "This is a local Gmail draft payload preview. SeekDesk does not call drafts.create or drafts.send in daily_work v1."
  };
}

export async function listCalendarEvents(input: {
  auth: GoogleOAuthClient;
  params: CalendarListEventsInput;
}) {
  const calendar = google.calendar({
    version: "v3",
    auth: input.auth
  });
  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId: input.params.calendarId,
    maxResults: input.params.maxResults,
    singleEvents: true,
    orderBy: "startTime"
  };

  if (input.params.timeMin) {
    params.timeMin = input.params.timeMin;
  }

  if (input.params.timeMax) {
    params.timeMax = input.params.timeMax;
  }

  const response = await calendar.events.list(params);

  return {
    provider: "google_calendar",
    previewOnly: true,
    calendarId: input.params.calendarId,
    events: response.data.items?.map(mapCalendarEvent) ?? []
  };
}

export function createCalendarEventPreview(
  input: CalendarProposeEventPreviewInput
) {
  return {
    provider: "google_calendar",
    previewOnly: true,
    externalEffects: ["none"],
    eventPayloadPreview: {
      summary: input.summary,
      ...(input.description ? { description: input.description } : {}),
      start: {
        dateTime: input.startDateTime
      },
      end: {
        dateTime: input.endDateTime
      },
      attendees: input.attendeeEmails.map((email) => ({ email }))
    },
    calendarId: input.calendarId,
    safetyBoundary:
      "This is a local Calendar event JSON preview. SeekDesk does not call events.insert in daily_work v1."
  };
}

export function encryptJson(value: unknown, secret: string) {
  const iv = randomBytes(12);
  const key = deriveEncryptionKey(secret);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

export function decryptJson<T = unknown>(payload: string, secret: string): T {
  const [version, ivText, tagText, encryptedText] = payload.split(".");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    throw new GoogleConnectorConfigurationError(
      "Encrypted Google token payload is invalid."
    );
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(secret),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}

function createOAuthState(input: {
  secret: string;
  workspaceId?: string;
}) {
  const payload = Buffer.from(
    JSON.stringify({
      workspaceId: input.workspaceId ?? "workspace-seekdesk",
      nonce: randomBytes(12).toString("base64url"),
      createdAt: new Date().toISOString()
    }),
    "utf8"
  ).toString("base64url");
  const signature = signState(payload, input.secret);

  return `${payload}.${signature}`;
}

function verifyOAuthState(input: { state: string; secret: string }) {
  const [payload, signature] = input.state.split(".");
  if (!payload || !signature || signState(payload, input.secret) !== signature) {
    throw new GoogleConnectorConfigurationError("Invalid Google OAuth state.");
  }
}

function signState(payload: string, secret: string) {
  return createHash("sha256")
    .update(`${payload}.${secret}`)
    .digest("base64url");
}

function deriveEncryptionKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function normalizeScopes(scope: string | null | undefined) {
  if (!scope) {
    return [...googleConnectorScopes];
  }

  return scope
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createEmailRawPreview(input: GmailCreateDraftPreviewInput) {
  const lines = [
    `To: ${input.to.join(", ")}`,
    ...(input.cc.length > 0 ? [`Cc: ${input.cc.join(", ")}`] : []),
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.bodyText
  ];

  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

function mapGmailMessageMetadata(message: gmail_v1.Schema$Message) {
  return {
    id: message.id ?? "",
    threadId: message.threadId ?? "",
    snippet: message.snippet ?? "",
    internalDate: message.internalDate ?? "",
    headers: Object.fromEntries(
      message.payload?.headers
        ?.filter((header) => header.name && header.value)
        .map((header) => [String(header.name), String(header.value)]) ?? []
    )
  };
}

function mapCalendarEvent(event: calendar_v3.Schema$Event) {
  return {
    id: event.id ?? "",
    status: event.status ?? "",
    summary: event.summary ?? "(untitled)",
    description: event.description ?? "",
    location: event.location ?? "",
    start: event.start ?? {},
    end: event.end ?? {},
    attendees:
      event.attendees?.map((attendee) => ({
        email: attendee.email ?? "",
        displayName: attendee.displayName ?? "",
        responseStatus: attendee.responseStatus ?? ""
      })) ?? []
  };
}
