CREATE TABLE "repository_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"key_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_runtime_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_payload" jsonb NOT NULL,
	"result_payload" jsonb,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "daily_work_activity_events" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_activity_events" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_activity_events" ADD COLUMN "runtime_mode" text;--> statement-breakpoint
ALTER TABLE "daily_work_artifacts" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_artifacts" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_artifacts" ADD COLUMN "runtime_mode" text;--> statement-breakpoint
ALTER TABLE "daily_work_messages" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_messages" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_messages" ADD COLUMN "runtime_mode" text;--> statement-breakpoint
ALTER TABLE "daily_work_permission_grants" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_permission_grants" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_permission_grants" ADD COLUMN "runtime_mode" text;--> statement-breakpoint
ALTER TABLE "daily_work_sessions" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_sessions" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "daily_work_sessions" ADD COLUMN "runtime_mode" text;--> statement-breakpoint
ALTER TABLE "model_usage_records" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "model_usage_records" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "model_usage_records" ADD COLUMN "runtime_mode" text;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD COLUMN "runtime_mode" text;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "runtime_mode" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "root_path" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "repository_url" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "repository_branch" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "repository_revision" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "image_profile" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "credential_ref" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "daemon_id" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "container_ref" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "storage_ref" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "stopped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "daily_work_sessions"
SET
	"owner_id" = COALESCE(NULLIF("payload"->>'ownerId', ''), 'local-dev-user'),
	"workspace_id" = COALESCE(NULLIF("payload"->>'workspaceId', ''), 'workspace-seekdesk'),
	"runtime_mode" = COALESCE(NULLIF("payload"->>'runtimeMode', ''), 'server_local');--> statement-breakpoint
UPDATE "daily_work_activity_events"
SET
	"owner_id" = COALESCE(NULLIF("payload"->>'ownerId', ''), 'local-dev-user'),
	"workspace_id" = COALESCE(NULLIF("payload"->>'workspaceId', ''), 'workspace-seekdesk'),
	"runtime_mode" = COALESCE(NULLIF("payload"->>'runtimeMode', ''), 'server_local');--> statement-breakpoint
UPDATE "daily_work_artifacts"
SET
	"owner_id" = COALESCE(NULLIF("payload"->>'ownerId', ''), 'local-dev-user'),
	"workspace_id" = COALESCE(NULLIF("payload"->>'workspaceId', ''), 'workspace-seekdesk'),
	"runtime_mode" = COALESCE(NULLIF("payload"->>'runtimeMode', ''), 'server_local');--> statement-breakpoint
UPDATE "daily_work_messages" AS "message"
SET
	"owner_id" = COALESCE("session"."owner_id", NULLIF("message"."payload"->>'ownerId', ''), 'local-dev-user'),
	"workspace_id" = COALESCE("session"."workspace_id", NULLIF("message"."payload"->>'workspaceId', ''), 'workspace-seekdesk'),
	"runtime_mode" = COALESCE("session"."runtime_mode", NULLIF("message"."payload"->>'runtimeMode', ''), 'server_local')
FROM "daily_work_sessions" AS "session"
WHERE "message"."session_id" = "session"."id";--> statement-breakpoint
UPDATE "daily_work_messages"
SET
	"owner_id" = COALESCE("owner_id", NULLIF("payload"->>'ownerId', ''), 'local-dev-user'),
	"workspace_id" = COALESCE("workspace_id", NULLIF("payload"->>'workspaceId', ''), 'workspace-seekdesk'),
	"runtime_mode" = COALESCE("runtime_mode", NULLIF("payload"->>'runtimeMode', ''), 'server_local');--> statement-breakpoint
UPDATE "daily_work_permission_grants" AS "grant"
SET
	"owner_id" = COALESCE("session"."owner_id", NULLIF("grant"."payload"->>'ownerId', ''), 'local-dev-user'),
	"workspace_id" = COALESCE("session"."workspace_id", NULLIF("grant"."payload"->>'workspaceId', ''), 'workspace-seekdesk'),
	"runtime_mode" = COALESCE("session"."runtime_mode", NULLIF("grant"."payload"->>'runtimeMode', ''), 'server_local')
FROM "daily_work_sessions" AS "session"
WHERE "grant"."session_id" = "session"."id";--> statement-breakpoint
UPDATE "daily_work_permission_grants"
SET
	"owner_id" = COALESCE("owner_id", NULLIF("payload"->>'ownerId', ''), 'local-dev-user'),
	"workspace_id" = COALESCE("workspace_id", NULLIF("payload"->>'workspaceId', ''), 'workspace-seekdesk'),
	"runtime_mode" = COALESCE("runtime_mode", NULLIF("payload"->>'runtimeMode', ''), 'server_local');--> statement-breakpoint
