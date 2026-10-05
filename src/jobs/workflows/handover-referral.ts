import { and, eq } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { projects, leads, customers } from '@/lib/db/schema';
import { stageGateError } from '@/lib/projects/stage-gates';
import { applyStageMoneyEffects } from '@/lib/project-money/server';
import { whatsapp } from '@/lib/whatsapp/send';
import {
  scheduleHandoverComplete,
  scheduleHandoverNps,
  cancelHandoverSequence,
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
  /** Null when the project has no lead/customer phone — the NPS ping is skipped. */
  contactPhone: string | null;
  contactName: string;
}

export const handoverReferralStart = defineJob(
  { id: 'handover-referral-start', name: 'Handover → Referral — start' },
  { event: 'project/handover.initiated' },
  async ({ event }) => {
    const { projectId, tenantId } = event.data as { projectId: string; tenantId: string };

    // Projects without a lead (standalone or imported) are valid — fall back to
    // the customer record, and to no phone at all, rather than failing/retrying.
    const [row] = await db
      .select({
        stage: projects.lifecycleStage,
        leadPhone: leads.contactPhone, leadName: leads.contactName,
        customerPhone: customers.phone, customerName: customers.fullName,
      })
      .from(projects)
      .leftJoin(leads, and(eq(projects.leadId, leads.id), eq(leads.tenantId, tenantId)))
      .leftJoin(customers, and(eq(projects.customerId, customers.id), eq(customers.tenantId, tenantId)))
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));

    if (!row) return { skipped: true, reason: 'project not found' };
    if (row.stage !== 'handover') return { skipped: true, reason: `project is in ${row.stage}, not handover` };

    const data: HandoverData = {
      projectId,
      tenantId,
      contactPhone: row.leadPhone ?? row.customerPhone ?? null,
      contactName: row.leadName ?? row.customerName ?? 'there',
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

    const [project] = await db
      .select({ stage: projects.lifecycleStage })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.tenantId, data.tenantId)));

    // Completed by hand during the wait — still send the NPS ping a week later.
    if (project?.stage === 'complete') {
      await scheduleHandoverNps(data as unknown as Record<string, unknown>, data.projectId);
      return { marked: 'already complete', projectId: data.projectId };
    }
    // The project was moved back out of handover during the wait.
    if (project?.stage !== 'handover') {
      await cancelHandoverSequence(data.projectId);
      return { skipped: true, reason: `project is ${project?.stage ?? 'missing'}, not handover` };
    }

    // Same gate as a manual move: nothing may be outstanding at completion.
    const gateError = await stageGateError(data.tenantId, data.projectId, 'handover', 'complete');
    if (gateError) return { skipped: true, reason: gateError };

    // Only move a project that is still in handover (guards a concurrent stage change).
    const moved = await db
      .update(projects)
      .set({ lifecycleStage: 'complete' })
      .where(and(
        eq(projects.id, data.projectId),
        eq(projects.tenantId, data.tenantId),
        eq(projects.lifecycleStage, 'handover'),
      ))
      .returning({ id: projects.id });
    if (moved.length === 0) return { skipped: true, reason: 'project left handover' };
    await applyStageMoneyEffects(db, data.tenantId, data.projectId, 'complete');

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
    if (!data.contactPhone) return { skipped: true, reason: 'no client phone' };

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
