import { and, eq } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { projects, leads } from '@/lib/db/schema';
import { whatsapp } from '@/lib/whatsapp/send';
import {
  scheduleHandoverComplete,
  scheduleHandoverNps,
} from '@/jobs/workflows/schedule';

/**
 * Handover → NPS referral sequence: mark the project complete a day after
 * handover, then ask the client for a score a week later.
 *
 * The client's contact details are resolved once at the start and carried in the
 * job payload, exactly as the original captured them before its first sleep.
 * `project/handover.cancelled` removes the pending stages by id — see
 * cancelHandoverSequence.
 */
export interface HandoverData {
  projectId: string;
  tenantId: string;
  contactPhone: string;
  contactName: string;
}

export const handoverReferralStart = defineJob(
  { id: 'handover-referral-start', name: 'Handover → Referral — start' },
  { event: 'project/handover.initiated' },
  async ({ event }) => {
    const { projectId, tenantId } = event.data as { projectId: string; tenantId: string };

    const [row] = await db
      .select({ contactPhone: leads.contactPhone, contactName: leads.contactName })
      .from(projects)
      .innerJoin(leads, eq(projects.leadId, leads.id))
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));

    if (!row) {
      throw new Error(`No project/lead found for projectId=${projectId} tenantId=${tenantId}`);
    }

    const data: HandoverData = {
      projectId,
      tenantId,
      contactPhone: row.contactPhone,
      contactName: row.contactName,
    };
    await scheduleHandoverComplete(data as unknown as Record<string, unknown>, projectId);
    return { scheduled: 'complete', projectId };
  },
);

export const handoverComplete = defineJob(
  { id: 'handover-complete', name: 'Handover → mark project complete' },
  { event: 'project/handover.complete' },
  async ({ event }) => {
    const data = event.data as HandoverData;

    await db
      .update(projects)
      .set({ lifecycleStage: 'complete' })
      .where(and(eq(projects.id, data.projectId), eq(projects.tenantId, data.tenantId)));

    await scheduleHandoverNps(data as unknown as Record<string, unknown>, data.projectId);
    return { marked: 'complete', projectId: data.projectId };
  },
);

export const handoverNps = defineJob(
  { id: 'handover-nps', name: 'Handover → NPS ping' },
  { event: 'project/handover.nps' },
  async ({ event }) => {
    const data = event.data as HandoverData;

    // Only ask a project that actually finished — a handover reverted during the
    // week-long wait should not produce an NPS request.
    const [project] = await db
      .select({ lifecycleStage: projects.lifecycleStage })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.tenantId, data.tenantId)));

    if (project?.lifecycleStage !== 'complete') {
      return { skipped: true, reason: 'project is no longer complete' };
    }

    await whatsapp.send({
      type: 'template',
      to: data.contactPhone,
      templateName: 'nps_ping',
      languageCode: 'en',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: data.contactName }] },
      ],
    });

    return { sent: true, to: data.contactPhone, sequence: 'complete' };
  },
);
