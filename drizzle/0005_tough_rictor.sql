CREATE TYPE "public"."design_deliverable_status" AS ENUM('draft', 'shared', 'changes_requested', 'approved');--> statement-breakpoint
CREATE TYPE "public"."design_deliverable_type" AS ENUM('mood_board', '2d_layout', '3d_render', 'working_drawing', 'material_board');--> statement-breakpoint
CREATE TYPE "public"."service_request_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."service_request_status" AS ENUM('open', 'assigned', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('planned', 'in_progress', 'ready', 'installed');--> statement-breakpoint
CREATE TYPE "public"."work_order_type" AS ENUM('inhouse_carpentry', 'factory', 'vendor_job', 'site_work');--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE 'measured';--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE 'booked';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'admin';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'employee';--> statement-breakpoint
CREATE TABLE "deliverable_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"version_id" uuid,
	"body" text NOT NULL,
	"from_client" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverable_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text,
	"shared_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"project_id" uuid,
	"type" "design_deliverable_type" NOT NULL,
	"title" text NOT NULL,
	"revision_cap" integer DEFAULT 3 NOT NULL,
	"status" "design_deliverable_status" DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_client" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"room" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"project_id" uuid,
	"issue" text NOT NULL,
	"photo_url" text,
	"priority" "service_request_priority" DEFAULT 'medium' NOT NULL,
	"status" "service_request_status" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"scheduled_visit_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"assigned_to" uuid,
	"related_type" text,
	"related_id" uuid,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"quote_line_id" uuid,
	"title" text NOT NULL,
	"type" "work_order_type" DEFAULT 'site_work' NOT NULL,
	"assigned_user_id" uuid,
	"assigned_vendor_id" uuid,
	"start_date" date,
	"due_date" date,
	"status" "work_order_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "cold_flag_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "pdf_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "client_portal_token" text;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN "finish" text;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "quote_number" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "discount_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "gst_pct" integer DEFAULT 18 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "margin_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "terms_text" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions_json" jsonb DEFAULT '{"canSeeFinance":false,"canCreateQuotes":false,"canSendQuotes":false,"canRaisePO":false,"canRecordPayments":false,"canSeeAllLeads":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD CONSTRAINT "deliverable_comments_deliverable_id_design_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."design_deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD CONSTRAINT "deliverable_comments_version_id_deliverable_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."deliverable_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD CONSTRAINT "deliverable_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_deliverable_id_design_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."design_deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD CONSTRAINT "design_deliverables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD CONSTRAINT "design_deliverables_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD CONSTRAINT "design_deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD CONSTRAINT "design_deliverables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_sections" ADD CONSTRAINT "quote_sections_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_quote_line_id_quote_lines_id_fk" FOREIGN KEY ("quote_line_id") REFERENCES "public"."quote_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_vendor_id_vendors_id_fk" FOREIGN KEY ("assigned_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliverable_comments_deliverable_idx" ON "deliverable_comments" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "deliverable_versions_deliverable_idx" ON "deliverable_versions" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "design_deliverables_lead_idx" ON "design_deliverables" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "design_deliverables_project_idx" ON "design_deliverables" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "quote_sections_quote_idx" ON "quote_sections" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "service_requests_tenant_status_idx" ON "service_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tasks_tenant_assigned_idx" ON "tasks" USING btree ("tenant_id","assigned_to");--> statement-breakpoint
CREATE INDEX "work_orders_tenant_project_idx" ON "work_orders" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "work_orders_status_idx" ON "work_orders" USING btree ("status");--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_section_id_quote_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."quote_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_portal_token_unique" UNIQUE("client_portal_token");