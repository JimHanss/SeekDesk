import type {
  OutlookCalendarListEventsInput,
  OutlookCalendarProposeEventPreviewInput,
  OutlookCreateDraftPreviewInput,
  OutlookReadMessageInput,
  OutlookSearchMessagesInput
} from "@seekdesk/shared";

import type { DailyWorkRepository } from "../repositories/daily-work-repository.js";
import {
  EmailConnectorConfigurationError,
  createConnectorAccount,
  createEmailOAuthState,
  decryptConnectorJson,
  encryptConnectorJson,
  getEmailConnectorStatus,
  normalizeScopeString,
  verifyEmailOAuthState,
  type EmailConnectorStatus
} from "./email-connector-service.js";

const microsoftAuthorizeUrl =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const microsoftTokenUrl =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const microsoftGraphUrl = "https://graph.microsoft.com/v1.0";

export const microsoftConnectorScopes = [
  "offline_access",
  "User.Read",
  "Mail.Read",
  "Calendars.Read"
] as const;

export interface MicrosoftOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  stateSecret: string;
}

export type MicrosoftConnectionStatus = EmailConnectorStatus & {
  provider: "microsoft";
};

interface MicrosoftTokenPayload {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  ext_expires_in?: number;
  scope?: string;
  expires_at?: string;
}

interface MicrosoftProfileResponse {
  mail?: string | null;
  userPrincipalName?: string | null;
  displayName?: string | null;
}

interface MicrosoftGraphListResponse<T> {
  value?: T[];
  "@odata.nextLink"?: string;
}

interface MicrosoftGraphEmailAddress {
  name?: string | null;
  address?: string | null;
}

interface MicrosoftGraphMessage {
  id?: string;
  subject?: string | null;
  from?: {
    emailAddress?: MicrosoftGraphEmailAddress | null;
  } | null;
  receivedDateTime?: string | null;
  bodyPreview?: string | null;
  conversationId?: string | null;
  webLink?: string | null;
  body?: {
    contentType?: string | null;
    content?: string | null;
  } | null;
  toRecipients?: Array<{ emailAddress?: MicrosoftGraphEmailAddress | null }>;
  ccRecipients?: Array<{ emailAddress?: MicrosoftGraphEmailAddress | null }>;
}

interface MicrosoftGraphEvent {
  id?: string;
  subject?: string | null;
  bodyPreview?: string | null;
  start?: {
    dateTime?: string | null;
    timeZone?: string | null;
  } | null;
  end?: {
    dateTime?: string | null;
    timeZone?: string | null;
  } | null;
  location?: {
    displayName?: string | null;
  } | null;
  attendees?: Array<{
    emailAddress?: MicrosoftGraphEmailAddress | null;
    status?: {
      response?: string | null;
    } | null;
  }>;
  webLink?: string | null;
}

export class MicrosoftConnectorNotConnectedError extends Error {
  constructor() {
    super("Microsoft connector is not connected.");
    this.name = "MicrosoftConnectorNotConnectedError";
  }
}

export class MicrosoftConnectorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicrosoftConnectorConfigurationError";
  }
}

export function getMicrosoftOAuthConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): MicrosoftOAuthConfig | null {
  const clientId = env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = env.MICROSOFT_CLIENT_SECRET?.trim();
  const redirectUri = env.MICROSOFT_REDIRECT_URI?.trim();
  const tokenEncryptionKey = env.MICROSOFT_TOKEN_ENCRYPTION_KEY?.trim();
  const stateSecret =
    env.MICROSOFT_OAUTH_STATE_SECRET?.trim() ??
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

export function getMissingMicrosoftOAuthConfig(
  env: NodeJS.ProcessEnv = process.env
) {
  return [
    ["MICROSOFT_CLIENT_ID", env.MICROSOFT_CLIENT_ID],
    ["MICROSOFT_CLIENT_SECRET", env.MICROSOFT_CLIENT_SECRET],
    ["MICROSOFT_REDIRECT_URI", env.MICROSOFT_REDIRECT_URI],
    ["MICROSOFT_TOKEN_ENCRYPTION_KEY", env.MICROSOFT_TOKEN_ENCRYPTION_KEY]
  ]
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([name]) => String(name));
}

