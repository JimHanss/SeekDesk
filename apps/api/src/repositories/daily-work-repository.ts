import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  dailyActivityEventSchema,
  dailyApprovalRequestSchema,
  dailyContextDocumentSchema,
  dailyContextItemSchema,
  dailyWorkArtifactSchema,
  dailyWorkConnectorSchema,
  dailyWorkSessionDetailSchema,
  dailyWorkSessionSummarySchema,
  dailyWorkTemplateSchema,
  dailyWorkWorkflowSchema,
  defaultDailyActivityEvents,
  defaultDailyContextDocuments,
  defaultDailyWorkApprovalRequests,
  defaultDailyWorkArtifacts,
  defaultDailyWorkConnectors,
  defaultDailyWorkContextItems,
  defaultDailyWorkSessionDetails,
  defaultDailyWorkTemplates,
  defaultDailyWorkflows,
  normalizeRuntimeMode,
  type DailyActivityEvent,
  type DailyApprovalRequest,
  type DailyContextDocument,
  type DailyContextItem,
  type DailyWorkArtifact,
  type DailyWorkConnector,
  type DailyWorkPermissionGrant,
  type DailyWorkSessionDetail,
  type DailyWorkSessionMessage,
  type DailyWorkSessionSummary,
  type DailyWorkTemplate,
  type DailyWorkWorkflow,
  type ToolCallRecord,
  type ToolModelUsageRecord
} from "@seekdesk/shared";
import { PostgresDailyWorkRepository } from "./postgres-daily-work-repository.js";

type JsonCollectionKey =
  | "templates"
  | "context"
  | "contextDocuments"
  | "approvals"
  | "artifacts"
  | "sessions"
  | "events"
  | "connectors"
  | "workflows";

type JsonArrayParser<T> = {
  parse(input: unknown): T[];
};

export type DailyWorkDataLayerStatus = {
  currentLayer: "seed_mock" | "json_local" | "postgres";
  dataDirConfigured: boolean;
  jsonLocalReady: boolean;
  postgresConfigured: boolean;
  postgresReady: boolean;
  futureDatabaseReady: false;
};

export interface PersistedChatMessage {
  id: string;
  sessionId: string;
  appMode?: DailyWorkSessionDetail["appMode"];
  role: DailyWorkSessionMessage["role"];
  content: string;
  createdAt: string;
  artifactIds?: string[];
  contextItemIds?: string[];
  approvalRequestIds?: string[];
  workspaceId?: string;
  workspaceName?: string;
  workspaceRoot?: string;
  workspaceRuntimeMode?: string;
}

export interface DailyWorkPermissionGrantQuery extends DailyWorkTraceQuery {
  provider?: string;
  action?: string;
  activeOnly?: boolean;
}

export interface DailyWorkConnectorAccount {
  id: string;
  provider: string;
  accountEmail?: string;
  encryptedTokens: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
}

const jsonFileNames: Record<JsonCollectionKey, string> = {
  templates: "templates.json",
  context: "context.json",
  contextDocuments: "context-documents.json",
  approvals: "approvals.json",
  artifacts: "artifacts.json",
  sessions: "sessions.json",
  events: "events.json",
  connectors: "connectors.json",
  workflows: "workflows.json"
};

