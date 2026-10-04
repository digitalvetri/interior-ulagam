import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth/config';
import { getAuthContext } from '@/lib/auth';

/**
 * The signed-in user's own active sessions, and a way to end one.
 *
 * Self-scoped — any role may list and revoke their own sessions. Better Auth
 * scopes both operations to the caller's user, so one user cannot enumerate or
 * end another's.
 *
 * The Settings security tab previously rendered two invented rows — "Chrome —
 * Windows 11" and "Safari — iPhone", both in Coimbatore — for every user. A
 * security surface showing fabricated data is worse than showing none: it is
 * exactly where someone would look to notice a session they did not start.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requestHeaders = await headers();
  const sessions = await auth.api.listSessions({ headers: requestHeaders });
  const current = await auth.api.getSession({ headers: requestHeaders });

  const data = sessions.map((s) => ({
    id: s.id,
    token: s.token,
    userAgent: s.userAgent ?? null,
    ipAddress: s.ipAddress ?? null,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    current: s.token === current?.session?.token,
  }));

  // Most recent first, with the current session pinned to the top.
  data.sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return NextResponse.json({ data });
}

const RevokeSchema = z.object({ token: z.string().min(1) });

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = RevokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A session token is required.' }, { status: 400 });
  }

  try {
    await auth.api.revokeSession({
      headers: await headers(),
      body: { token: parsed.data.token },
    });
  } catch {
    return NextResponse.json({ error: 'Could not end that session.' }, { status: 400 });
  }

  return NextResponse.json({ data: { revoked: true } });
}
