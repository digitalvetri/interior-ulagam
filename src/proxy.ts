import { createServerClient, type CookieOptions } from '@supabase/ssr';
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

  // Short-circuit before touching Supabase for public paths.
  // This prevents AuthRetryableFetchError from crashing all requests
  // when Supabase is temporarily unreachable.
  if (isPublic(pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Fail-open on network errors: if Supabase is unreachable and the request
  // already carries a Supabase auth cookie, we assume the session is still
  // valid rather than bouncing the user to /login. The API routes still run
  // their own auth checks, so this only affects page navigation UX; it does
  // not weaken data-plane security. Prevents "site is slow → user redirected
  // to /login every refresh" during flaky connectivity to the Supabase host.
  const hasSupabaseCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));

  let user: unknown = null;
  let supabaseReachable = true;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    supabaseReachable = false;
  }

  if (!user) {
    // Supabase unreachable but we have a session cookie — trust it for the
    // page shell so the user keeps browsing. If we can reach Supabase and
    // there is genuinely no user, fall through to the login redirect.
    if (!supabaseReachable && hasSupabaseCookie) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
