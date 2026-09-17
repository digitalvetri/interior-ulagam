import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
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

const ROLES: readonly UserRole[] = ['owner', 'designer', 'supervisor', 'accountant'];
// 'admin' is a migration alias for 'owner'; 'employee' falls back to 'designer'.
const ROLE_ALIASES: Record<string, UserRole> = { admin: 'owner', employee: 'designer' };

function toRole(value: unknown): UserRole {
  if (typeof value !== 'string') return 'designer';
  if (ROLES.includes(value as UserRole)) return value as UserRole;
  return ROLE_ALIASES[value] ?? 'designer';
}

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

export async function requireRole(allowedRoles: UserRole[]): Promise<TenantContext> {
  const ctx = await requireAuth();
  if (!allowedRoles.includes(ctx.role)) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }
  return ctx;
}

// Use in API routes — returns null instead of redirecting.
export async function getAuthContext(): Promise<TenantContext | null> {
  return loadContext();
}
