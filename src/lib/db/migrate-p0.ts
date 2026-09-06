/**
 * migrate-p0.ts — one-time Phase 0 data migration
 *
 * Run ONCE against the live database AFTER deploying the Phase 0 schema changes:
 *
 *   cd interior-ulagam
 *   pnpm tsx src/lib/db/migrate-p0.ts
 *
 * What it does:
 *   1. Back-fills permissionsJson on every user row based on their CURRENT (legacy) role.
 *   2. Remaps legacy roles to the new role values.
 *
 * NOTE: permissions are set in the SAME statement as the role remap so the
 *       CASE expressions still see the old role value — no ordering bug.
 */

import { db } from './index';
import { sql } from 'drizzle-orm';

async function main(): Promise<void> {
  console.error('[migrate-p0] Starting Phase 0 user migration...');

  // Single atomic UPDATE: derive permissions from OLD role, then remap role.
  // Using raw SQL CASE expressions for clarity and atomicity.
  const result = await db.execute(sql`
    UPDATE users
    SET
      permissions_json = CASE role
        WHEN 'owner' THEN
          '{"canSeeFinance":true,"canCreateQuotes":true,"canSendQuotes":true,"canRaisePO":true,"canRecordPayments":true,"canSeeAllLeads":true}'::jsonb
        WHEN 'accountant' THEN
          '{"canSeeFinance":true,"canCreateQuotes":false,"canSendQuotes":false,"canRaisePO":false,"canRecordPayments":true,"canSeeAllLeads":false}'::jsonb
        WHEN 'designer' THEN
          '{"canSeeFinance":false,"canCreateQuotes":true,"canSendQuotes":false,"canRaisePO":false,"canRecordPayments":false,"canSeeAllLeads":false}'::jsonb
        WHEN 'supervisor' THEN
          '{"canSeeFinance":false,"canCreateQuotes":false,"canSendQuotes":false,"canRaisePO":false,"canRecordPayments":false,"canSeeAllLeads":false}'::jsonb
        ELSE
          permissions_json
      END,
      role = CASE role
        WHEN 'owner'      THEN 'admin'
        WHEN 'designer'   THEN 'employee'
        WHEN 'supervisor' THEN 'employee'
        WHEN 'accountant' THEN 'employee'
        ELSE role
      END
    WHERE role IN ('owner', 'designer', 'supervisor', 'accountant')
  `);

  // drizzle-orm's execute() returns the raw postgres.js result.
  // The rowCount is available on the result object.
  const rowCount = (result as unknown as { count?: number }).count ?? 'unknown';
  console.error(`[migrate-p0] Updated ${rowCount} user rows.`);
  console.error('[migrate-p0] Phase 0 migration complete.');
}

main().catch((err: unknown) => {
  console.error('[migrate-p0] FATAL:', err);
  process.exit(1);
});
