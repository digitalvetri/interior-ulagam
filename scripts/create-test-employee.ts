/**
 * Creates a test employee account.
 * Run: pnpm exec tsx --tsconfig tsconfig.json scripts/create-test-employee.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/db/schema';
import { auth } from '../src/lib/auth/config';
import { and, eq } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

const TEST_EMAIL    = 'employee@konstdesign.com';
const TEST_PASSWORD = 'KonstEmployee@2026';
const TEST_NAME     = 'Arjun Krishnamurthy';
const TEST_ROLE     = 'designer' as const;
const TEST_TITLE    = 'Interior Designer';
const TEST_DEPT     = 'Design';

async function main() {
  console.log('Creating test employee account…\n');

  // 1. Sign up via Better Auth (auto-assigns tenantId via databaseHook)
  try {
    await auth.api.signUpEmail({
      body: { name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    console.log('✅ Auth account created');
  } catch (e: unknown) {
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
    const cause = err?.cause?.message ?? '';
    const msg   = err?.message ?? String(e);
    if (cause.includes('unique') || cause.includes('duplicate') || cause.includes('exist') ||
        msg.includes('exist') || msg.includes('duplicate') || err?.cause?.code === '23505') {
      console.log('ℹ️  Auth account already exists — patching profile…');
    } else {
      console.error('❌ Sign-up failed:', msg);
      console.error('   Cause:', cause || err?.cause);
      await client.end();
      process.exit(1);
    }
  }

  // 2. Patch app-level profile fields
  const [user] = await db
    .select({ id: schema.users.id, tenantId: schema.users.tenantId })
    .from(schema.users)
    .where(eq(schema.users.email, TEST_EMAIL))
    .limit(1);

  if (!user) {
    console.error('❌ User row not found — tenant hook may have failed');
    await client.end();
    process.exit(1);
  }

  await db
    .update(schema.users)
    .set({ role: TEST_ROLE, jobTitle: TEST_TITLE, department: TEST_DEPT, status: 'active' })
    .where(and(eq(schema.users.id, user.id), eq(schema.users.tenantId, user.tenantId)));

  await client.end();

  console.log('✅ Profile updated\n');
  console.log('────────────────────────────────────────');
  console.log('  Employee Dashboard Credentials');
  console.log('────────────────────────────────────────');
  console.log(`  URL      : http://localhost:3000/login`);
  console.log(`  Email    : ${TEST_EMAIL}`);
  console.log(`  Password : ${TEST_PASSWORD}`);
  console.log(`  Role     : ${TEST_ROLE} → ${TEST_TITLE}`);
  console.log('────────────────────────────────────────');
  console.log('  After login → click "My Space" in sidebar\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
