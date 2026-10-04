import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, ledgerAdjustments } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { LedgerAdjustmentInput } from '@/types/project-money';
import { customerProjectIds } from '@/lib/project-money/server';
import { invalid, readJson, serverError } from '@/lib/civil/server';

type Params = { params: Promise<{ id: string }> };

/** Discount, refund or write-off on a client's account (owner only; kept in the ledger with its reason). */
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  const { id } = await params;

  const parsed = LedgerAdjustmentInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  try {
    const [c] = await db.select({ id: customers.id }).from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId))).limit(1);
    if (!c) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (input.projectId && !(await customerProjectIds(ctx.tenantId, id)).some(p => p.id === input.projectId)) {
      return NextResponse.json({ error: 'That project does not belong to this client.' }, { status: 422 });
    }
    const [row] = await db.insert(ledgerAdjustments).values({
      tenantId: ctx.tenantId, customerId: id, projectId: input.projectId, kind: input.kind,
      amountPaise: input.amountPaise, reason: input.reason, adjDate: input.adjDate, createdBy: ctx.dbUserId,
    }).returning();
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return serverError('customers/:id/adjustments POST', err);
  }
}
