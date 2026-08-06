import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clientTokens, projects, milestones, deliverables, siteLogs, snagItems } from '@/lib/db/schema';
import { eq, and, desc, asc, inArray, isNull, gt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { ClientProjectSnapshot } from '@/types/snag';
import { checkRateLimit, clientPortalLimiter } from '@/lib/ratelimit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const rateLimitResponse = await checkRateLimit(clientPortalLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  const { token } = await params;

  // Validate token format — must be a 64-char hex string.
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  try {
    // Look up the token — must exist, be unexpired and unrevoked. Expiry is
    // compared with the database's now(), not the app server's clock.
    const [tokenRow] = await db
      .select({
        projectId: clientTokens.projectId,
        tenantId: clientTokens.tenantId,
        expiresAt: clientTokens.expiresAt,
        revokedAt: clientTokens.revokedAt,
      })
      .from(clientTokens)
      .where(
        and(
          eq(clientTokens.token, token),
          isNull(clientTokens.revokedAt),
          gt(clientTokens.expiresAt, sql`now()`),
        ),
      )
      .limit(1);

    if (!tokenRow) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });
    }

    const { projectId, tenantId } = tokenRow;

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        lifecycleStage: projects.lifecycleStage,
        expectedEndAt: projects.expectedEndAt,
        tenantId: projects.tenantId,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });
    }

    const [milestonesData, deliverablesData, siteLogsData, snagItemsData] = await Promise.all([
      db
        .select({
          id: milestones.id,
          projectId: milestones.projectId,
          label: milestones.label,
          pctOfTotal: milestones.pctOfTotal,
          amountPaise: milestones.amountPaise,
          paymentStatus: milestones.paymentStatus,
          paidAt: milestones.paidAt,
          createdAt: milestones.createdAt,
        })
        .from(milestones)
        .where(eq(milestones.projectId, projectId))
        .orderBy(asc(milestones.createdAt)),

      db
        .select({
          id: deliverables.id,
          projectId: deliverables.projectId,
          type: deliverables.type,
          status: deliverables.status,
          latestFileUrl: deliverables.latestFileUrl,
          approvedAt: deliverables.approvedAt,
          createdAt: deliverables.createdAt,
        })
        .from(deliverables)
        .where(and(eq(deliverables.projectId, projectId), eq(deliverables.status, 'approved'))),

      db
        .select({
          id: siteLogs.id,
          projectId: siteLogs.projectId,
          logDate: siteLogs.logDate,
          photos: siteLogs.photos,
          progressPct: siteLogs.progressPct,
          createdAt: siteLogs.createdAt,
        })
        .from(siteLogs)
        .where(eq(siteLogs.projectId, projectId))
        .orderBy(desc(siteLogs.logDate))
        .limit(5),

      db
        .select({
          id: snagItems.id,
          projectId: snagItems.projectId,
          description: snagItems.description,
          photoUrl: snagItems.photoUrl,
          assigneeId: snagItems.assigneeId,
          status: snagItems.status,
          clientConfirmedAt: snagItems.clientConfirmedAt,
          waMessageId: snagItems.waMessageId,
          createdAt: snagItems.createdAt,
        })
        .from(snagItems)
        .where(
          and(
            eq(snagItems.projectId, projectId),
            inArray(snagItems.status, ['resolved', 'client_confirmed']),
          ),
        ),
    ]);

    const snapshot: ClientProjectSnapshot = {
      project: {
        name: project.name,
        lifecycleStage: project.lifecycleStage,
        expectedEndAt: project.expectedEndAt ? project.expectedEndAt.toISOString() : null,
      },
      milestones: milestonesData.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        label: m.label,
        pctOfTotal: m.pctOfTotal,
        amountPaise: m.amountPaise,
        paymentStatus: m.paymentStatus,
        paidAt: m.paidAt ? m.paidAt.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
      })),
      deliverables: deliverablesData.map((d) => ({
        id: d.id,
        projectId: d.projectId,
        type: d.type,
        status: 'approved' as const,
        latestFileUrl: d.latestFileUrl ?? null,
        approvedAt: d.approvedAt ? d.approvedAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
      })),
      recentSiteLogs: siteLogsData.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        logDate: s.logDate,
        photos: s.photos,
        progressPct: s.progressPct ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      snagItems: snagItemsData.map((sn) => ({
        id: sn.id,
        projectId: sn.projectId,
        description: sn.description,
        photoUrl: sn.photoUrl ?? null,
        assigneeId: sn.assigneeId ?? null,
        status: sn.status,
        clientConfirmedAt: sn.clientConfirmedAt ? sn.clientConfirmedAt.toISOString() : null,
        waMessageId: sn.waMessageId ?? null,
        createdAt: sn.createdAt.toISOString(),
      })),
    };

    return NextResponse.json({ data: snapshot });
  } catch (err) {
    console.error('[client-view/:token GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
