import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { grns, purchaseOrders, users } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, sum, sql, isNotNull, like } from 'drizzle-orm';
import type { POLine } from '@/types/purchase-orders';
import { nextDocNumber, pendingQty, receiptStatus, roundQty } from '@/lib/procurement/receipts';

const CreateGRNSchema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        lineId:      z.string().uuid(),
        // Decimals allowed: PO lines can be fractional (e.g. 12.5 sqft). Stored as numeric(12,3).
        receivedQty: z.number().positive().max(999_999_999),
      }),
    )
    .min(1, 'At least one line is required'),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [po] = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    const rows = await db
      .select({
        id:             grns.id,
        tenantId:       grns.tenantId,
        poId:           grns.poId,
        lineId:         grns.lineId,
        deliveredQty:   grns.deliveredQty,
        photoProof:     grns.photoProof,
        receivedAt:     grns.receivedAt,
        notes:          grns.notes,
        createdAt:      grns.createdAt,
        grnNumber:      grns.grnNumber,
        deliveryDate:   grns.deliveryDate,
        receivedBy:     grns.receivedBy,
        status:         grns.status,
        receivedByName: users.fullName,
      })
      .from(grns)
      .leftJoin(users, eq(grns.receivedBy, users.id))
      .where(and(eq(grns.poId, id), eq(grns.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[purchase-orders/:id/grn GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.PROCUREMENT);
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateGRNSchema.safeParse(body);
  if (!parsed.success) {
    // A readable message: the screen shows `error` verbatim.
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid goods receipt' }, { status: 422 });
  }

  const input = parsed.data;

  try {
    // 1. Verify PO belongs to tenant
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));

    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });

    if (po.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot record GRN against a cancelled PO.' }, { status: 409 });
    }
    if (po.status === 'complete') {
      return NextResponse.json({ error: 'PO is already fully received.' }, { status: 409 });
    }

    // 2. Build line lookup
    const linesJson = Array.isArray(po.linesJson) ? (po.linesJson as POLine[]) : [];
    const linesMap = new Map<string, POLine>(linesJson.map(l => [l.id, l]));

    for (const { lineId } of input.lines) {
      if (!linesMap.has(lineId)) {
        return NextResponse.json({ error: `Line ID ${lineId} not found in this PO.` }, { status: 422 });
      }
    }

    // 3. Over-receipt check — sum active GRNs per lineId server-side
    const deliveredRows = await db
      .select({ lineId: grns.lineId, total: sum(grns.deliveredQty) })
      .from(grns)
      .where(and(
        eq(grns.poId, id),
        eq(grns.tenantId, ctx.tenantId),
        eq(grns.status, 'active'),
        isNotNull(grns.lineId),
      ))
      .groupBy(grns.lineId);

    const alreadyReceived: Record<string, number> = {};
    for (const row of deliveredRows) {
      if (row.lineId) alreadyReceived[row.lineId] = Number(row.total ?? 0);
    }

    for (const { lineId, receivedQty } of input.lines) {
      const line = linesMap.get(lineId)!;
      const already = alreadyReceived[lineId] ?? 0;
      const pending = pendingQty(Number(line.qty) || 0, already);
      if (roundQty(receivedQty) > pending) {
        return NextResponse.json({
          error: `"${line.description}": cannot receive ${receivedQty} ${line.unit}. Only ${pending} pending.`,
        }, { status: 422 });
      }
    }

    // 4 + 5. Number the GRN, insert rows and recalculate PO status atomically.
    // One GRN spans several rows (one per line) sharing a number, so a unique
    // index can't guard it; a per-tenant transaction lock serialises numbering.
    const year = new Date().getFullYear();
    let grnNumber = '';
    const insertedRows = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`grn-number:${ctx.tenantId}`}))`);
      const existing = await tx
        .selectDistinct({ n: grns.grnNumber })
        .from(grns)
        .where(and(eq(grns.tenantId, ctx.tenantId), like(grns.grnNumber, `GRN-${year}-%`)));
      grnNumber = nextDocNumber('GRN', year, existing.map((r) => r.n));

      const rows = await tx
        .insert(grns)
        .values(
          input.lines.map(({ lineId, receivedQty }) => ({
            tenantId:     ctx.tenantId,
            poId:         id,
            lineId,
            deliveredQty: roundQty(receivedQty),
            photoProof:   [] as string[],
            notes:        input.notes ?? null,
            grnNumber,
            deliveryDate: input.deliveryDate,
            receivedBy:   ctx.dbUserId ?? null,
            status:       'active',
          })),
        )
        .returning();

      // Per-line status recalculation. A delivery against a draft PO (goods
      // arrived before the PO was formally sent) still moves it to partial/complete.
      if (po.status !== 'cancelled') {
        const refreshed = await tx
          .select({ lineId: grns.lineId, total: sum(grns.deliveredQty) })
          .from(grns)
          .where(and(
            eq(grns.poId, id),
            eq(grns.tenantId, ctx.tenantId),
            eq(grns.status, 'active'),
            isNotNull(grns.lineId),
          ))
          .groupBy(grns.lineId);

        const receivedPerLine: Record<string, number> = {};
        for (const r of refreshed) {
          if (r.lineId) receivedPerLine[r.lineId] = Number(r.total ?? 0);
        }

        const newStatus = receiptStatus(
          linesJson.map(l => ({ id: l.id, qty: Number(l.qty) || 0 })),
          receivedPerLine,
        );

        if (newStatus && newStatus !== po.status) {
          await tx
            .update(purchaseOrders)
            .set({ status: newStatus })
            .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, ctx.tenantId)));
        }
      }

      return rows;
    });

    return NextResponse.json(
      { data: { grnNumber, rows: insertedRows }, message: `GRN ${grnNumber} recorded` },
      { status: 201 },
    );
  } catch (err) {
    console.error('[purchase-orders/:id/grn POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
