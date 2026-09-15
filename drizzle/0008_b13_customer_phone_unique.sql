-- B-13: enforce one customer per (tenant_id, phone)
-- Prevents SELECT-then-INSERT race condition in lead conversion and customer upsert.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenant_phone_unique" ON "customers" USING btree ("tenant_id","phone");
