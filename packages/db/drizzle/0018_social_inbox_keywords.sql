CREATE TABLE IF NOT EXISTS "social_reply_keywords" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid REFERENCES "instagram_connections"("id") ON DELETE CASCADE,
  "keyword" text NOT NULL,
  "created_by_id" uuid REFERENCES "accounts"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_reply_keywords_connection_keyword_uq"
  ON "social_reply_keywords" ("connection_id", "keyword");
