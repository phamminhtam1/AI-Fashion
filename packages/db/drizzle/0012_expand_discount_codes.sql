ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "image_url" text;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "banner_url" text;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "apply_scope" text DEFAULT 'all' NOT NULL;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "applied_products" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "applied_category_ids" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "customer_group" text DEFAULT 'all' NOT NULL;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "per_customer_limit" integer;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "apply_on_sale" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "show_on_homepage" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "stackable" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "created_by_id" uuid;
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "updated_by_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_created_by_id_accounts_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_updated_by_id_accounts_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
