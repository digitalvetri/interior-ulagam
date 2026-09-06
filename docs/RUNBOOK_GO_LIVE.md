# Konstdesign CRM — Go-Live Runbook

> **Owner:** DigitalVetri (`info@digitalvetri.com`)  
> **Target:** Production Postgres (self-hosted Docker)  
> **Estimated window:** 30–45 minutes (zero-downtime reads; writes paused for ~5 min during migration)

---

## Pre-flight checklist

Complete every item before starting.

- [ ] Full database backup taken and verified (see §1)
- [ ] `.env.production` values confirmed (DB URL, MinIO, WhatsApp, Razorpay, AI keys)
- [ ] Docker images built and pushed: `docker compose build && docker compose push`
- [ ] `DATABASE_URL` in your shell points at the **production** database
- [ ] Dry-run report reviewed: `npx tsx scripts/migrate-konstdesign.ts` (no `--apply`)
- [ ] Mohammed Sheriff signed off on user permission assignments
- [ ] At least one admin user (`role=admin`) exists and can log in
- [ ] Staging environment ran the migration cleanly

---

## §1 — Backup

```bash
# Replace values for your environment
DB_HOST=localhost
DB_PORT=5432
DB_NAME=konstdesign
DB_USER=postgres

# Dump to timestamped file
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -Fc $DB_NAME \
  > backups/konstdesign_$(date +%Y%m%d_%H%M%S).dump

# Verify the dump is readable
pg_restore --list backups/konstdesign_*.dump | head -20
```

Keep the dump file until the 2-week hypercare period ends.

---

## §2 — Schema migration (Drizzle)

Apply any pending schema changes. This is non-destructive (additive only for this release).

```bash
cd /opt/konstdesign   # repo root on the server

# Push schema — will add new enums, columns, indices; never drops
pnpm drizzle-kit push

# Verify: check that all tables exist
psql $DATABASE_URL -c "\dt public.*" | wc -l
# Expected: 30+ rows
```

---

## §3 — Data migration

### 3a. Dry run first (always)

```bash
# Load production env
set -a && source .env.production && set +a

npx tsx scripts/migrate-konstdesign.ts
# Review the Before/After report. Expected:
#   Leads with legacy stages:  N  → 0 after --apply
#   Users with legacy roles:   N  → 0 after --apply
#   FK orphan total:           0  (any non-zero needs investigation before applying)
```

### 3b. Apply

If the dry run looks clean:

```bash
npx tsx scripts/migrate-konstdesign.ts --apply
```

Expected output ends with:

```
  ✅ Migration complete.
```

If you see FK orphan warnings, **do not proceed** — follow §5 (Orphan cleanup) first.

---

## §4 — Verify

Run these queries immediately after migration.

```sql
-- 1. No legacy stages remain
SELECT stage, count(*) FROM leads
WHERE stage IN ('site_visit_scheduled','consultation_done','proposal_sent','measured','booked')
GROUP BY stage;
-- Expected: 0 rows

-- 2. No legacy roles remain
SELECT role, count(*) FROM users
WHERE role IN ('owner','designer','accountant','supervisor')
GROUP BY role;
-- Expected: 0 rows

-- 3. All leads have a customer
SELECT count(*) FROM leads WHERE customer_id IS NULL;
-- Expected: 0 (or very low for newly imported leads created post-migration)

-- 4. Admin user can log in
-- Log in at https://crm.konstdesign.com and confirm the dashboard loads.

-- 5. FK sanity
SELECT count(*) FROM lead_activities la
LEFT JOIN leads l ON l.id = la.lead_id WHERE l.id IS NULL;
-- Expected: 0
```

---

## §5 — Orphan cleanup (if needed)

If the FK check in §3a returns non-zero:

```sql
-- Identify orphaned lead_activities
SELECT la.id, la.lead_id FROM lead_activities la
LEFT JOIN leads l ON l.id = la.lead_id WHERE l.id IS NULL;

-- Safe to delete — these reference deleted leads
DELETE FROM lead_activities WHERE id IN (
  SELECT la.id FROM lead_activities la
  LEFT JOIN leads l ON l.id = la.lead_id WHERE l.id IS NULL
);

-- Repeat for site_visits, quotes (set lead_id = null), etc.
```

Re-run the migration dry run after cleanup to confirm zero orphans.

---

## §6 — Rollback

If anything goes wrong **before** the schema push (§2), no action needed — the old code is still running.

If you've applied the data migration (§3b) but need to revert:

```bash
# Restore from backup (this destroys all data written after the backup)
pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  --clean --if-exists backups/konstdesign_<timestamp>.dump

# Restart the old Docker image
docker compose up -d --scale app=1
```

If only the data migration needs reversal (schema is fine):

```sql
-- Restore roles from backup table (created by migrate-konstdesign.ts in a future
-- destructive migration; for now, restore roles manually from the backup dump):
-- pg_restore -t users --data-only backups/konstdesign_<timestamp>.dump | psql $DATABASE_URL

-- Restore lead stages from backup
-- pg_restore -t leads --data-only backups/konstdesign_<timestamp>.dump | psql $DATABASE_URL
```

> The migration script is idempotent. If you rolled back and re-run, it is safe.

---

## §7 — Post go-live checklist

Complete within the first 2 hours:

- [ ] All admin users can log in and see the dashboard
- [ ] Lead pipeline shows correct stages (no `site_visit_scheduled` etc.)
- [ ] Create a test lead → advance through stages → confirm customer record created
- [ ] Raise a test invoice → confirm Razorpay payment link generates
- [ ] Upload a test deliverable → confirm MinIO URL is accessible
- [ ] WhatsApp webhook: send a test message and confirm it appears in the lead thread
- [ ] Reports page: run "Enquiry Funnel" report and confirm data loads

---

## §8 — Hypercare contacts

| Name | Role | Contact |
|------|------|---------|
| Binu | DigitalVetri (builder) | `info@digitalvetri.com` |
| Mohammed Sheriff | Konstdesign (CEO) | +91 98943 31115 |

Monitor logs for the first 48 hours:

```bash
docker compose logs -f app | grep -E "ERROR|WARN|500"
```

Escalation threshold: >5 errors/minute → rollback immediately.

---

*Generated by Claude Code · DigitalVetri · 2026-09-06*
