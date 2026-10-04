-- Vendors → studio-managed categories. vendors.category was the fixed
-- material_category enum; it becomes free text holding a vendor_categories
-- name so the studio can add, rename and delete categories.
ALTER TABLE "vendors" ALTER COLUMN "category" TYPE text USING "category"::text;
--> statement-breakpoint
-- Old enum slugs become display names ("laminate" → "Laminate"). Only exact
-- lowercase slugs match, so a re-run changes nothing.
UPDATE "vendors" SET "category" = initcap("category")
WHERE "category" IN ('laminate', 'hardware', 'furniture', 'fabric', 'lighting', 'flooring', 'sanitary', 'other');
--> statement-breakpoint
UPDATE "vendors" SET "category" = NULL WHERE "category" IS NOT NULL AND btrim("category") = '';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_categories_tenant_name_uq" ON "vendor_categories" ("tenant_id", lower("name"));
--> statement-breakpoint
-- Default list for every studio.
INSERT INTO "vendor_categories" ("tenant_id", "name", "sort_order")
SELECT t."id", d."name", d."ord"
FROM "tenants" t
CROSS JOIN (VALUES
  ('Laminate', 0), ('Hardware', 1), ('Furniture', 2), ('Fabric', 3),
  ('Lighting', 4), ('Flooring', 5), ('Sanitary', 6), ('Other', 7)
) AS d("name", "ord")
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Any other value a vendor already carries becomes a category too.
INSERT INTO "vendor_categories" ("tenant_id", "name", "sort_order")
SELECT DISTINCT ON (v."tenant_id", lower(btrim(v."category")))
  v."tenant_id", btrim(v."category"), 100
FROM "vendors" v
WHERE v."category" IS NOT NULL AND btrim(v."category") <> ''
ORDER BY v."tenant_id", lower(btrim(v."category")), btrim(v."category")
ON CONFLICT DO NOTHING;
