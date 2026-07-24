import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type UserRole = 'owner' | 'designer' | 'supervisor' | 'accountant';

export interface TenantContext {
  userId: string;
  tenantId: string;
  role: UserRole;
}

export async function requireAuth(): Promise<TenantContext> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // app_metadata is server-only (Admin API / service role), not user-editable.
  // Never read tenant_id or role from user_metadata — users can self-edit that field.
  const tenantId = (user.app_metadata?.tenant_id ?? user.user_metadata?.tenant_id) as string | undefined;
  const role = (user.app_metadata?.role ?? user.user_metadata?.role) as UserRole | undefined;

  if (!tenantId) {
    throw new Error('User has no tenant_id in metadata');
  }

  return {
    userId: user.id,
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
  // app_metadata is server-only (Admin API), never user-editable — use it as the source of truth.
  const tenantId = (user.app_metadata?.tenant_id ?? user.user_metadata?.tenant_id) as string | undefined;
  const role = (user.app_metadata?.role ?? user.user_metadata?.role) as UserRole | undefined;
  if (!tenantId) return null;
  return { userId: user.id, tenantId, role: role ?? 'designer' };
}
