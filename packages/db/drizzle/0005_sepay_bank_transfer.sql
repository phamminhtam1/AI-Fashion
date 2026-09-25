ALTER TABLE "orders" ADD COLUMN "payment_status" text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_ref" text;--> statement-breakpoint
CREATE TABLE "sepay_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sepay_id" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	"matched_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sepay_webhook_events_sepay_id_unique" UNIQUE("sepay_id")
);--> statement-breakpoint
ALTER TABLE "sepay_webhook_events" ADD CONSTRAINT "sepay_webhook_events_matched_order_id_orders_id_fk" FOREIGN KEY ("matched_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
