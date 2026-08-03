import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenants, users } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';

/**
 * First-run setup: creates the studio tenant and its owner account.
 *
 * This is deliberately unauthenticated — there is nobody to authenticate as yet.
 * It is safe because it refuses to run once a single user exists, so the window
 * closes permanently the moment the first account is created.
 */
const SetupSchema = z.object({
  studioName: z.string().min(1).max(120),
  fullName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(12, 'Password must be at least 12 characters.'),
});

export async function GET() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  return NextResponse.json({ data: { setupComplete: count > 0 } });
}

export async function POST(request: NextRequest) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if (count > 0) {
    return NextResponse.json(
      { error: 'Setup has already been completed.' },
      { status: 409 },
    );
  }

  const parsed = SetupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }
  const { studioName, fullName, email, password } = parsed.data;

  // The tenant must exist first: users.tenantId is NOT NULL and the Better Auth
  // create hook resolves it from the tenants table.
  const [tenant] = await db.insert(tenants).values({ name: studioName }).returning();

  try {
    await auth.api.signUpEmail({ body: { name: fullName, email, password } });
  } catch (err) {
    // Roll the tenant back so a failed attempt can be retried cleanly.
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
    const message = err instanceof Error ? err.message : 'Failed to create the owner account.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Sign-up cannot set a role (role is input: false), so promote to owner here.
  const [owner] = await db
    .update(users)
    .set({ role: 'owner', emailVerified: true })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, role: users.role });

  return NextResponse.json(
    { data: { tenantId: tenant.id, tenantName: tenant.name, owner } },
    { status: 201 },
  );
}
