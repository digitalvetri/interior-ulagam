import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { APIError } from 'better-auth/api';
import { auth } from '@/lib/auth/config';
import { checkRateLimit, loginLimiter } from '@/lib/ratelimit';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(loginLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    // asResponse: true so Better Auth's Set-Cookie headers reach the browser.
    const response = await auth.api.signInEmail({
      body: parsed.data,
      headers: request.headers,
      asResponse: true,
    });

    // Better Auth answers a bad credential with a 401 Response rather than by
    // throwing, so normalise it to this route's { error } contract. Every
    // failure collapses to one message — distinguishing "no such user" from
    // "wrong password" would let an attacker enumerate accounts.
    if (!response.ok) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Checked only after the password is verified, so it reveals nothing to a
    // guesser. Drop the session just issued and say why, rather than letting
    // the app bounce them back to this page.
    const [account] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.email, parsed.data.email.trim().toLowerCase()))
      .limit(1);
    if (account?.status === 'inactive') {
      const authCtx = await auth.$context;
      await authCtx.internalAdapter.deleteUserSessions(account.id);
      return NextResponse.json(
        { error: 'This account has been deactivated. Contact your studio owner.' },
        { status: 403 },
      );
    }

    return response;
  } catch (err) {
    // Deliberately collapse every failure mode into one message — distinguishing
    // "no such user" from "wrong password" would let an attacker enumerate accounts.
    if (err instanceof APIError) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }
    console.error('[auth/login] unexpected error:', err);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
