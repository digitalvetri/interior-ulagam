CREATE TYPE "public"."follow_up_type" AS ENUM('call', 'whatsapp', 'meeting', 'email');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'revised', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."site_visit_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "lead_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"follow_up_date" timestamp with time zone,
	"follow_up_type" "follow_up_type",
	"stage" text NOT NULL,
	"client_status" text NOT NULL,
	"comments" text,
	"completed_at" timestamp with time zone,
	"rescheduled_from_id" uuid,
	"rescheduled_notes" text,
	"add_to_calendar" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"room" text NOT NULL,
	"item_name" text NOT NULL,
	"dimensions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'sqft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"round_name" text DEFAULT 'Round 1' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_to_id" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "materials" DROP CONSTRAINT "materials_vendor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_vendor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" SET DEFAULT 'new'::text;--> statement-breakpoint
DROP TYPE "public"."lead_stage";--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'contacted', 'qualified', 'site_visit', 'measurement', 'quotation', 'negotiation', 'won', 'lost', 'site_visit_scheduled', 'consultation_done', 'proposal_sent');--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" SET DEFAULT 'new'::"public"."lead_stage";--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" SET DATA TYPE "public"."lead_stage" USING "stage"::"public"."lead_stage";--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN "contact_method" text;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN "metadata_json" jsonb;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "selling_rate_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "parent_quote_id" uuid;--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN "status" "site_visit_status" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_rescheduled_from_id_lead_follow_ups_id_fk" FOREIGN KEY ("rescheduled_from_id") REFERENCES "public"."lead_follow_ups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_items" ADD CONSTRAINT "measurement_items_round_id_measurement_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."measurement_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_follow_ups_lead_idx" ON "lead_follow_ups" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_follow_ups_tenant_lead_idx" ON "lead_follow_ups" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "measurement_items_round_idx" ON "measurement_items" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "measurement_rounds_lead_idx" ON "measurement_rounds" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "measurement_rounds_tenant_idx" ON "measurement_rounds" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_parent_quote_id_quotes_id_fk" FOREIGN KEY ("parent_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;