export interface DailyWorkRepository {
  listTemplates(): Promise<DailyWorkTemplate[]>;
  upsertTemplate(template: DailyWorkTemplate): Promise<DailyWorkTemplate>;
  listContextItems(): Promise<DailyContextItem[]>;
  upsertContextItem(item: DailyContextItem): Promise<DailyContextItem>;
  listContextDocuments(): Promise<DailyContextDocument[]>;
  upsertContextDocument(document: DailyContextDocument): Promise<DailyContextDocument>;
  listApprovalRequests(): Promise<DailyApprovalRequest[]>;
  listArtifacts(): Promise<DailyWorkArtifact[]>;
  listSessionSummaries(): Promise<DailyWorkSessionSummary[]>;
  listSessionDetails(): Promise<DailyWorkSessionDetail[]>;
  listEvents(): Promise<DailyActivityEvent[]>;
  listConnectors(): Promise<DailyWorkConnector[]>;
  listWorkflows(): Promise<DailyWorkWorkflow[]>;
  updateApprovalRequest(request: DailyApprovalRequest): Promise<DailyApprovalRequest>;
  updateSessionDetail(session: DailyWorkSessionDetail): Promise<DailyWorkSessionDetail>;
  deleteSessionDetail(sessionId: string): Promise<boolean>;
  upsertActivityEvent(event: DailyActivityEvent): Promise<DailyActivityEvent>;
  upsertArtifact(artifact: DailyWorkArtifact): Promise<DailyWorkArtifact>;
  recordChatMessage(message: PersistedChatMessage): Promise<PersistedChatMessage>;
  recordToolCall(record: ToolCallRecord): Promise<ToolCallRecord>;
  listToolCalls(query?: DailyWorkTraceQuery): Promise<ToolCallRecord[]>;
  recordModelUsage(record: ToolModelUsageRecord): Promise<ToolModelUsageRecord>;
  listModelUsageRecords(
    query?: DailyWorkTraceQuery
  ): Promise<ToolModelUsageRecord[]>;
  upsertPermissionGrant(
    grant: DailyWorkPermissionGrant
  ): Promise<DailyWorkPermissionGrant>;
  listPermissionGrants(
    query?: DailyWorkPermissionGrantQuery
  ): Promise<DailyWorkPermissionGrant[]>;
  getConnectorAccount(provider: string): Promise<DailyWorkConnectorAccount | null>;
  upsertConnectorAccount(
    account: DailyWorkConnectorAccount
  ): Promise<DailyWorkConnectorAccount>;
  getDataLayerStatus(): Promise<DailyWorkDataLayerStatus>;
}

export interface DailyWorkTraceQuery {
  sessionId?: string;
  limit?: number;
}

export class DailyWorkRepositoryDataError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DailyWorkRepositoryDataError";

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class SeedDailyWorkRepository implements DailyWorkRepository {
  private readonly templates = cloneJson(defaultDailyWorkTemplates);
  private readonly contextItems = cloneJson(defaultDailyWorkContextItems);
  private readonly contextDocuments = cloneJson(defaultDailyContextDocuments);
  private readonly approvalRequests = cloneJson(defaultDailyWorkApprovalRequests);
  private readonly artifacts = cloneJson(defaultDailyWorkArtifacts);
  private readonly sessionDetails = cloneJson(defaultDailyWorkSessionDetails);
  private readonly events = cloneJson(defaultDailyActivityEvents);
  private readonly connectors = cloneJson(defaultDailyWorkConnectors);
  private readonly workflows = cloneJson(defaultDailyWorkflows);
  private readonly connectorAccounts = new Map<string, DailyWorkConnectorAccount>();
  private readonly permissionGrants: DailyWorkPermissionGrant[] = [];
  private readonly toolCalls: ToolCallRecord[] = [];
  private readonly modelUsageRecords: ToolModelUsageRecord[] = [];

  async listTemplates() {
    return cloneJson(this.templates);
  }

  async upsertTemplate(template: DailyWorkTemplate) {
    const parsed = dailyWorkTemplateSchema.parse(template);
    replaceById(this.templates, parsed);

    return cloneJson(parsed);
  }

  async listContextItems() {
    return cloneJson(this.contextItems);
  }

  async upsertContextItem(item: DailyContextItem) {
    const parsed = dailyContextItemSchema.parse(item);
    replaceById(this.contextItems, parsed);

    return cloneJson(parsed);
  }

  async listContextDocuments() {
    return cloneJson(this.contextDocuments);
  }

  async upsertContextDocument(document: DailyContextDocument) {
    const parsed = dailyContextDocumentSchema.parse(document);
    replaceById(this.contextDocuments, parsed);

    return cloneJson(parsed);
  }

  async listApprovalRequests() {
    return cloneJson(this.approvalRequests);
  }

  async listArtifacts() {
    return cloneJson(this.artifacts);
  }

  async listSessionSummaries() {
    return dailyWorkSessionSummarySchema.array().parse(
      this.sessionDetails.map(({ recentMessages, ...summary }) => {
        void recentMessages;
        return summary;
      })
    );
  }

  async listSessionDetails() {
    return cloneJson(this.sessionDetails);
  }

  async listEvents() {
    return cloneJson(this.events);
  }

  async listConnectors() {
    return cloneJson(this.connectors);
  }

  async listWorkflows() {
    return cloneJson(this.workflows);
  }

  async updateApprovalRequest(request: DailyApprovalRequest) {
    const parsed = dailyApprovalRequestSchema.parse(request);

    return cloneJson(parsed);
  }

  async updateSessionDetail(session: DailyWorkSessionDetail) {
    const parsed = dailyWorkSessionDetailSchema.parse(session);
    replaceById(this.sessionDetails, parsed);

    return cloneJson(parsed);
  }

  async deleteSessionDetail(sessionId: string) {
    const before = this.sessionDetails.length;
    this.sessionDetails.splice(
      0,
      this.sessionDetails.length,
      ...this.sessionDetails.filter((session) => session.id !== sessionId)
    );

    return this.sessionDetails.length !== before;
  }

  async upsertActivityEvent(event: DailyActivityEvent) {
    const parsed = dailyActivityEventSchema.parse(event);
    upsertFirstById(this.events, parsed);

    return cloneJson(parsed);
  }

  async upsertArtifact(artifact: DailyWorkArtifact) {
    const parsed = dailyWorkArtifactSchema.parse(artifact);
    replaceById(this.artifacts, parsed);

    return cloneJson(parsed);
  }

  async recordChatMessage(message: PersistedChatMessage) {
    mergeChatMessageIntoSessions(this.sessionDetails, message);

    return cloneJson(message);
  }

  async recordToolCall(record: ToolCallRecord) {
    upsertFirstById(this.toolCalls, record);

    return cloneJson(record);
  }

  async listToolCalls(query: DailyWorkTraceQuery = {}) {
    return cloneJson(filterTraceRecords(this.toolCalls, query));
  }

  async recordModelUsage(record: ToolModelUsageRecord) {
    upsertFirstById(this.modelUsageRecords, record);

    return cloneJson(record);
  }

  async listModelUsageRecords(query: DailyWorkTraceQuery = {}) {
    return cloneJson(filterTraceRecords(this.modelUsageRecords, query));
  }

  async upsertPermissionGrant(grant: DailyWorkPermissionGrant) {
    upsertFirstById(this.permissionGrants, grant);

    return cloneJson(grant);
  }

  async listPermissionGrants(query: DailyWorkPermissionGrantQuery = {}) {
    return cloneJson(filterPermissionGrants(this.permissionGrants, query));
  }

  async getConnectorAccount(provider: string) {
    const account = this.connectorAccounts.get(provider);

    return account ? cloneJson(account) : null;
  }

  async upsertConnectorAccount(account: DailyWorkConnectorAccount) {
    this.connectorAccounts.set(account.provider, cloneJson(account));

    return cloneJson(account);
  }

  async getDataLayerStatus(): Promise<DailyWorkDataLayerStatus> {
    return {
      currentLayer: "seed_mock",
      dataDirConfigured: false,
      jsonLocalReady: false,
      postgresConfigured: false,
      postgresReady: false,
      futureDatabaseReady: false
    };
  }
}

