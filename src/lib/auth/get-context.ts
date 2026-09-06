import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

export interface Permissions {
  canSeeFinance: boolean;
  canCreateQuotes: boolean;
  canSendQuotes: boolean;
  canRaisePO: boolean;
  canRecordPayments: boolean;
  canSeeAllLeads: boolean;
}

// Canonical roles used by application logic. The DB enum also contains 'admin'
// and 'employee' (added for migration compatibility), but app code uses these.
export type AppRole = 'owner' | 'designer' | 'supervisor' | 'accountant' | 'admin' | 'employee';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: AppRole;
  isAdmin: boolean;
  permissions: Permissions;
  fullName: string;
}

const DEFAULT_PERMISSIONS: Permissions = {
  canSeeFinance:     false,
  canCreateQuotes:   false,
  canSendQuotes:     false,
  canRaisePO:        false,
  canRecordPayments: false,
  canSeeAllLeads:    false,
};

const ADMIN_PERMISSIONS: Permissions = {
  canSeeFinance:     true,
  canCreateQuotes:   true,
  canSendQuotes:     true,
  canRaisePO:        true,
  canRecordPayments: true,
  canSeeAllLeads:    true,
};

export async function getEnrichedAuthContext(): Promise<AuthContext | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) return null;

  const [user] = await db
    .select({
      id:              users.id,
      tenantId:        users.tenantId,
      role:            users.role,
      fullName:        users.fullName,
      permissionsJson: users.permissionsJson,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) return null;

  // 'owner' is the legacy admin role; 'admin' is the P0 migration alias.
  // Both get full permissions. All other roles fall back to per-user flags.
  const isAdmin = user.role === 'owner' || user.role === 'admin';

  const rawPerms = (user.permissionsJson ?? {}) as Partial<Permissions>;
  const permissions: Permissions = isAdmin
    ? ADMIN_PERMISSIONS
    : {
        canSeeFinance:     rawPerms.canSeeFinance     ?? DEFAULT_PERMISSIONS.canSeeFinance,
        canCreateQuotes:   rawPerms.canCreateQuotes   ?? DEFAULT_PERMISSIONS.canCreateQuotes,
        canSendQuotes:     rawPerms.canSendQuotes     ?? DEFAULT_PERMISSIONS.canSendQuotes,
        canRaisePO:        rawPerms.canRaisePO        ?? DEFAULT_PERMISSIONS.canRaisePO,
        canRecordPayments: rawPerms.canRecordPayments ?? DEFAULT_PERMISSIONS.canRecordPayments,
        canSeeAllLeads:    rawPerms.canSeeAllLeads    ?? DEFAULT_PERMISSIONS.canSeeAllLeads,
      };

  return {
    userId:   user.id,
    tenantId: user.tenantId,
    role:     user.role as AppRole,
    isAdmin,
    permissions,
    fullName: user.fullName,
  };
}

export async function requireEnrichedAuth(): Promise<AuthContext> {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) throw new Error('UNAUTHORIZED');
  return ctx;
}

export async function requireEnrichedAdmin(): Promise<AuthContext> {
  const ctx = await requireEnrichedAuth();
  if (!ctx.isAdmin) throw new Error('FORBIDDEN');
  return ctx;
}
