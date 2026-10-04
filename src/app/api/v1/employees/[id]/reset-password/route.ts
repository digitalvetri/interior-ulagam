import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { resetToTemporaryPassword } from '@/lib/auth/reset-password';

/**
 * Owner resets a staff member's password to a one-time temporary password.
 *
 * There is no mail transport, so "forgot password" goes through the owner: the
 * new password is returned once for them to hand over, the staff member is
 * signed out everywhere, and must choose their own password at next sign-in.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  const { id } = await params;

  // Your own password is changed with the current one, not reset around it.
  if (id === ctx.userId) {
    return NextResponse.json(
      { error: 'Use Change password to change your own password.' },
      { status: 400 },
    );
  }

  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId)))
    .limit(1);
  if (!target) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const temporaryPassword = await resetToTemporaryPassword(target.id);
  if (!temporaryPassword) {
    return NextResponse.json(
      { error: 'This employee has no login. Add an email when creating them to give them one.' },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: { email: target.email, temporaryPassword } });
}