export class JsonDailyWorkRepository implements DailyWorkRepository {
  private readonly permissionGrants: DailyWorkPermissionGrant[] = [];
  private readonly toolCalls: ToolCallRecord[] = [];
  private readonly modelUsageRecords: ToolModelUsageRecord[] = [];

  constructor(
    private readonly dataDir: string,
    private readonly seedRepository: DailyWorkRepository = new SeedDailyWorkRepository()
  ) {}

  async listTemplates() {
    return this.readCollection(
      "templates",
      dailyWorkTemplateSchema.array(),
      () => this.seedRepository.listTemplates()
    );
  }

  async upsertTemplate(template: DailyWorkTemplate) {
    const parsed = dailyWorkTemplateSchema.parse(template);
    const templates = await this.listTemplates();
    replaceById(templates, parsed);
    await this.writeCollection("templates", dailyWorkTemplateSchema.array(), templates);

    return cloneJson(parsed);
  }

  async listContextItems() {
    return this.readCollection(
      "context",
      dailyContextItemSchema.array(),
      () => this.seedRepository.listContextItems()
    );
  }

  async upsertContextItem(item: DailyContextItem) {
    const parsed = dailyContextItemSchema.parse(item);
    const contextItems = await this.listContextItems();
    replaceById(contextItems, parsed);
    await this.writeCollection("context", dailyContextItemSchema.array(), contextItems);

    return cloneJson(parsed);
  }

  async listContextDocuments() {
    return this.readCollection(
      "contextDocuments",
      dailyContextDocumentSchema.array(),
      () => this.seedRepository.listContextDocuments()
    );
  }

  async upsertContextDocument(document: DailyContextDocument) {
    const parsed = dailyContextDocumentSchema.parse(document);
    const documents = await this.listContextDocuments();
    replaceById(documents, parsed);
    await this.writeCollection(
      "contextDocuments",
      dailyContextDocumentSchema.array(),
      documents
    );

    return cloneJson(parsed);
  }

