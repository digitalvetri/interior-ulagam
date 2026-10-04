import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// In Next.js dev mode each hot-reload re-evaluates this module, creating a new
// postgres() pool while the old one stays open. Over several reloads the
// connections exhaust Postgres's limit. Caching on `global` means reloads
// reuse the existing pool instead of leaking connections.
declare global {
  var __dbClient: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__dbClient ??
  postgres(process.env.DATABASE_URL!, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });

if (process.env.NODE_ENV !== 'production') {
  global.__dbClient = client;
}

export const db = drizzle(client, { schema });
