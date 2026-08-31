import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

// Local Postgres (127.0.0.1 / localhost) doesn't accept SSL. Remote Supabase
// requires it. Detect the host and only require SSL when we're not local.
const isLocal = /(?:^|@)(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(DATABASE_URL);
const sql = postgres(DATABASE_URL, { max: 1, ssl: isLocal ? false : 'require' });

const migrationSql = readFileSync(
  resolve(__dirname, '../drizzle/0000_worthless_quasar.sql'),
  'utf8'
);

// Split on the drizzle-kit statement-breakpoint marker
const statements = migrationSql
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(Boolean);

console.log(`Applying ${statements.length} statements…\n`);

let applied = 0;
let skipped = 0;
let errors = 0;

for (const stmt of statements) {
  const preview = stmt.slice(0, 60).replace(/\n/g, ' ');
  try {
    await sql.unsafe(stmt);
    applied++;
    console.log(`  ✓  ${preview}`);
  } catch (e) {
    const msg = e.message ?? '';
    // Postgres codes for "already exists" errors — safe to skip
    if (
      msg.includes('already exists') ||
      e.code === '42710' || // duplicate_object (type/enum already exists)
      e.code === '42P07' || // duplicate_table
      e.code === '42701' || // duplicate_column
      e.code === '23505' || // unique_violation (constraint)
      e.code === '42P16'    // invalid_table_definition (index already exists)
    ) {
      skipped++;
      console.log(`  ⊘  (already exists, skipped) ${preview}`);
    } else {
      errors++;
      console.error(`  ✗  ERROR: ${msg}`);
      console.error(`     Statement: ${stmt.slice(0, 120)}`);
    }
  }
}

await sql.end();

console.log(`\nDone — applied: ${applied}, skipped (already exist): ${skipped}, errors: ${errors}`);
if (errors > 0) process.exit(1);