export function createMicrosoftAuthUrl(input: {
  config: MicrosoftOAuthConfig;
  workspaceId?: string;
}) {
  const state = createEmailOAuthState({
    secret: input.config.stateSecret,
    provider: "microsoft",
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {})
  });
  const authorizationUrl = new URL(microsoftAuthorizeUrl);

  authorizationUrl.searchParams.set("client_id", input.config.clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", input.config.redirectUri);
  authorizationUrl.searchParams.set("response_mode", "query");
  authorizationUrl.searchParams.set("scope", microsoftConnectorScopes.join(" "));
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", "select_account");

  return {
    authorizationUrl: authorizationUrl.toString(),
    state,
    scopes: [...microsoftConnectorScopes]
  };
}

export async function exchangeMicrosoftOAuthCode(input: {
  code: string;
  state?: string;
  config: MicrosoftOAuthConfig;
  repository: DailyWorkRepository;
}) {
  if (input.state) {
    verifyMicrosoftOAuthState(input.state, input.config.stateSecret);
  }

  const tokenPayload = addTokenExpiry(
    await requestMicrosoftToken({
      config: input.config,
      grant: {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.config.redirectUri
      }
    })
  );
  const profile = await fetchMicrosoftJson<MicrosoftProfileResponse>({
    accessToken: tokenPayload.access_token,
    url: `${microsoftGraphUrl}/me?$select=mail,userPrincipalName,displayName`
  });
  const accountEmail =
    profile.mail?.trim() || profile.userPrincipalName?.trim() || undefined;
  const account = createConnectorAccount({
    provider: "microsoft",
    ...(accountEmail ? { accountEmail } : {}),
    encryptedTokens: encryptConnectorJson(
      tokenPayload,
      input.config.tokenEncryptionKey
    ),
    scopes: normalizeScopeString(tokenPayload.scope, microsoftConnectorScopes)
  });

  return input.repository.upsertConnectorAccount(account);
}

export async function getMicrosoftConnectionStatus(input: {
  repository: DailyWorkRepository;
  env?: NodeJS.ProcessEnv;
}): Promise<MicrosoftConnectionStatus> {
  const status = await getEmailConnectorStatus({
    provider: "microsoft",
    repository: input.repository,
    requiredScopes: microsoftConnectorScopes,
    missingConfig: getMissingMicrosoftOAuthConfig(input.env)
  });

  return {
    ...status,
    provider: "microsoft"
  };
}

export async function createMicrosoftAccessToken(input: {
  repository: DailyWorkRepository;
  config: MicrosoftOAuthConfig;
}) {
  const account = await input.repository.getConnectorAccount("microsoft");
  if (!account) {
    throw new MicrosoftConnectorNotConnectedError();
  }

  const tokens = decryptConnectorJson<MicrosoftTokenPayload>(
    account.encryptedTokens,
    input.config.tokenEncryptionKey
  );

  if (!tokens.access_token) {
    throw new MicrosoftConnectorNotConnectedError();
  }

  if (!isTokenExpired(tokens)) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw new MicrosoftConnectorNotConnectedError();
  }

  const refreshedTokens = addTokenExpiry(
    await requestMicrosoftToken({
      config: input.config,
      grant: {
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token
      }
    })
  );
  const mergedTokens: MicrosoftTokenPayload = {
    ...tokens,
    ...refreshedTokens,
    refresh_token: refreshedTokens.refresh_token ?? tokens.refresh_token
  };
  const scopes = normalizeScopeString(
    mergedTokens.scope,
    account.scopes.length ? account.scopes : microsoftConnectorScopes
  );

  await input.repository.upsertConnectorAccount({
    ...account,
    encryptedTokens: encryptConnectorJson(
      mergedTokens,
      input.config.tokenEncryptionKey
    ),
    scopes,
    updatedAt: new Date().toISOString()
  });

  return mergedTokens.access_token;
}

