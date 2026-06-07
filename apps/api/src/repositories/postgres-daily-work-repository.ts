import { desc, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  dailyActivityEventSchema,
  dailyApprovalRequestSchema,
  dailyContextItemSchema,
  dailyWorkArtifactSchema,
  dailyWorkConnectorSchema,
  dailyWorkSessionDetailSchema,
  dailyWorkSessionMessageSchema,
  dailyWorkSessionSummarySchema,
  dailyWorkTemplateSchema,
  dailyWorkWorkflowSchema,
  defaultDailyActivityEvents,
  defaultDailyWorkApprovalRequests,
  defaultDailyWorkArtifacts,
  defaultDailyWorkConnectors,
  defaultDailyWorkContextItems,
  defaultDailyWorkSessionDetails,
  defaultDailyWorkTemplates,
  defaultDailyWorkflows,
  toolCallRecordSchema,
  toolModelUsageRecordSchema,
  type DailyActivityEvent,
  type DailyApprovalRequest,
  type DailyWorkArtifact,
  type DailyWorkSessionDetail,
  type DailyWorkSessionMessage,
  type ToolCallRecord,
  type ToolModelUsageRecord
} from "@seekdesk/shared";

import * as schema from "../db/schema.js";
import type {
  DailyWorkConnectorAccount,
  DailyWorkDataLayerStatus,
  DailyWorkRepository,
  PersistedChatMessage
} from "./daily-work-repository.js";

type PayloadTable =
  | typeof schema.dailyWorkTemplates
  | typeof schema.dailyWorkContextItems
  | typeof schema.dailyWorkApprovals
  | typeof schema.dailyWorkArtifacts
  | typeof schema.dailyWorkSessions
  | typeof schema.dailyWorkActivityEvents
  | typeof schema.dailyWorkConnectors
  | typeof schema.dailyWorkWorkflows;

type ArrayParser<T> = {
  parse(input: unknown): T[];
};

export class PostgresDailyWorkRepository implements DailyWorkRepository {
  private readonly pool: Pool;
  private readonly db: NodePgDatabase<typeof schema>;

