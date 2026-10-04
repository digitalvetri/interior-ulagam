-- Project money & client payment ledger.
-- Contract value is typed by the owner, excluding GST; GST is added per project.
-- Milestones fall due on a date or when their stage is reached; payments are
-- allocated to milestones; salaried staff cost comes from days logged per project.

ALTER TABLE projects ALTER COLUMN total_contract_paise TYPE bigint;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gst_pct smallint NOT NULL DEFAULT 18 CHECK (gst_pct IN (0, 5, 12, 18, 28));
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN IF NOT EXISTS handover_at timestamptz;
--> statement-breakpoint
ALTER TABLE milestones ALTER COLUMN amount_paise TYPE bigint;
--> statement-breakpoint
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS due_on date;
--> statement-breakpoint
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS due_since date;
--> statement-breakpoint
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- Keep today's order: by creation time within each project.
UPDATE milestones m SET sort_order = o.rn
  FROM (SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY created_at, id) AS rn FROM milestones) o
 WHERE o.id = m.id;
--> statement-breakpoint
-- Milestones whose stage the project has already reached (or with no trigger) are due.
UPDATE milestones m
   SET due_since = COALESCE(p.started_at, p.created_at)::date
  FROM projects p
 WHERE p.id = m.project_id
   AND m.due_since IS NULL
   AND (m.trigger_stage IS NULL
        OR array_position(ARRAY['design_pending','design_in_progress','design_approved','procurement','execution','snagging','handover','complete'], p.lifecycle_stage::text)
           >= array_position(ARRAY['design_pending','design_in_progress','design_approved','procurement','execution','snagging','handover','complete'], m.trigger_stage::text));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS project_additions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description  text NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),
  added_on     date NOT NULL DEFAULT current_date,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS project_additions_project_idx ON project_additions (project_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS payment_allocations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id   uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx ON payment_allocations (payment_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payment_allocations_milestone_idx ON payment_allocations (milestone_id);
--> statement-breakpoint
-- Payments that reached a milestone through its invoice become allocations.
INSERT INTO payment_allocations (tenant_id, payment_id, milestone_id, amount_paise)
SELECT p.tenant_id, p.id, m.id, p.amount_paise
  FROM payments p
  JOIN milestones m ON m.invoice_id = p.invoice_id AND m.tenant_id = p.tenant_id
 WHERE p.invoice_id IS NOT NULL AND p.status <> 'pending' AND p.amount_paise > 0
   AND NOT EXISTS (SELECT 1 FROM payment_allocations a WHERE a.payment_id = p.id);
--> statement-breakpoint
-- Older payment paths left project/customer empty; fill them from the invoice.
UPDATE payments p SET project_id = i.project_id
  FROM invoices i WHERE i.id = p.invoice_id AND p.project_id IS NULL;
--> statement-breakpoint
UPDATE payments p SET customer_id = pr.customer_id
  FROM projects pr WHERE pr.id = p.project_id AND p.customer_id IS NULL AND pr.customer_id IS NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE ledger_adjustment_kind AS ENUM ('discount', 'refund', 'write_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ledger_adjustments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES projects(id) ON DELETE SET NULL,
  kind         ledger_adjustment_kind NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  reason       text NOT NULL,
  adj_date     date NOT NULL DEFAULT current_date,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ledger_adjustments_customer_idx ON ledger_adjustments (tenant_id, customer_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS staff_day_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id     uuid REFERENCES projects(id) ON DELETE CASCADE,   -- NULL = office / no project
  week_start     date NOT NULL,                                     -- Monday of the week
  days           numeric(3,1) NOT NULL CHECK (days > 0 AND days <= 7),
  day_rate_paise bigint NOT NULL CHECK (day_rate_paise >= 0),       -- salary ÷ 26 when saved
  cost_paise     bigint NOT NULL CHECK (cost_paise >= 0),
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS staff_day_logs_uq
  ON staff_day_logs (tenant_id, user_id, week_start, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS staff_day_logs_project_idx ON staff_day_logs (project_id);