UPDATE "tool_calls" AS "tool"
SET
	"owner_id" = COALESCE("session"."owner_id", 'local-dev-user'),
	"workspace_id" = COALESCE("session"."workspace_id", NULLIF("tool"."input_json"->>'workspaceId', ''), 'workspace-seekdesk'),
	"runtime_mode" = COALESCE("session"."runtime_mode", NULLIF("tool"."input_json"->>'runtimeMode', ''), 'server_local')
FROM "daily_work_sessions" AS "session"
WHERE "tool"."session_id" = "session"."id";--> statement-breakpoint
UPDATE "tool_calls"
SET
	"owner_id" = COALESCE("owner_id", 'local-dev-user'),
	"workspace_id" = COALESCE("workspace_id", NULLIF("input_json"->>'workspaceId', ''), 'workspace-seekdesk'),
	"runtime_mode" = COALESCE("runtime_mode", NULLIF("input_json"->>'runtimeMode', ''), 'server_local');--> statement-breakpoint
UPDATE "model_usage_records" AS "usage"
SET
	"owner_id" = COALESCE("session"."owner_id", 'local-dev-user'),
	"workspace_id" = COALESCE("session"."workspace_id", 'workspace-seekdesk'),
	"runtime_mode" = COALESCE("session"."runtime_mode", 'server_local')
FROM "daily_work_sessions" AS "session"
WHERE "usage"."session_id" = "session"."id";--> statement-breakpoint
UPDATE "model_usage_records"
SET
	"owner_id" = COALESCE("owner_id", 'local-dev-user'),
	"workspace_id" = COALESCE("workspace_id", 'workspace-seekdesk'),
	"runtime_mode" = COALESCE("runtime_mode", 'server_local');--> statement-breakpoint
UPDATE "workspaces"
SET
	"owner_id" = 'local-dev-user',
	"runtime_mode" = 'server_local',
	"status" = 'ready',
	"root_path" = '/workspace';--> statement-breakpoint
