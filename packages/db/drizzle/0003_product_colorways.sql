CREATE TABLE "product_colorways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "product_colorways" ADD CONSTRAINT "product_colorways_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "_colorway_map" (
	"product_id" uuid NOT NULL,
	"color_id" uuid NOT NULL,
	"colorway_id" uuid NOT NULL,
	PRIMARY KEY ("product_id", "color_id")
);--> statement-breakpoint
INSERT INTO "product_colorways" ("id", "product_id", "sort_order")
SELECT gen_random_uuid(), sub.product_id, sub.rn - 1
FROM (
	SELECT v.product_id, v.color_id,
		ROW_NUMBER() OVER (PARTITION BY v.product_id ORDER BY MIN(c.code)) AS rn
	FROM product_variants v
	JOIN colors c ON c.id = v.color_id
	GROUP BY v.product_id, v.color_id
) sub;--> statement-breakpoint
INSERT INTO "_colorway_map" ("product_id", "color_id", "colorway_id")
SELECT v.product_id, v.color_id, cw.id
FROM (
	SELECT DISTINCT product_id, color_id FROM product_variants
) v
JOIN product_colorways cw ON cw.product_id = v.product_id
JOIN colors c ON c.id = v.color_id
JOIN (
	SELECT v2.product_id, v2.color_id,
		ROW_NUMBER() OVER (PARTITION BY v2.product_id ORDER BY MIN(c2.code)) - 1 AS sort_order
	FROM product_variants v2
	JOIN colors c2 ON c2.id = v2.color_id
	GROUP BY v2.product_id, v2.color_id
) ranked ON ranked.product_id = v.product_id AND ranked.color_id = v.color_id AND ranked.sort_order = cw.sort_order;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "colorway_id" uuid;--> statement-breakpoint
UPDATE "product_variants" pv
SET "colorway_id" = m.colorway_id
FROM "_colorway_map" m
WHERE pv.product_id = m.product_id AND pv.color_id = m.color_id;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "colorway_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "variant_pcs_uq";--> statement-breakpoint
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_color_id_colors_id_fk";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "color_id";--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_colorway_id_product_colorways_id_fk" FOREIGN KEY ("colorway_id") REFERENCES "public"."product_colorways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "variant_pcs_uq" ON "product_variants" USING btree ("product_id","colorway_id","size_id");--> statement-breakpoint
ALTER TABLE "product_media" ADD COLUMN "colorway_id" uuid;--> statement-breakpoint
UPDATE "product_media" pm
SET "colorway_id" = m.colorway_id
FROM "_colorway_map" m
WHERE pm.product_id = m.product_id AND pm.color_id = m.color_id;--> statement-breakpoint
UPDATE "product_media" pm
SET "colorway_id" = cw.id
FROM (
	SELECT DISTINCT ON (product_id) id, product_id
	FROM product_colorways
	ORDER BY product_id, sort_order ASC
) cw
WHERE pm.colorway_id IS NULL AND pm.product_id = cw.product_id;--> statement-breakpoint
INSERT INTO "product_colorways" ("id", "product_id", "sort_order")
SELECT gen_random_uuid(), orphan.product_id, 0
FROM (
	SELECT DISTINCT pm.product_id
	FROM product_media pm
	WHERE pm.colorway_id IS NULL
	AND NOT EXISTS (SELECT 1 FROM product_colorways cw WHERE cw.product_id = pm.product_id)
) orphan;--> statement-breakpoint
UPDATE "product_media" pm
SET "colorway_id" = cw.id
FROM (
	SELECT DISTINCT ON (product_id) id, product_id
	FROM product_colorways
	ORDER BY product_id, sort_order ASC
) cw
WHERE pm.colorway_id IS NULL AND pm.product_id = cw.product_id;--> statement-breakpoint
ALTER TABLE "product_media" DROP CONSTRAINT IF EXISTS "product_media_color_id_colors_id_fk";--> statement-breakpoint
ALTER TABLE "product_media" DROP COLUMN IF EXISTS "color_id";--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_colorway_id_product_colorways_id_fk" FOREIGN KEY ("colorway_id") REFERENCES "public"."product_colorways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TABLE "_colorway_map";
