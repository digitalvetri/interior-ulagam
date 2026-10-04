import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';

export type UserRole = 'owner' | 'designer' | 'supervisor' | 'accountant';

export interface TenantContext {
  /**
   * Authenticated user id. Better Auth uses the `users` table as its user model,
   * so this is the same value as `dbUserId` — under Supabase they were two
   * separate identities. Both fields are kept so existing call sites still work.
   */
  userId: string;
  /** App-level users.id — use this for any FK that references users. */
  dbUserId: string | null;
  tenantId: string;
  role: UserRole;
}

const ALL_ROLES: readonly UserRole[] = ['owner', 'designer', 'supervisor', 'accountant'];
// 'admin' is a migration alias for 'owner'; 'employee' falls back to 'designer'.
const ROLE_ALIASES: Record<string, UserRole> = { admin: 'owner', employee: 'designer' };

function toRole(value: unknown): UserRole {
  if (typeof value !== 'string') return 'designer';
  if (ALL_ROLES.includes(value as UserRole)) return value as UserRole;
  return ROLE_ALIASES[value] ?? 'designer';
}

/**
 * Resolve the session and the caller's tenant. Returns null when unauthenticated,
 * or when the account somehow has no tenant — treated as unauthenticated rather
 * than trusted.
 */
async function loadContext(): Promise<TenantContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  // Read tenant and role from the database rather than the session payload, so a
  // role change or tenant move takes effect immediately instead of whenever the
  // session next refreshes.
  const [row] = await db
    .select({ id: users.id, tenantId: users.tenantId, role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!row?.tenantId) return null;

  return {
    userId: row.id,
    dbUserId: row.id,
    tenantId: row.tenantId,
    role: toRole(row.role),
  };
}

export async function requireAuth(): Promise<TenantContext> {
  const ctx = await loadContext();
  if (!ctx) redirect('/login');
  return ctx;
}

/**
 * Server-component guard. Throws, which React renders as an error boundary —
 * appropriate for a page, wrong for an API route. API routes use
 * requireApiRole() below.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<TenantContext> {
  const ctx = await requireAuth();
  if (!allowedRoles.includes(ctx.role)) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }
  return ctx;
}

/** True while the user holds a temporary password (new login or owner reset). */
export async function mustChangePassword(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.mustChangePassword ?? false;
}

/** Layout guard: send anyone on a temporary password to choose their own first. */
export async function redirectIfTemporaryPassword(): Promise<void> {
  const ctx = await loadContext();
  if (ctx && (await mustChangePassword(ctx.userId))) redirect('/change-password');
}

// Use in API routes — returns null instead of redirecting.
export async function getAuthContext(): Promise<TenantContext | null> {
  return loadContext();
}

/**
 * Named role sets, derived from src/lib/nav-items.ts.
 *
 * The sidebar already encodes who is meant to see each module; these mirror it
 * so the API enforces the boundary the interface advertises, rather than a
 * second opinion invented here. Operations with financial or destructive
 * consequence — approving, sending, deleting, changing a role, overriding a
 * milestone, issuing a client token — are narrowed to OWNER_ONLY regardless of
 * what the module's read access allows.
 */
export const ROLES = {
  /** Leads and customers — the CRM group. */
  CRM: ['owner', 'designer'] as UserRole[],
  /** Projects, design tasks, site logs, snags — anyone who works on delivery. */
  DELIVERY: ['owner', 'designer', 'supervisor'] as UserRole[],
  /** Quotes and requirements — commercial documents, before approval. */
  COMMERCIAL: ['owner', 'designer'] as UserRole[],
  /** Materials, vendors, purchase orders — the procurement group. */
  PROCUREMENT: ['owner', 'designer', 'accountant'] as UserRole[],
  /** Invoices, payments, expenses, milestones — the finance group. */
  FINANCE: ['owner', 'accountant'] as UserRole[],
  /** Civil Management division — office staff only, reads included (it is all billing data). */
  CIVIL: ['owner', 'accountant'] as UserRole[],
  /** Irreversible or financially binding actions. */
  OWNER_ONLY: ['owner'] as UserRole[],
  /**
   * Any signed-in staff member. For self-service routes (my profile, my tasks,
   * check-in, the AI assistant) where the route itself scopes rows to the caller.
   */
  STAFF: ['owner', 'designer', 'supervisor', 'accountant'] as UserRole[],
} as const;

/**
 * API-route role guard. Returns a 403 response to hand back, or null to proceed:
 *
 *   const denied = requireApiRole(ctx, ROLES.CRM);
 *   if (denied) return denied;
 *
 * Deliberately mirrors checkRateLimit's shape rather than requireRole's. A
 * thrown error inside a route handler becomes a 500, which tells the caller the
 * server broke when in fact they were not allowed — and hides a genuine
 * authorisation denial inside the noise of real failures.
 */
export function requireApiRole(
  ctx: Pick<TenantContext, 'role'> | { role: string },
  allowedRoles: readonly UserRole[],
): NextResponse | null {
  // Accepts both auth helpers: the enriched context still speaks the legacy
  // role names ('admin' = owner, 'employee' = designer).
  if (allowedRoles.includes(toRole(ctx.role))) return null;

  return NextResponse.json(
    {
      error: `Access denied. This action requires: ${allowedRoles.join(', ')}.`,
    },
    { status: 403 },
  );
}
