-- The studio logo uploaded while the site was on plain http kept an http://
-- URL, which the https site loads as mixed content. Upgrade the scheme.
UPDATE "tenants"
SET "branding_json" = jsonb_set("branding_json", '{logoUrl}', to_jsonb(regexp_replace("branding_json"->>'logoUrl', '^http://', 'https://')))
WHERE "branding_json"->>'logoUrl' LIKE 'http://%';
