import { describe, it, expect } from 'vitest';
import { requireApiRole, ROLES, type TenantContext, type UserRole } from '@/lib/auth';

/**
 * The guard itself. role-enforcement.test.ts proves every mutating route calls
 * it; this proves that calling it does the right thing.
 */
function ctx(role: UserRole): TenantContext {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    dbUserId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    role,
  };
}

const ALL: UserRole[] = ['owner', 'designer', 'supervisor', 'accountant'];

describe('requireApiRole', () => {
  it('lets an allowed role through', () => {
    expect(requireApiRole(ctx('owner'), ROLES.OWNER_ONLY)).toBeNull();
    expect(requireApiRole(ctx('designer'), ROLES.CRM)).toBeNull();
    expect(requireApiRole(ctx('supervisor'), ROLES.DELIVERY)).toBeNull();
    expect(requireApiRole(ctx('accountant'), ROLES.FINANCE)).toBeNull();
  });

  it('returns a 403 rather than throwing', () => {
    // The predecessor, requireRole(), threw — which inside a route handler
    // becomes a 500 and reads to the caller as a server fault.
    let denied: unknown;
    expect(() => {
      denied = requireApiRole(ctx('supervisor'), ROLES.OWNER_ONLY);
    }).not.toThrow();
    expect((denied as Response).status).toBe(403);
  });

  it('names the roles required, so the caller can act on the refusal', async () => {
    const denied = requireApiRole(ctx('designer'), ROLES.FINANCE);
    const body = await (denied as Response).json();
    expect(body.error).toContain('owner');
    expect(body.error).toContain('accountant');
  });

  it('admits only the owner to OWNER_ONLY', () => {
    for (const role of ALL) {
      const result = requireApiRole(ctx(role), ROLES.OWNER_ONLY);
      if (role === 'owner') expect(result).toBeNull();
      else expect(result).not.toBeNull();
    }
  });

  it('keeps a supervisor out of commercial and financial actions', () => {
    // The concrete escalation the guard exists to stop: a supervisor approving
    // a quotation or booking an expense.
    expect(requireApiRole(ctx('supervisor'), ROLES.COMMERCIAL)).not.toBeNull();
    expect(requireApiRole(ctx('supervisor'), ROLES.FINANCE)).not.toBeNull();
    expect(requireApiRole(ctx('supervisor'), ROLES.CRM)).not.toBeNull();
  });

  it('keeps an accountant out of delivery and CRM writes', () => {
    expect(requireApiRole(ctx('accountant'), ROLES.DELIVERY)).not.toBeNull();
    expect(requireApiRole(ctx('accountant'), ROLES.CRM)).not.toBeNull();
  });

  it('grants the owner every role set', () => {
    for (const set of Object.values(ROLES)) {
      expect(requireApiRole(ctx('owner'), set)).toBeNull();
    }
  });

  it('reads the legacy role names the enriched auth context still uses', () => {
    // getEnrichedAuthContext() reports 'admin' for the owner and 'employee' for designers.
    expect(requireApiRole({ role: 'admin' }, ROLES.OWNER_ONLY)).toBeNull();
    expect(requireApiRole({ role: 'employee' }, ROLES.DELIVERY)).toBeNull();
    expect(requireApiRole({ role: 'employee' }, ROLES.OWNER_ONLY)).not.toBeNull();
  });

  it('lets every staff role through STAFF (self-service routes)', () => {
    for (const r of ['owner', 'designer', 'supervisor', 'accountant'] as const) {
      expect(requireApiRole(ctx(r), ROLES.STAFF)).toBeNull();
    }
  });
});
