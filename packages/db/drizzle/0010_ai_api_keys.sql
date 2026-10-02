CREATE TABLE IF NOT EXISTS "ai_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'kie' NOT NULL,
	"label" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"masked_key" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"credits_remaining" integer,
	"cooldown_until" timestamp with time zone,
	"priority" integer DEFAULT 1 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_error_message" text,
	"last_used_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
