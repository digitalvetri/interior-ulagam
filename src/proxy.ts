import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = [
  '/login',
  '/p/',      // client trust-timeline (magic link, no login)
  '/api/',    // API routes handle their own auth
  '/_next/',
  '/favicon',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sign-up stays enabled in the Better Auth config so the first-run setup route
  // can call it server-side, but this product has no public registration — so the
  // HTTP endpoint is sealed off. Today the only account-creating caller is
  // /api/v1/setup, which itself refuses to run once a user exists.
  if (pathname.startsWith('/api/auth/sign-up')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Short-circuit before touching Supabase for public paths.
  // This prevents AuthRetryableFetchError from crashing all requests
  // when Supabase is temporarily unreachable.
  if (isPublic(pathname)) {
    return NextResponse.next({ request });
  }

  // Optimistic check only: does a session cookie exist and is its signature
  // intact? This deliberately does not touch the database — every protected
  // route re-validates the session server-side via requireAuth()/getAuthContext(),
  // which is where a revoked or expired session is actually caught. Keeping this
  // stateless also means the proxy behaves identically on the Node and Edge
  // runtimes.
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
