import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { quotes, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── GET /api/v1/leads/[id]/quotes ───────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const rows = await db
      .select({
        id:            quotes.id,
        tenantId:      quotes.tenantId,
        projectId:     quotes.projectId,
        leadId:        quotes.leadId,
        version:       quotes.version,
        status:        quotes.status,
        subtotalPaise: quotes.subtotalPaise,
        gstPaise:      quotes.gstPaise,
        totalPaise:    quotes.totalPaise,
        pdfUrl:        quotes.pdfUrl,
        sentAt:        quotes.sentAt,
        approvedAt:    quotes.approvedAt,
        createdBy:     quotes.createdBy,
        createdAt:     quotes.createdAt,
      })
      .from(quotes)
      .where(and(eq(quotes.leadId, id), eq(quotes.tenantId, ctx.tenantId)))
      .orderBy(desc(quotes.createdAt));

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/leads/[id]/quotes]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/v1/leads/[id]/quotes ──────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    // Verify lead belongs to tenant
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // Version = existing lead quotes + 1
    const [{ total }] = await db
      .select({ total: count() })
      .from(quotes)
      .where(and(eq(quotes.leadId, id), eq(quotes.tenantId, ctx.tenantId)));

    const [quote] = await db
      .insert(quotes)
      .values({
        tenantId:  ctx.tenantId,
        leadId:    id,
        projectId: null,
        version:   (total ?? 0) + 1,
        status:    'draft',
        createdBy: ctx.dbUserId,
      })
      .returning({
        id:            quotes.id,
        tenantId:      quotes.tenantId,
        projectId:     quotes.projectId,
        leadId:        quotes.leadId,
        version:       quotes.version,
        status:        quotes.status,
        subtotalPaise: quotes.subtotalPaise,
        gstPaise:      quotes.gstPaise,
        totalPaise:    quotes.totalPaise,
        createdAt:     quotes.createdAt,
      });

    return NextResponse.json({ data: quote, message: 'Quote draft created' }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/leads/[id]/quotes]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
