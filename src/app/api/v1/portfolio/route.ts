import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { portfolios, projects, customers } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

const CreateSchema = z.object({
  projectId:    z.string().uuid(),
  title:        z.string().max(200).optional(),
  coverPhotoUrl: z.string().url().optional(),
  photos:       z.array(z.string().url()).optional(),
  isPublic:     z.boolean().optional(),
  clientConsent: z.boolean().optional(),
});

// GET /api/v1/portfolio — list portfolio entries for tenant
export async function GET(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const publicOnly = request.nextUrl.searchParams.get('public') === '1';
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10), 200);

  const filters = [eq(portfolios.tenantId, ctx.tenantId)];
  if (publicOnly) {
    // unauthenticated-safe: only public + consented entries
    filters.push(eq(portfolios.isPublic, true));
    filters.push(eq(portfolios.clientConsent, true));
  }

  const rows = await db
    .select({
      id:            portfolios.id,
      title:         portfolios.title,
      coverPhotoUrl: portfolios.coverPhotoUrl,
      photos:        portfolios.photos,
      isPublic:      portfolios.isPublic,
      clientConsent: portfolios.clientConsent,
      aiCuratedJson: portfolios.aiCuratedJson,
      createdAt:     portfolios.createdAt,
      projectId:     portfolios.projectId,
      projectName:   projects.name,
      customerName:  customers.fullName,
    })
    .from(portfolios)
    .leftJoin(projects,  eq(portfolios.projectId, projects.id))
    .leftJoin(customers, eq(projects.customerId,  customers.id))
    .where(and(...filters))
    .orderBy(desc(portfolios.createdAt))
    .limit(limit);

  return NextResponse.json({ data: rows });
}

// POST /api/v1/portfolio — create entry (admin only)
export async function POST(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { projectId, title, coverPhotoUrl, photos, isPublic, clientConsent } = parsed.data;

  const [row] = await db.insert(portfolios).values({
    tenantId:      ctx.tenantId,
    projectId,
    title:         title         ?? '',
    coverPhotoUrl: coverPhotoUrl ?? null,
    photos:        photos        ?? [],
    isPublic:      isPublic      ?? false,
    clientConsent: clientConsent ?? false,
  }).returning();

  return NextResponse.json({ data: row }, { status: 201 });
}
