import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, notifications, aiActions, leads, tasks } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';
import { whatsapp } from '@/lib/whatsapp/send';

// POST /api/v1/ai/action
// Executes a confirmed AI-proposed action. Re-checks permission server-side.
// Logs every execution to ai_actions for traceability.

const BodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('notify_employee'),
    targetUserId: z.string().uuid(),
    message: z.string().min(1).max(2000),
    notificationTitle: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal('create_task'),
    taskTitle: z.string().min(1).max(500),
    assignToId: z.string().uuid().optional(),
    dueAt: z.string().datetime({ offset: true }).optional(),
    notes: z.string().max(2000).optional(),
  }),
  z.object({
    type: z.literal('set_followup'),
    leadId: z.string().uuid(),
    followUpDate: z.string().datetime({ offset: true }),
  }),
]);

export async function POST(request: NextRequest) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  try {
    if (body.type === 'notify_employee') {
      // Re-validate: target user must belong to this tenant
      const [target] = await db
        .select({ id: users.id, fullName: users.fullName, phone: users.phone })
        .from(users)
        .where(and(eq(users.id, body.targetUserId), eq(users.tenantId, ctx.tenantId)))
        .limit(1);

      if (!target) {
        return NextResponse.json({ error: 'Employee not found in this organisation' }, { status: 404 });
      }

      // 1. In-app notification (guaranteed delivery)
      const [notifRow] = await db
        .insert(notifications)
        .values({
          tenantId: ctx.tenantId,
          userId: target.id,
          severity: 'info',
          title: body.notificationTitle,
          body: body.message,
        })
        .returning({ id: notifications.id });

      // 2. WhatsApp message (best-effort — works within 24h service window)
      let waStatus = 'not_sent';
      if (target.phone) {
        try {
          await whatsapp.send({
            type: 'text',
            to: target.phone,
            text: `[Konst Design CRM] ${body.notificationTitle}\n\n${body.message}\n\n— Sent by ${ctx.fullName}`,
          });
          waStatus = 'sent';
        } catch (waErr) {
          // WhatsApp failure is non-blocking; in-app notification is already created
          console.error('[ai/action] WhatsApp send failed', waErr);
          waStatus = 'failed';
        }
      }

      // 3. Audit log
      const [auditRow] = await db
        .insert(aiActions)
        .values({
          tenantId: ctx.tenantId,
          requestedBy: ctx.userId,
          actionType: 'notify_employee',
          targetUserId: target.id,
          payloadJson: {
            notificationId: notifRow.id,
            title: body.notificationTitle,
            message: body.message,
            waStatus,
          },
          result: 'success',
        })
        .returning({ id: aiActions.id });

      return NextResponse.json({
        data: {
          auditId: auditRow.id,
          notificationId: notifRow.id,
          whatsappStatus: waStatus,
          targetName: target.fullName,
        },
      }, { status: 201 });
    }

    if (body.type === 'create_task') {
      // Validate assignee if provided
      if (body.assignToId) {
        const [assignee] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, body.assignToId), eq(users.tenantId, ctx.tenantId)))
          .limit(1);
        if (!assignee) {
          return NextResponse.json({ error: 'Assignee not found in this organisation' }, { status: 404 });
        }
      }

      const [taskRow] = await db
        .insert(tasks)
        .values({
          tenantId: ctx.tenantId,
          title: body.taskTitle,
          status: 'pending',
          assignedTo: body.assignToId ?? null,
          createdBy: ctx.userId,
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          notes: body.notes ?? null,
        })
        .returning({ id: tasks.id });

      const [auditRow] = await db
        .insert(aiActions)
        .values({
          tenantId: ctx.tenantId,
          requestedBy: ctx.userId,
          actionType: 'create_task',
          targetUserId: body.assignToId ?? null,
          payloadJson: { taskId: taskRow.id, title: body.taskTitle },
          result: 'success',
        })
        .returning({ id: aiActions.id });

      return NextResponse.json({
        data: { auditId: auditRow.id, taskId: taskRow.id },
      }, { status: 201 });
    }

    if (body.type === 'set_followup') {
      // Validate lead belongs to tenant
      const [lead] = await db
        .select({ id: leads.id, contactName: leads.contactName, ownerId: leads.ownerId })
        .from(leads)
        .where(and(eq(leads.id, body.leadId), eq(leads.tenantId, ctx.tenantId)))
        .limit(1);

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      // Designers can only update their own leads
      if (ctx.role === 'designer' && lead.ownerId !== ctx.userId) {
        return NextResponse.json({ error: 'Forbidden: not your lead' }, { status: 403 });
      }

      await db
        .update(leads)
        .set({ followUpDate: new Date(body.followUpDate) })
        .where(eq(leads.id, body.leadId));

      const [auditRow] = await db
        .insert(aiActions)
        .values({
          tenantId: ctx.tenantId,
          requestedBy: ctx.userId,
          actionType: 'set_followup',
          payloadJson: { leadId: body.leadId, contactName: lead.contactName, followUpDate: body.followUpDate },
          result: 'success',
        })
        .returning({ id: aiActions.id });

      return NextResponse.json({
        data: { auditId: auditRow.id, leadId: body.leadId, contactName: lead.contactName },
      }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action type' }, { status: 400 });
  } catch (err) {
    console.error('[ai/action]', err);
    // Log the failure too
    await db.insert(aiActions).values({
      tenantId: ctx.tenantId,
      requestedBy: ctx.userId,
      actionType: body.type,
      payloadJson: body as Record<string, unknown>,
      result: err instanceof Error ? err.message : 'unknown error',
    }).catch(() => { /* best-effort audit */ });
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
