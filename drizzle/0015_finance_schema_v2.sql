-- Migration: 0015_finance_schema_v2.sql
-- Finance module v2: additive only — no DROP, no ALTER … DROP COLUMN.

-- ── 1. New enums ──────────────────────────────────────────────────────────────

CREATE TYPE invoice_lifecycle_status AS ENUM
  ('draft', 'issued', 'part_paid', 'paid', 'void');

CREATE TYPE payment_mode AS ENUM
  ('upi', 'cash', 'bank', 'cheque', 'card', 'razorpay');

CREATE TYPE payee_type AS ENUM
  ('vendor', 'staff', 'office', 'other');

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
