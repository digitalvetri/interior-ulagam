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
  if (!supabase) {
    redirect('/login');
  }
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  const role = user.user_metadata?.role as UserRole | undefined;

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
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  const role = user.user_metadata?.role as UserRole | undefined;
  if (!tenantId) return null;
  return { userId: user.id, tenantId, role: role ?? 'designer' };
}
