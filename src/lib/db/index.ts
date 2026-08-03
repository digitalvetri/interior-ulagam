import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Direct connection to our own Postgres — prepared statements are enabled
// (they were disabled only to satisfy Supabase's transaction-mode pooler).
const client = postgres(process.env.DATABASE_URL!, {
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
});

export const db = drizzle(client, { schema });