  async listApprovalRequests() {
    return this.readCollection(
      "approvals",
      dailyApprovalRequestSchema.array(),
      () => this.seedRepository.listApprovalRequests()
    );
  }

  async listArtifacts() {
    return this.readCollection(
      "artifacts",
      dailyWorkArtifactSchema.array(),
      () => this.seedRepository.listArtifacts()
    );
  }

  async listSessionSummaries() {
    const details = await this.listSessionDetails();

    return dailyWorkSessionSummarySchema.array().parse(
      details.map(({ recentMessages, ...summary }) => {
        void recentMessages;
        return summary;
      })
    );
  }

  async listSessionDetails() {
    return this.readCollection(
      "sessions",
      dailyWorkSessionDetailSchema.array(),
      () => this.seedRepository.listSessionDetails()
    );
  }

  async listEvents() {
    return this.readCollection(
      "events",
      dailyActivityEventSchema.array(),
      () => this.seedRepository.listEvents()
    );
  }

  async listConnectors() {
    return this.readCollection(
      "connectors",
      dailyWorkConnectorSchema.array(),
      () => this.seedRepository.listConnectors()
    );
  }

  async listWorkflows() {
    return this.readCollection(
      "workflows",
      dailyWorkWorkflowSchema.array(),
      () => this.seedRepository.listWorkflows()
    );
  }

  async updateApprovalRequest(request: DailyApprovalRequest) {
    const parsed = dailyApprovalRequestSchema.parse(request);
    const approvalRequests = await this.listApprovalRequests();
    replaceById(approvalRequests, parsed);
    await this.writeCollection(
      "approvals",
      dailyApprovalRequestSchema.array(),
      approvalRequests
    );

    return cloneJson(parsed);
  }

  async updateSessionDetail(session: DailyWorkSessionDetail) {
    const parsed = dailyWorkSessionDetailSchema.parse(session);
    const sessionDetails = await this.listSessionDetails();
    replaceById(sessionDetails, parsed);
    await this.writeCollection(
      "sessions",
      dailyWorkSessionDetailSchema.array(),
      sessionDetails
    );

    return cloneJson(parsed);
  }

  async deleteSessionDetail(sessionId: string) {
    const sessionDetails = await this.listSessionDetails();
    const nextSessionDetails = sessionDetails.filter(
      (session) => session.id !== sessionId
    );

    if (nextSessionDetails.length === sessionDetails.length) {
      return false;
    }

    await this.writeCollection(
      "sessions",
      dailyWorkSessionDetailSchema.array(),
      nextSessionDetails
    );

    return true;
  }

  async upsertActivityEvent(event: DailyActivityEvent) {
    const parsed = dailyActivityEventSchema.parse(event);
    const events = await this.listEvents();
    upsertFirstById(events, parsed);
    await this.writeCollection("events", dailyActivityEventSchema.array(), events);

    return cloneJson(parsed);
  }

  async upsertArtifact(artifact: DailyWorkArtifact) {
    const parsed = dailyWorkArtifactSchema.parse(artifact);
    const artifacts = await this.listArtifacts();
    replaceById(artifacts, parsed);
    await this.writeCollection(
      "artifacts",
      dailyWorkArtifactSchema.array(),
      artifacts
    );

    return cloneJson(parsed);
  }

  async recordChatMessage(message: PersistedChatMessage) {
    const sessions = await this.listSessionDetails();
    mergeChatMessageIntoSessions(sessions, message);
    await this.writeCollection(
      "sessions",
      dailyWorkSessionDetailSchema.array(),
      sessions
    );

    return cloneJson(message);
  }

  async recordToolCall(record: ToolCallRecord) {
    upsertFirstById(this.toolCalls, record);

    return cloneJson(record);
  }

  async listToolCalls(query: DailyWorkTraceQuery = {}) {
    return cloneJson(filterTraceRecords(this.toolCalls, query));
  }

  async recordModelUsage(record: ToolModelUsageRecord) {
    upsertFirstById(this.modelUsageRecords, record);

    return cloneJson(record);
  }

  async listModelUsageRecords(query: DailyWorkTraceQuery = {}) {
    return cloneJson(filterTraceRecords(this.modelUsageRecords, query));
  }

  async upsertPermissionGrant(grant: DailyWorkPermissionGrant) {
    upsertFirstById(this.permissionGrants, grant);

    return cloneJson(grant);
  }

