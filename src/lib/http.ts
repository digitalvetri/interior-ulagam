import { NextResponse } from 'next/server';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns a 400 when a route parameter is not a UUID, otherwise null.
 *
 * Without this a malformed id reaches Postgres and fails the uuid cast, which
 * surfaces as a 500 — telling the caller the server broke when in fact they
 * sent a bad id, and burying a real fault in the noise.
 */
export function requireUuid(value: string, field = 'id'): NextResponse | null {
  if (UUID_RE.test(value)) return null;
  return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
}
