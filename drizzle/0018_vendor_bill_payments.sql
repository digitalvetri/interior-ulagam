-- Migration 0018: bill-level payment tracking + void support
-- Additive only — no DROP or breaking ALTER.

-- Link vendor_payments to a specific expense (vendor bill)
ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS vendor_payments_expense_id_idx ON vendor_payments (expense_id);

-- Allow a vendor bill (expense) to be voided
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS voided_at timestamptz;
CREATE INDEX IF NOT EXISTS expenses_voided_at_idx ON expenses (voided_at) WHERE voided_at IS NOT NULL;
