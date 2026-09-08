import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

async function run() {
  await db.execute(sql`
    ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS check_in_latitude  numeric(10, 7),
      ADD COLUMN IF NOT EXISTS check_in_longitude numeric(10, 7),
      ADD COLUMN IF NOT EXISTS check_in_address   text;
  `);
  console.log('✅ GPS columns added to attendance_records');
  await client.end();
}

run().catch(e => { console.error('❌ Migration failed:', e); process.exit(1); });
