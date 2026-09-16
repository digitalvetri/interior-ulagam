-- Enforce at most one pending follow-up per lead per tenant.
-- Partial: only rows where completed_at IS NULL are in scope, preserving the full audit history.
CREATE UNIQUE INDEX IF NOT EXISTS lead_follow_ups_pending_unique
  ON lead_follow_ups (tenant_id, lead_id)
  WHERE completed_at IS NULL;
