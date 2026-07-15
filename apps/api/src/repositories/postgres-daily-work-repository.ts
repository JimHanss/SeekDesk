import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  dailyActivityEventSchema,
  dailyApprovalRequestSchema,
  dailyContextDocumentSchema,
  dailyContextItemSchema,
  dailyWorkArtifactSchema,
  dailyWorkConnectorSchema,
  dailyWorkSessionDetailSchema,
  dailyWorkSessionMessageSchema,
  dailyWorkSessionSummarySchema,
  dailyWorkTemplateSchema,
  dailyWorkWorkflowSchema,
  dailyWorkPermissionGrantSchema,
  codingWorkspaceRecordSchema,
  runtimeOperationSchema,
  toolCallRecordSchema,
  toolModelUsageRecordSchema,
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
  type DailyWorkPermissionGrant,
  type DailyWorkSessionDetail,
  type DailyWorkTemplate,
  type DailyWorkSessionMessage,
  type CodingWorkspaceRecord,
  type RuntimeOperation,
  type ToolCallRecord,
  type ToolModelUsageRecord
} from "@seekdesk/shared";

import * as schema from "../db/schema.js";
import type {
  DailyWorkConnectorAccount,
  CodingScopeQuery,
  CodingWorkspaceQuery,
  DailyWorkDataLayerStatus,
  DailyWorkPermissionGrantQuery,
  DailyWorkTraceQuery,
  DailyWorkRepository,
  PersistedChatMessage,
  RepositoryCredentialMetadata,
  RepositoryCredentialRecord,
  RuntimeOperationQuery
} from "./daily-work-repository.js";
import { DailyWorkRepositoryAccessError } from "./repository-errors.js";

type PayloadTable =
  | typeof schema.dailyWorkTemplates
  | typeof schema.dailyWorkContextItems
  | typeof schema.dailyWorkContextDocuments
  | typeof schema.dailyWorkApprovals
  | typeof schema.dailyWorkConnectors
  | typeof schema.dailyWorkWorkflows;

