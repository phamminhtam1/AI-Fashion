ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "tagline" text;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'SPECIAL RUNWAY COLLECTION';
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "hero_image_url" text;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") - 1 AS position
  FROM "collections"
)
UPDATE "collections" AS c
SET "sort_order" = ranked.position
FROM ranked
WHERE c."id" = ranked."id";

CREATE UNIQUE INDEX IF NOT EXISTS "collections_one_featured_idx"
ON "collections" ("is_featured")
WHERE "is_featured" = true;