export async function searchOutlookMessages(input: {
  accessToken: string;
  params: OutlookSearchMessagesInput;
}) {
  const url = new URL(`${microsoftGraphUrl}/me/messages`);
  const headers: Record<string, string> = {};

  url.searchParams.set(
    "$select",
    "id,subject,from,receivedDateTime,bodyPreview,conversationId,webLink"
  );
  url.searchParams.set("$top", String(input.params.maxResults));
  url.searchParams.set("$orderby", "receivedDateTime desc");

  if (input.params.query) {
    url.searchParams.set("$search", `"${escapeGraphSearch(input.params.query)}"`);
    headers.ConsistencyLevel = "eventual";
    url.searchParams.delete("$orderby");
  }

  const response = await fetchMicrosoftJson<
    MicrosoftGraphListResponse<MicrosoftGraphMessage>
  >({
    accessToken: input.accessToken,
    url: url.toString(),
    headers
  });

  return {
    provider: "outlook",
    previewOnly: true,
    query: input.params.query ?? "",
    messages: (response.value ?? []).map(mapGraphMessageSummary),
    resultCount: response.value?.length ?? 0,
    nextLinkAvailable: Boolean(response["@odata.nextLink"])
  };
}

export async function readOutlookMessage(input: {
  accessToken: string;
  params: OutlookReadMessageInput;
}) {
  const url = new URL(
    `${microsoftGraphUrl}/me/messages/${encodeURIComponent(input.params.messageId)}`
  );
  url.searchParams.set(
    "$select",
    "id,subject,from,receivedDateTime,bodyPreview,conversationId,webLink,body,toRecipients,ccRecipients"
  );

  const message = await fetchMicrosoftJson<MicrosoftGraphMessage>({
    accessToken: input.accessToken,
    url: url.toString()
  });

  return {
    provider: "outlook",
    previewOnly: true,
    message: mapGraphMessageDetail(message)
  };
}

export function createOutlookDraftPreview(input: OutlookCreateDraftPreviewInput) {
  return {
    provider: "outlook",
    previewOnly: true,
    externalEffects: ["none"],
    draftPayloadPreview: {
      subject: input.subject,
      body: {
        contentType: "Text",
        content: input.bodyText
      },
      toRecipients: input.to.map((email) => toGraphRecipient(email)),
      ccRecipients: input.cc.map((email) => toGraphRecipient(email))
    },
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    safetyBoundary:
      "This is a local Outlook draft payload preview. SeekDesk does not call Microsoft Graph /me/messages, /sendMail, or send in daily_work v1."
  };
}

