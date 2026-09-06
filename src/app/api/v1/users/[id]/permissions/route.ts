import { NextRequest, NextResponse } from 'next/server';
import { requireEnrichedAdmin } from '@/lib/auth/get-context';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const permissionsSchema = z.object({
  canSeeFinance:     z.boolean().optional(),
  canCreateQuotes:   z.boolean().optional(),
  canSendQuotes:     z.boolean().optional(),
  canRaisePO:        z.boolean().optional(),
  canRecordPayments: z.boolean().optional(),
  canSeeAllLeads:    z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireEnrichedAdmin();
    const { id } = await params;
    const body = await req.json();
    const parsed = permissionsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    // Merge patch into existing permissionsJson — tenant-scoped to prevent IDOR
    const [existing] = await db
      .select({ permissionsJson: users.permissionsJson })
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const merged = { ...(existing.permissionsJson as object ?? {}), ...parsed.data };

    await db
      .update(users)
      .set({ permissionsJson: merged })
      .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId)));

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
