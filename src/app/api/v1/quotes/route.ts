import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { quotes, projects, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc, count } from 'drizzle-orm';

const CreateQuoteSchema = z.object({
  projectId: z.string().uuid().optional(),
  leadId:    z.string().uuid().optional(),
}).refine(d => d.projectId || d.leadId, {
  message: 'Either projectId or leadId is required',
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const leadId    = searchParams.get('leadId');

  try {
    const conditions = [eq(quotes.tenantId, ctx.tenantId)];
    if (projectId) conditions.push(eq(quotes.projectId, projectId));
    if (leadId)    conditions.push(eq(quotes.leadId, leadId));

    const rows = await db
      .select({
        id:               quotes.id,
        tenantId:         quotes.tenantId,
        projectId:        quotes.projectId,
        projectName:      projects.name,
        leadId:           quotes.leadId,
        leadContactName:  leads.contactName,
        version:          quotes.version,
        status:           quotes.status,
        subtotalPaise:    quotes.subtotalPaise,
        gstPaise:         quotes.gstPaise,
        totalPaise:       quotes.totalPaise,
        pdfUrl:           quotes.pdfUrl,
        sentAt:           quotes.sentAt,
        approvedAt:       quotes.approvedAt,
        createdBy:        quotes.createdBy,
        createdAt:        quotes.createdAt,
      })
      .from(quotes)
      .leftJoin(projects, eq(quotes.projectId, projects.id))
      .leftJoin(leads, eq(quotes.leadId, leads.id))
      .where(and(...conditions))
      .orderBy(desc(quotes.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[quotes GET]', err);
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

  const parsed = CreateQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    let nextVersion = 1;

    if (input.projectId) {
      // Verify project belongs to tenant
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.tenantId, ctx.tenantId)));

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const [{ total }] = await db
        .select({ total: count() })
        .from(quotes)
        .where(and(eq(quotes.projectId, input.projectId), eq(quotes.tenantId, ctx.tenantId)));

      nextVersion = (total ?? 0) + 1;
    } else if (input.leadId) {
      // Verify lead belongs to tenant
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, ctx.tenantId)));

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      const [{ total }] = await db
        .select({ total: count() })
        .from(quotes)
        .where(and(eq(quotes.leadId, input.leadId), eq(quotes.tenantId, ctx.tenantId)));

      nextVersion = (total ?? 0) + 1;
    }

    const [quote] = await db
      .insert(quotes)
      .values({
        tenantId:  ctx.tenantId,
        projectId: input.projectId ?? null,
        leadId:    input.leadId ?? null,
        version:   nextVersion,
        status:    'draft',
        createdBy: ctx.dbUserId,
      })
      .returning();

    return NextResponse.json({ data: quote, message: 'Quote draft created' }, { status: 201 });
  } catch (err) {
    console.error('[quotes POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