ALTER TABLE "daily_work_activity_events" ALTER COLUMN "owner_id" SET DEFAULT 'local-dev-user';--> statement-breakpoint
ALTER TABLE "daily_work_activity_events" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_activity_events" ALTER COLUMN "workspace_id" SET DEFAULT 'workspace-seekdesk';--> statement-breakpoint
ALTER TABLE "daily_work_activity_events" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_activity_events" ALTER COLUMN "runtime_mode" SET DEFAULT 'server_local';--> statement-breakpoint
ALTER TABLE "daily_work_activity_events" ALTER COLUMN "runtime_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_artifacts" ALTER COLUMN "owner_id" SET DEFAULT 'local-dev-user';--> statement-breakpoint
ALTER TABLE "daily_work_artifacts" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_artifacts" ALTER COLUMN "workspace_id" SET DEFAULT 'workspace-seekdesk';--> statement-breakpoint
ALTER TABLE "daily_work_artifacts" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_artifacts" ALTER COLUMN "runtime_mode" SET DEFAULT 'server_local';--> statement-breakpoint
ALTER TABLE "daily_work_artifacts" ALTER COLUMN "runtime_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_messages" ALTER COLUMN "owner_id" SET DEFAULT 'local-dev-user';--> statement-breakpoint
ALTER TABLE "daily_work_messages" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_messages" ALTER COLUMN "workspace_id" SET DEFAULT 'workspace-seekdesk';--> statement-breakpoint
ALTER TABLE "daily_work_messages" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_messages" ALTER COLUMN "runtime_mode" SET DEFAULT 'server_local';--> statement-breakpoint
ALTER TABLE "daily_work_messages" ALTER COLUMN "runtime_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_permission_grants" ALTER COLUMN "owner_id" SET DEFAULT 'local-dev-user';--> statement-breakpoint
ALTER TABLE "daily_work_permission_grants" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_permission_grants" ALTER COLUMN "workspace_id" SET DEFAULT 'workspace-seekdesk';--> statement-breakpoint
ALTER TABLE "daily_work_permission_grants" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_permission_grants" ALTER COLUMN "runtime_mode" SET DEFAULT 'server_local';--> statement-breakpoint
ALTER TABLE "daily_work_permission_grants" ALTER COLUMN "runtime_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_sessions" ALTER COLUMN "owner_id" SET DEFAULT 'local-dev-user';--> statement-breakpoint
ALTER TABLE "daily_work_sessions" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_sessions" ALTER COLUMN "workspace_id" SET DEFAULT 'workspace-seekdesk';--> statement-breakpoint
ALTER TABLE "daily_work_sessions" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_work_sessions" ALTER COLUMN "runtime_mode" SET DEFAULT 'server_local';--> statement-breakpoint
ALTER TABLE "daily_work_sessions" ALTER COLUMN "runtime_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "model_usage_records" ALTER COLUMN "owner_id" SET DEFAULT 'local-dev-user';--> statement-breakpoint
ALTER TABLE "model_usage_records" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "model_usage_records" ALTER COLUMN "workspace_id" SET DEFAULT 'workspace-seekdesk';--> statement-breakpoint
ALTER TABLE "model_usage_records" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "model_usage_records" ALTER COLUMN "runtime_mode" SET DEFAULT 'server_local';--> statement-breakpoint
ALTER TABLE "model_usage_records" ALTER COLUMN "runtime_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_calls" ALTER COLUMN "owner_id" SET DEFAULT 'local-dev-user';--> statement-breakpoint
ALTER TABLE "tool_calls" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_calls" ALTER COLUMN "workspace_id" SET DEFAULT 'workspace-seekdesk';--> statement-breakpoint
ALTER TABLE "tool_calls" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_calls" ALTER COLUMN "runtime_mode" SET DEFAULT 'server_local';--> statement-breakpoint
ALTER TABLE "tool_calls" ALTER COLUMN "runtime_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "owner_id" SET DEFAULT 'local-dev-user';--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "runtime_mode" SET DEFAULT 'server_local';--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "runtime_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "status" SET DEFAULT 'ready';--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "root_path" SET DEFAULT '/workspace';--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "root_path" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "repository_credentials_owner_provider_idx" ON "repository_credentials" USING btree ("owner_id","provider");--> statement-breakpoint
CREATE INDEX "repository_credentials_owner_revoked_idx" ON "repository_credentials" USING btree ("owner_id","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_operations_owner_idempotency_uidx" ON "workspace_runtime_operations" USING btree ("owner_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "workspace_operations_workspace_time_idx" ON "workspace_runtime_operations" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "workspace_operations_status_time_idx" ON "workspace_runtime_operations" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "daily_work_activity_events_owner_workspace_idx" ON "daily_work_activity_events" USING btree ("owner_id","workspace_id");--> statement-breakpoint
CREATE INDEX "daily_work_activity_events_workspace_time_idx" ON "daily_work_activity_events" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "daily_work_artifacts_owner_workspace_idx" ON "daily_work_artifacts" USING btree ("owner_id","workspace_id");--> statement-breakpoint
CREATE INDEX "daily_work_artifacts_workspace_time_idx" ON "daily_work_artifacts" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "daily_messages_owner_session_idx" ON "daily_work_messages" USING btree ("owner_id","session_id");--> statement-breakpoint
CREATE INDEX "daily_messages_workspace_time_idx" ON "daily_work_messages" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "permission_grants_owner_session_idx" ON "daily_work_permission_grants" USING btree ("owner_id","session_id");--> statement-breakpoint
CREATE INDEX "permission_grants_workspace_action_idx" ON "daily_work_permission_grants" USING btree ("workspace_id","action");--> statement-breakpoint
CREATE INDEX "permission_grants_status_expiry_idx" ON "daily_work_permission_grants" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "daily_work_sessions_owner_workspace_idx" ON "daily_work_sessions" USING btree ("owner_id","workspace_id");--> statement-breakpoint
CREATE INDEX "daily_work_sessions_workspace_time_idx" ON "daily_work_sessions" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "model_usage_owner_session_idx" ON "model_usage_records" USING btree ("owner_id","session_id");--> statement-breakpoint
CREATE INDEX "model_usage_workspace_time_idx" ON "model_usage_records" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "tool_calls_owner_session_idx" ON "tool_calls" USING btree ("owner_id","session_id");--> statement-breakpoint
CREATE INDEX "tool_calls_workspace_time_idx" ON "tool_calls" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_calls_owner_request_uidx" ON "tool_calls" USING btree ("owner_id","request_id");--> statement-breakpoint
CREATE INDEX "workspaces_owner_runtime_idx" ON "workspaces" USING btree ("owner_id","runtime_mode");--> statement-breakpoint
CREATE INDEX "workspaces_owner_status_idx" ON "workspaces" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "workspaces_last_active_idx" ON "workspaces" USING btree ("last_active_at");
