-- Payroll (feat(payroll) 0f5340b added these to schema.ts without a migration).
-- Mirrors schema.ts exactly; all amounts in paise.

DO $$ BEGIN
  CREATE TYPE payroll_run_status AS ENUM ('draft', 'approved', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_paise integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS payroll_runs (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month                     text NOT NULL,
  status                    payroll_run_status NOT NULL DEFAULT 'draft',
  working_days              integer NOT NULL DEFAULT 26,
  total_gross_paise         integer NOT NULL DEFAULT 0,
  total_net_paise           integer NOT NULL DEFAULT 0,
  total_employee_pf_paise   integer NOT NULL DEFAULT 0,
  total_employee_esi_paise  integer NOT NULL DEFAULT 0,
  total_employer_pf_paise   integer NOT NULL DEFAULT 0,
  total_employer_esi_paise  integer NOT NULL DEFAULT 0,
  total_cost_paise          integer NOT NULL DEFAULT 0,
  notes                     text,
  created_by                uuid NOT NULL REFERENCES users(id),
  created_at                timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payroll_runs_tenant_idx ON payroll_runs (tenant_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_tenant_month_uq ON payroll_runs (tenant_id, month);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS payslips (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id               uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  days_present         numeric(5,1) NOT NULL DEFAULT 0,
  days_absent          numeric(5,1) NOT NULL DEFAULT 0,
  gross_paise          integer NOT NULL DEFAULT 0,
  employee_pf_paise    integer NOT NULL DEFAULT 0,
  employee_esi_paise   integer NOT NULL DEFAULT 0,
  net_paise            integer NOT NULL DEFAULT 0,
  employer_pf_paise    integer NOT NULL DEFAULT 0,
  employer_esi_paise   integer NOT NULL DEFAULT 0,
  total_cost_paise     integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payslips_run_idx ON payslips (run_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payslips_tenant_idx ON payslips (tenant_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payslips_run_user_uq ON payslips (run_id, user_id);
