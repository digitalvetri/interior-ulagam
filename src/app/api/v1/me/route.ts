import { NextResponse } from 'next/server';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

// Identity for client components (sidebar, top bar). Returns only what the
// chrome needs to render — never tokens or anything sensitive.
export async function GET() {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    data: {
      id:          ctx.userId,
      fullName:    ctx.fullName,
      role:        ctx.role,
      isAdmin:     ctx.isAdmin,
      tenantId:    ctx.tenantId,
      permissions: ctx.permissions,
    },
  });
}
