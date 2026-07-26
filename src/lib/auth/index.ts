import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export type UserRole = 'owner' | 'designer' | 'supervisor' | 'accountant';

export interface TenantContext {
  /** Supabase auth user id (auth.users.id — used for auth flows only). */
  userId: string;
  /** App-level users.id (public.users.id — use this for any FK that references users). */
  dbUserId: string | null;
  tenantId: string;
  role: UserRole;
}

// Resolve the app-level users.id from the Supabase auth uid. Null if the
// auth user has no matching users row yet.
async function resolveDbUserId(supabaseUid: string, tenantId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.supabaseUid, supabaseUid), eq(users.tenantId, tenantId)))
    .limit(1);
  return row?.id ?? null;
}

export async function requireAuth(): Promise<TenantContext> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const tenantId = (user.app_metadata?.tenant_id ?? user.user_metadata?.tenant_id) as string | undefined;
  const role = (user.app_metadata?.role ?? user.user_metadata?.role) as UserRole | undefined;

  if (!tenantId) {
    throw new Error('User has no tenant_id in metadata');
  }

  const dbUserId = await resolveDbUserId(user.id, tenantId);

  return {
    userId: user.id,
    dbUserId,
    tenantId,
    role: role ?? 'designer',
  };
}

export async function requireRole(allowedRoles: UserRole[]): Promise<TenantContext> {
  const ctx = await requireAuth();
  if (!allowedRoles.includes(ctx.role)) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }
  return ctx;
}

// Use in API routes — returns null instead of redirecting
export async function getAuthContext(): Promise<TenantContext | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const tenantId = (user.app_metadata?.tenant_id ?? user.user_metadata?.tenant_id) as string | undefined;
  const role = (user.app_metadata?.role ?? user.user_metadata?.role) as UserRole | undefined;
  if (!tenantId) return null;
  const dbUserId = await resolveDbUserId(user.id, tenantId);
  return { userId: user.id, dbUserId, tenantId, role: role ?? 'designer' };
}