  async listPermissionGrants(query: DailyWorkPermissionGrantQuery = {}) {
    return cloneJson(filterPermissionGrants(this.permissionGrants, query));
  }

  async getConnectorAccount(_provider: string) {
    void _provider;
    return null;
  }

  async upsertConnectorAccount(account: DailyWorkConnectorAccount) {
    return cloneJson(account);
  }

  async getDataLayerStatus(): Promise<DailyWorkDataLayerStatus> {
    let jsonLocalReady = true;

    try {
      await mkdir(this.dataDir, { recursive: true });
    } catch {
      jsonLocalReady = false;
    }

    return {
      currentLayer: "json_local",
      dataDirConfigured: true,
      jsonLocalReady,
      postgresConfigured: false,
      postgresReady: false,
      futureDatabaseReady: false
    };
  }

  private async readCollection<T>(
    key: JsonCollectionKey,
    parser: JsonArrayParser<T>,
    fallback: () => Promise<T[]>
  ): Promise<T[]> {
    const filePath = join(this.dataDir, jsonFileNames[key]);
    let rawJson: string;

    try {
      rawJson = await readFile(filePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        const seedValues = await fallback();
        await this.writeCollection(key, parser, seedValues);

        return seedValues;
      }

      throw error;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawJson) as unknown;
    } catch (error) {
      throw createInvalidJsonFileError(key, filePath, error);
    }

    const collection = unwrapJsonCollection(parsed, key);

    try {
      return parser.parse(collection);
    } catch (error) {
      throw createInvalidSchemaFileError(key, filePath, error);
    }
  }

  private async writeCollection<T>(
    key: JsonCollectionKey,
    parser: JsonArrayParser<T>,
    values: T[]
  ) {
    const parsed = parser.parse(values);
    const filePath = join(this.dataDir, jsonFileNames[key]);

    await mkdir(this.dataDir, { recursive: true });
    await writeFile(
      filePath,
      `${JSON.stringify({ [key]: parsed }, null, 2)}\n`,
      "utf8"
    );
  }
}

export function createDailyWorkRepositoryFromEnv(
  env: NodeJS.ProcessEnv = process.env
): DailyWorkRepository {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return new PostgresDailyWorkRepository(databaseUrl);
  }

  const dataDir = env.SEEKDESK_DATA_DIR?.trim();

  if (!dataDir) {
    return new SeedDailyWorkRepository();
  }

  return new JsonDailyWorkRepository(dataDir);
}

function unwrapJsonCollection(input: unknown, key: JsonCollectionKey): unknown {
  if (Array.isArray(input)) {
    return input;
  }

  if (input && typeof input === "object" && key in input) {
    return (input as Record<JsonCollectionKey, unknown>)[key];
  }

  return input;
}

function createInvalidJsonFileError(
  key: JsonCollectionKey,
  filePath: string,
  cause: unknown
) {
  return new DailyWorkRepositoryDataError(
    `Invalid daily-work JSON data file for collection "${key}" at ${filePath}: ${formatErrorMessage(cause)}`,
    cause
  );
}

function createInvalidSchemaFileError(
  key: JsonCollectionKey,
  filePath: string,
  cause: unknown
) {
  return new DailyWorkRepositoryDataError(
    `Invalid daily-work JSON schema for collection "${key}" at ${filePath}: ${formatSchemaError(cause)}`,
    cause
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function formatSchemaError(error: unknown): string {
  if (hasSchemaIssues(error)) {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";

        return `${path}: ${issue.message}`;
      })
      .join("; ");
  }

  return formatErrorMessage(error);
}

