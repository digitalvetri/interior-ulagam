/**
 * Adds score + score_breakdown to leads, and lead_id + lead index to wa_messages.
 * Run: node scripts/migrate-leads-v2.mjs
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: 'require' });

const statements = [
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS score SMALLINT NOT NULL DEFAULT 0`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_breakdown JSONB`,
  `ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS wa_messages_lead_idx ON wa_messages(lead_id)`,
];

let applied = 0, skipped = 0;
for (const stmt of statements) {
  try {
    await sql.unsafe(stmt);
    console.log(`✓  ${stmt.slice(0, 70)}`);
    applied++;
  } catch (e) {
    const already = ['42701', '42P07', '42710', '23505'].includes(e.code);
    if (already) { console.log(`–  already exists: ${stmt.slice(0, 60)}`); skipped++; }
    else { console.error(`✗  ${stmt.slice(0, 70)}\n   ${e.message}`); }
  }
}

console.log(`\nDone — ${applied} applied, ${skipped} skipped`);
await sql.end();
