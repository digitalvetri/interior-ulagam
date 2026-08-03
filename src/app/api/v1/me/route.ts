import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// Identity for client components (sidebar, top bar). Returns only what the
// chrome needs to render — never tokens or anything sensitive.
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [row] = await db
    .select({ fullName: users.fullName, email: users.email, photoUrl: users.photoUrl })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);

  return NextResponse.json({
    data: {
      id: ctx.userId,
      role: ctx.role,
      tenantId: ctx.tenantId,
      fullName: row?.fullName ?? row?.email ?? '',
      email: row?.email ?? null,
      photoUrl: row?.photoUrl ?? null,
    },
  });
}
