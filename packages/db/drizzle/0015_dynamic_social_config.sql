CREATE TABLE IF NOT EXISTS "social_platform_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL UNIQUE,
  "app_id" text NOT NULL,
  "encrypted_app_secret" text NOT NULL,
  "encrypted_webhook_verify_token" text NOT NULL,
  "graph_version" text DEFAULT 'v23.0' NOT NULL,
  "redirect_uri" text,
  "updated_by_id" uuid REFERENCES "accounts"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
