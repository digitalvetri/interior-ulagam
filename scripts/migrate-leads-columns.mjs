import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: 'require' });

const alterStatements = [
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "priority" "lead_priority"`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contact_email" text`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "property_type" text`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "project_location" text`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "project_value_paise" bigint`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "designer_name" text`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "follow_up_date" timestamp with time zone`,
];

for (const stmt of alterStatements) {
  try {
    await sql.unsafe(stmt);
    console.log(`  ✓  ${stmt}`);
  } catch (e) {
    console.error(`  ✗  ${e.message}`);
    console.error(`     ${stmt}`);
  }
}

await sql.end();
console.log('\nLeads columns migration done.');
