-- Fix for partial 0003 migration (run as owner/superuser 'interioos')

-- 1. measurement_rounds new columns (failed earlier due to wrong user)
ALTER TABLE measurement_rounds
  ADD COLUMN IF NOT EXISTS status             measurement_round_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS project_id         uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_visit_id      uuid REFERENCES site_visits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS measurement_number text;

-- 2. measurement_items new columns
ALTER TABLE measurement_items
  ADD COLUMN IF NOT EXISTS floor      text,
  ADD COLUMN IF NOT EXISTS area_sqft  numeric(10,3);

-- 3. work_orders.status: column is currently text, work_order_status_v2 exists
--    Drop the stale default referencing the old enum type, then cast to new enum
ALTER TABLE work_orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE work_orders
  ALTER COLUMN status TYPE work_order_status_v2 USING status::work_order_status_v2;
ALTER TABLE work_orders ALTER COLUMN status SET DEFAULT 'draft';

-- 4. Drop old enum type and rename v2 → work_order_status
DROP TYPE IF EXISTS work_order_status;
ALTER TYPE work_order_status_v2 RENAME TO work_order_status;

-- Verify
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'work_orders' AND column_name = 'status';

SELECT status, count(*) FROM work_orders GROUP BY status;
