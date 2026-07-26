import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { portfolios } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq } from 'drizzle-orm';

const PatchPortfolioSchema = z.object({
  isPublic: z.boolean().optional(),
  clientConsent: z.boolean().optional(),
  title: z.string().optional(),
  photos: z.array(z.string()).optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.id, id));

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    if (portfolio.isPublic) {
      // Public portfolio — no auth needed
      return NextResponse.json({ data: portfolio });
    }

    // Private portfolio — require auth and verify tenant
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (ctx.tenantId !== portfolio.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: portfolio });
  } catch (err) {
    console.error('[portfolio/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchPortfolioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    // Fetch portfolio and verify tenant ownership
    const [existing] = await db
      .select({ id: portfolios.id, tenantId: portfolios.tenantId })
      .from(portfolios)
      .where(eq(portfolios.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    if (existing.tenantId !== ctx.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [updated] = await db
      .update(portfolios)
      .set(input)
      .where(eq(portfolios.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[portfolio/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
