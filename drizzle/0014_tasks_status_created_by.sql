-- Add status + createdBy to tasks, and 'task' to the lead_activity_type enum.

-- 1. Extend the lead_activity_type enum (ADD VALUE is non-destructive and transaction-safe in Postgres 12+)
ALTER TYPE lead_activity_type ADD VALUE IF NOT EXISTS 'task';

-- 2. Add status column (text — Zod-validated on insert/update)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- 3. Backfill: any row that has completedAt set is already 'done'
UPDATE tasks SET status = 'done' WHERE completed_at IS NOT NULL AND status = 'pending';

-- 4. Add createdBy FK
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

-- 5. Index on (tenant_id, status) for dashboard queries
CREATE INDEX IF NOT EXISTS tasks_tenant_status_idx ON tasks (tenant_id, status);
