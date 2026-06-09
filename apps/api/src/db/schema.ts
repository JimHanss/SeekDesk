import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp
} from "drizzle-orm/pg-core";

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const dailyWorkTemplates = createPayloadTable("daily_work_templates");
export const dailyWorkContextItems = createPayloadTable("daily_work_context_items");
export const dailyWorkContextDocuments = createPayloadTable("daily_work_context_documents");
export const dailyWorkApprovals = createPayloadTable("daily_work_approvals");
export const dailyWorkArtifacts = createPayloadTable("daily_work_artifacts");
export const dailyWorkSessions = createPayloadTable("daily_work_sessions");
export const dailyWorkActivityEvents = createPayloadTable("daily_work_activity_events");
export const dailyWorkConnectors = createPayloadTable("daily_work_connectors");
export const dailyWorkWorkflows = createPayloadTable("daily_work_workflows");

export const dailyWorkMessages = pgTable("daily_work_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const connectorAccounts = pgTable("connector_accounts", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  accountEmail: text("account_email"),
  encryptedTokens: text("encrypted_tokens").notNull(),
  scopes: jsonb("scopes").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const toolCalls = pgTable("tool_calls", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  mode: text("mode").notNull().default("daily_work"),
  name: text("name").notNull(),
  status: text("status").notNull(),
  inputJson: jsonb("input_json").notNull(),
  outputJson: jsonb("output_json"),
  previewOnly: boolean("preview_only").notNull().default(true),
  permissionRequired: boolean("permission_required").notNull().default(false),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true })
});

export const modelUsageRecords = pgTable("model_usage_records", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

function createPayloadTable(name: string) {
  return pgTable(name, {
    id: text("id").primaryKey(),
    mode: text("mode").notNull().default("daily_work"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  });
}
