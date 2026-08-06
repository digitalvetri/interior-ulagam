-- Lead follow-up history table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS "public"."lead_follow_ups" (
  "id"              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"       uuid        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  "lead_id"         uuid        NOT NULL REFERENCES leads(id)    ON DELETE CASCADE,
  "follow_up_date"  timestamptz,
  "stage"           text        NOT NULL DEFAULT 'new',
  "client_status"   text        NOT NULL DEFAULT 'interested',
  "comments"        text,
  "add_to_calendar" boolean     NOT NULL DEFAULT true,
  "created_by"      uuid        REFERENCES users(id),
  "updated_by"      uuid        REFERENCES users(id),
  "updated_at"      timestamptz NOT NULL DEFAULT now(),
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "lead_follow_ups_lead_idx"        ON "public"."lead_follow_ups" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_follow_ups_tenant_lead_idx" ON "public"."lead_follow_ups" ("tenant_id", "lead_id");

-- Enable RLS
ALTER TABLE "public"."lead_follow_ups" ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read/write policies (drop first so the file is safe to re-run)
DROP POLICY IF EXISTS "tenant_read"   ON "public"."lead_follow_ups";
DROP POLICY IF EXISTS "tenant_insert" ON "public"."lead_follow_ups";
DROP POLICY IF EXISTS "tenant_update" ON "public"."lead_follow_ups";

CREATE POLICY "tenant_read" ON "public"."lead_follow_ups"
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_insert" ON "public"."lead_follow_ups"
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_update" ON "public"."lead_follow_ups"
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
