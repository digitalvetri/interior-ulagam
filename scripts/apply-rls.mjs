import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '..', 'supabase', 'rls-policies.sql');
const sqlText = await readFile(sqlPath, 'utf8');

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

try {
  await sql.unsafe(sqlText);
  console.log('RLS policies applied.');
} catch (err) {
  console.error('Failed to apply RLS:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
