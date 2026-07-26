import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { projects, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';

const CreateProjectSchema = z.object({
  leadId: z.string().uuid(),
  name: z.string().min(1),
  designerIds: z.array(z.string().uuid()).default([]),
  totalContractPaise: z.number().int().nonnegative().optional(),
});

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.tenantId, ctx.tenantId))
      .orderBy(desc(projects.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[projects GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    // Verify lead belongs to tenant
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, ctx.tenantId)));

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const [project] = await db
      .insert(projects)
      .values({
        tenantId: ctx.tenantId,
        leadId: input.leadId,
        name: input.name,
        designerIds: input.designerIds,
        totalContractPaise: input.totalContractPaise ?? null,
      })
      .returning();

    // Mark lead as won
    await db
      .update(leads)
      .set({ stage: 'won', lastActivityAt: new Date() })
      .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: project, message: 'Project created' }, { status: 201 });
  } catch (err) {
    console.error('[projects POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
