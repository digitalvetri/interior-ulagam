-- Adds tenant_id to the four business tables that lacked it.
--
-- Supabase enforced isolation in the database with RLS. Self-hosted, isolation
-- is only ever as good as the WHERE clause on each query — and these four
-- tables had no tenant column at all, so a query could only be scoped by
-- joining up to a parent that had one. tenant-isolation.test.ts cannot catch a
-- missing join: it checks that a route mentions `tenantId`, not that the join
-- is present. One forgotten join was a cross-tenant leak of quote pricing or
-- payment links with nothing behind it.
--
-- It also blocked realtime. The pg_notify trigger in 0002 reads tenant_id off
-- the row and the SSE endpoint drops events for other tenants; a table without
-- the column emits a null tenant, and these four are exactly the tables worth
-- watching next.
--
-- Order matters: add nullable, backfill from the parent, then constrain. Doing
-- it in one step fails on any existing row.

-- ── quote_lines → quotes ────────────────────────────────────────────────────
ALTER TABLE quote_lines ADD COLUMN IF NOT EXISTS tenant_id UUID;
--> statement-breakpoint
UPDATE quote_lines ql
   SET tenant_id = q.tenant_id
  FROM quotes q
 WHERE q.id = ql.quote_id
   AND ql.tenant_id IS NULL;
--> statement-breakpoint
-- A line whose quote vanished cannot be attributed to a tenant, and an
-- unattributable row is exactly what this column exists to prevent.
DELETE FROM quote_lines WHERE tenant_id IS NULL;
--> statement-breakpoint
ALTER TABLE quote_lines ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE quote_lines DROP CONSTRAINT IF EXISTS quote_lines_tenant_id_fk;
--> statement-breakpoint
ALTER TABLE quote_lines
  ADD CONSTRAINT quote_lines_tenant_id_fk
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS quote_lines_tenant_idx ON quote_lines (tenant_id);
--> statement-breakpoint

-- ── milestones → projects ───────────────────────────────────────────────────
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS tenant_id UUID;
--> statement-breakpoint
UPDATE milestones m
   SET tenant_id = p.tenant_id
  FROM projects p
 WHERE p.id = m.project_id
   AND m.tenant_id IS NULL;
--> statement-breakpoint
DELETE FROM milestones WHERE tenant_id IS NULL;
--> statement-breakpoint
ALTER TABLE milestones ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_tenant_id_fk;
--> statement-breakpoint
ALTER TABLE milestones
  ADD CONSTRAINT milestones_tenant_id_fk
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS milestones_tenant_idx ON milestones (tenant_id);
--> statement-breakpoint

-- ── deliverables → projects ─────────────────────────────────────────────────
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS tenant_id UUID;
--> statement-breakpoint
UPDATE deliverables d
   SET tenant_id = p.tenant_id
  FROM projects p
 WHERE p.id = d.project_id
   AND d.tenant_id IS NULL;
--> statement-breakpoint
DELETE FROM deliverables WHERE tenant_id IS NULL;
--> statement-breakpoint
ALTER TABLE deliverables ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE deliverables DROP CONSTRAINT IF EXISTS deliverables_tenant_id_fk;
--> statement-breakpoint
ALTER TABLE deliverables
  ADD CONSTRAINT deliverables_tenant_id_fk
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deliverables_tenant_idx ON deliverables (tenant_id);
--> statement-breakpoint

-- ── snag_items → projects ───────────────────────────────────────────────────
ALTER TABLE snag_items ADD COLUMN IF NOT EXISTS tenant_id UUID;
--> statement-breakpoint
UPDATE snag_items s
   SET tenant_id = p.tenant_id
  FROM projects p
 WHERE p.id = s.project_id
   AND s.tenant_id IS NULL;
--> statement-breakpoint
DELETE FROM snag_items WHERE tenant_id IS NULL;
--> statement-breakpoint
ALTER TABLE snag_items ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE snag_items DROP CONSTRAINT IF EXISTS snag_items_tenant_id_fk;
--> statement-breakpoint
ALTER TABLE snag_items
  ADD CONSTRAINT snag_items_tenant_id_fk
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS snag_items_tenant_idx ON snag_items (tenant_id);
