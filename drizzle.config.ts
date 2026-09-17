import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

// drizzle-kit needs DDL privileges (CREATE/ALTER/DROP); the app's DATABASE_URL
// uses a restricted role that cannot own or alter tables. Set DRIZZLE_DATABASE_URL
// to the superuser connection string so that `pnpm drizzle-kit push` works.
const migrationUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!migrationUrl) throw new Error('Set DRIZZLE_DATABASE_URL (or DATABASE_URL) in .env.local');

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: migrationUrl,
  },
});
