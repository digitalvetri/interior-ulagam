import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the invariant that replaced row-level security.
 *
 * Supabase enforced tenant isolation in the database. Self-hosted, it is
 * enforced only by every query filtering on tenant_id — so a single route that
 * forgets is a cross-tenant data leak with nothing behind it. This walks the
 * API surface and fails if a route touches tenant-scoped data without
 * establishing a tenant.
 *
 * When a genuinely tenant-free route is added, add it to ALLOWED below with a
 * reason. That list is the point: it makes each exemption a deliberate,
 * reviewable decision rather than an oversight.
 */
const API_ROOT = join(__dirname, '..', 'src', 'app', 'api');

const ALLOWED = new Map<string, string>([
  ['health/route.ts', 'liveness probe — runs SELECT 1, touches no tenant data'],
  ['auth/[...all]/route.ts', 'Better Auth handler — operates on its own session tables'],
  ['v1/auth/login/route.ts', 'authenticates; there is no tenant until it succeeds'],
  ['v1/setup/route.ts', 'first-run bootstrap — creates the first tenant, self-disables after'],
  ['v1/client-view/[token]/route.ts', 'public client portal — scoped by an unguessable token'],
  ['webhooks/whatsapp/route.ts', 'signature-verified; resolves tenant from the matched lead'],
  ['webhooks/razorpay/route.ts', 'signature-verified; resolves tenant from the payment record'],
]);

function routeFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) return routeFiles(full, rel);
    return entry === 'route.ts' ? [rel] : [];
  });
}

describe('tenant isolation', () => {
  const routes = routeFiles(API_ROOT);

  it('finds the API surface', () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it.each(routes)('%s scopes its queries to a tenant', (rel) => {
    if (ALLOWED.has(rel)) return;

    const source = readFileSync(join(API_ROOT, rel), 'utf8');
    const touchesDb = /\bdb\s*\.\s*(select|insert|update|delete)|\bdb\b\s*$/m.test(source);
    if (!touchesDb) return;

    expect(
      source.includes('tenantId'),
      `${rel} queries the database without referencing tenantId. Either scope it, ` +
        'or add it to ALLOWED in this test with the reason it is safe.',
    ).toBe(true);
  });

  it.each(routes)('%s authenticates or is a documented exception', (rel) => {
    if (ALLOWED.has(rel)) return;
    const source = readFileSync(join(API_ROOT, rel), 'utf8');
    expect(
      /getAuthContext|requireAuth|requireRole/.test(source),
      `${rel} has no authentication check.`,
    ).toBe(true);
  });

  it('every exemption still exists', () => {
    // Stops the allow-list rotting into a shield for files that moved.
    for (const rel of ALLOWED.keys()) {
      expect(routes, `${rel} is exempted but no longer exists`).toContain(rel);
    }
  });
});
