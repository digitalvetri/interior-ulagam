import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { loadCustomerLedger } from '@/lib/project-money/server';
import { serverError } from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

/** The client's running payment ledger across their projects (?projectId= to narrow). */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;
  const { id } = await params;

  const projectId = request.nextUrl.searchParams.get('projectId');
  if (projectId && !z.string().uuid().safeParse(projectId).success) {
    return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
  }

  try {
    const [c] = await db.select({ id: customers.id, fullName: customers.fullName, phone: customers.phone })
      .from(customers).where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId))).limit(1);
    if (!c) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    const ledger = await loadCustomerLedger(ctx.tenantId, id, projectId);
    return NextResponse.json({ data: { customer: c, ...ledger } });
  } catch (err) {
    return serverError('customers/:id/ledger GET', err);
  }
}
