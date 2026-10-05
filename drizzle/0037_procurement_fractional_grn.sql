-- Procurement fixes. Idempotent — safe to re-run.
--
-- 1. GRN quantities can be fractional. PO lines allow decimals (12.5 sqft of
--    laminate) but grns.delivered_qty was integer, so such lines could never be
--    fully received. numeric(12,3) holds every existing integer value exactly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grns' AND column_name = 'delivered_qty' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "grns" ALTER COLUMN "delivered_qty" TYPE numeric(12,3) USING "delivered_qty"::numeric(12,3);
  END IF;
END $$;
--> statement-breakpoint
-- 2. PO numbers unique per tenant. The app now numbers from the highest
--    existing PO number under a per-tenant lock, but older count-based numbering
--    may already have produced duplicates. Only add the index when none exist;
--    otherwise skip (with a notice) so the migration never fails on live data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'purchase_orders_tenant_po_number_uq'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM "purchase_orders" GROUP BY "tenant_id", "po_number" HAVING count(*) > 1
    ) THEN
      RAISE NOTICE 'purchase_orders has duplicate (tenant_id, po_number) rows; unique index skipped';
    ELSE
      CREATE UNIQUE INDEX "purchase_orders_tenant_po_number_uq" ON "purchase_orders" ("tenant_id", "po_number");
    END IF;
  END IF;
END $$;
