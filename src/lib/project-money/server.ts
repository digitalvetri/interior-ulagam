import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  customers, expenses, invoices, ledgerAdjustments, leads, milestones, paymentAllocations, payments,
  projectAdditions, projects, purchaseOrders, quotes, staffDayLogs, vendorPayments,
} from '@/lib/db/schema';
import {
  allocateOldestFirst, costBreakdown, durationView, gstOf, ledgerWithBalance, milestoneState, profitView,
  revisedContract, stageReached, STAGE_ORDER, type LedgerEntry, type MilestoneView, type ProjectStage,
} from './calc';

// Loads the numbers the calc rules need and returns ready-to-render views.
// Every query is tenant-scoped. Profit is computed here but callers strip it
// for anyone who is not the owner.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/** How far along each stage is — shown next to time used and money collected. */
const STAGE_PROGRESS: Record<ProjectStage, number> = {
  design_pending: 10, design_in_progress: 30, design_approved: 45,
  procurement: 55, execution: 70, snagging: 85, handover: 95, complete: 100,
};

const SETTLED = sql`${payments.status} <> 'pending'`;

export function todayIso(): string {
  // India time — the office's "today", whatever the server's zone is.
  return new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

function iso(d: Date | string | null): string | null {
  if (!d) return null;
  return typeof d === 'string' ? d.slice(0, 10) : new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

function poTotalPaise(linesJson: unknown): number {
  if (!Array.isArray(linesJson)) return 0;
  return (linesJson as Record<string, unknown>[]).reduce((sum, l) => {
    if (typeof l.totalPaise === 'number') return sum + l.totalPaise;
    const qty = typeof l.qty === 'number' ? l.qty : 0;
    const rate = typeof l.unitRatePaise === 'number' ? l.unitRatePaise : 0;
    return sum + qty * rate;
  }, 0);
}

/* ── Milestones with what has been paid against them ────────────────────────── */

export interface MilestoneRow extends MilestoneView {
  id: string;
  label: string;
  pctOfTotal: number;
  triggerStage: ProjectStage | null;
  dueOn: string | null;
  sortOrder: number;
  razorpayLinkId: string | null;
  locked: boolean;
}

async function loadMilestones(
  tx: Db, tenantId: string,
  project: { id: string; stage: ProjectStage; gstPct: number }, revisedPaise: number, today: string,
): Promise<MilestoneRow[]> {
  const rows = await tx.select({
    id: milestones.id, label: milestones.label, pctOfTotal: milestones.pctOfTotal, amountPaise: milestones.amountPaise,
    triggerStage: milestones.triggerStage, dueOn: milestones.dueOn, dueSince: milestones.dueSince,
    paymentStatus: milestones.paymentStatus, sortOrder: milestones.sortOrder, razorpayLinkId: milestones.razorpayLinkId,
    createdAt: milestones.createdAt,
    receivedPaise: sql<number>`coalesce((select sum(a.amount_paise) from payment_allocations a where a.milestone_id = "milestones"."id"), 0)::bigint`,
  }).from(milestones)
    .where(and(eq(milestones.tenantId, tenantId), eq(milestones.projectId, project.id)))
    .orderBy(asc(milestones.sortOrder), asc(milestones.createdAt));

  return rows.map(r => {
    const view = milestoneState({
      pctOfTotal: r.pctOfTotal, amountPaise: Number(r.amountPaise), triggerStage: r.triggerStage,
      dueOn: r.dueOn, dueSince: r.dueSince, paymentStatus: r.paymentStatus, receivedPaise: Number(r.receivedPaise),
    }, project, revisedPaise, today);
    return {
      ...view, id: r.id, label: r.label, pctOfTotal: r.pctOfTotal, triggerStage: r.triggerStage, dueOn: r.dueOn,
      sortOrder: r.sortOrder, razorpayLinkId: r.razorpayLinkId,
      locked: view.status === 'paid' || Number(r.receivedPaise) > 0,
    };
  });
}

/* ── One project ────────────────────────────────────────────────────────────── */

export async function loadProjectMoney(tenantId: string, projectId: string, today = todayIso()) {
  const [p] = await db.select({
    id: projects.id, name: projects.name, stage: projects.lifecycleStage, customerId: projects.customerId,
    contractPaise: projects.totalContractPaise, gstPct: projects.gstPct, startedAt: projects.startedAt,
    expectedEndAt: projects.expectedEndAt, handoverAt: projects.handoverAt,
  }).from(projects).where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId))).limit(1);
  if (!p) return null;

  const additions = (await db.select({
    id: projectAdditions.id, description: projectAdditions.description,
    amountPaise: projectAdditions.amountPaise, addedOn: projectAdditions.addedOn,
  }).from(projectAdditions)
    .where(and(eq(projectAdditions.tenantId, tenantId), eq(projectAdditions.projectId, projectId)))
    .orderBy(asc(projectAdditions.addedOn), asc(projectAdditions.createdAt)))
    .map(a => ({ ...a, amountPaise: Number(a.amountPaise) }));

  const contractPaise = p.contractPaise === null ? null : Number(p.contractPaise);
  const revisedPaise = revisedContract(contractPaise, additions);
  const ms = await loadMilestones(db, tenantId, { id: p.id, stage: p.stage, gstPct: p.gstPct }, revisedPaise, today);

  const [exp, staff, pos, received, paidOutVendors, quote] = await Promise.all([
    db.select({
      category: expenses.category, amountPaise: expenses.amountPaise, gstAmountPaise: expenses.gstAmountPaise,
      poId: expenses.poId, voidedAt: expenses.voidedAt,
    }).from(expenses).where(and(eq(expenses.tenantId, tenantId), eq(expenses.projectId, projectId))),
    db.select({ cost: sql<number>`coalesce(sum(${staffDayLogs.costPaise}), 0)::bigint`, days: sql<string>`coalesce(sum(${staffDayLogs.days}), 0)` })
      .from(staffDayLogs).where(and(eq(staffDayLogs.tenantId, tenantId), eq(staffDayLogs.projectId, projectId))),
    db.select({ id: purchaseOrders.id, linesJson: purchaseOrders.linesJson, status: purchaseOrders.status })
      .from(purchaseOrders).where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.projectId, projectId))),
    db.select({ total: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::bigint` })
      .from(payments).leftJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(and(eq(payments.tenantId, tenantId), SETTLED,
        sql`coalesce(${payments.projectId}, ${invoices.projectId}) = ${projectId}`)),
    db.select({ total: sql<number>`coalesce(sum(${vendorPayments.amountPaise}), 0)::bigint` })
      .from(vendorPayments).innerJoin(purchaseOrders, eq(purchaseOrders.id, vendorPayments.purchaseOrderId))
      .where(and(eq(vendorPayments.tenantId, tenantId), eq(purchaseOrders.projectId, projectId))),
    db.select({ subtotal: quotes.subtotalPaise, margin: quotes.marginPaise, version: quotes.version })
      .from(quotes)
      .where(and(eq(quotes.tenantId, tenantId), eq(quotes.projectId, projectId), inArray(quotes.status, ['accepted', 'approved'])))
      .orderBy(desc(quotes.version)).limit(1),
  ]);

  const expenseRows = exp.map(e => ({ ...e, amountPaise: Number(e.amountPaise), gstAmountPaise: Number(e.gstAmountPaise) }));
  const billedByPo = new Map<string, number>();
  for (const e of expenseRows) if (e.poId && !e.voidedAt) billedByPo.set(e.poId, (billedByPo.get(e.poId) ?? 0) + e.amountPaise);
  const committedPaise = pos.filter(po => po.status !== 'cancelled')
    .reduce((s, po) => s + Math.max(0, poTotalPaise(po.linesJson) - (billedByPo.get(po.id) ?? 0)), 0);

  const costs = costBreakdown(expenseRows, Number(staff[0]?.cost ?? 0), committedPaise);
  const profit = profitView(revisedPaise, costs.totalPaise, costs.committedPaise);

  const contractGstPaise = gstOf(revisedPaise, p.gstPct);
  const duePaise = ms.filter(m => m.isDue).reduce((s, m) => s + m.totalPaise, 0);
  const receivedPaise = Number(received[0]?.total ?? 0);
  const allocatedPaise = ms.reduce((s, m) => s + m.receivedPaise, 0);
  const outstandingPaise = Math.max(0, duePaise - receivedPaise);
  const overduePaise = Math.min(outstandingPaise, ms.filter(m => m.status === 'overdue').reduce((s, m) => s + m.balancePaise, 0));

  const paidOutPaise = expenseRows.filter(e => !e.poId && !e.voidedAt).reduce((s, e) => s + e.amountPaise, 0)
    + Number(paidOutVendors[0]?.total ?? 0);

  const totalWithGst = revisedPaise + contractGstPaise;
  const q = quote[0];

  return {
    project: {
      id: p.id, name: p.name, stage: p.stage, customerId: p.customerId, gstPct: p.gstPct,
      startedAt: iso(p.startedAt), expectedEndAt: iso(p.expectedEndAt), handoverAt: iso(p.handoverAt),
    },
    contract: {
      contractPaise, additions, additionsPaise: revisedPaise - (contractPaise ?? 0), revisedPaise,
      gstPaise: contractGstPaise, totalWithGstPaise: totalWithGst,
      milestonePctTotal: ms.reduce((s, m) => s + m.pctOfTotal, 0),
    },
    milestones: ms,
    billing: {
      duePaise, receivedPaise, allocatedPaise, advancePaise: Math.max(0, receivedPaise - allocatedPaise),
      outstandingPaise, overduePaise,
      paidOutPaise, cashInHandPaise: receivedPaise - paidOutPaise,
    },
    costs: { ...costs, staffDays: Number(staff[0]?.days ?? 0) },
    profit: { ...profit, quotedMarginPct: q && Number(q.subtotal) > 0 ? Math.round((Number(q.margin) / Number(q.subtotal)) * 1000) / 10 : null },
    duration: {
      ...durationView({ startedAt: iso(p.startedAt), expectedEndAt: iso(p.expectedEndAt), handoverAt: iso(p.handoverAt) }, today),
      collectedPct: totalWithGst > 0 ? Math.round((receivedPaise / totalWithGst) * 100) : null,
      stagePct: STAGE_PROGRESS[p.stage],
    },
  };
}

export type ProjectMoney = NonNullable<Awaited<ReturnType<typeof loadProjectMoney>>>;

/** Remove owner-only numbers (profit, staff cost) for everyone else. */
export function withoutProfit(m: ProjectMoney) {
  return { ...m, profit: null, costs: { ...m.costs, staffLabourPaise: null, staffDays: null } };
}

/* ── One client ─────────────────────────────────────────────────────────────── */

export async function customerProjectIds(tenantId: string, customerId: string, tx: Db = db): Promise<{ id: string; name: string }[]> {
  const [c] = await tx.select({ leadId: customers.leadId }).from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId))).limit(1);
  if (!c) return [];
  return tx.select({ id: projects.id, name: projects.name }).from(projects)
    .where(and(eq(projects.tenantId, tenantId), or(
      eq(projects.customerId, customerId),
      inArray(projects.leadId, tx.select({ id: leads.id }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.customerId, customerId)))),
      c.leadId ? eq(projects.leadId, c.leadId) : undefined,
    )))
    .orderBy(asc(projects.createdAt));
}

const ADJ_LABEL = { discount: 'Discount', refund: 'Refund', write_off: 'Write-off' } as const;
const MODE_LABEL: Record<string, string> = { upi: 'UPI', cash: 'Cash', bank: 'Bank transfer', cheque: 'Cheque', card: 'Card', razorpay: 'Razorpay' };

export async function loadCustomerLedger(tenantId: string, customerId: string, projectFilter: string | null, today = todayIso()) {
  const all = await customerProjectIds(tenantId, customerId);
  const scoped = projectFilter ? all.filter(p => p.id === projectFilter) : all;
  const ids = scoped.map(p => p.id);
  const nameOf = new Map(all.map(p => [p.id, p.name]));

  const moneys = (await Promise.all(ids.map(id => loadProjectMoney(tenantId, id, today)))).filter((m): m is ProjectMoney => !!m);

  const entries: (LedgerEntry & { projectId: string | null; projectName: string | null; ref: string | null; paymentId: string | null })[] = [];
  for (const m of moneys) {
    for (const ms of m.milestones) {
      if (!ms.isDue || !ms.dueDate) continue;
      entries.push({
        date: ms.dueDate, kind: 'due', owedPaise: ms.totalPaise, paidPaise: 0,
        label: `${ms.label} (${ms.pctOfTotal}%) falls due`, projectId: m.project.id, projectName: m.project.name, ref: null, paymentId: null,
      });
    }
  }

  const paymentRows = ids.length || !projectFilter ? await db.select({
    id: payments.id, amountPaise: payments.amountPaise, mode: payments.mode, reference: payments.reference,
    receiptNumber: payments.receiptNumber, receivedAt: payments.receivedAt, createdAt: payments.createdAt,
    projectId: sql<string | null>`coalesce(${payments.projectId}, ${invoices.projectId})`,
  }).from(payments).leftJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(eq(payments.tenantId, tenantId), SETTLED, or(
      ids.length ? sql`coalesce(${payments.projectId}, ${invoices.projectId}) in (${sql.join(ids.map(i => sql`${i}`), sql`, `)})` : undefined,
      projectFilter ? undefined : and(eq(payments.customerId, customerId), isNull(payments.projectId), isNull(payments.invoiceId)),
    ))) : [];

  for (const pmt of paymentRows) {
    const bits = [MODE_LABEL[pmt.mode ?? ''] ?? 'Payment', pmt.reference, pmt.receiptNumber].filter(Boolean);
    entries.push({
      date: iso(pmt.receivedAt ?? pmt.createdAt)!, kind: 'payment', owedPaise: 0, paidPaise: Number(pmt.amountPaise),
      label: `Payment · ${bits.join(' · ')}`, projectId: pmt.projectId, projectName: pmt.projectId ? nameOf.get(pmt.projectId) ?? null : null,
      ref: pmt.receiptNumber, paymentId: pmt.id,
    });
  }

  const adjustments = await db.select({
    id: ledgerAdjustments.id, kind: ledgerAdjustments.kind, amountPaise: ledgerAdjustments.amountPaise,
    reason: ledgerAdjustments.reason, adjDate: ledgerAdjustments.adjDate, projectId: ledgerAdjustments.projectId,
  }).from(ledgerAdjustments)
    .where(and(eq(ledgerAdjustments.tenantId, tenantId), eq(ledgerAdjustments.customerId, customerId),
      projectFilter ? eq(ledgerAdjustments.projectId, projectFilter) : undefined));
  for (const a of adjustments) {
    const amt = Number(a.amountPaise);
    entries.push({
      date: a.adjDate, kind: a.kind, owedPaise: a.kind === 'refund' ? amt : 0, paidPaise: a.kind === 'refund' ? 0 : amt,
      label: `${ADJ_LABEL[a.kind]} · ${a.reason}`, projectId: a.projectId, projectName: a.projectId ? nameOf.get(a.projectId) ?? null : null,
      ref: null, paymentId: null,
    });
  }

  const rows = ledgerWithBalance(entries);
  const owed = rows.reduce((s, r) => s + r.owedPaise, 0);
  const credited = rows.reduce((s, r) => s + r.paidPaise, 0);
  const receivedPaise = rows.filter(r => r.kind === 'payment').reduce((s, r) => s + r.paidPaise, 0);

  return {
    projects: all,
    totals: {
      contractWithGstPaise: moneys.reduce((s, m) => s + m.contract.totalWithGstPaise, 0),
      duePaise: rows.filter(r => r.kind === 'due').reduce((s, r) => s + r.owedPaise, 0),
      receivedPaise,
      adjustmentsPaise: credited - receivedPaise - rows.filter(r => r.kind === 'refund').reduce((s, r) => s + r.owedPaise, 0),
      outstandingPaise: Math.max(0, owed - credited),
      advancePaise: Math.max(0, credited - owed),
      overduePaise: Math.min(Math.max(0, owed - credited), moneys.reduce((s, m) => s + m.billing.overduePaise, 0)),
    },
    entries: rows,
  };
}

/* ── Writes shared by several routes ────────────────────────────────────────── */

/**
 * After a stage change: milestones waiting on a stage the project has now
 * reached fall due today, and reaching handover stamps the handover date.
 */
export async function applyStageMoneyEffects(tx: Db, tenantId: string, projectId: string, stage: ProjectStage): Promise<void> {
  const reached = STAGE_ORDER.filter(s => stageReached(stage, s));
  await tx.update(milestones).set({ dueSince: sql`(now() at time zone 'Asia/Kolkata')::date` })
    .where(and(eq(milestones.tenantId, tenantId), eq(milestones.projectId, projectId), isNull(milestones.dueSince),
      isNull(milestones.dueOn), inArray(milestones.triggerStage, reached)));
  if (stage === 'handover' || stage === 'complete') {
    await tx.update(projects).set({ handoverAt: sql`now()` })
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId), isNull(projects.handoverAt)));
  }
}

/** Mark milestones paid once their allocations cover the full amount incl. GST. */
export async function refreshMilestonesPaid(tx: Db, tenantId: string, projectId: string): Promise<void> {
  const money = await loadProjectMoneyTx(tx, tenantId, projectId);
  if (!money) return;
  for (const m of money.milestones) {
    if (m.status === 'paid') {
      await tx.update(milestones).set({ paymentStatus: 'paid', paidAt: sql`coalesce(${milestones.paidAt}, now())`, amountPaise: m.amountPaise })
        .where(and(eq(milestones.id, m.id), eq(milestones.tenantId, tenantId), ne(milestones.paymentStatus, 'paid')));
    }
  }
}

/** Milestones with balances, inside a transaction (no costs). */
async function loadProjectMoneyTx(tx: Db, tenantId: string, projectId: string) {
  const [p] = await tx.select({ id: projects.id, stage: projects.lifecycleStage, gstPct: projects.gstPct, contractPaise: projects.totalContractPaise })
    .from(projects).where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId))).limit(1);
  if (!p) return null;
  const adds = await tx.select({ amountPaise: projectAdditions.amountPaise }).from(projectAdditions)
    .where(and(eq(projectAdditions.tenantId, tenantId), eq(projectAdditions.projectId, projectId)));
  const revised = revisedContract(p.contractPaise === null ? null : Number(p.contractPaise), adds.map(a => ({ amountPaise: Number(a.amountPaise) })));
  return { milestones: await loadMilestones(tx, tenantId, { id: p.id, stage: p.stage, gstPct: p.gstPct }, revised, todayIso()) };
}

/**
 * Spread a payment over the project's milestones (explicit split, or oldest
 * due first) and mark the ones it completes as paid. Returns what was left as advance.
 */
export async function allocatePayment(
  tx: Tx, tenantId: string, paymentId: string, projectId: string, amountPaise: number,
  explicit?: { milestoneId: string; amountPaise: number }[],
): Promise<{ allocatedPaise: number; advancePaise: number }> {
  const money = await loadProjectMoneyTx(tx, tenantId, projectId);
  if (!money) return { allocatedPaise: 0, advancePaise: amountPaise };

  let plan: { milestoneId: string; amountPaise: number }[];
  if (explicit?.length) {
    const balance = new Map(money.milestones.map(m => [m.id, m.balancePaise]));
    plan = explicit.filter(a => balance.has(a.milestoneId) && a.amountPaise > 0)
      .map(a => ({ milestoneId: a.milestoneId, amountPaise: Math.min(a.amountPaise, balance.get(a.milestoneId)!) }))
      .filter(a => a.amountPaise > 0);
    const sum = plan.reduce((s, a) => s + a.amountPaise, 0);
    if (sum > amountPaise) throw new Error('Allocations add up to more than the payment.');
  } else {
    plan = allocateOldestFirst(amountPaise, money.milestones.map(m => ({
      id: m.id, balancePaise: m.balancePaise, isDue: m.isDue, order: m.sortOrder,
    }))).allocations;
  }

  if (plan.length) {
    await tx.insert(paymentAllocations).values(plan.map(a => ({ tenantId, paymentId, milestoneId: a.milestoneId, amountPaise: a.amountPaise })));
  }
  await refreshMilestonesPaid(tx, tenantId, projectId);
  const allocatedPaise = plan.reduce((s, a) => s + a.amountPaise, 0);
  return { allocatedPaise, advancePaise: amountPaise - allocatedPaise };
}
