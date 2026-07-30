import { NextRequest, NextResponse } from 'next/server';
import { and, between, eq, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { siteVisits, leadActivities, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const QuerySchema = z.object({
  from: z.string().datetime(),
  to:   z.string().datetime(),
});

export type CalendarEventSource = 'site_visit' | 'lead_activity' | 'lead_followup';

export interface CalendarEvent {
  id: string;
  source: CalendarEventSource;
  title: string;
  subtitle: string | null;
  start: string;         // ISO
  end: string | null;    // ISO
  href: string;
  color: 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'slate';
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = QuerySchema.safeParse({
    from: request.nextUrl.searchParams.get('from'),
    to:   request.nextUrl.searchParams.get('to'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'from/to must be ISO datetimes' }, { status: 400 });
  }
  const from = new Date(parsed.data.from);
  const to   = new Date(parsed.data.to);

  try {
    const siteVisitRows = await db
      .select({
        id: siteVisits.id,
        scheduledAt: siteVisits.scheduledAt,
        completedAt: siteVisits.completedAt,
        notes: siteVisits.notes,
        leadId: siteVisits.leadId,
        leadName: leads.contactName,
      })
      .from(siteVisits)
      .leftJoin(leads, eq(siteVisits.leadId, leads.id))
      .where(and(
        eq(siteVisits.tenantId, ctx.tenantId),
        between(siteVisits.scheduledAt, from, to),
      ));

    const activityRows = await db
      .select({
        id: leadActivities.id,
        scheduledAt: leadActivities.scheduledAt,
        completedAt: leadActivities.completedAt,
        title: leadActivities.title,
        type: leadActivities.type,
        leadId: leadActivities.leadId,
        leadName: leads.contactName,
      })
      .from(leadActivities)
      .leftJoin(leads, eq(leadActivities.leadId, leads.id))
      .where(and(
        eq(leadActivities.tenantId, ctx.tenantId),
        isNotNull(leadActivities.scheduledAt),
        between(leadActivities.scheduledAt, from, to),
      ));

    const events: CalendarEvent[] = [];

    for (const v of siteVisitRows) {
      events.push({
        id: `sv_${v.id}`,
        source: 'site_visit',
        title: v.leadName ? `Site visit · ${v.leadName}` : 'Site visit',
        subtitle: v.notes ?? null,
        start: v.scheduledAt.toISOString(),
        end: v.completedAt ? v.completedAt.toISOString() : null,
        href: `/site-visits`,
        color: v.completedAt ? 'slate' : 'blue',
      });
    }

    const typeColor: Record<string, CalendarEvent['color']> = {
      call: 'green',
      whatsapp: 'green',
      meeting: 'violet',
      site_visit: 'blue',
      follow_up: 'amber',
      note: 'slate',
      stage_change: 'slate',
    };

    for (const a of activityRows) {
      if (!a.scheduledAt) continue;
      // follow_up activities are superseded by leads.followUpDate (canonical, mutable source).
      // Keeping them would create phantom events when the date is rescheduled or cleared.
      if (a.type === 'follow_up') continue;
      events.push({
        id: `la_${a.id}`,
        source: 'lead_activity',
        title: a.title,
        subtitle: a.leadName ? `Lead · ${a.leadName}` : null,
        start: a.scheduledAt.toISOString(),
        end: a.completedAt ? a.completedAt.toISOString() : null,
        href: a.leadId ? `/leads/${a.leadId}` : '/leads',
        color: typeColor[a.type] ?? 'slate',
      });
    }

    // Lead follow-ups: drive from leads.followUpDate (single mutable source of truth).
    // Archived leads are excluded; won/lost leads are included (follow-up may still be relevant).
    const fuRows = await db
      .select({
        id: leads.id,
        followUpDate: leads.followUpDate,
        contactName: leads.contactName,
        stage: leads.stage,
      })
      .from(leads)
      .where(and(
        eq(leads.tenantId, ctx.tenantId),
        isNotNull(leads.followUpDate),
        between(leads.followUpDate, from, to),
        isNull(leads.archivedAt),
      ));

    const now = new Date();
    for (const fu of fuRows) {
      if (!fu.followUpDate) continue;
      const d = fu.followUpDate;
      // Anchor at 9:00 AM UTC so the event lands in a readable week-view slot.
      const start = new Date(Date.UTC(
        d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 9, 0, 0, 0,
      )).toISOString();
      const stageLabel = fu.stage.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const color: CalendarEvent['color'] = d < now ? 'rose' : 'amber';
      events.push({
        id: `fu_${fu.id}`,
        source: 'lead_followup',
        title: `Follow-up · ${fu.contactName}`,
        subtitle: stageLabel,
        start,
        end: null,
        href: `/leads/${fu.id}`,
        color,
      });
    }

    events.sort((x, y) => x.start.localeCompare(y.start));
    return NextResponse.json({ data: events });
  } catch (e) {
    console.error('[GET /api/v1/calendar/events]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
