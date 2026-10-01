CREATE TABLE IF NOT EXISTS "ai_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"type" text NOT NULL,
	"storage_key" text NOT NULL UNIQUE,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"sha256" text,
	"source_sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_tryon_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"status" text DEFAULT 'CREATED' NOT NULL,
	"visibility_flag" text,
	"classifier_confidence" numeric,
	"provider" text DEFAULT 'krea' NOT NULL,
	"provider_job_id" text,
	"user_image_asset_id" uuid,
	"garment_asset_id" uuid,
	"result_asset_id" uuid,
	"generation_prompt_version" text DEFAULT 'v1' NOT NULL,
	"error_code" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_tryon_cust_idemp_uq" ON "ai_tryon_jobs" ("customer_id", "idempotency_key");
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "tryon_asset_id" uuid;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "tryon_metadata" jsonb;
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "tryon_source_sha256" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_assets" ADD CONSTRAINT "ai_assets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_tryon_jobs" ADD CONSTRAINT "ai_tryon_jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_tryon_jobs" ADD CONSTRAINT "ai_tryon_jobs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_tryon_jobs" ADD CONSTRAINT "ai_tryon_jobs_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_tryon_jobs" ADD CONSTRAINT "ai_tryon_jobs_user_image_asset_id_ai_assets_id_fk" FOREIGN KEY ("user_image_asset_id") REFERENCES "public"."ai_assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_tryon_jobs" ADD CONSTRAINT "ai_tryon_jobs_garment_asset_id_ai_assets_id_fk" FOREIGN KEY ("garment_asset_id") REFERENCES "public"."ai_assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_tryon_jobs" ADD CONSTRAINT "ai_tryon_jobs_result_asset_id_ai_assets_id_fk" FOREIGN KEY ("result_asset_id") REFERENCES "public"."ai_assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tryon_asset_id_ai_assets_id_fk" FOREIGN KEY ("tryon_asset_id") REFERENCES "public"."ai_assets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
