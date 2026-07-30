-- Phase 1 migration: adds missing enums, columns, and tables
-- Safe to run multiple times (uses IF NOT EXISTS / DO guards)

-- ── 1. New enums ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."customer_health_status"
    AS ENUM('hot', 'healthy', 'at_risk', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."customer_activity_type"
    AS ENUM('call', 'whatsapp', 'note', 'site_visit', 'meeting',
            'stage_change', 'project_created', 'payment_received',
            'quote_sent', 'follow_up');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. New columns on leads ───────────────────────────────────────────────────

ALTER TABLE "public"."leads"
  ADD COLUMN IF NOT EXISTS "customer_id" uuid
    REFERENCES "public"."customers"("id") ON DELETE SET NULL;

ALTER TABLE "public"."leads"
  ADD COLUMN IF NOT EXISTS "score" smallint DEFAULT 0;

ALTER TABLE "public"."leads"
  ADD COLUMN IF NOT EXISTS "score_breakdown" jsonb;

-- ── 3. New columns on customers ───────────────────────────────────────────────

ALTER TABLE "public"."customers"
  ADD COLUMN IF NOT EXISTS "lead_id" uuid
    REFERENCES "public"."leads"("id") ON DELETE SET NULL;

ALTER TABLE "public"."customers"
  ADD COLUMN IF NOT EXISTS "health_score" smallint;

ALTER TABLE "public"."customers"
  ADD COLUMN IF NOT EXISTS "health_status" "public"."customer_health_status";

ALTER TABLE "public"."customers"
  ADD COLUMN IF NOT EXISTS "health_updated_at" timestamp with time zone;

-- ── 4. New table: customer_activities ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."customer_activities" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"    uuid NOT NULL
    REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "customer_id"  uuid NOT NULL
    REFERENCES "public"."customers"("id") ON DELETE CASCADE,
  "type"         "public"."customer_activity_type" NOT NULL,
  "title"        text NOT NULL,
  "body"         text,
  "metadata_json" jsonb,
  "scheduled_at"  timestamp with time zone,
  "completed_at"  timestamp with time zone,
  "performed_by"  uuid REFERENCES "public"."users"("id"),
  "created_at"   timestamp with time zone DEFAULT now() NOT NULL
);

-- ── 5. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "leads_customer_idx"
  ON "public"."leads"("customer_id");

CREATE INDEX IF NOT EXISTS "customer_activities_customer_idx"
  ON "public"."customer_activities"("customer_id");

CREATE INDEX IF NOT EXISTS "customer_activities_tenant_type_idx"
  ON "public"."customer_activities"("tenant_id", "type");
