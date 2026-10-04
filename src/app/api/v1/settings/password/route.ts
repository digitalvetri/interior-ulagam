import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth/config';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

/**
 * Change the signed-in user's own password.
 *
 * Self-scoped, so any role may call it — a user changing their own password
 * needs no privilege beyond being that user. The current password is verified
 * by Better Auth, which is what stops a hijacked session from locking the real
 * owner out.
 *
 * The Settings security tab previously rendered this form with no submit
 * handler at all: three inputs whose state was never read, and a toast that
 * reported success. A user who "changed" their password still had the old one
 * and had no way to find out.
 */
const BodySchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  // Must match minPasswordLength in src/lib/auth/config.ts.
  newPassword: z.string().min(12, 'New password must be at least 12 characters.'),
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  let authHeaders: Headers;
  try {
    // returnHeaders: revoking the other sessions also replaces this one, so the
    // new session cookie has to reach the browser or the user is signed out.
    ({ headers: authHeaders } = await auth.api.changePassword({
      returnHeaders: true,
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        // Everything else signed in with the old password. Changing it is
        // exactly when you want those sessions gone.
        revokeOtherSessions: true,
      },
    }));
  } catch {
    // Better Auth does not distinguish "wrong password" from other failures in
    // a way worth exposing — and saying which it was would help an attacker
    // who already holds the session.
    return NextResponse.json(
      { error: 'Could not change the password. Check your current password and try again.' },
      { status: 400 },
    );
  }

  // They now hold a password only they know — stop sending them to /change-password.
  await db.update(users).set({ mustChangePassword: false }).where(and(eq(users.id, ctx.userId), eq(users.tenantId, ctx.tenantId)));

  const res = NextResponse.json({ data: { changed: true } });
  for (const cookie of authHeaders.getSetCookie()) res.headers.append('set-cookie', cookie);
  return res;
}
