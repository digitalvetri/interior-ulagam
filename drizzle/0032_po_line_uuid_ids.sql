-- PO lines saved from the browser briefly carried ids like "line-1"; GRNs
-- reference lines by uuid, so receiving goods against those POs failed.
-- Give every non-uuid line a uuid (no GRN can reference the old ids).
UPDATE "purchase_orders" po
SET "lines_json" = (
  SELECT jsonb_agg(
    CASE WHEN coalesce(l->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         THEN l
         ELSE jsonb_set(l, '{id}', to_jsonb(gen_random_uuid()::text), true)
    END ORDER BY ord)
  FROM jsonb_array_elements(po."lines_json") WITH ORDINALITY AS t(l, ord)
)
WHERE jsonb_typeof(po."lines_json") = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(po."lines_json") l
    WHERE NOT coalesce(l->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
