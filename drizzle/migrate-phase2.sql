-- Phase 2 migration: schema corrections
-- Safe to run multiple times (all statements use IF NOT EXISTS / DO guards)

-- ── 1. Add customer_id to projects ────────────────────────────────────────────
-- This column was present in schema.ts but missing from the initial migration,
-- causing Drizzle's RETURNING clause to reference a nonexistent column (500 error).

ALTER TABLE "public"."projects"
  ADD COLUMN IF NOT EXISTS "customer_id" uuid
    REFERENCES "public"."customers"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "projects_customer_idx"
  ON "public"."projects"("customer_id");

-- ── 2. Backfill: link existing projects to their customer via the lead ─────────
-- If a project has a lead_id, and that lead has a customer_id, wire them up.
UPDATE "public"."projects" p
SET customer_id = l.customer_id
FROM "public"."leads" l
WHERE p.lead_id = l.id
  AND l.customer_id IS NOT NULL
  AND p.customer_id IS NULL;
