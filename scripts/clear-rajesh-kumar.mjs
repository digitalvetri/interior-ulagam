/**
 * One-time cleanup: removes the "Rajesh Kumar" test records
 * created by human-flow-audit.spec.ts (phone: 9876543210).
 *
 * Most child tables have onDelete: 'cascade' from projects/leads,
 * so we delete parents and let the DB handle children.
 * Only quote_lines/sections need explicit deletion (cascade from lead
 * is not guaranteed for all environments).
 *
 * Usage (from repo root):
 *   node scripts/clear-rajesh-kumar.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

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
  } catch { /* .env.local missing */ }
}

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL not found in .env.local or environment.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);
const TEST_PHONE = '9876543210';

// 1. Find the leads
const leads = await sql`
  SELECT id, contact_name, customer_id
  FROM leads
  WHERE contact_phone = ${TEST_PHONE}
`;

if (leads.length === 0) {
  console.log(`ℹ️  No leads found with phone ${TEST_PHONE} — nothing to delete.`);
  await sql.end();
  process.exit(0);
}

for (const l of leads) console.log(`🎯  Lead: "${l.contact_name}" (${l.id})`);

const leadIds   = leads.map(l => l.id);
const custIds   = leads.map(l => l.customer_id).filter(Boolean);

// 2. Find quotes (need to kill lines first — no cascade from quote)
const quotes = await sql`SELECT id FROM quotes WHERE lead_id = ANY(${leadIds})`;
const quoteIds = quotes.map(q => q.id);

// 3. Find projects
const projects = await sql`SELECT id, name FROM projects WHERE lead_id = ANY(${leadIds})`;
for (const p of projects) console.log(`🎯  Project: "${p.name}" (${p.id})`);

console.log(`\n🗑️  Deleting ${leads.length} lead(s), ${projects.length} project(s), ${quoteIds.length} quote(s)…\n`);

// --- Step-by-step deletion ---

// Quote lines + sections (no cascade from quote)
if (quoteIds.length) {
  await sql`DELETE FROM quote_lines    WHERE quote_id = ANY(${quoteIds})`;
  await sql`DELETE FROM quote_sections WHERE quote_id = ANY(${quoteIds})`;
  console.log(`   ✓ quote_lines / quote_sections`);
}

// Quotes (cascade not guaranteed from lead in all envs)
if (quoteIds.length) {
  await sql`DELETE FROM quotes WHERE id = ANY(${quoteIds})`;
  console.log(`   ✓ quotes`);
}

// Projects — cascade removes milestones, expenses, site_logs, invoices, etc.
// But payments link via invoices with SET NULL, so delete invoices first.
const projectIds = projects.map(p => p.id);
if (projectIds.length) {
  // Payments reference invoices with ON DELETE SET NULL — safe to delete invoices
  const invoices = await sql`SELECT id FROM invoices WHERE project_id = ANY(${projectIds})`;
  const invoiceIds = invoices.map(i => i.id);
  if (invoiceIds.length) {
    await sql`UPDATE payments SET invoice_id = NULL WHERE invoice_id = ANY(${invoiceIds})`;
    await sql`DELETE FROM invoices WHERE id = ANY(${invoiceIds})`;
    console.log(`   ✓ invoices (${invoiceIds.length})`);
  }
  await sql`DELETE FROM projects WHERE id = ANY(${projectIds})`;
  console.log(`   ✓ projects (cascade: milestones, expenses, site_logs, snag_items, work_orders, POs…)`);
}

// Break circular FK leads ↔ customers before deleting leads
await sql`UPDATE leads SET customer_id = NULL WHERE id = ANY(${leadIds})`;

// Delete leads — cascade removes lead_activities, lead_follow_ups, site_visits, measurements, wa_messages
await sql`DELETE FROM leads WHERE id = ANY(${leadIds})`;
console.log(`   ✓ leads (cascade: activities, follow-ups, site visits, measurements…)`);

// Delete customers
if (custIds.length) {
  // customer_activities cascades from customer
  await sql`DELETE FROM customers WHERE id = ANY(${custIds})`;
  console.log(`   ✓ customers`);
} else {
  // Also clean up any customer by phone in case customerId link was missing
  const orphans = await sql`SELECT id FROM customers WHERE phone = ${TEST_PHONE}`;
  if (orphans.length) {
    const orphanIds = orphans.map(c => c.id);
    await sql`DELETE FROM customers WHERE id = ANY(${orphanIds})`;
    console.log(`   ✓ orphan customers (${orphans.length})`);
  }
}

console.log('\n🎉  Done. Rajesh Kumar test data removed.');
await sql.end();
