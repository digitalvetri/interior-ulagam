-- Employees module migration
-- Adds HR columns to the users table + employment_type enum.
-- Safe to run multiple times (all statements use IF NOT EXISTS / DO guards).
-- Run in: Supabase Dashboard → SQL Editor → New query → paste & Run.

-- ── 1. Create employment_type enum (skip if already exists) ──────────────────

DO $$ BEGIN
  CREATE TYPE "public"."employment_type"
    AS ENUM('full_time', 'part_time', 'contract', 'intern', 'consultant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Add HR columns to users (skip each if already exists) ─────────────────

ALTER TABLE "public"."users"
  ADD COLUMN IF NOT EXISTS "photo_url"               text,
  ADD COLUMN IF NOT EXISTS "job_title"               text,
  ADD COLUMN IF NOT EXISTS "department"              text,
  ADD COLUMN IF NOT EXISTS "location"                text,
  ADD COLUMN IF NOT EXISTS "hire_date"               date,
  ADD COLUMN IF NOT EXISTS "dob"                     date,
  ADD COLUMN IF NOT EXISTS "manager_id"              uuid,
  ADD COLUMN IF NOT EXISTS "emergency_contact_json"  jsonb;

-- status column: NOT NULL with default so existing rows get 'active'
ALTER TABLE "public"."users"
  ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active';

UPDATE "public"."users" SET "status" = 'active' WHERE "status" IS NULL;

ALTER TABLE "public"."users"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'active';

-- employment_type column (enum, nullable)
DO $$ BEGIN
  ALTER TABLE "public"."users"
    ADD COLUMN "employment_type" "public"."employment_type";
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── 3. Self-FK on manager_id (optional — skip if already exists) ─────────────

DO $$ BEGIN
  ALTER TABLE "public"."users"
    ADD CONSTRAINT "users_manager_id_fkey"
    FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
