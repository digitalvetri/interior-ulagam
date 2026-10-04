import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the invariant that the sidebar cannot enforce.
 *
 * `src/lib/nav-items.ts` hides navigation per role, so the interface advertises
 * a permission boundary. Nothing in the API held that boundary: of 82 routes,
 * 11 checked a role, all by ad-hoc string comparison, and `requireRole` was
 * never called. A supervisor could approve a quotation, delete a colleague, or
 * PATCH their own row to `role: 'owner'` — the sidebar simply did not offer them
 * the button.
 *
 * This walks every route that mutates state and fails if it does not assert a
 * role. It is the sibling of tenant-isolation.test.ts and works the same way:
 * a genuinely role-free route goes in ALLOWED with the reason it is safe, so
 * each exemption is a reviewable decision rather than an oversight.
 */
const API_ROOT = join(__dirname, '..', 'src', 'app', 'api');

/** Methods that change state. GET is readable by anyone the tenant check admits. */
const MUTATING = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/;

const ALLOWED = new Map<string, string>([
  ['auth/[...all]/route.ts', 'Better Auth handler — there is no role before sign-in'],
  ['v1/auth/login/route.ts', 'authenticates; there is no role until it succeeds'],
  ['v1/setup/route.ts', 'first-run bootstrap — creates the first owner, self-disables after'],
  [
    'webhooks/whatsapp/route.ts',
    'signature-verified machine caller; acts as the system, not as a user',
  ],
  [
    'webhooks/razorpay/route.ts',
    'signature-verified machine caller; acts as the system, not as a user',
  ],
  [
    'v1/notifications/route.ts',
    'self-scoped — a user reads and dismisses their own notifications, any role',
  ],
  [
    'v1/notifications/[id]/route.ts',
    'self-scoped — a user reads and dismisses their own notifications, any role',
  ],
  [
    'v1/settings/profile/route.ts',
    'self-scoped — a user edits their own profile, any role',
  ],
  [
    'v1/settings/password/route.ts',
    'self-scoped — a user changes their own password; Better Auth verifies the current one',
  ],
  [
    'v1/settings/sessions/route.ts',
    'self-scoped — Better Auth scopes listing and revocation to the calling user',
  ],
]);

function routeFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) return routeFiles(full, rel);
    return entry === 'route.ts' ? [rel] : [];
  });
}

describe('role enforcement', () => {
  const routes = routeFiles(API_ROOT);
  const mutating = routes.filter((rel) =>
    MUTATING.test(readFileSync(join(API_ROOT, rel), 'utf8')),
  );

  it('finds the mutating API surface', () => {
    expect(mutating.length).toBeGreaterThan(40);
  });

  it.each(mutating)('%s asserts a role on its mutating methods', (rel) => {
    if (ALLOWED.has(rel)) return;

    const source = readFileSync(join(API_ROOT, rel), 'utf8');

    expect(
      /requireApiRole|requireRole/.test(source),
      `${rel} mutates state without asserting a role. Add requireApiRole(ctx, [...]), ` +
        'or add it to ALLOWED in this test with the reason any role may call it.',
    ).toBe(true);
  });

  it.each(mutating)('%s guards every mutating handler, not just one', (rel) => {
    if (ALLOWED.has(rel)) return;

    const source = readFileSync(join(API_ROOT, rel), 'utf8');

    // The check above is satisfied by a single mention anywhere in the file, so
    // a route exporting both PATCH and DELETE would pass with only PATCH
    // guarded. Counting closes that gap: one guard per mutating handler.
    const handlers = source.match(/export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/g) ?? [];
    const guards = source.match(/requireApiRole\s*\(/g) ?? [];

    expect(
      guards.length >= handlers.length,
      `${rel} exports ${handlers.length} mutating handler(s) but calls requireApiRole ` +
        `${guards.length} time(s). Every mutating handler needs its own guard.`,
    ).toBe(true);
  });

  it('no route throws requireRole into an API response', () => {
    // requireRole() throws, which surfaces as a 500 rather than a 403. API
    // routes must use requireApiRole, which returns a response to hand back.
    for (const rel of mutating) {
      const source = readFileSync(join(API_ROOT, rel), 'utf8');
      expect(
        /\brequireRole\s*\(/.test(source),
        `${rel} uses requireRole(), which throws a 500. Use requireApiRole() instead.`,
      ).toBe(false);
    }
  });

  it('every exemption still exists', () => {
    for (const rel of ALLOWED.keys()) {
      expect(routes, `${rel} is exempted but no longer exists`).toContain(rel);
    }
  });
});
