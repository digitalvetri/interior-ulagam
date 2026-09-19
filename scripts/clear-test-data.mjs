/**
 * Clears all transactional/demo data from the CRM database.
 * KEEPS: tenants, users (login accounts), sessions, accounts, verifications.
 * CLEARS: leads, customers, projects, quotes, invoices, payments, expenses,
 *          purchase orders, vendors, materials, attendance, tasks, and all
 *          dependent tables.
 *
 * Uses DELETE (not TRUNCATE) so it works with the Supabase app-role permissions.
 * All tables use UUIDs as PKs — no sequences need resetting.
 *
 * Usage (from repo root):
 *   node scripts/clear-test-data.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

// ── Load DATABASE_URL from .env.local ─────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');

let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        DATABASE_URL = trimmed.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '');
        break;
      }
    }
  } catch {
    // .env.local missing
  }
}

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL not found in .env.local or environment.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

console.log('🔌  Connected to database.');
console.log('🗑️   Clearing all test data — schema, users, and tenant config are preserved.\n');

// ── Delete in dependency order (children before parents) ──────────────────────
// All UUIDs — no sequences to reset. Circular FK (leads ↔ customers) handled
// by nulling the circular columns first before deleting the rows.

// 1. Deepest leaves
await sql`DELETE FROM measurement_items`;
await sql`DELETE FROM deliverable_comments`;
await sql`DELETE FROM deliverable_versions`;
await sql`DELETE FROM grns`;
await sql`DELETE FROM work_order_updates`;
await sql`DELETE FROM quote_lines`;
await sql`DELETE FROM quote_sections`;

// 2. Mid-level dependents
await sql`DELETE FROM measurement_rounds`;
await sql`DELETE FROM milestones`;
await sql`DELETE FROM payments`;
await sql`DELETE FROM expenses`;
await sql`DELETE FROM vendor_payments`;
await sql`DELETE FROM purchase_orders`;
await sql`DELETE FROM work_orders`;
await sql`DELETE FROM snag_items`;
await sql`DELETE FROM site_logs`;
await sql`DELETE FROM deliverables`;
await sql`DELETE FROM design_deliverables`;
await sql`DELETE FROM portfolios`;
await sql`DELETE FROM client_tokens`;
await sql`DELETE FROM documents`;
await sql`DELETE FROM invoices`;
await sql`DELETE FROM quotes`;
await sql`DELETE FROM site_visits`;
await sql`DELETE FROM requirements`;
await sql`DELETE FROM lead_follow_ups`;
await sql`DELETE FROM lead_activities`;
await sql`DELETE FROM wa_messages`;
await sql`DELETE FROM customer_activities`;
await sql`DELETE FROM service_requests`;

// 3. HR / operational (independent of leads/projects)
await sql`DELETE FROM attendance_records`;
await sql`DELETE FROM leave_requests`;
await sql`DELETE FROM notifications`;
await sql`DELETE FROM design_tasks`;
await sql`DELETE FROM tasks`;

// 4. Root entities — break the leads ↔ customers circular FK first
await sql`UPDATE leads SET customer_id = NULL WHERE customer_id IS NOT NULL`;
await sql`DELETE FROM projects`;
await sql`DELETE FROM customers`;
await sql`DELETE FROM leads`;

// 5. Master data
await sql`DELETE FROM vendors`;
await sql`DELETE FROM materials`;

// ── Verify ────────────────────────────────────────────────────────────────────
const checks = [
  { label: 'leads',           query: sql`SELECT COUNT(*)::int AS n FROM leads` },
  { label: 'customers',       query: sql`SELECT COUNT(*)::int AS n FROM customers` },
  { label: 'projects',        query: sql`SELECT COUNT(*)::int AS n FROM projects` },
  { label: 'quotes',          query: sql`SELECT COUNT(*)::int AS n FROM quotes` },
  { label: 'invoices',        query: sql`SELECT COUNT(*)::int AS n FROM invoices` },
  { label: 'payments',        query: sql`SELECT COUNT(*)::int AS n FROM payments` },
  { label: 'expenses',        query: sql`SELECT COUNT(*)::int AS n FROM expenses` },
  { label: 'purchase_orders', query: sql`SELECT COUNT(*)::int AS n FROM purchase_orders` },
  { label: 'vendors',         query: sql`SELECT COUNT(*)::int AS n FROM vendors` },
  { label: 'materials',       query: sql`SELECT COUNT(*)::int AS n FROM materials` },
  { label: 'tasks',           query: sql`SELECT COUNT(*)::int AS n FROM tasks` },
  { label: 'attendance',      query: sql`SELECT COUNT(*)::int AS n FROM attendance_records` },
  { label: 'leave_requests',  query: sql`SELECT COUNT(*)::int AS n FROM leave_requests` },
  { label: 'wa_messages',     query: sql`SELECT COUNT(*)::int AS n FROM wa_messages` },
];

console.log('✅  Deletion complete. Verifying row counts:\n');
let allZero = true;
for (const { label, query } of checks) {
  const [{ n }] = await query;
  const ok = n === 0;
  if (!ok) allZero = false;
  console.log(`   ${ok ? '✓' : '✗'} ${label.padEnd(18)} ${n} rows`);
}

const [{ n: userCount }]   = await sql`SELECT COUNT(*)::int AS n FROM users`;
const [{ n: tenantCount }] = await sql`SELECT COUNT(*)::int AS n FROM tenants`;
console.log(`\n🔒  Preserved:`);
console.log(`   • users   : ${userCount}`);
console.log(`   • tenants : ${tenantCount}`);

if (allZero) {
  console.log('\n🎉  Done. CRM is in a clean empty state — ready for fresh data.');
} else {
  console.log('\n⚠️   Some tables still have rows — check output above.');
}

await sql.end();
