import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { purchaseOrders, projects, vendors } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { withServerLineIds } from '@/lib/procurement/line-ids';
import { hasPgCode, nextDocNumber } from '@/lib/procurement/receipts';

const PO_STATUSES = [
  'draft',
  'sent',
  'acknowledged',
  'partial',
  'complete',
  'cancelled',
] as const;

const CreatePurchaseOrderSchema = z.object({
  projectId: z.string().uuid(),
  vendorId: z.string().uuid().optional(),
  linesJson: z.array(z.record(z.unknown())).min(1),
  expectedDeliveryAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const status = searchParams.get('status');

  if (status) {
    const statusParsed = z.enum(PO_STATUSES).safeParse(status);
    if (!statusParsed.success) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }
  }

  try {
    const conditions = [eq(purchaseOrders.tenantId, ctx.tenantId)];

    if (projectId) {
      conditions.push(eq(purchaseOrders.projectId, projectId));
    }

    if (status) {
      const validStatus = status as (typeof PO_STATUSES)[number];
      conditions.push(eq(purchaseOrders.status, validStatus));
    }

    const rows = await db
      .select({
        id:                  purchaseOrders.id,
        tenantId:            purchaseOrders.tenantId,
        projectId:           purchaseOrders.projectId,
        vendorId:            purchaseOrders.vendorId,
        vendorContactName:   purchaseOrders.vendorContactName,
        vendorPhone:         purchaseOrders.vendorPhone,
        poNumber:            purchaseOrders.poNumber,
        linesJson:           purchaseOrders.linesJson,
        status:              purchaseOrders.status,
        advancePaidPaise:    purchaseOrders.advancePaidPaise,
        expectedDeliveryAt:  purchaseOrders.expectedDeliveryAt,
        pdfUrl:              purchaseOrders.pdfUrl,
        createdAt:           purchaseOrders.createdAt,
        projectName:         projects.name,
        vendorName:          vendors.name,
      })
      .from(purchaseOrders)
      .leftJoin(projects, eq(purchaseOrders.projectId, projects.id))
      .leftJoin(vendors,  eq(purchaseOrders.vendorId,  vendors.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt));

    // Compute line count and total paise from linesJson
    const enriched = rows.map((po) => {
      const lines = Array.isArray(po.linesJson) ? (po.linesJson as Record<string, unknown>[]) : [];
      const lineCount = lines.length;
      const totalPaise = lines.reduce((sum, l) => {
        // Use the pre-computed totalPaise stored on each line; fall back to
        // unitRatePaise (paise) × qty for older rows that lacked totalPaise.
        if (typeof l.totalPaise === 'number') return sum + l.totalPaise;
        const qty  = typeof l.qty === 'number' ? l.qty : 0;
        const rate = typeof l.unitRatePaise === 'number' ? l.unitRatePaise : 0;
        return sum + qty * rate;
      }, 0);
      return { ...po, lineCount, totalPaise };
    });

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error('[purchase-orders GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.PROCUREMENT);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreatePurchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const input = parsed.data;

  try {
    // PO number = one past the highest PO-YYYY-NNN for this tenant (a row
    // count reused numbers after deletes). A per-tenant transaction lock
    // serialises concurrent creates; 23505 (unique index from 0037) retries.
    const year = new Date().getFullYear();
    let po: typeof purchaseOrders.$inferSelect | undefined;
    for (let attempt = 0; attempt < 3 && !po; attempt++) {
      try {
        po = await db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`po-number:${ctx.tenantId}`}))`);
          const existing = await tx
            .select({ n: purchaseOrders.poNumber })
            .from(purchaseOrders)
            .where(and(eq(purchaseOrders.tenantId, ctx.tenantId), like(purchaseOrders.poNumber, `PO-${year}-%`)));
          const poNumber = nextDocNumber('PO', year, existing.map((r) => r.n));
          const [row] = await tx
            .insert(purchaseOrders)
            .values({
              tenantId: ctx.tenantId,
              projectId: input.projectId,
              vendorId: input.vendorId ?? null,
              poNumber,
              linesJson: withServerLineIds(input.linesJson),
              status: 'draft',
              advancePaidPaise: 0,
              expectedDeliveryAt: input.expectedDeliveryAt
                ? new Date(input.expectedDeliveryAt)
                : null,
            })
            .returning();
          return row;
        });
      } catch (err) {
        if (!hasPgCode(err, '23505') || attempt === 2) throw err;
      }
    }

    return NextResponse.json({ data: po, message: 'Purchase order created' }, { status: 201 });
  } catch (err) {
    console.error('[purchase-orders POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
