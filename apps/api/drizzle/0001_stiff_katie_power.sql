CREATE TABLE "daily_work_context_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'daily_work' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
