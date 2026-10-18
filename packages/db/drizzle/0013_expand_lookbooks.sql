ALTER TABLE "lookbooks" ADD COLUMN IF NOT EXISTS "intro_content" text;
ALTER TABLE "lookbooks" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
ALTER TABLE "lookbooks" ADD COLUMN IF NOT EXISTS "unpublish_at" timestamp with time zone;
ALTER TABLE "lookbooks" ADD COLUMN IF NOT EXISTS "show_on_home" boolean DEFAULT true NOT NULL;
ALTER TABLE "lookbooks" ADD COLUMN IF NOT EXISTS "allow_products" boolean DEFAULT true NOT NULL;
ALTER TABLE "lookbooks" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "lookbooks" ADD COLUMN IF NOT EXISTS "attached_products" jsonb DEFAULT '[]'::jsonb;
