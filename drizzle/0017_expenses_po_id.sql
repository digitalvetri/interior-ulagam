-- Migration: 0017_expenses_po_id.sql
-- Links expenses to purchase orders so a Vendor Bill can be an expense row.
-- Additive only — no DROP or breaking ALTER.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS po_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_po_id_idx ON expenses (po_id);