export async function listOutlookCalendarEvents(input: {
  accessToken: string;
  params: OutlookCalendarListEventsInput;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timeMin = input.params.timeMin ?? now.toISOString();
  const timeMax =
    input.params.timeMax ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const calendarPath =
    input.params.calendarId && input.params.calendarId !== "primary"
      ? `/me/calendars/${encodeURIComponent(input.params.calendarId)}/calendarView`
      : "/me/calendarView";
  const url = new URL(`${microsoftGraphUrl}${calendarPath}`);

  url.searchParams.set("startDateTime", timeMin);
  url.searchParams.set("endDateTime", timeMax);
  url.searchParams.set("$top", String(input.params.maxResults));
  url.searchParams.set(
    "$select",
    "id,subject,bodyPreview,start,end,location,attendees,webLink"
  );
  url.searchParams.set("$orderby", "start/dateTime");

  const response = await fetchMicrosoftJson<
    MicrosoftGraphListResponse<MicrosoftGraphEvent>
  >({
    accessToken: input.accessToken,
    url: url.toString(),
    ...(input.params.timeZone
      ? { headers: { Prefer: `outlook.timezone="${input.params.timeZone}"` } }
      : {})
  });

  return {
    provider: "outlook_calendar",
    previewOnly: true,
    calendarId: input.params.calendarId,
    timeMin,
    timeMax,
    events: (response.value ?? []).map(mapGraphEvent),
    resultCount: response.value?.length ?? 0,
    nextLinkAvailable: Boolean(response["@odata.nextLink"])
  };
}

export function createOutlookCalendarEventPreview(
  input: OutlookCalendarProposeEventPreviewInput
) {
  return {
    provider: "outlook_calendar",
    previewOnly: true,
    externalEffects: ["none"],
    eventPayloadPreview: {
      subject: input.summary,
      ...(input.description ? { body: { contentType: "Text", content: input.description } } : {}),
      start: {
        dateTime: input.startDateTime,
        timeZone: input.timeZone
      },
      end: {
        dateTime: input.endDateTime,
        timeZone: input.timeZone
      },
      ...(input.location ? { location: { displayName: input.location } } : {}),
      attendees: input.attendeeEmails.map((email) => ({
        emailAddress: {
          address: email
        },
        type: "required"
      }))
    },
    calendarId: input.calendarId,
    safetyBoundary:
      "This is a local Outlook calendar event JSON preview. SeekDesk does not call Microsoft Graph events insert/create in daily_work v1."
  };
}

function verifyMicrosoftOAuthState(state: string, secret: string) {
  try {
    verifyEmailOAuthState({
      state,
      secret,
      provider: "microsoft"
    });
  } catch (error) {
    if (error instanceof EmailConnectorConfigurationError) {
      throw new MicrosoftConnectorConfigurationError(error.message);
    }

    throw error;
  }
}

async function requestMicrosoftToken(input: {
  config: MicrosoftOAuthConfig;
  grant:
    | {
        grant_type: "authorization_code";
        code: string;
        redirect_uri: string;
      }
    | {
        grant_type: "refresh_token";
        refresh_token: string;
      };
}) {
  const body = new URLSearchParams({
    client_id: input.config.clientId,
    client_secret: input.config.clientSecret,
    scope: microsoftConnectorScopes.join(" "),
    ...input.grant
  });
  const response = await fetch(microsoftTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = (await response.json()) as Partial<MicrosoftTokenPayload> & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new MicrosoftConnectorConfigurationError(
      payload.error_description ??
        payload.error ??
        `Microsoft OAuth token exchange failed: ${response.status}`
    );
  }

  return payload as MicrosoftTokenPayload;
}

function addTokenExpiry(payload: MicrosoftTokenPayload): MicrosoftTokenPayload {
  if (!payload.expires_in || payload.expires_at) {
    return payload;
  }

  return {
    ...payload,
    expires_at: new Date(Date.now() + payload.expires_in * 1000).toISOString()
  };
}

function isTokenExpired(payload: MicrosoftTokenPayload) {
  if (!payload.expires_at) {
    return false;
  }

  return new Date(payload.expires_at).getTime() <= Date.now() + 60_000;
}

async function fetchMicrosoftJson<T>(input: {
  accessToken: string;
  url: string;
  headers?: Record<string, string>;
}): Promise<T> {
  const response = await fetch(input.url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      ...(input.headers ?? {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) as { error?: { message?: string } } : {};

  if (!response.ok) {
    throw new MicrosoftConnectorConfigurationError(
      payload.error?.message ?? `Microsoft Graph request failed: ${response.status}`
    );
  }

  return payload as T;
}

function mapGraphMessageSummary(message: MicrosoftGraphMessage) {
  return {
    id: message.id ?? "",
    subject: message.subject ?? "(no subject)",
    from: mapGraphEmailAddress(message.from?.emailAddress),
    receivedDateTime: message.receivedDateTime ?? "",
    bodyPreview: message.bodyPreview ?? "",
    conversationId: message.conversationId ?? "",
    webLink: message.webLink ?? ""
  };
}

function mapGraphMessageDetail(message: MicrosoftGraphMessage) {
  return {
    ...mapGraphMessageSummary(message),
    body: {
      contentType: message.body?.contentType ?? "",
      content: message.body?.content ?? ""
    },
    toRecipients: mapGraphRecipients(message.toRecipients ?? []),
    ccRecipients: mapGraphRecipients(message.ccRecipients ?? [])
  };
}

function mapGraphEvent(event: MicrosoftGraphEvent) {
  return {
    id: event.id ?? "",
    summary: event.subject ?? "(untitled)",
    description: event.bodyPreview ?? "",
    location: event.location?.displayName ?? "",
    start: event.start ?? {},
    end: event.end ?? {},
    attendees:
      event.attendees?.map((attendee) => ({
        email: attendee.emailAddress?.address ?? "",
        displayName: attendee.emailAddress?.name ?? "",
        responseStatus: attendee.status?.response ?? ""
      })) ?? [],
    webLink: event.webLink ?? ""
  };
}

function mapGraphRecipients(
  recipients: Array<{ emailAddress?: MicrosoftGraphEmailAddress | null }>
) {
  return recipients.map((recipient) => mapGraphEmailAddress(recipient.emailAddress));
}

function mapGraphEmailAddress(emailAddress: MicrosoftGraphEmailAddress | null | undefined) {
  return {
    name: emailAddress?.name ?? "",
    address: emailAddress?.address ?? ""
  };
}

function toGraphRecipient(email: string) {
  return {
    emailAddress: {
      address: email
    }
  };
}

function escapeGraphSearch(value: string) {
  return value.replace(/"/g, '\\"');
}
