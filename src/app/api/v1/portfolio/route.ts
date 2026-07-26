import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { portfolios } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/portfolio
// - Authenticated: returns ALL portfolios for the tenant (public and private)
// - Unauthenticated: requires ?tenantId= and returns only isPublic+clientConsent portfolios
export async function GET(request: NextRequest) {
  try {
    // Check for an auth session first
    const ctx = await getAuthContext();

    if (ctx) {
      // Authed branch — return all portfolios for this tenant (no public/consent filter)
      const rows = await db
        .select({
          id: portfolios.id,
          projectId: portfolios.projectId,
          title: portfolios.title,
          coverPhotoUrl: portfolios.coverPhotoUrl,
          isPublic: portfolios.isPublic,
          clientConsent: portfolios.clientConsent,
          photosCount: sql<number>`array_length(${portfolios.photos}, 1)`,
          createdAt: portfolios.createdAt,
        })
        .from(portfolios)
        .where(eq(portfolios.tenantId, ctx.tenantId));

      const data = rows.map((r) => ({ ...r, photosCount: r.photosCount ?? 0 }));
      return NextResponse.json({ data });
    }

    // Public (unauthenticated) branch — requires ?tenantId= query param
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 },
      );
    }

    const rows = await db
      .select({
        id: portfolios.id,
        projectId: portfolios.projectId,
        title: portfolios.title,
        coverPhotoUrl: portfolios.coverPhotoUrl,
        isPublic: portfolios.isPublic,
        clientConsent: portfolios.clientConsent,
        photosCount: sql<number>`array_length(${portfolios.photos}, 1)`,
        createdAt: portfolios.createdAt,
      })
      .from(portfolios)
      .where(
        and(
          eq(portfolios.tenantId, tenantId),
          eq(portfolios.isPublic, true),
          eq(portfolios.clientConsent, true),
        ),
      );

    const data = rows.map((r) => ({ ...r, photosCount: r.photosCount ?? 0 }));
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[portfolio GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