type ScopedPayloadTable =
  | typeof schema.dailyWorkArtifacts
  | typeof schema.dailyWorkSessions
  | typeof schema.dailyWorkActivityEvents;

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

  async upsertTemplate(template: DailyWorkTemplate) {
    const parsed = dailyWorkTemplateSchema.parse(template);
    await this.upsertPayload(schema.dailyWorkTemplates, parsed.id, parsed);

    return cloneJson(parsed);
  }

  async listContextItems() {
    return this.listPayloadCollection(
      schema.dailyWorkContextItems,
      dailyContextItemSchema.array(),
      async () => cloneJson(defaultDailyWorkContextItems)
    );
  }

  async upsertContextItem(item: DailyContextItem) {
    const parsed = dailyContextItemSchema.parse(item);
    await this.upsertPayload(schema.dailyWorkContextItems, parsed.id, parsed);

    return cloneJson(parsed);
  }

  async listContextDocuments() {
    return this.listPayloadCollection(
      schema.dailyWorkContextDocuments,
      dailyContextDocumentSchema.array(),
      async () => cloneJson(defaultDailyContextDocuments)
    );
  }

  async upsertContextDocument(document: DailyContextDocument) {
    const parsed = dailyContextDocumentSchema.parse(document);
    await this.upsertPayload(schema.dailyWorkContextDocuments, parsed.id, parsed);

    return cloneJson(parsed);
  }

  async listApprovalRequests() {
    return this.listPayloadCollection(
      schema.dailyWorkApprovals,
      dailyApprovalRequestSchema.array(),
      async () => cloneJson(defaultDailyWorkApprovalRequests)
    );
  }

  async listArtifacts(query: CodingScopeQuery = {}) {
    return this.listScopedPayloadCollection(
      schema.dailyWorkArtifacts,
      dailyWorkArtifactSchema.array(),
      async () => cloneJson(defaultDailyWorkArtifacts),
      query
    );
  }

  async listSessionSummaries(query: CodingScopeQuery = {}) {
    const details = await this.listSessionDetails(query);

    return dailyWorkSessionSummarySchema.array().parse(
      details.map(({ recentMessages, ...summary }) => {
        void recentMessages;
        return summary;
      })
    );
  }

  async listSessionDetails(query: CodingScopeQuery = {}) {
    return this.listScopedPayloadCollection(
      schema.dailyWorkSessions,
      dailyWorkSessionDetailSchema.array(),
      async () => cloneJson(defaultDailyWorkSessionDetails),
      query
    );
  }

  async listEvents(query: CodingScopeQuery = {}) {
    return this.listScopedPayloadCollection(
      schema.dailyWorkActivityEvents,
      dailyActivityEventSchema.array(),
      async () => cloneJson(defaultDailyActivityEvents),
      query
    );
  }

  async listConnectors() {
    const connectors = await this.listPayloadCollection(
      schema.dailyWorkConnectors,
      dailyWorkConnectorSchema.array(),
      async () => cloneJson(defaultDailyWorkConnectors)
    );
    return connectors;
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
    await this.upsertScopedPayload(
      schema.dailyWorkSessions,
      parsed.id,
      parsed,
      scopeFromSession(parsed)
    );

    return cloneJson(parsed);
  }

  async deleteSessionDetail(sessionId: string) {
    const result = await this.db
      .delete(schema.dailyWorkSessions)
      .where(eq(schema.dailyWorkSessions.id, sessionId));

    return (result.rowCount ?? 0) > 0;
  }

  async upsertActivityEvent(event: DailyActivityEvent, scope: CodingScopeQuery = {}) {
    const parsed = dailyActivityEventSchema.parse(event);
    await this.upsertScopedPayload(schema.dailyWorkActivityEvents, parsed.id, parsed, scope);

    return cloneJson(parsed);
  }

  async upsertArtifact(artifact: DailyWorkArtifact, scope: CodingScopeQuery = {}) {
    const parsed = dailyWorkArtifactSchema.parse(artifact);
    await this.upsertScopedPayload(schema.dailyWorkArtifacts, parsed.id, parsed, scope);

    return cloneJson(parsed);
  }

  async recordChatMessage(message: PersistedChatMessage) {
    const parsedMessage = parsePersistedChatMessage(message);

    await this.db
      .insert(schema.dailyWorkMessages)
      .values({
        id: parsedMessage.id,
        ownerId: parsedMessage.ownerId ?? fallbackOwnerId,
        sessionId: parsedMessage.sessionId,
        workspaceId: parsedMessage.workspaceId ?? fallbackWorkspaceId,
        runtimeMode: normalizeRuntimeMode(
          parsedMessage.workspaceRuntimeMode ?? fallbackRuntimeMode
        ),
        role: parsedMessage.role,
        content: parsedMessage.content,
        payload: parsedMessage,
        createdAt: new Date(parsedMessage.createdAt)
      })
      .onConflictDoUpdate({
        target: schema.dailyWorkMessages.id,
        set: {
          sessionId: parsedMessage.sessionId,
          ownerId: parsedMessage.ownerId ?? fallbackOwnerId,
          workspaceId: parsedMessage.workspaceId ?? fallbackWorkspaceId,
          runtimeMode: normalizeRuntimeMode(
            parsedMessage.workspaceRuntimeMode ?? fallbackRuntimeMode
          ),
          role: parsedMessage.role,
          content: parsedMessage.content,
          payload: parsedMessage,
          createdAt: new Date(parsedMessage.createdAt)
        }
      });

    const messageScope: CodingScopeQuery = {
      ownerId: parsedMessage.ownerId ?? fallbackOwnerId,
      workspaceId: parsedMessage.workspaceId ?? fallbackWorkspaceId,
      runtimeMode: normalizeRuntimeMode(
        parsedMessage.workspaceRuntimeMode ?? fallbackRuntimeMode
      )
    };
    const sessions = await this.listSessionDetails(messageScope);
    mergeChatMessageIntoSessions(sessions, parsedMessage);
    const session = sessions.find((item) => item.id === parsedMessage.sessionId);
    if (session) {
      await this.upsertScopedPayload(
        schema.dailyWorkSessions,
        session.id,
        session,
        messageScope
      );
    }

    return cloneJson(parsedMessage);
  }

  async recordToolCall(record: ToolCallRecord) {
    const parsed = toolCallRecordSchema.parse(record);

    await this.db
      .insert(schema.toolCalls)
      .values({
        id: parsed.id,
        ownerId: parsed.ownerId ?? fallbackOwnerId,
        sessionId: parsed.sessionId ?? null,
        workspaceId: parsed.workspaceId ?? fallbackWorkspaceId,
        runtimeMode: normalizeRuntimeMode(parsed.runtimeMode ?? fallbackRuntimeMode),
        requestId: parsed.requestId ?? null,
        mode: inferToolCallMode(parsed.name),
        name: parsed.name,
        status: parsed.status,
        inputJson: parsed.inputJson,
        outputJson: parsed.outputJson ?? null,
        previewOnly: parsed.previewOnly,
        permissionRequired: parsed.permissionRequired,
        error: parsed.error ?? null,
        createdAt: new Date(parsed.createdAt),
        startedAt: parsed.startedAt ? new Date(parsed.startedAt) : null,
        completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null
      })
      .onConflictDoUpdate({
        target: schema.toolCalls.id,
        set: {
          sessionId: parsed.sessionId ?? null,
          ownerId: parsed.ownerId ?? fallbackOwnerId,
          workspaceId: parsed.workspaceId ?? fallbackWorkspaceId,
          runtimeMode: normalizeRuntimeMode(parsed.runtimeMode ?? fallbackRuntimeMode),
          requestId: parsed.requestId ?? null,
          status: parsed.status,
          outputJson: parsed.outputJson ?? null,
          previewOnly: parsed.previewOnly,
          permissionRequired: parsed.permissionRequired,
          error: parsed.error ?? null,
          startedAt: parsed.startedAt ? new Date(parsed.startedAt) : null,
          completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null
        }
      });

    return cloneJson(parsed);
  }

  async listToolCalls(query: DailyWorkTraceQuery = {}) {
    const rows = await this.selectToolCallRows(query);

    return rows.map(mapToolCallRow);
  }

  async recordModelUsage(record: ToolModelUsageRecord) {
    const parsed = toolModelUsageRecordSchema.parse(record);

    await this.db
      .insert(schema.modelUsageRecords)
      .values({
        id: parsed.id,
        ownerId: parsed.ownerId ?? fallbackOwnerId,
        sessionId: parsed.sessionId ?? null,
        workspaceId: parsed.workspaceId ?? fallbackWorkspaceId,
        runtimeMode: normalizeRuntimeMode(parsed.runtimeMode ?? fallbackRuntimeMode),
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
          ownerId: parsed.ownerId ?? fallbackOwnerId,
          workspaceId: parsed.workspaceId ?? fallbackWorkspaceId,
          runtimeMode: normalizeRuntimeMode(parsed.runtimeMode ?? fallbackRuntimeMode),
          provider: parsed.provider,
          model: parsed.model,
          promptTokens: parsed.promptTokens,
          completionTokens: parsed.completionTokens,
          totalTokens: parsed.totalTokens
        }
      });

    return cloneJson(parsed);
  }

  async listModelUsageRecords(query: DailyWorkTraceQuery = {}) {
    const rows = await this.selectModelUsageRows(query);

    return rows.map(mapModelUsageRow);
  }

  async upsertPermissionGrant(grant: DailyWorkPermissionGrant) {
    const parsed = dailyWorkPermissionGrantSchema.parse(grant);

    await this.db
      .insert(schema.dailyWorkPermissionGrants)
      .values({
        id: parsed.id,
        ownerId: parsed.ownerId ?? fallbackOwnerId,
        mode: parsed.mode,
        provider: parsed.provider,
        sessionId: parsed.sessionId,
        workspaceId: parsed.workspaceId ?? fallbackWorkspaceId,
        runtimeMode: normalizeRuntimeMode(parsed.runtimeMode ?? parsed.provider),
        action: parsed.action,
        decision: parsed.decision,
        status: parsed.status,
        reason: parsed.reason ?? null,
        payload: parsed,
        createdAt: new Date(parsed.createdAt),
        expiresAt: new Date(parsed.expiresAt),
        revokedAt: parsed.revokedAt ? new Date(parsed.revokedAt) : null,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: schema.dailyWorkPermissionGrants.id,
        set: {
          status: parsed.status,
          ownerId: parsed.ownerId ?? fallbackOwnerId,
          workspaceId: parsed.workspaceId ?? fallbackWorkspaceId,
          runtimeMode: normalizeRuntimeMode(parsed.runtimeMode ?? parsed.provider),
          reason: parsed.reason ?? null,
          payload: parsed,
          expiresAt: new Date(parsed.expiresAt),
          revokedAt: parsed.revokedAt ? new Date(parsed.revokedAt) : null,
          updatedAt: new Date()
        }
      });

    return cloneJson(parsed);
  }

  async listPermissionGrants(query: DailyWorkPermissionGrantQuery = {}) {
    const rows = await this.selectPermissionGrantRows(query);

    return rows.map(mapPermissionGrantRow).filter((grant) => filterPermissionGrant(grant, query));
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

  async listCodingWorkspaces(query: CodingWorkspaceQuery) {
    const conditions = [eq(schema.workspaces.ownerId, query.ownerId)];
    if (query.runtimeMode) {
      conditions.push(eq(schema.workspaces.runtimeMode, query.runtimeMode));
    }
    if (!query.includeDeleted) {
      conditions.push(isNull(schema.workspaces.deletedAt));
    }
    const rows = await this.db
      .select()
      .from(schema.workspaces)
      .where(and(...conditions))
      .orderBy(desc(schema.workspaces.updatedAt));
    return rows.map(mapWorkspaceRow);
  }

  async getCodingWorkspace(ownerId: string, workspaceId: string) {
    const [row] = await this.db
      .select()
      .from(schema.workspaces)
      .where(and(eq(schema.workspaces.ownerId, ownerId), eq(schema.workspaces.id, workspaceId)))
      .limit(1);
    return row ? mapWorkspaceRow(row) : null;
  }

  async upsertCodingWorkspace(workspace: CodingWorkspaceRecord) {
    const parsed = codingWorkspaceRecordSchema.parse(workspace);
    const repository = parsed.repository;
    const row = {
      id: parsed.workspaceId,
      ownerId: parsed.ownerId,
      name: parsed.name,
      runtimeMode: parsed.runtimeMode,
      status: parsed.status,
      rootPath: parsed.rootPath,
      repositoryUrl: repository?.url ?? null,
      repositoryBranch: repository?.branch ?? null,
      repositoryRevision: repository?.revision ?? null,
      imageProfile: parsed.imageProfile ?? null,
      credentialRef: parsed.credentialRef ?? null,
      daemonId: parsed.daemonId ?? null,
      containerRef: parsed.containerRef ?? null,
      storageRef: parsed.storageRef ?? null,
      errorCode: parsed.errorCode ?? null,
      errorMessage: parsed.errorMessage ?? null,
      lastActiveAt: parsed.lastActiveAt ? new Date(parsed.lastActiveAt) : null,
      stoppedAt: parsed.stoppedAt ? new Date(parsed.stoppedAt) : null,
      deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt)
    };
    const [inserted] = await this.db
      .insert(schema.workspaces)
      .values(row)
      .onConflictDoNothing({ target: schema.workspaces.id })
      .returning({ id: schema.workspaces.id });
    if (!inserted) {
      const { id: _id, createdAt: _createdAt, ...update } = row;
      void _id;
      void _createdAt;
      const [updated] = await this.db
        .update(schema.workspaces)
        .set(update)
        .where(and(
          eq(schema.workspaces.id, parsed.workspaceId),
          eq(schema.workspaces.ownerId, parsed.ownerId)
        ))
        .returning({ id: schema.workspaces.id });
      if (!updated) {
        throw new DailyWorkRepositoryAccessError("Workspace", parsed.workspaceId);
      }
    }
    return cloneJson(parsed);
  }

  async listRuntimeOperations(query: RuntimeOperationQuery) {
    const conditions = [eq(schema.workspaceRuntimeOperations.ownerId, query.ownerId)];
    if (query.workspaceId) {
      conditions.push(eq(schema.workspaceRuntimeOperations.workspaceId, query.workspaceId));
    }
    if (query.status) {
      conditions.push(eq(schema.workspaceRuntimeOperations.status, query.status));
    }
    const rows = await this.db
      .select()
      .from(schema.workspaceRuntimeOperations)
      .where(and(...conditions))
      .orderBy(desc(schema.workspaceRuntimeOperations.createdAt))
      .limit(normalizeTraceLimit(query.limit));
    return rows.map(mapRuntimeOperationRow);
  }

  async getRuntimeOperationByIdempotencyKey(ownerId: string, idempotencyKey: string) {
    const [row] = await this.db
      .select()
      .from(schema.workspaceRuntimeOperations)
      .where(and(
        eq(schema.workspaceRuntimeOperations.ownerId, ownerId),
        eq(schema.workspaceRuntimeOperations.idempotencyKey, idempotencyKey)
      ))
      .limit(1);
    return row ? mapRuntimeOperationRow(row) : null;
  }

  async upsertRuntimeOperation(operation: RuntimeOperation) {
    const parsed = runtimeOperationSchema.parse(operation);
    const row = operationToRow(parsed);
    const [inserted] = await this.db
      .insert(schema.workspaceRuntimeOperations)
      .values(row)
      .onConflictDoNothing({ target: schema.workspaceRuntimeOperations.id })
      .returning({ id: schema.workspaceRuntimeOperations.id });
    if (!inserted) {
      const { id: _id, ownerId: _ownerId, createdAt: _createdAt, ...update } = row;
      void _id;
      void _ownerId;
      void _createdAt;
      const [updated] = await this.db
        .update(schema.workspaceRuntimeOperations)
        .set(update)
        .where(and(
          eq(schema.workspaceRuntimeOperations.id, parsed.id),
          eq(schema.workspaceRuntimeOperations.ownerId, parsed.ownerId)
        ))
        .returning({ id: schema.workspaceRuntimeOperations.id });
      if (!updated) {
        throw new DailyWorkRepositoryAccessError("Runtime operation", parsed.id);
      }
    }
    return cloneJson(parsed);
  }

  async listRepositoryCredentials(ownerId: string) {
    const rows = await this.db
      .select()
      .from(schema.repositoryCredentials)
      .where(eq(schema.repositoryCredentials.ownerId, ownerId))
      .orderBy(desc(schema.repositoryCredentials.updatedAt));
    return rows.map(mapCredentialMetadataRow);
  }

  async getRepositoryCredential(ownerId: string, credentialId: string) {
    const [row] = await this.db
      .select()
      .from(schema.repositoryCredentials)
      .where(and(
        eq(schema.repositoryCredentials.ownerId, ownerId),
        eq(schema.repositoryCredentials.id, credentialId)
      ))
      .limit(1);
    return row ? mapCredentialRow(row) : null;
  }

  async upsertRepositoryCredential(credential: RepositoryCredentialRecord) {
    const parsed = parseRepositoryCredential(credential);
    const row = credentialToRow(parsed);
    const [inserted] = await this.db
      .insert(schema.repositoryCredentials)
      .values(row)
      .onConflictDoNothing({ target: schema.repositoryCredentials.id })
      .returning({ id: schema.repositoryCredentials.id });
    if (!inserted) {
      const { id: _id, ownerId: _ownerId, createdAt: _createdAt, ...update } = row;
      void _id;
      void _ownerId;
      void _createdAt;
      const [updated] = await this.db
        .update(schema.repositoryCredentials)
        .set(update)
        .where(and(
          eq(schema.repositoryCredentials.id, parsed.id),
          eq(schema.repositoryCredentials.ownerId, parsed.ownerId)
        ))
        .returning({ id: schema.repositoryCredentials.id });
      if (!updated) {
        throw new DailyWorkRepositoryAccessError("Repository credential", parsed.id);
      }
    }
    return toCredentialMetadata(parsed);
  }

  async revokeRepositoryCredential(ownerId: string, credentialId: string, revokedAt: string) {
    const [row] = await this.db
      .update(schema.repositoryCredentials)
      .set({ revokedAt: new Date(revokedAt), updatedAt: new Date(revokedAt) })
      .where(and(
        eq(schema.repositoryCredentials.ownerId, ownerId),
        eq(schema.repositoryCredentials.id, credentialId)
      ))
      .returning();
    return row ? mapCredentialMetadataRow(row) : null;
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

  private async listScopedPayloadCollection<T extends { id: string }>(
    table: ScopedPayloadTable,
    parser: ArrayParser<T>,
    seed: () => Promise<T[]>,
    query: CodingScopeQuery
  ): Promise<T[]> {
    const conditions = [];
    if (query.ownerId) {
      conditions.push(eq(table.ownerId, query.ownerId));
    }
    if (query.workspaceId) {
      conditions.push(eq(table.workspaceId, query.workspaceId));
    }
    if (query.runtimeMode) {
      conditions.push(eq(table.runtimeMode, query.runtimeMode));
    }
    const rows = await this.db
      .select({ payload: table.payload })
      .from(table)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(table.updatedAt));

    if (rows.length === 0) {
      if (query.ownerId && query.ownerId !== fallbackOwnerId) {
        return [];
      }
      const seedValues = await seed();
      await this.upsertScopedPayloadCollection(table, seedValues);
      return parser.parse(seedValues).filter((value) => scopedPayloadMatches(value, query));
    }

    try {
      return parser.parse(rows.map((row) => row.payload));
    } catch (error) {
      throw new PostgresDailyWorkRepositoryDataError(
        `Invalid scoped Postgres daily-work payload: ${formatSchemaError(error)}`,
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

  private async upsertScopedPayloadCollection<T extends { id: string }>(
    table: ScopedPayloadTable,
    values: T[]
  ) {
    for (const value of values) {
      await this.upsertScopedPayload(table, value.id, value, inferPayloadScope(value));
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

  private async upsertScopedPayload<T>(
    table: ScopedPayloadTable,
    id: string,
    payload: T,
    scope: CodingScopeQuery = {}
  ) {
    const resolvedScope = {
      ownerId: scope.ownerId ?? fallbackOwnerId,
      workspaceId: scope.workspaceId ?? fallbackWorkspaceId,
      runtimeMode: scope.runtimeMode ?? fallbackRuntimeMode
    };
    await this.db
      .insert(table)
      .values({
        id,
        ownerId: resolvedScope.ownerId,
        workspaceId: resolvedScope.workspaceId,
        runtimeMode: resolvedScope.runtimeMode,
        mode: inferPayloadMode(payload),
        payload,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: table.id,
        set: {
          ownerId: resolvedScope.ownerId,
          workspaceId: resolvedScope.workspaceId,
          runtimeMode: resolvedScope.runtimeMode,
          mode: inferPayloadMode(payload),
          payload,
          updatedAt: new Date()
        }
      });
  }

  private async selectToolCallRows(query: DailyWorkTraceQuery) {
    const limit = normalizeTraceLimit(query.limit);
    const conditions = createTraceConditions(schema.toolCalls, query);
    return this.db
      .select()
      .from(schema.toolCalls)
      .where(conditions)
      .orderBy(asc(schema.toolCalls.createdAt))
      .limit(limit);
  }

  private async selectModelUsageRows(query: DailyWorkTraceQuery) {
    const limit = normalizeTraceLimit(query.limit);
    const conditions = createTraceConditions(schema.modelUsageRecords, query);
    return this.db
      .select()
      .from(schema.modelUsageRecords)
      .where(conditions)
      .orderBy(asc(schema.modelUsageRecords.createdAt))
      .limit(limit);
  }

  private async selectPermissionGrantRows(query: DailyWorkPermissionGrantQuery) {
    const limit = normalizeTraceLimit(query.limit);
    const conditions = createTraceConditions(schema.dailyWorkPermissionGrants, query);
    return this.db
      .select()
      .from(schema.dailyWorkPermissionGrants)
      .where(conditions)
      .orderBy(asc(schema.dailyWorkPermissionGrants.createdAt))
      .limit(limit);
  }
}

const fallbackOwnerId = "local-dev-user";
const fallbackWorkspaceId = "workspace-seekdesk";
const fallbackRuntimeMode = "server_local" as const;

function createTraceConditions(
  table: {
    ownerId: AnyPgColumn;
    sessionId: AnyPgColumn;
    workspaceId: AnyPgColumn;
    runtimeMode: AnyPgColumn;
  },
  query: DailyWorkTraceQuery
) {
  const conditions = [];
  if (query.ownerId) {
    conditions.push(eq(table.ownerId, query.ownerId));
  }
  if (query.sessionId) {
    conditions.push(eq(table.sessionId, query.sessionId));
  }
  if (query.workspaceId) {
    conditions.push(eq(table.workspaceId, query.workspaceId));
  }
  if (query.runtimeMode) {
    conditions.push(eq(table.runtimeMode, query.runtimeMode));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function mapWorkspaceRow(row: typeof schema.workspaces.$inferSelect): CodingWorkspaceRecord {
  return codingWorkspaceRecordSchema.parse({
    workspaceId: row.id,
    ownerId: row.ownerId,
    name: row.name,
    runtimeMode: row.runtimeMode,
    status: row.status,
    rootPath: row.rootPath,
    connected: row.runtimeMode === "server_local" || row.status === "ready" || row.status === "busy",
    ...(row.repositoryUrl && row.repositoryBranch
      ? {
          repository: {
            url: row.repositoryUrl,
            branch: row.repositoryBranch,
            ...(row.repositoryRevision ? { revision: row.repositoryRevision } : {})
          }
        }
      : {}),
    ...(row.imageProfile ? { imageProfile: row.imageProfile } : {}),
    ...(row.credentialRef ? { credentialRef: row.credentialRef } : {}),
    ...(row.daemonId ? { daemonId: row.daemonId } : {}),
    ...(row.containerRef ? { containerRef: row.containerRef } : {}),
    ...(row.storageRef ? { storageRef: row.storageRef } : {}),
    ...(row.errorCode ? { errorCode: row.errorCode } : {}),
    ...(row.errorMessage ? { errorMessage: row.errorMessage } : {}),
    ...(row.lastActiveAt ? { lastActiveAt: row.lastActiveAt.toISOString() } : {}),
    ...(row.stoppedAt ? { stoppedAt: row.stoppedAt.toISOString() } : {}),
    ...(row.deletedAt ? { deletedAt: row.deletedAt.toISOString() } : {}),
    supportedCapabilities: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  });
}

function mapRuntimeOperationRow(
  row: typeof schema.workspaceRuntimeOperations.$inferSelect
): RuntimeOperation {
  return runtimeOperationSchema.parse({
    id: row.id,
    ownerId: row.ownerId,
    workspaceId: row.workspaceId,
    type: row.type,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    requestPayload: row.requestPayload,
    ...(row.resultPayload === null ? {} : { resultPayload: row.resultPayload }),
    ...(row.errorCode ? { errorCode: row.errorCode } : {}),
    ...(row.errorMessage ? { errorMessage: row.errorMessage } : {}),
    createdAt: row.createdAt.toISOString(),
    ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
    ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {})
  });
}

function operationToRow(operation: RuntimeOperation) {
  return {
    id: operation.id,
    ownerId: operation.ownerId,
    workspaceId: operation.workspaceId,
    type: operation.type,
    status: operation.status,
    idempotencyKey: operation.idempotencyKey,
    requestPayload: operation.requestPayload,
    resultPayload: operation.resultPayload ?? null,
    errorCode: operation.errorCode ?? null,
    errorMessage: operation.errorMessage ?? null,
    createdAt: new Date(operation.createdAt),
    startedAt: operation.startedAt ? new Date(operation.startedAt) : null,
    completedAt: operation.completedAt ? new Date(operation.completedAt) : null
  };
}

function mapCredentialRow(
  row: typeof schema.repositoryCredentials.$inferSelect
): RepositoryCredentialRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    provider: parseCredentialProvider(row.provider),
    label: row.label,
    encryptedSecret: row.encryptedSecret,
    keyVersion: row.keyVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.revokedAt ? { revokedAt: row.revokedAt.toISOString() } : {})
  };
}

function mapCredentialMetadataRow(
  row: typeof schema.repositoryCredentials.$inferSelect
): RepositoryCredentialMetadata {
  return toCredentialMetadata(mapCredentialRow(row));
}

function parseRepositoryCredential(credential: RepositoryCredentialRecord) {
  if (
    !credential.id.trim() ||
    !credential.ownerId.trim() ||
    !credential.label.trim() ||
    !credential.encryptedSecret.trim() ||
    !credential.keyVersion.trim()
  ) {
    throw new PostgresDailyWorkRepositoryDataError("Repository credential fields are required.");
  }
  return cloneJson(credential);
}

function parseCredentialProvider(provider: string): "https_token" {
  if (provider !== "https_token") {
    throw new PostgresDailyWorkRepositoryDataError(`Unsupported credential provider: ${provider}`);
  }
  return provider;
}

function credentialToRow(credential: RepositoryCredentialRecord) {
  return {
    id: credential.id,
    ownerId: credential.ownerId,
    provider: credential.provider,
    label: credential.label,
    encryptedSecret: credential.encryptedSecret,
    keyVersion: credential.keyVersion,
    createdAt: new Date(credential.createdAt),
    updatedAt: new Date(credential.updatedAt),
    revokedAt: credential.revokedAt ? new Date(credential.revokedAt) : null
  };
}

function toCredentialMetadata(credential: RepositoryCredentialRecord): RepositoryCredentialMetadata {
  const { encryptedSecret: _encryptedSecret, ...metadata } = credential;
  void _encryptedSecret;
  return cloneJson(metadata);
}

function inferPayloadScope(value: unknown): CodingScopeQuery {
  const record = value && typeof value === "object"
    ? value as { ownerId?: unknown; workspaceId?: unknown; workspaceRuntimeMode?: unknown; runtimeMode?: unknown }
    : {};
  return {
    ownerId: typeof record.ownerId === "string" ? record.ownerId : fallbackOwnerId,
    workspaceId: typeof record.workspaceId === "string" ? record.workspaceId : fallbackWorkspaceId,
    runtimeMode: normalizeRuntimeMode(
      record.workspaceRuntimeMode ?? record.runtimeMode ?? fallbackRuntimeMode
    )
  };
}

function scopeFromSession(session: DailyWorkSessionDetail): CodingScopeQuery {
  return {
    ownerId: fallbackOwnerId,
    workspaceId: session.workspaceId,
    runtimeMode: normalizeRuntimeMode(session.workspaceRuntimeMode ?? fallbackRuntimeMode)
  };
}

function scopedPayloadMatches(value: unknown, query: CodingScopeQuery) {
  const scope = inferPayloadScope(value);
  return (
    (!query.ownerId || scope.ownerId === query.ownerId) &&
    (!query.workspaceId || scope.workspaceId === query.workspaceId) &&
    (!query.runtimeMode || scope.runtimeMode === query.runtimeMode)
  );
}

function inferPayloadMode(payload: unknown) {
  if (payload && typeof payload === "object" && "appMode" in payload) {
    const appMode = (payload as { appMode?: unknown }).appMode;
    return appMode === "coding_agent" ? "coding_agent" : "daily_work";
  }
  if (payload && typeof payload === "object" && "mode" in payload) {
    const mode = (payload as { mode?: unknown }).mode;
    return mode === "coding_agent" ? "coding_agent" : "daily_work";
  }
  return "daily_work";
}

function inferToolCallMode(name: string) {
  return name.startsWith("coding.") ? "coding_agent" : "daily_work";
}

function mapToolCallRow(row: typeof schema.toolCalls.$inferSelect): ToolCallRecord {
  return toolCallRecordSchema.parse({
    id: row.id,
    ownerId: row.ownerId,
    ...(row.sessionId ? { sessionId: row.sessionId } : {}),
    workspaceId: row.workspaceId,
    runtimeMode: row.runtimeMode,
    ...(row.requestId ? { requestId: row.requestId } : {}),
    name: row.name,
    status: row.status,
    inputJson: row.inputJson,
    ...(row.outputJson === null ? {} : { outputJson: row.outputJson }),
    previewOnly: row.previewOnly,
    permissionRequired: row.permissionRequired,
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.createdAt.toISOString(),
    ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
    ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {})
  });
}

function mapPermissionGrantRow(
  row: typeof schema.dailyWorkPermissionGrants.$inferSelect
): DailyWorkPermissionGrant {
  return dailyWorkPermissionGrantSchema.parse({
    id: row.id,
    mode: row.mode,
    provider: row.provider,
    ownerId: row.ownerId,
    sessionId: row.sessionId,
    workspaceId: row.workspaceId,
    runtimeMode: row.runtimeMode,
    action: row.action,
    decision: row.decision,
    status: row.status,
    ...(row.reason ? { reason: row.reason } : {}),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    ...(row.revokedAt ? { revokedAt: row.revokedAt.toISOString() } : {})
  });
}

function filterPermissionGrant(
  grant: DailyWorkPermissionGrant,
  query: DailyWorkPermissionGrantQuery
) {
  if (query.provider && grant.provider !== query.provider) {
    return false;
  }

  if (query.action && grant.action !== query.action) {
    return false;
  }

  if (!query.activeOnly) {
    return true;
  }

  return grant.status === "active" && new Date(grant.expiresAt).getTime() > Date.now();
}

function mapModelUsageRow(
  row: typeof schema.modelUsageRecords.$inferSelect
): ToolModelUsageRecord {
  return toolModelUsageRecordSchema.parse({
    id: row.id,
    ownerId: row.ownerId,
    ...(row.sessionId ? { sessionId: row.sessionId } : {}),
    workspaceId: row.workspaceId,
    runtimeMode: row.runtimeMode,
    provider: row.provider,
    model: row.model,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    createdAt: row.createdAt.toISOString()
  });
}

function normalizeTraceLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(limit ?? 50), 1), 200);
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
        label:
          message.role === "assistant"
            ? "Assistant response recorded."
            : "User prompt recorded."
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
