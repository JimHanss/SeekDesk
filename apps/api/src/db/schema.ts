import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

const ownerDefault = "local-dev-user";
const workspaceDefault = "workspace-seekdesk";
const runtimeDefault = "server_local";

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default(ownerDefault),
    name: text("name").notNull(),
    runtimeMode: text("runtime_mode").notNull().default(runtimeDefault),
    status: text("status").notNull().default("ready"),
    rootPath: text("root_path").notNull().default("/workspace"),
    repositoryUrl: text("repository_url"),
    repositoryBranch: text("repository_branch"),
    repositoryRevision: text("repository_revision"),
    imageProfile: text("image_profile"),
    credentialRef: text("credential_ref"),
    daemonId: text("daemon_id"),
    containerRef: text("container_ref"),
    storageRef: text("storage_ref"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("workspaces_owner_runtime_idx").on(table.ownerId, table.runtimeMode),
    index("workspaces_owner_status_idx").on(table.ownerId, table.status),
    index("workspaces_last_active_idx").on(table.lastActiveAt)
  ]
);

export const workspaceRuntimeOperations = pgTable(
  "workspace_runtime_operations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestPayload: jsonb("request_payload").notNull(),
    resultPayload: jsonb("result_payload"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("workspace_operations_owner_idempotency_uidx").on(
      table.ownerId,
      table.idempotencyKey
    ),
    index("workspace_operations_workspace_time_idx").on(table.workspaceId, table.createdAt),
    index("workspace_operations_status_time_idx").on(table.status, table.createdAt)
  ]
);

export const repositoryCredentials = pgTable(
  "repository_credentials",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    label: text("label").notNull(),
    encryptedSecret: text("encrypted_secret").notNull(),
    keyVersion: text("key_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => [
    index("repository_credentials_owner_provider_idx").on(table.ownerId, table.provider),
    index("repository_credentials_owner_revoked_idx").on(table.ownerId, table.revokedAt)
  ]
);

export const dailyWorkTemplates = createPayloadTable("daily_work_templates");
export const dailyWorkContextItems = createPayloadTable("daily_work_context_items");
export const dailyWorkContextDocuments = createPayloadTable("daily_work_context_documents");
export const dailyWorkApprovals = createPayloadTable("daily_work_approvals");
export const dailyWorkArtifacts = createScopedPayloadTable("daily_work_artifacts");
export const dailyWorkSessions = createScopedPayloadTable("daily_work_sessions");
export const dailyWorkActivityEvents = createScopedPayloadTable("daily_work_activity_events");
export const dailyWorkConnectors = createPayloadTable("daily_work_connectors");
export const dailyWorkWorkflows = createPayloadTable("daily_work_workflows");

export const dailyWorkMessages = pgTable(
  "daily_work_messages",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default(ownerDefault),
    sessionId: text("session_id"),
    workspaceId: text("workspace_id").notNull().default(workspaceDefault),
    runtimeMode: text("runtime_mode").notNull().default(runtimeDefault),
    role: text("role").notNull(),
    content: text("content").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("daily_messages_owner_session_idx").on(table.ownerId, table.sessionId),
    index("daily_messages_workspace_time_idx").on(table.workspaceId, table.createdAt)
  ]
);

export const connectorAccounts = pgTable("connector_accounts", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  accountEmail: text("account_email"),
  encryptedTokens: text("encrypted_tokens").notNull(),
  scopes: jsonb("scopes").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const toolCalls = pgTable(
  "tool_calls",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default(ownerDefault),
    sessionId: text("session_id"),
    workspaceId: text("workspace_id").notNull().default(workspaceDefault),
    runtimeMode: text("runtime_mode").notNull().default(runtimeDefault),
    requestId: text("request_id"),
    mode: text("mode").notNull().default("daily_work"),
    name: text("name").notNull(),
    status: text("status").notNull(),
    inputJson: jsonb("input_json").notNull(),
    outputJson: jsonb("output_json"),
    previewOnly: boolean("preview_only").notNull().default(true),
    permissionRequired: boolean("permission_required").notNull().default(false),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [
    index("tool_calls_owner_session_idx").on(table.ownerId, table.sessionId),
    index("tool_calls_workspace_time_idx").on(table.workspaceId, table.createdAt),
    uniqueIndex("tool_calls_owner_request_uidx").on(table.ownerId, table.requestId)
  ]
);

export const dailyWorkPermissionGrants = pgTable(
  "daily_work_permission_grants",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default(ownerDefault),
    mode: text("mode").notNull().default("daily_work"),
    provider: text("provider").notNull(),
    sessionId: text("session_id").notNull(),
    workspaceId: text("workspace_id").notNull().default(workspaceDefault),
    runtimeMode: text("runtime_mode").notNull().default(runtimeDefault),
    action: text("action").notNull(),
    decision: text("decision").notNull().default("allow_for_session"),
    status: text("status").notNull(),
    reason: text("reason"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("permission_grants_owner_session_idx").on(table.ownerId, table.sessionId),
    index("permission_grants_workspace_action_idx").on(table.workspaceId, table.action),
    index("permission_grants_status_expiry_idx").on(table.status, table.expiresAt)
  ]
);

export const modelUsageRecords = pgTable(
  "model_usage_records",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default(ownerDefault),
    sessionId: text("session_id"),
    workspaceId: text("workspace_id").notNull().default(workspaceDefault),
    runtimeMode: text("runtime_mode").notNull().default(runtimeDefault),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("model_usage_owner_session_idx").on(table.ownerId, table.sessionId),
    index("model_usage_workspace_time_idx").on(table.workspaceId, table.createdAt)
  ]
);

function createPayloadTable(name: string) {
  return pgTable(name, {
    id: text("id").primaryKey(),
    mode: text("mode").notNull().default("daily_work"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  });
}

function createScopedPayloadTable(name: string) {
  return pgTable(
    name,
    {
      id: text("id").primaryKey(),
      ownerId: text("owner_id").notNull().default(ownerDefault),
      workspaceId: text("workspace_id").notNull().default(workspaceDefault),
      runtimeMode: text("runtime_mode").notNull().default(runtimeDefault),
      mode: text("mode").notNull().default("daily_work"),
      payload: jsonb("payload").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
    },
    (table) => [
      index(`${name}_owner_workspace_idx`).on(table.ownerId, table.workspaceId),
      index(`${name}_workspace_time_idx`).on(table.workspaceId, table.updatedAt)
    ]
  );
}
