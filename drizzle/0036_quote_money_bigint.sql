-- Quote money columns were int4 (max ₹2.14 crore in paise). A large quote or a
-- line-heavy BOQ can overflow them. Widen to bigint, like projects/milestones.
-- Idempotent: each column is altered only while it is still integer.
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['subtotal_paise', 'discount_paise', 'gst_paise', 'total_paise', 'margin_paise'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = col AND data_type = 'integer'
    ) THEN
      EXECUTE format('ALTER TABLE "quotes" ALTER COLUMN %I TYPE bigint', col);
    END IF;
  END LOOP;
END $$;
