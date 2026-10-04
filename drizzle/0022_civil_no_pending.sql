-- Civil jobs are entered after the work is finished, so there is no Pending
-- stage: a job is Done → Billed → Paid. Existing pending jobs become Done and
-- the enum loses the value (Postgres cannot drop an enum value in place).

UPDATE civil_jobs SET status = 'done' WHERE status = 'pending';
--> statement-breakpoint
-- History: the "Pending → Done" step disappears; "Created → Pending" becomes "Created → Done".
DELETE FROM civil_job_events WHERE from_status = 'pending' AND to_status = 'done';
--> statement-breakpoint
UPDATE civil_job_events SET to_status = 'done' WHERE to_status = 'pending';
--> statement-breakpoint
UPDATE civil_job_events SET from_status = 'done' WHERE from_status = 'pending';
--> statement-breakpoint
DELETE FROM civil_job_events WHERE from_status = to_status;
--> statement-breakpoint
ALTER TABLE civil_jobs ALTER COLUMN status DROP DEFAULT;
--> statement-breakpoint
-- These checks compare against the old type; drop and recreate around the switch.
ALTER TABLE civil_jobs DROP CONSTRAINT IF EXISTS civil_jobs_billed_has_bill;
--> statement-breakpoint
ALTER TABLE civil_jobs DROP CONSTRAINT IF EXISTS civil_jobs_paid_has_date;
--> statement-breakpoint
ALTER TYPE civil_job_status RENAME TO civil_job_status_old;
--> statement-breakpoint
CREATE TYPE civil_job_status AS ENUM ('done', 'billed', 'paid');
--> statement-breakpoint
ALTER TABLE civil_jobs ALTER COLUMN status TYPE civil_job_status USING status::text::civil_job_status;
--> statement-breakpoint
ALTER TABLE civil_job_events ALTER COLUMN from_status TYPE civil_job_status USING from_status::text::civil_job_status;
--> statement-breakpoint
ALTER TABLE civil_job_events ALTER COLUMN to_status TYPE civil_job_status USING to_status::text::civil_job_status;
--> statement-breakpoint
ALTER TABLE civil_jobs ALTER COLUMN status SET DEFAULT 'done';
--> statement-breakpoint
ALTER TABLE civil_jobs ADD CONSTRAINT civil_jobs_billed_has_bill
  CHECK (status NOT IN ('billed', 'paid') OR (bill_no IS NOT NULL AND bill_date IS NOT NULL));
--> statement-breakpoint
ALTER TABLE civil_jobs ADD CONSTRAINT civil_jobs_paid_has_date CHECK (status <> 'paid' OR paid_date IS NOT NULL);
--> statement-breakpoint
DROP TYPE civil_job_status_old;
