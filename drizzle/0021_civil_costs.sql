-- Civil Management: private real costs, for profit. Owner-only in the app and
-- never included in the Excel/PDF downloads that go to clients.
--   civil_job_lines.cost_paise — what a billed line really cost (NULL = not entered yet)
--   civil_job_costs            — expenses on a job that are not billed (transport, vehicle hire…)
--   civil_jobs.cost_paise      — cached sum of both, kept in step by the server

ALTER TABLE civil_job_lines ADD COLUMN IF NOT EXISTS cost_paise bigint CHECK (cost_paise >= 0);
--> statement-breakpoint
ALTER TABLE civil_jobs ADD COLUMN IF NOT EXISTS cost_paise bigint NOT NULL DEFAULT 0 CHECK (cost_paise >= 0);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS civil_job_costs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id       uuid NOT NULL REFERENCES civil_jobs(id) ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0,
  description  text NOT NULL,
  amount_paise bigint NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS civil_job_costs_job_idx ON civil_job_costs (job_id);
