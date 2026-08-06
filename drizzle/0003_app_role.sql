-- Least-privilege database role for the application.
--
-- Migrations run as the owner (the `migrate` container's DATABASE_URL); the app
-- and worker connect as this role instead. It can read and write rows but holds
-- no DDL rights, so a SQL-injection flaw cannot drop or truncate a table, alter
-- a column, or create one.
--
-- This is not row-level security. Tenant isolation is still enforced in the
-- application layer — every query filters on tenant_id. True RLS needs a
-- transaction-scoped tenant setting on every query path, which is a separate
-- change; this narrows the blast radius in the meantime.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'interioos_app') THEN
    -- The password is replaced immediately below from APP_DB_PASSWORD; this
    -- placeholder never survives a real deployment.
    CREATE ROLE interioos_app LOGIN PASSWORD 'change_me_via_migration_env';
  END IF;
END
$$;
--> statement-breakpoint
GRANT CONNECT ON DATABASE interior_studio TO interioos_app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO interioos_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO interioos_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO interioos_app;
--> statement-breakpoint
-- Tables created by later migrations must be reachable too, without revisiting
-- this file each time.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO interioos_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO interioos_app;
--> statement-breakpoint
-- Drizzle's bookkeeping stays owner-only: the app has no business reading or
-- rewriting migration history.
REVOKE ALL ON SCHEMA drizzle FROM interioos_app;
