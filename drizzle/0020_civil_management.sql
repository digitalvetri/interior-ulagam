-- Civil Management division: facility-maintenance contracts for retail chains.
-- Company → Branch (in a City) → Job → Lines. All tenant-scoped; money in paise.
-- Grants to interioos_app come from the default privileges set in 0003.

DO $$ BEGIN
  CREATE TYPE civil_job_status AS ENUM ('pending', 'done', 'billed', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE civil_line_kind AS ENUM ('material', 'labour');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS civil_companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  gstin         text,
  address       text,
  contact_name  text,
  contact_phone text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS civil_companies_tenant_name_uq ON civil_companies (tenant_id, lower(name));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS civil_cities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS civil_cities_tenant_name_uq ON civil_cities (tenant_id, lower(name));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS civil_branches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES civil_companies(id) ON DELETE RESTRICT,
  city_id       uuid NOT NULL REFERENCES civil_cities(id) ON DELETE RESTRICT,
  name          text NOT NULL,
  address       text,
  contact_name  text,
  contact_phone text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS civil_branches_company_city_name_uq ON civil_branches (company_id, city_id, lower(name));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS civil_branches_tenant_idx ON civil_branches (tenant_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS civil_managers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  phone      text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS civil_managers_tenant_name_uq ON civil_managers (tenant_id, lower(name));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS civil_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_no      integer NOT NULL,
  branch_id   uuid NOT NULL REFERENCES civil_branches(id) ON DELETE RESTRICT,
  job_date    date NOT NULL,
  heading     text NOT NULL,
  remark      text,
  manager_id  uuid REFERENCES civil_managers(id) ON DELETE SET NULL,
  status      civil_job_status NOT NULL DEFAULT 'pending',
  bill_no     text,
  bill_date   date,
  paid_date   date,
  total_paise bigint NOT NULL DEFAULT 0 CHECK (total_paise >= 0),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT civil_jobs_billed_has_bill CHECK (status NOT IN ('billed', 'paid') OR (bill_no IS NOT NULL AND bill_date IS NOT NULL)),
  CONSTRAINT civil_jobs_paid_has_date   CHECK (status <> 'paid' OR paid_date IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS civil_jobs_tenant_job_no_uq ON civil_jobs (tenant_id, job_no);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS civil_jobs_tenant_status_idx ON civil_jobs (tenant_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS civil_jobs_branch_idx ON civil_jobs (branch_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS civil_job_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id       uuid NOT NULL REFERENCES civil_jobs(id) ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0,
  description  text NOT NULL,
  kind         civil_line_kind NOT NULL DEFAULT 'material',
  amount_paise bigint NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS civil_job_lines_job_idx ON civil_job_lines (job_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS civil_job_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES civil_jobs(id) ON DELETE CASCADE,
  from_status civil_job_status,
  to_status   civil_job_status NOT NULL,
  note        text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS civil_job_events_job_idx ON civil_job_events (job_id);
