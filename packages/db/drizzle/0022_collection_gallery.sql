ALTER TABLE "collections"
ADD COLUMN IF NOT EXISTS "gallery_images" jsonb NOT NULL DEFAULT '[]'::jsonb;
