CREATE TYPE "public"."customer_source" AS ENUM('referral', 'instagram', 'whatsapp', 'website', 'walk_in', 'imported', 'other');--> statement-breakpoint
CREATE TYPE "public"."customer_stage" AS ENUM('lead', 'opportunity', 'client', 'past_client');--> statement-breakpoint
CREATE TYPE "public"."deliverable_status" AS ENUM('pending', 'in_progress', 'in_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."deliverable_type" AS ENUM('2d_plan', '3d_render', 'color_palette', 'working_drawings', 'bom');--> statement-breakpoint
CREATE TYPE "public"."design_task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."design_task_status" AS ENUM('todo', 'in_progress', 'review', 'done');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('folder', 'file');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'intern', 'consultant');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('petty_cash', 'transport', 'labour', 'material', 'other');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('pending', 'completed', 'overdue', 'rescheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_activity_type" AS ENUM('call', 'whatsapp', 'note', 'site_visit', 'meeting', 'stage_change', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."lead_priority" AS ENUM('hot', 'warm', 'cold');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('instagram', 'whatsapp', 'referral', 'website', 'walk_in', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'site_visit_scheduled', 'consultation_done', 'proposal_sent', 'negotiation', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."material_category" AS ENUM('laminate', 'hardware', 'furniture', 'fabric', 'lighting', 'flooring', 'sanitary', 'other');--> statement-breakpoint
CREATE TYPE "public"."message_category" AS ENUM('utility', 'marketing', 'service');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'success', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'link_sent', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('draft', 'sent', 'acknowledged', 'partial', 'complete', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."project_stage" AS ENUM('design_pending', 'design_in_progress', 'design_approved', 'procurement', 'execution', 'snagging', 'handover', 'complete');--> statement-breakpoint
CREATE TYPE "public"."site_log_source" AS ENUM('whatsapp', 'manual');--> statement-breakpoint
CREATE TYPE "public"."snag_status" AS ENUM('open', 'in_progress', 'resolved', 'client_confirmed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'designer', 'supervisor', 'accountant');--> statement-breakpoint
CREATE TABLE "client_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_id" uuid,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text NOT NULL,
	"company" text,
	"city" text,
	"address" text,
	"source" "customer_source" DEFAULT 'other' NOT NULL,
	"stage" "customer_stage" DEFAULT 'lead' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"last_contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "deliverable_type" NOT NULL,
	"status" "deliverable_status" DEFAULT 'pending' NOT NULL,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"revision_cap" integer DEFAULT 2 NOT NULL,
	"latest_file_url" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "design_task_status" DEFAULT 'todo' NOT NULL,
	"priority" "design_task_priority" DEFAULT 'normal' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"kind" "document_kind" NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"storage_path" text,
	"project_id" uuid,
	"uploaded_by" uuid,
	"starred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount_paise" integer NOT NULL,
	"description" text,
	"receipt_url" text,
	"logged_by" uuid,
	"logged_via" text DEFAULT 'manual' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"po_id" uuid NOT NULL,
	"line_id" uuid,
	"delivered_qty" integer NOT NULL,
	"photo_proof" text[] DEFAULT '{}'::text[] NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" date NOT NULL,
	"hsn_sac_lines_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_paise" integer DEFAULT 0 NOT NULL,
	"cgst_paise" integer DEFAULT 0 NOT NULL,
	"sgst_paise" integer DEFAULT 0 NOT NULL,
	"igst_paise" integer DEFAULT 0 NOT NULL,
	"place_of_supply" text,
	"is_interstate" boolean DEFAULT false NOT NULL,
	"irn" text,
	"qr_code_url" text,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" "lead_activity_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status" "follow_up_status",
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" "lead_source" DEFAULT 'whatsapp' NOT NULL,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"priority" "lead_priority",
	"owner_id" uuid,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text,
	"property_type" text,
	"project_location" text,
	"budget_band" text,
	"project_value_paise" bigint,
	"designer_name" text,
	"follow_up_date" timestamp with time zone,
	"lost_reason" text,
	"notes" text,
	"preferred_language" text DEFAULT 'en',
	"first_touch_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category" "material_category" NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"vendor_id" uuid,
	"unit" text DEFAULT 'nos' NOT NULL,
	"current_rate_paise" integer DEFAULT 0 NOT NULL,
	"last_purchase_price_paise" integer,
	"price_history_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hsn_sac" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"pct_of_total" integer NOT NULL,
	"amount_paise" integer DEFAULT 0 NOT NULL,
	"trigger_stage" "project_stage",
	"invoice_id" uuid,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"razorpay_link_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"razorpay_link_id" text,
	"razorpay_payment_id" text,
	"amount_paise" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reconciled_at" timestamp with time zone,
	"manual_override_by" uuid,
	"manual_override_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"cover_photo_url" text,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"client_consent" boolean DEFAULT false NOT NULL,
	"ai_curated_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"name" text DEFAULT '' NOT NULL,
	"designer_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"total_contract_paise" integer,
	"lifecycle_stage" "project_stage" DEFAULT 'design_pending' NOT NULL,
	"timeline_json" jsonb,
	"started_at" timestamp with time zone,
	"expected_end_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"vendor_id" uuid,
	"po_number" text NOT NULL,
	"lines_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "po_status" DEFAULT 'draft' NOT NULL,
	"advance_paid_paise" integer DEFAULT 0 NOT NULL,
	"expected_delivery_at" timestamp with time zone,
	"pdf_url" text,
	"wa_message_id" text,
	"vendor_phone" text,
	"vendor_contact_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"room" text NOT NULL,
	"item" text NOT NULL,
	"description" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'nos' NOT NULL,
	"client_rate_paise" integer DEFAULT 0 NOT NULL,
	"cost_rate_paise" integer DEFAULT 0 NOT NULL,
	"margin_paise" integer DEFAULT 0 NOT NULL,
	"hsn_sac" text,
	"material_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal_paise" integer DEFAULT 0 NOT NULL,
	"gst_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer DEFAULT 0 NOT NULL,
	"pdf_url" text,
	"sent_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approval_audit_json" jsonb,
	"wa_message_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"rooms_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"style_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"budget_band" text,
	"moodboard_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"total_area_sqft" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"voice_note_url" text,
	"transcript" text,
	"progress_pct" integer,
	"stage" text,
	"delay_flag" boolean DEFAULT false NOT NULL,
	"labour_count" integer,
	"blockers_json" jsonb,
	"ai_parsed_json" jsonb,
	"source" "site_log_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"designer_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"location_json" jsonb,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"measurements_json" jsonb,
	"voice_notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snag_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"description" text NOT NULL,
	"photo_url" text,
	"assignee_id" uuid,
	"status" "snag_status" DEFAULT 'open' NOT NULL,
	"client_confirmed_at" timestamp with time zone,
	"wa_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"gstin" text,
	"branding_json" jsonb,
	"wa_config" jsonb,
	"tally_settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supabase_uid" uuid,
	"role" "user_role" DEFAULT 'designer' NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"photo_url" text,
	"job_title" text,
	"department" text,
	"location" text,
	"employment_type" "employment_type",
	"hire_date" date,
	"dob" date,
	"manager_id" uuid,
	"emergency_contact_json" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabase_uid_unique" UNIQUE("supabase_uid")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"gstin" text,
	"category" "material_category",
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"thread_id" text NOT NULL,
	"meta_message_id" text,
	"direction" "message_direction" NOT NULL,
	"category" "message_category",
	"template_name" text,
	"body_preview" text,
	"flow_response_json" jsonb,
	"cost_paise" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_tokens" ADD CONSTRAINT "client_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tokens" ADD CONSTRAINT "client_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grns" ADD CONSTRAINT "grns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grns" ADD CONSTRAINT "grns_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_vendor_id_users_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_manual_override_by_users_id_fk" FOREIGN KEY ("manual_override_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_users_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_logs" ADD CONSTRAINT "site_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_logs" ADD CONSTRAINT "site_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_designer_id_users_id_fk" FOREIGN KEY ("designer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_tokens_token_idx" ON "client_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "client_tokens_project_idx" ON "client_tokens" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "customers_tenant_stage_idx" ON "customers" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "customers_tenant_owner_idx" ON "customers" USING btree ("tenant_id","owner_id");--> statement-breakpoint
CREATE INDEX "design_tasks_tenant_status_idx" ON "design_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "design_tasks_tenant_project_idx" ON "design_tasks" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "documents_tenant_parent_idx" ON "documents" USING btree ("tenant_id","parent_id");--> statement-breakpoint
CREATE INDEX "documents_tenant_starred_idx" ON "documents" USING btree ("tenant_id","starred");--> statement-breakpoint
CREATE INDEX "lead_activities_tenant_lead_idx" ON "lead_activities" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "leads_tenant_stage_idx" ON "leads" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "leads_tenant_owner_idx" ON "leads" USING btree ("tenant_id","owner_id");--> statement-breakpoint
CREATE INDEX "notifications_tenant_read_idx" ON "notifications" USING btree ("tenant_id","read_at");--> statement-breakpoint
CREATE INDEX "portfolios_tenant_idx" ON "portfolios" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "projects_tenant_stage_idx" ON "projects" USING btree ("tenant_id","lifecycle_stage");--> statement-breakpoint
CREATE INDEX "vendors_tenant_idx" ON "vendors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "wa_messages_tenant_thread_idx" ON "wa_messages" USING btree ("tenant_id","thread_id");