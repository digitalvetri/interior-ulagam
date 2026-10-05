-- Receipt and invoice numbers are unique per tenant (not globally).
-- Idempotent and safe on existing data.

-- 1. payments.receipt_number: global UNIQUE -> UNIQUE (tenant_id, receipt_number).
--    The old constraint has had two names depending on how the DB was built
--    (0015 inline UNIQUE -> *_key, 0027 -> *_unique).
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_receipt_number_unique";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_receipt_number_key";
--> statement-breakpoint
DROP INDEX IF EXISTS "payments_receipt_number_unique";
--> statement-breakpoint
-- Receipt numbers were globally unique until now, so no per-tenant duplicates can exist.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_tenant_receipt_number_uq"
  ON "payments" ("tenant_id", "receipt_number");
--> statement-breakpoint

-- 2. invoices.invoice_number: UNIQUE (tenant_id, invoice_number), only once the
--    data is clean. Older count-based numbering may have produced duplicates;
--    those are reported (not renamed — issued GST invoice numbers must not change)
--    and the index is created on a later run once they are fixed by hand.
DO $$
DECLARE dup_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'invoices_tenant_invoice_number_uq') THEN
    RETURN;
  END IF;
  SELECT count(*) INTO dup_count FROM (
    SELECT tenant_id, invoice_number FROM invoices GROUP BY tenant_id, invoice_number HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE NOTICE 'invoices: % duplicate (tenant_id, invoice_number) pairs; unique index NOT created. Renumber the duplicates and re-run.', dup_count;
  ELSE
    CREATE UNIQUE INDEX invoices_tenant_invoice_number_uq ON invoices (tenant_id, invoice_number);
  END IF;
END $$;
