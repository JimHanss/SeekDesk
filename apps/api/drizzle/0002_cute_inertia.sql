CREATE TABLE "daily_work_permission_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'daily_work' NOT NULL,
	"provider" text NOT NULL,
	"session_id" text NOT NULL,
	"action" text NOT NULL,
	"decision" text DEFAULT 'allow_for_session' NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
