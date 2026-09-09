-- Phase F1: Records get homes
-- Additive migration + work_order_status enum remap.
-- Data effect: all 9 work_orders rows move from 'planned' → 'assigned'.

-- ── site_visits ──────────────────────────────────────────────────────────────
CREATE TYPE site_visit_purpose AS ENUM (
  'initial', 'measurement', 'design_review', 'site_inspection',
  'material_inspection', 'final_inspection', 'other'
);
ALTER TABLE site_visits
  ADD COLUMN IF NOT EXISTS purpose          site_visit_purpose,
  ADD COLUMN IF NOT EXISTS project_id       uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visit_number     text,
  ADD COLUMN IF NOT EXISTS follow_up_notes  text;

-- ── measurement_rounds ───────────────────────────────────────────────────────
CREATE TYPE measurement_round_status AS ENUM ('draft', 'completed', 'revised');
ALTER TABLE measurement_rounds
  ADD COLUMN IF NOT EXISTS status             measurement_round_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS project_id         uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_visit_id      uuid REFERENCES site_visits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS measurement_number text;

-- ── measurement_items ────────────────────────────────────────────────────────
ALTER TABLE measurement_items
  ADD COLUMN IF NOT EXISTS floor      text,
  ADD COLUMN IF NOT EXISTS area_sqft  numeric(10,3);

-- ── quotes ───────────────────────────────────────────────────────────────────
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS valid_until    date,
  ADD COLUMN IF NOT EXISTS payment_terms  text;

-- ── work_orders: enum remap ──────────────────────────────────────────────────
-- Old: planned | in_progress | ready | installed
-- New: draft | assigned | in_progress | on_hold | completed | cancelled
-- Data mapping: planned→assigned, in_progress→in_progress, ready→completed, installed→completed
-- Current rows: 9, all 'planned' → will all become 'assigned'
CREATE TYPE work_order_status_v2 AS ENUM (
  'draft', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'
);
ALTER TABLE work_orders ALTER COLUMN status TYPE text;
UPDATE work_orders SET status = CASE status
  WHEN 'planned'     THEN 'assigned'
  WHEN 'in_progress' THEN 'in_progress'
  WHEN 'ready'       THEN 'completed'
  WHEN 'installed'   THEN 'completed'
  ELSE                    'assigned'
END;
ALTER TABLE work_orders
  ALTER COLUMN status TYPE work_order_status_v2 USING status::work_order_status_v2,
  ALTER COLUMN status SET DEFAULT 'draft';
DROP TYPE work_order_status;
ALTER TYPE work_order_status_v2 RENAME TO work_order_status;

-- ── work_orders: new columns ─────────────────────────────────────────────────
CREATE TYPE work_order_priority AS ENUM ('low', 'normal', 'high', 'urgent');
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS priority             work_order_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS description          text,
  ADD COLUMN IF NOT EXISTS room                 text,
  ADD COLUMN IF NOT EXISTS estimated_cost_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost_paise    bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS materials_json       jsonb  NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments          text[] NOT NULL DEFAULT '{}'::text[];

-- ── work_order_updates (new table) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_order_updates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid        NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  progress_pct  integer,
  note          text,
  photos        text[]      NOT NULL DEFAULT '{}'::text[],
  created_by    uuid        REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_order_updates_wo_idx ON work_order_updates(work_order_id);

-- ── site_logs: new columns ───────────────────────────────────────────────────
ALTER TABLE site_logs
  ADD COLUMN IF NOT EXISTS activity_type           text,
  ADD COLUMN IF NOT EXISTS follow_up_actions       text,
  ADD COLUMN IF NOT EXISTS attachments             text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS related_work_order_ids  uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- ── vendor_payments (new table) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_payments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id         uuid        REFERENCES vendors(id) ON DELETE SET NULL,
  purchase_order_id uuid        REFERENCES purchase_orders(id) ON DELETE SET NULL,
  amount_paise      bigint      NOT NULL,
  paid_at           timestamptz NOT NULL DEFAULT now(),
  method            text,
  reference         text,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_payments_tenant_idx ON vendor_payments(tenant_id);
CREATE INDEX IF NOT EXISTS vendor_payments_vendor_idx ON vendor_payments(vendor_id);
