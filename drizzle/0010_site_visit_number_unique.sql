-- Ensure visit numbers are unique per tenant.
-- Partial: NULLs are excluded so rows without a visit_number can coexist freely.
CREATE UNIQUE INDEX IF NOT EXISTS site_visits_tenant_visit_number_unique
  ON site_visits (tenant_id, visit_number)
  WHERE visit_number IS NOT NULL;
