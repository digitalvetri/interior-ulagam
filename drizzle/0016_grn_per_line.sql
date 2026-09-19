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
