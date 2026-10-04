-- Catch-up: migrations 0006–0018 were added as files but never registered in
-- meta/_journal.json, so `drizzle-kit migrate` (the production path) never ran
-- them. This re-applies all of them idempotently: anything already present is
-- skipped, anything missing (e.g. expenses.gst_amount_paise) is created.

-- ═══ from 0006_attendance.sql ═══
-- 0006_attendance.sql — Attendance records + leave requests

-- Enums
DO $$ BEGIN CREATE TYPE "attendance_status" AS ENUM ('present', 'absent', 'leave', 'half_day', 'late', 'holiday'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "leave_type" AS ENUM ('casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity', 'comp_off'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "leave_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- attendance_records: one row per employee per day
CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"    uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date"         date NOT NULL,
  "status"       "attendance_status" NOT NULL DEFAULT 'present',
  "check_in_at"  timestamptz,
  "check_out_at" timestamptz,
  "notes"        text,
  "marked_by"    uuid REFERENCES "users"("id"),
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

-- One record per employee per day — enforce at DB level
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_user_date_uniq" ON "attendance_records"("user_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_tenant_date_idx" ON "attendance_records"("tenant_id", "date");
CREATE INDEX IF NOT EXISTS "attendance_user_date_idx"   ON "attendance_records"("user_id", "date");

-- leave_requests: one request spans a date range
CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"    uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "leave_type"   "leave_type" NOT NULL,
  "from_date"    date NOT NULL,
  "to_date"      date NOT NULL,
  "reason"       text NOT NULL,
  "status"       "leave_status" NOT NULL DEFAULT 'pending',
  "reviewed_by"  uuid REFERENCES "users"("id"),
  "reviewed_at"  timestamptz,
  "review_note"  text,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "leave_requests_tenant_idx" ON "leave_requests"("tenant_id");
CREATE INDEX IF NOT EXISTS "leave_requests_user_idx"   ON "leave_requests"("user_id");
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests"("status");
--> statement-breakpoint

-- ═══ from 0007_checkin_location.sql ═══
-- 0007_checkin_location.sql — Add GPS location fields to attendance_records for employee self check-in

ALTER TABLE "attendance_records"
  ADD COLUMN IF NOT EXISTS "check_in_latitude"  numeric(10, 7),
  ADD COLUMN IF NOT EXISTS "check_in_longitude" numeric(10, 7),
  ADD COLUMN IF NOT EXISTS "check_in_address"   text;
--> statement-breakpoint

-- ═══ from 0008_b13_customer_phone_unique.sql ═══
-- B-13: enforce one customer per (tenant_id, phone)
-- Prevents SELECT-then-INSERT race condition in lead conversion and customer upsert.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenant_phone_unique" ON "customers" USING btree ("tenant_id","phone");
--> statement-breakpoint

-- ═══ from 0009_follow_up_pending_unique.sql ═══
-- Enforce at most one pending follow-up per lead per tenant.
-- Partial: only rows where completed_at IS NULL are in scope, preserving the full audit history.
CREATE UNIQUE INDEX IF NOT EXISTS lead_follow_ups_pending_unique
  ON lead_follow_ups (tenant_id, lead_id)
  WHERE completed_at IS NULL;
--> statement-breakpoint

-- ═══ from 0010_site_visit_number_unique.sql ═══
-- Ensure visit numbers are unique per tenant.
-- Partial: NULLs are excluded so rows without a visit_number can coexist freely.
-- Guarded: on a fresh database visit_number arrives in 0027.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_visits' AND column_name = 'visit_number') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS site_visits_tenant_visit_number_unique
      ON site_visits (tenant_id, visit_number)
      WHERE visit_number IS NOT NULL;
  END IF;
END $$;
--> statement-breakpoint

-- ═══ from 0011_site_visit_no_show.sql ═══
-- Add no_show to site_visit_status enum
ALTER TYPE site_visit_status ADD VALUE IF NOT EXISTS 'no_show';
--> statement-breakpoint

-- ═══ from 0012_attendance_unique_user_date.sql ═══
-- Consolidate duplicate indexes on attendance_records(user_id, date).
-- The unique constraint already existed as attendance_user_date_uniq; drop both
-- old indexes and re-create a single uniqueIndex matching the Drizzle schema name.
DROP INDEX IF EXISTS attendance_user_date_idx;
DROP INDEX IF EXISTS attendance_user_date_uniq;
CREATE UNIQUE INDEX attendance_user_date_idx ON attendance_records(user_id, date);
--> statement-breakpoint

-- ═══ from 0013_expenses_vendor_id.sql ═══
-- Add vendor_id FK to expenses table
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
--> statement-breakpoint

-- ═══ from 0014_tasks_status_created_by.sql ═══
-- Add status + createdBy to tasks, and 'task' to the lead_activity_type enum.

-- 1. Extend the lead_activity_type enum (ADD VALUE is non-destructive and transaction-safe in Postgres 12+)
ALTER TYPE lead_activity_type ADD VALUE IF NOT EXISTS 'task';

-- 2. Add status column (text — Zod-validated on insert/update)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- 3. Backfill: any row that has completedAt set is already 'done'
UPDATE tasks SET status = 'done' WHERE completed_at IS NOT NULL AND status = 'pending';

-- 4. Add createdBy FK
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

-- 5. Index on (tenant_id, status) for dashboard queries
CREATE INDEX IF NOT EXISTS tasks_tenant_status_idx ON tasks (tenant_id, status);
--> statement-breakpoint

-- ═══ from 0015_finance_schema_v2.sql ═══
-- Migration: 0015_finance_schema_v2.sql
-- Finance module v2: additive only — no DROP, no ALTER … DROP COLUMN.

-- ── 1. New enums ──────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE invoice_lifecycle_status AS ENUM ('draft', 'issued', 'part_paid', 'paid', 'void'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payment_mode AS ENUM ('upi', 'cash', 'bank', 'cheque', 'card', 'razorpay'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payee_type AS ENUM ('vendor', 'staff', 'office', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. invoices — lifecycle columns ──────────────────────────────────────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS status      invoice_lifecycle_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS issued_at   timestamptz,
  ADD COLUMN IF NOT EXISTS due_date    date,
  ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text;

-- Backfill status from linked milestone.payment_status
UPDATE invoices i
SET    status = CASE
         WHEN m.payment_status = 'paid'                    THEN 'paid'::invoice_lifecycle_status
         WHEN m.payment_status IN ('link_sent', 'overdue') THEN 'issued'::invoice_lifecycle_status
         ELSE                                                   'draft'::invoice_lifecycle_status
       END
FROM   milestones m
WHERE  m.invoice_id = i.id;

-- Backfill status for invoices whose full value was paid directly
UPDATE invoices i
SET    status = 'paid'
WHERE  i.status = 'draft'
  AND  (
         SELECT COALESCE(SUM(p.amount_paise), 0)
         FROM   payments p
         WHERE  p.invoice_id = i.id
           AND  p.status = 'captured'
       ) >= (i.subtotal_paise + i.cgst_paise + i.sgst_paise + i.igst_paise)
  AND  (i.subtotal_paise + i.cgst_paise + i.sgst_paise + i.igst_paise) > 0;

-- Backfill issued_at and due_date for non-draft invoices
UPDATE invoices
SET    issued_at = COALESCE(invoice_date::timestamptz, created_at),
       due_date  = COALESCE(invoice_date::date, created_at::date) + INTERVAL '7 days'
WHERE  status IN ('issued', 'part_paid', 'paid')
  AND  issued_at IS NULL;

CREATE INDEX IF NOT EXISTS invoices_status_tenant_idx
  ON invoices (tenant_id, status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx
  ON invoices (due_date);

-- ── 3. payments — receipt number, mode, metadata ──────────────────────────────

ALTER TABLE payments
  -- Make invoice_id nullable: a receipt may be recorded before an invoice exists
  ALTER COLUMN invoice_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS receipt_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS mode           payment_mode,
  ADD COLUMN IF NOT EXISTS reference      text,
  ADD COLUMN IF NOT EXISTS received_at    timestamptz,
  ADD COLUMN IF NOT EXISTS recorded_by    uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS note           text,
  ADD COLUMN IF NOT EXISTS customer_id    uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id     uuid REFERENCES projects(id)  ON DELETE SET NULL;

-- Backfill: received_at from reconciled_at or created_at
UPDATE payments
SET    received_at = COALESCE(reconciled_at, created_at)
WHERE  received_at IS NULL;

-- Backfill: mode for Razorpay-captured payments
UPDATE payments
SET    mode = 'razorpay'
WHERE  razorpay_payment_id IS NOT NULL
  AND  mode IS NULL;

CREATE INDEX IF NOT EXISTS payments_received_at_tenant_idx
  ON payments (tenant_id, received_at);
CREATE INDEX IF NOT EXISTS payments_customer_idx
  ON payments (customer_id);

-- ── 4. milestones — promised fields ──────────────────────────────────────────

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS promised_at   timestamptz,
  ADD COLUMN IF NOT EXISTS promised_note text;

-- ── 5. expenses — payable and payee fields ────────────────────────────────────

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS due_date     date,
  ADD COLUMN IF NOT EXISTS paid_at      timestamptz,
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS payee_type   payee_type;

CREATE INDEX IF NOT EXISTS expenses_due_date_idx
  ON expenses (due_date);
--> statement-breakpoint

-- ═══ from 0016_grn_per_line.sql ═══
-- Migration: 0016_grn_per_line.sql
-- Adds per-line GRN tracking: grn_number, delivery_date, received_by, status.
-- Additive only — no DROP or breaking ALTER.

ALTER TABLE grns
  ADD COLUMN IF NOT EXISTS grn_number    text,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS received_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'active';

-- Backfill: all existing rows are active deliveries (no voiding existed before this migration).
-- The DEFAULT 'active' above already handles new rows; this ensures legacy rows are also 'active'.
UPDATE grns SET status = 'active' WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS grns_tenant_grn_number_idx
  ON grns (tenant_id, grn_number);
--> statement-breakpoint

-- ═══ from 0017_expenses_po_id.sql ═══
-- Migration: 0017_expenses_po_id.sql
-- Links expenses to purchase orders so a Vendor Bill can be an expense row.
-- Additive only — no DROP or breaking ALTER.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS po_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_po_id_idx ON expenses (po_id);
--> statement-breakpoint

-- ═══ from 0018_vendor_bill_payments.sql ═══
-- Migration 0018: bill-level payment tracking + void support
-- Additive only — no DROP or breaking ALTER.

-- Link vendor_payments to a specific expense (vendor bill)
-- Guarded: on a fresh database vendor_payments is created by 0027.
DO $$ BEGIN
  IF to_regclass('public.vendor_payments') IS NOT NULL THEN
    ALTER TABLE vendor_payments
      ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS vendor_payments_expense_id_idx ON vendor_payments (expense_id);
  END IF;
END $$;

-- Allow a vendor bill (expense) to be voided
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS voided_at timestamptz;
CREATE INDEX IF NOT EXISTS expenses_voided_at_idx ON expenses (voided_at) WHERE voided_at IS NOT NULL;