function hasSchemaIssues(error: unknown): error is {
  issues: Array<{ path: Array<string | number>; message: string }>;
} {
  if (!error || typeof error !== "object" || !("issues" in error)) {
    return false;
  }

  const issues = (error as { issues: unknown }).issues;

  return Array.isArray(issues);
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function replaceById<T extends { id: string }>(items: T[], nextItem: T) {
  const index = items.findIndex((item) => item.id === nextItem.id);

  if (index === -1) {
    items.push(nextItem);
    return;
  }

  items[index] = nextItem;
}

function upsertFirstById<T extends { id: string }>(items: T[], nextItem: T) {
  const filtered = items.filter((item) => item.id !== nextItem.id);
  items.length = 0;
  items.push(nextItem, ...filtered);
}

function mergeChatMessageIntoSessions(
  sessions: DailyWorkSessionDetail[],
  message: PersistedChatMessage
) {
  const parsedMessage: DailyWorkSessionMessage = {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    artifactIds: message.artifactIds ?? [],
    contextItemIds: message.contextItemIds ?? [],
    approvalRequestIds: message.approvalRequestIds ?? []
  };
  const existing = sessions.find((session) => session.id === message.sessionId);

  if (!existing) {
    sessions.unshift({
      id: message.sessionId,
      workspaceId: message.workspaceId ?? "workspace-seekdesk",
      ...(message.workspaceName ? { workspaceName: message.workspaceName } : {}),
      ...(message.workspaceRoot ? { workspaceRoot: message.workspaceRoot } : {}),
      ...(message.workspaceRuntimeMode ? { workspaceRuntimeMode: normalizeRuntimeMode(message.workspaceRuntimeMode) } : {}),
      appMode: message.appMode ?? "daily_work",
      title: createSessionTitle(parsedMessage.content),
      pinned: false,
      status: "active",
      createdAt: message.createdAt,
      updatedAt: message.createdAt,
      summary:
        (message.appMode ?? "daily_work") === "coding_agent"
          ? "AI coding-agent chat session."
          : "AI daily-work chat session.",
      lastAction: {
        at: message.createdAt,
        actor: message.role === "assistant" ? "daily-work-agent" : "user",
        label: message.role === "assistant" ? "Assistant response recorded." : "User prompt recorded."
      },
      artifactIds: parsedMessage.artifactIds,
      contextItemIds: parsedMessage.contextItemIds,
      approvalRequestIds: parsedMessage.approvalRequestIds,
      messageCount: 1,
      tags:
        (message.appMode ?? "daily_work") === "coding_agent"
          ? ["chat", "coding-agent"]
          : ["chat", "daily-work"],
      recentMessages: [parsedMessage]
    });
    return;
  }

  if (message.workspaceName && !existing.workspaceName) {
    existing.workspaceName = message.workspaceName;
  }
  if (message.workspaceRoot && !existing.workspaceRoot) {
    existing.workspaceRoot = message.workspaceRoot;
  }
  if (message.workspaceRuntimeMode && !existing.workspaceRuntimeMode) {
    existing.workspaceRuntimeMode = normalizeRuntimeMode(message.workspaceRuntimeMode);
  }
  existing.recentMessages = [...existing.recentMessages, parsedMessage].slice(-20);
  existing.messageCount = Math.max(
    existing.messageCount + 1,
    existing.recentMessages.length
  );
  existing.updatedAt = message.createdAt;
  existing.lastAction = {
    at: message.createdAt,
    actor: message.role === "assistant" ? "daily-work-agent" : "user",
    label: message.role === "assistant" ? "Assistant response recorded." : "User prompt recorded."
  };
  existing.artifactIds = uniqueStrings([
    ...existing.artifactIds,
    ...parsedMessage.artifactIds
  ]);
  existing.contextItemIds = uniqueStrings([
    ...existing.contextItemIds,
    ...parsedMessage.contextItemIds
  ]);
  existing.approvalRequestIds = uniqueStrings([
    ...existing.approvalRequestIds,
    ...parsedMessage.approvalRequestIds
  ]);
}

function createSessionTitle(content: string) {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "Daily-work chat";
  }

  return trimmed.length > 64 ? `${trimmed.slice(0, 61)}...` : trimmed;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function filterPermissionGrants(
  grants: DailyWorkPermissionGrant[],
  query: DailyWorkPermissionGrantQuery
) {
  const now = Date.now();

  return grants
    .filter((grant) => !query.sessionId || grant.sessionId === query.sessionId)
    .filter((grant) => !query.provider || grant.provider === query.provider)
    .filter((grant) => !query.action || grant.action === query.action)
    .filter(
      (grant) =>
        !query.activeOnly ||
        (grant.status === "active" && new Date(grant.expiresAt).getTime() > now)
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, normalizeTraceLimit(query.limit));
}

function filterTraceRecords<T extends { createdAt: string }>(
  records: T[],
  query: DailyWorkTraceQuery
): T[] {
  const limit = normalizeTraceLimit(query.limit);

  return records
    .filter(
      (record) => !query.sessionId || getTraceSessionId(record) === query.sessionId
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
}

function getTraceSessionId(record: unknown) {
  if (record && typeof record === "object" && "sessionId" in record) {
    const value = (record as { sessionId?: unknown }).sessionId;

    return typeof value === "string" ? value : undefined;
  }

  return undefined;
}

function normalizeTraceLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(limit ?? 50), 1), 200);
}