  constructor(private readonly databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl
    });
    this.db = drizzle(this.pool, { schema });
  }

  async listTemplates() {
    return this.listPayloadCollection(
      schema.dailyWorkTemplates,
      dailyWorkTemplateSchema.array(),
      async () => cloneJson(defaultDailyWorkTemplates)
    );
  }

  async listContextItems() {
    return this.listPayloadCollection(
      schema.dailyWorkContextItems,
      dailyContextItemSchema.array(),
      async () => cloneJson(defaultDailyWorkContextItems)
    );
  }

  async listApprovalRequests() {
    return this.listPayloadCollection(
      schema.dailyWorkApprovals,
      dailyApprovalRequestSchema.array(),
      async () => cloneJson(defaultDailyWorkApprovalRequests)
    );
  }

  async listArtifacts() {
    return this.listPayloadCollection(
      schema.dailyWorkArtifacts,
      dailyWorkArtifactSchema.array(),
      async () => cloneJson(defaultDailyWorkArtifacts)
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
    return this.listPayloadCollection(
      schema.dailyWorkSessions,
      dailyWorkSessionDetailSchema.array(),
      async () => cloneJson(defaultDailyWorkSessionDetails)
    );
  }

  async listEvents() {
    return this.listPayloadCollection(
      schema.dailyWorkActivityEvents,
      dailyActivityEventSchema.array(),
      async () => cloneJson(defaultDailyActivityEvents)
    );
  }

  async listConnectors() {
    const connectors = await this.listPayloadCollection(
      schema.dailyWorkConnectors,
      dailyWorkConnectorSchema.array(),
      async () => cloneJson(defaultDailyWorkConnectors)
    );
    const googleAccount = await this.getConnectorAccount("google");

    if (!googleAccount) {
      return connectors;
    }

    return connectors.map((connector) => {
      if (connector.provider !== "gmail" && connector.provider !== "google_calendar") {
        return connector;
      }

      return {
        ...connector,
        status: "available" as const,
        lastSyncAt: googleAccount.updatedAt,
        notes: [
          `Google account connected: ${googleAccount.accountEmail ?? "unknown account"}.`,
          "Real reads are enabled for approved preview-only daily_work tools; sending email and creating calendar events remain disabled."
        ]
      };
    });
  }

  async listWorkflows() {
    return this.listPayloadCollection(
      schema.dailyWorkWorkflows,
      dailyWorkWorkflowSchema.array(),
      async () => cloneJson(defaultDailyWorkflows)
    );
  }

  async updateApprovalRequest(request: DailyApprovalRequest) {
    const parsed = dailyApprovalRequestSchema.parse(request);
    await this.upsertPayload(schema.dailyWorkApprovals, parsed.id, parsed);

    return cloneJson(parsed);
  }

  async updateSessionDetail(session: DailyWorkSessionDetail) {
    const parsed = dailyWorkSessionDetailSchema.parse(session);
    await this.upsertPayload(schema.dailyWorkSessions, parsed.id, parsed);

    return cloneJson(parsed);
  }

  async upsertActivityEvent(event: DailyActivityEvent) {
    const parsed = dailyActivityEventSchema.parse(event);
    await this.upsertPayload(schema.dailyWorkActivityEvents, parsed.id, parsed);

    return cloneJson(parsed);
  }

  async upsertArtifact(artifact: DailyWorkArtifact) {
    const parsed = dailyWorkArtifactSchema.parse(artifact);
    await this.upsertPayload(schema.dailyWorkArtifacts, parsed.id, parsed);

    return cloneJson(parsed);
  }

  async recordChatMessage(message: PersistedChatMessage) {
    const parsedMessage = parsePersistedChatMessage(message);

    await this.db
      .insert(schema.dailyWorkMessages)
      .values({
        id: parsedMessage.id,
        sessionId: parsedMessage.sessionId,
        role: parsedMessage.role,
        content: parsedMessage.content,
        payload: parsedMessage,
        createdAt: new Date(parsedMessage.createdAt)
      })
      .onConflictDoUpdate({
        target: schema.dailyWorkMessages.id,
        set: {
          sessionId: parsedMessage.sessionId,
          role: parsedMessage.role,
          content: parsedMessage.content,
          payload: parsedMessage,
          createdAt: new Date(parsedMessage.createdAt)
        }
      });

    const sessions = await this.listSessionDetails();
    mergeChatMessageIntoSessions(sessions, parsedMessage);
    const session = sessions.find((item) => item.id === parsedMessage.sessionId);
    if (session) {
      await this.updateSessionDetail(session);
    }

    return cloneJson(parsedMessage);
  }

  async recordToolCall(record: ToolCallRecord) {
    const parsed = toolCallRecordSchema.parse(record);

    await this.db
      .insert(schema.toolCalls)
      .values({
        id: parsed.id,
        sessionId: parsed.sessionId ?? null,
        mode: "daily_work",
        name: parsed.name,
        status: parsed.status,
        inputJson: parsed.inputJson,
        outputJson: parsed.outputJson ?? null,
        previewOnly: parsed.previewOnly,
        permissionRequired: parsed.permissionRequired,
        error: parsed.error ?? null,
        createdAt: new Date(parsed.createdAt),
        completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null
      })
      .onConflictDoUpdate({
        target: schema.toolCalls.id,
        set: {
          sessionId: parsed.sessionId ?? null,
          status: parsed.status,
          outputJson: parsed.outputJson ?? null,
          previewOnly: parsed.previewOnly,
          permissionRequired: parsed.permissionRequired,
          error: parsed.error ?? null,
          completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null
        }
      });

    return cloneJson(parsed);
  }

  async recordModelUsage(record: ToolModelUsageRecord) {
    const parsed = toolModelUsageRecordSchema.parse(record);

    await this.db
      .insert(schema.modelUsageRecords)
      .values({
        id: parsed.id,
        sessionId: parsed.sessionId ?? null,
        provider: parsed.provider,
        model: parsed.model,
        promptTokens: parsed.promptTokens,
        completionTokens: parsed.completionTokens,
        totalTokens: parsed.totalTokens,
        createdAt: new Date(parsed.createdAt)
      })
      .onConflictDoUpdate({
        target: schema.modelUsageRecords.id,
        set: {
          sessionId: parsed.sessionId ?? null,
          provider: parsed.provider,
          model: parsed.model,
          promptTokens: parsed.promptTokens,
          completionTokens: parsed.completionTokens,
          totalTokens: parsed.totalTokens
        }
      });

    return cloneJson(parsed);
  }

  async getConnectorAccount(provider: string) {
    const [row] = await this.db
      .select()
      .from(schema.connectorAccounts)
      .where(eq(schema.connectorAccounts.provider, provider))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      provider: row.provider,
      ...(row.accountEmail ? { accountEmail: row.accountEmail } : {}),
      encryptedTokens: row.encryptedTokens,
      scopes: parseStringArray(row.scopes),
      connectedAt: row.connectedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async upsertConnectorAccount(account: DailyWorkConnectorAccount) {
    const parsed = parseConnectorAccount(account);

    await this.db
      .insert(schema.connectorAccounts)
      .values({
        id: parsed.id,
        provider: parsed.provider,
        accountEmail: parsed.accountEmail ?? null,
        encryptedTokens: parsed.encryptedTokens,
        scopes: parsed.scopes,
        connectedAt: new Date(parsed.connectedAt),
        updatedAt: new Date(parsed.updatedAt)
      })
      .onConflictDoUpdate({
        target: schema.connectorAccounts.id,
        set: {
          accountEmail: parsed.accountEmail ?? null,
          encryptedTokens: parsed.encryptedTokens,
          scopes: parsed.scopes,
          updatedAt: new Date(parsed.updatedAt)
        }
      });

    return cloneJson(parsed);
  }

  async getDataLayerStatus(): Promise<DailyWorkDataLayerStatus> {
    let postgresReady = true;

    try {
      await this.pool.query("select 1");
    } catch {
      postgresReady = false;
    }

    return {
      currentLayer: "postgres",
      dataDirConfigured: false,
      jsonLocalReady: false,
      postgresConfigured: true,
      postgresReady,
      futureDatabaseReady: false
    };
  }

  async close() {
    await this.pool.end();
  }

  private async listPayloadCollection<T extends { id: string }>(
    table: PayloadTable,
    parser: ArrayParser<T>,
    seed: () => Promise<T[]>
  ): Promise<T[]> {
    const rows = await this.db
      .select({
        payload: table.payload
      })
      .from(table)
      .orderBy(desc(table.updatedAt));

    if (rows.length === 0) {
      const seedValues = await seed();
      await this.upsertPayloadCollection(table, seedValues);

      return seedValues;
    }

    try {
      return parser.parse(rows.map((row) => row.payload));
    } catch (error) {
      throw new PostgresDailyWorkRepositoryDataError(
        `Invalid Postgres daily-work payload: ${formatSchemaError(error)}`,
        error
      );
    }
  }

  private async upsertPayloadCollection<T extends { id: string }>(
    table: PayloadTable,
    values: T[]
  ) {
    for (const value of values) {
      await this.upsertPayload(table, value.id, value);
    }
  }

  private async upsertPayload<T>(
    table: PayloadTable,
    id: string,
    payload: T
  ) {
    await this.db
      .insert(table)
      .values({
        id,
        mode: "daily_work",
        payload,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: table.id,
        set: {
          payload,
          updatedAt: new Date()
        }
      });
  }
}

function parsePersistedChatMessage(
  message: PersistedChatMessage
): PersistedChatMessage {
  const parsedMessage: DailyWorkSessionMessage = {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    artifactIds: message.artifactIds ?? [],
    contextItemIds: message.contextItemIds ?? [],
    approvalRequestIds: message.approvalRequestIds ?? []
  };

  dailyWorkSessionMessageSchema.parse(parsedMessage);

  return {
    ...message,
    artifactIds: parsedMessage.artifactIds,
    contextItemIds: parsedMessage.contextItemIds,
    approvalRequestIds: parsedMessage.approvalRequestIds
  };
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
      workspaceId: "workspace-seekdesk",
      appMode: "daily_work",
      title: createSessionTitle(parsedMessage.content),
      status: "active",
      createdAt: message.createdAt,
      updatedAt: message.createdAt,
      summary: "AI daily-work chat session.",
      lastAction: {
        at: message.createdAt,
        actor: message.role === "assistant" ? "daily-work-agent" : "user",
        label:
          message.role === "assistant"
            ? "Assistant response recorded."
            : "User prompt recorded."
      },
      artifactIds: parsedMessage.artifactIds,
      contextItemIds: parsedMessage.contextItemIds,
      approvalRequestIds: parsedMessage.approvalRequestIds,
      messageCount: 1,
      tags: ["chat", "daily-work"],
      recentMessages: [parsedMessage]
    });
    return;
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
    label:
      message.role === "assistant"
        ? "Assistant response recorded."
        : "User prompt recorded."
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

function parseConnectorAccount(
  account: DailyWorkConnectorAccount
): DailyWorkConnectorAccount {
  if (!account.id.trim() || !account.provider.trim()) {
    throw new PostgresDailyWorkRepositoryDataError(
      "Connector account id and provider are required."
    );
  }

  return {
    ...account,
    scopes: parseStringArray(account.scopes)
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
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

  return error instanceof Error ? error.message : String(error);
}

function hasSchemaIssues(error: unknown): error is {
  issues: Array<{ path: Array<string | number>; message: string }>;
} {
  if (!error || typeof error !== "object" || !("issues" in error)) {
    return false;
  }

  return Array.isArray((error as { issues: unknown }).issues);
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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class PostgresDailyWorkRepositoryDataError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PostgresDailyWorkRepositoryDataError";

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
