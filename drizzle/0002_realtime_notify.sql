-- Realtime change notifications, replacing Supabase Realtime.
--
-- Each watched table gets an AFTER INSERT/UPDATE/DELETE trigger that emits a
-- pg_notify on the 'table_changes' channel. The app LISTENs on that channel and
-- fans events out to browsers over SSE (see /api/v1/events).
--
-- The payload carries the tenant id so the SSE endpoint can drop events that do
-- not belong to the connected user's tenant — a client must never learn that
-- another studio's data changed. pg_notify payloads are capped at 8000 bytes,
-- so identifiers are sent, never row contents.

CREATE OR REPLACE FUNCTION notify_table_change() RETURNS trigger AS $$
DECLARE
  rec RECORD;
  tenant TEXT;
BEGIN
  rec := COALESCE(NEW, OLD);

  BEGIN
    tenant := rec.tenant_id::TEXT;
  EXCEPTION WHEN undefined_column THEN
    tenant := NULL;
  END;

  PERFORM pg_notify(
    'table_changes',
    json_build_object(
      'table', TG_TABLE_NAME,
      'op', TG_OP,
      'tenantId', tenant
    )::text
  );

  RETURN NULL; -- AFTER trigger; the return value is ignored
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS leads_notify_change ON leads;
--> statement-breakpoint
CREATE TRIGGER leads_notify_change
  AFTER INSERT OR UPDATE OR DELETE ON leads
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS customers_notify_change ON customers;
--> statement-breakpoint
CREATE TRIGGER customers_notify_change
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION notify_table_change();
