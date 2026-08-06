// Sets the application role's password from the environment, after migrations.
//
// Migration 0003 creates `interioos_app` with a placeholder password because SQL
// files cannot read env. This runs immediately afterwards in the same container
// and replaces it. Idempotent — safe on every boot.
import postgres from 'postgres';

const ownerUrl = process.env.DATABASE_URL;
const appPassword = process.env.APP_DB_PASSWORD;

if (!ownerUrl) {
  console.error('[app-role] DATABASE_URL is not set');
  process.exit(1);
}

if (!appPassword) {
  console.warn('[app-role] APP_DB_PASSWORD is not set — leaving the role password unchanged.');
  process.exit(0);
}

const sql = postgres(ownerUrl, { max: 1 });

try {
  // Identifier is a literal; only the password is interpolated, and postgres-js
  // escapes it as a value rather than splicing it into the statement text.
  await sql`ALTER ROLE interioos_app WITH PASSWORD ${sql.unsafe(`'${appPassword.replace(/'/g, "''")}'`)}`;
  console.log('[app-role] password set for interioos_app');
} catch (err) {
  console.error('[app-role] failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
