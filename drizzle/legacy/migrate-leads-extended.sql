-- Phase: Extended lead capture + archive support
-- Run once in Supabase SQL Editor. All statements are idempotent.

ALTER TABLE "public"."leads"
  ADD COLUMN IF NOT EXISTS "alternate_phone" text,
  ADD COLUMN IF NOT EXISTS "contact_city"    text,
  ADD COLUMN IF NOT EXISTS "pincode"         text,
  ADD COLUMN IF NOT EXISTS "project_name"    text,
  ADD COLUMN IF NOT EXISTS "archived_at"     timestamptz;

-- Back-fill contact_city from customers table where lead has a linked customer
UPDATE "public"."leads" l
SET contact_city = c.city
FROM "public"."customers" c
WHERE l.customer_id = c.id
  AND c.city IS NOT NULL
  AND l.contact_city IS NULL;
