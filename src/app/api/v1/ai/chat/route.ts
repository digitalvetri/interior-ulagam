import { NextRequest, NextResponse } from 'next/server';
import { eq, and, ne, inArray, desc, not } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, leads, projects, customers, invoices, payments, milestones } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';
import { groqProvider } from '@/lib/ai';

// ── Request types ─────────────────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const BodySchema = z.object({
  message: z.string().min(1).max(4000),
  module: z.string().default('dashboard'),
  conversationHistory: z.array(MessageSchema).default([]),
});

// ── Module descriptions ───────────────────────────────────────────────────────

function moduleContext(module: string): string {
  const map: Record<string, string> = {
    leads:         'Leads pipeline (stages: new → site_visit → won / lost)',
    clients:       'Clients (customers) — project history, payments, health status',
    projects:      'Projects (lifecycle: design_pending→design_approved→procurement→execution→snagging→handover→complete)',
    'site-visits': 'Site Visits — scheduled/completed visits linked to leads or projects',
    vendors:       'Vendors — supplier records, purchase orders, GRNs, vendor payments',
    finance:       'Finance — invoices, payments, expenses, outstanding milestones',
    invoices:      'Invoices (lifecycle: draft→issued→part_paid→paid→void). GST: 18% works contract',
    attendance:    'Attendance — employee check-in/out, leave requests',
    reports:       'Reports — revenue trends, lead funnel, KPI dashboard',
    employees:     'Employees (HR) — staff records, roles, leave, attendance',
    materials:     'Materials catalogue — rates in paise (÷100 = ₹), category, vendor links',
    quotes:        'Quotes — room-wise BOQ with margin engine. All amounts in paise (÷100 = ₹)',
    calendar:      'Calendar — events, site visits, follow-ups',
    'work-orders': 'Work Orders — design and site deliverables per project',
  };
  return map[module] ?? 'Konst Design CRM overview';
}

// ── Action extraction ─────────────────────────────────────────────────────────

interface ProposedAction {
  type: 'notify_employee' | 'create_task' | 'set_followup';
  label: string;
  targetUserId?: string;
  targetUserName?: string;
  message?: string;
  taskTitle?: string;
  assignToId?: string;
  assignToName?: string;
  dueAt?: string;
  leadId?: string;
  followUpDate?: string;
}

function extractAction(text: string): { answer: string; proposedAction: ProposedAction | null } {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const bare    = text.match(/(\{[\s\S]*"type"\s*:\s*"(?:notify_employee|create_task|set_followup)"[\s\S]*\})/);
  const jsonStr = fenced?.[1]?.trim() ?? bare?.[1]?.trim();
  if (!jsonStr) return { answer: text.trim(), proposedAction: null };
  try {
    const parsed = JSON.parse(jsonStr) as Partial<ProposedAction>;
    if (
      typeof parsed.type !== 'string' ||
      !['notify_employee', 'create_task', 'set_followup'].includes(parsed.type) ||
      typeof parsed.label !== 'string'
    ) {
      return { answer: text.replace(/```json[\s\S]*?```/, '').trim(), proposedAction: null };
    }
    const answer = text
      .replace(/```json[\s\S]*?```/, '')
      .replace(bare?.[1] ?? '', '')
      .trim();
    return {
      answer: answer || 'Here is my proposed action:',
      proposedAction: parsed as ProposedAction,
    };
  } catch {
    return { answer: text.trim(), proposedAction: null };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(paise: number | null | undefined): string {
  if (!paise) return '₹0';
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Live data fetchers ────────────────────────────────────────────────────────

async function fetchReceivables(tenantId: string): Promise<string> {
  // Get all non-void, non-draft invoices with client names
  const invRows = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      subtotalPaise: invoices.subtotalPaise,
      cgstPaise:     invoices.cgstPaise,
      sgstPaise:     invoices.sgstPaise,
      igstPaise:     invoices.igstPaise,
      dueDate:       invoices.dueDate,
      status:        invoices.status,
      projectName:   projects.name,
      clientName:    customers.fullName,
      clientPhone:   customers.phone,
      invoiceId:     invoices.id,
    })
    .from(invoices)
    .innerJoin(projects,  eq(invoices.projectId, projects.id))
    .leftJoin(customers,  eq(projects.customerId, customers.id))
    .where(and(
      eq(invoices.tenantId, tenantId),
      ne(invoices.status, 'void'),
      ne(invoices.status, 'draft'),
      ne(invoices.status, 'paid'),
    ))
    .orderBy(desc(invoices.createdAt));

  if (invRows.length === 0) return '  (no outstanding invoices)';

  // Sum payments per invoice
  const ids = invRows.map(r => r.invoiceId);
  const paidMap = new Map<string, number>();
  if (ids.length > 0) {
    const sums = await db
      .select({
        invoiceId: payments.invoiceId,
        total:     payments.amountPaise,
      })
      .from(payments)
      .where(and(
        inArray(payments.invoiceId, ids),
        ne(payments.status, 'pending'),
      ));
    for (const s of sums) {
      if (s.invoiceId) paidMap.set(s.invoiceId, (paidMap.get(s.invoiceId) ?? 0) + s.total);
    }
  }

  const today = new Date();
  const lines = invRows.map(r => {
    const total       = r.subtotalPaise + r.cgstPaise + r.sgstPaise + r.igstPaise;
    const paid        = paidMap.get(r.invoiceId) ?? 0;
    const outstanding = total - paid;
    if (outstanding <= 0) return null;
    const overdue = r.dueDate && new Date(r.dueDate) < today ? ' ⚠️ OVERDUE' : '';
    return `  • ${r.invoiceNumber} | Client: ${r.clientName ?? 'Unknown'}${r.clientPhone ? ` (${r.clientPhone})` : ''} | Project: ${r.projectName} | Outstanding: ${fmt(outstanding)}${r.dueDate ? ` | Due: ${fmtDate(r.dueDate)}` : ''}${overdue}`;
  }).filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : '  (all invoices fully paid)';
}

async function fetchLeads(tenantId: string): Promise<string> {
  const rows = await db
    .select({
      id:            leads.id,
      contactName:   leads.contactName,
      contactPhone:  leads.contactPhone,
      stage:         leads.stage,
      followUpDate:  leads.followUpDate,
      projectLocation: leads.projectLocation,
      projectValuePaise: leads.projectValuePaise,
      notes:         leads.notes,
    })
    .from(leads)
    .where(eq(leads.tenantId, tenantId))
    .orderBy(desc(leads.createdAt))
    .limit(60);

  if (rows.length === 0) return '  (no leads)';

  return rows.map(r => {
    const followUp = r.followUpDate ? ` | Follow-up: ${fmtDate(r.followUpDate)}` : '';
    const value    = r.projectValuePaise ? ` | Value: ${fmt(r.projectValuePaise)}` : '';
    const location = r.projectLocation ? ` | Location: ${r.projectLocation}` : '';
    return `  • ${r.contactName} (${r.contactPhone}) — Stage: ${r.stage}${location}${value}${followUp} | ID: ${r.id}`;
  }).join('\n');
}

async function fetchProjects(tenantId: string): Promise<string> {
  const rows = await db
    .select({
      id:               projects.id,
      name:             projects.name,
      lifecycleStage:   projects.lifecycleStage,
      totalContractPaise: projects.totalContractPaise,
      expectedEndAt:    projects.expectedEndAt,
      clientName:       customers.fullName,
      clientPhone:      customers.phone,
    })
    .from(projects)
    .leftJoin(customers, eq(projects.customerId, customers.id))
    .where(and(
      eq(projects.tenantId, tenantId),
      not(eq(projects.lifecycleStage, 'complete')),
    ))
    .orderBy(desc(projects.createdAt))
    .limit(30);

  if (rows.length === 0) return '  (no active projects)';

  return rows.map(r => {
    const client   = r.clientName ? ` | Client: ${r.clientName}${r.clientPhone ? ` (${r.clientPhone})` : ''}` : '';
    const contract = r.totalContractPaise ? ` | Contract: ${fmt(r.totalContractPaise)}` : '';
    const deadline = r.expectedEndAt ? ` | Deadline: ${fmtDate(r.expectedEndAt)}` : '';
    return `  • ${r.name}${client} | Stage: ${r.lifecycleStage}${contract}${deadline} | ID: ${r.id}`;
  }).join('\n');
}

// ── Main handler ─────────────────────────────────────────────────────────────

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
  const { message, module, conversationHistory } = parsed.data;

  // Fetch all live data in parallel
  const [employees, receivables, leadsData, projectsData] = await Promise.all([
    db.select({ id: users.id, fullName: users.fullName, role: users.role, phone: users.phone })
      .from(users)
      .where(eq(users.tenantId, ctx.tenantId)),
    fetchReceivables(ctx.tenantId),
    fetchLeads(ctx.tenantId),
    fetchProjects(ctx.tenantId),
  ]);

  const employeeDir = employees.length > 0
    ? employees.map(e =>
        `  • ${e.fullName} (${e.role})${e.phone ? ` — phone: ${e.phone}` : ''} — ID: ${e.id}`
      ).join('\n')
    : '  (no employees found)';

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const systemPrompt = `You are an intelligent AI assistant built into Konst Design CRM — a premium interior design firm's management platform based in Coimbatore, Tamil Nadu.

You are talking to: ${ctx.fullName} (role: ${ctx.role})
Today: ${today}
Current section: ${moduleContext(module)}

You have FULL ACCESS to the live CRM data below. Answer questions directly using this data — never ask the user to tell you something that is already listed here.

════════════════════════════════════════
LIVE CRM DATA
════════════════════════════════════════

OUTSTANDING INVOICES / ACCOUNTS RECEIVABLE:
${receivables}

ALL LEADS:
${leadsData}

ACTIVE PROJECTS:
${projectsData}

EMPLOYEES & TEAM:
${employeeDir}

════════════════════════════════════════

RULES:
- Answer questions directly from the data above. Never ask for information already present in the data.
- Monetary values are in paise in the DB; they are already converted to ₹ in the data above.
- Keep answers concise and specific. Use names, amounts, and dates from the data.
- If something is not in the data, say so clearly rather than guessing.

SPECIAL ACTIONS (only propose when the user explicitly requests one):
You can embed a JSON block to trigger an action:

1. Notify an employee:
\`\`\`json
{"type":"notify_employee","label":"Short description","targetUserId":"<ID from directory>","targetUserName":"<Name>","message":"<message text>"}
\`\`\`

2. Create a task:
\`\`\`json
{"type":"create_task","label":"Short description","taskTitle":"<title>","assignToId":"<optional ID>","assignToName":"<optional name>","dueAt":"<optional ISO date>"}
\`\`\`

3. Set a lead follow-up:
\`\`\`json
{"type":"set_followup","label":"Short description","leadId":"<lead ID from data above>","followUpDate":"<ISO datetime>"}
\`\`\`

For notify_employee: use the exact employee ID from the directory. Only propose an action when the user explicitly asks for one.`;

  const historyMessages = conversationHistory.slice(-6).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  try {
    const rawText = await groqProvider.chatText({
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: message }],
      model: 'heavy',
    });

    const { answer, proposedAction } = extractAction(rawText);

    let safeAction = proposedAction;
    if (safeAction?.type === 'notify_employee' && safeAction.targetUserId) {
      const knownIds = new Set(employees.map(e => e.id));
      if (!knownIds.has(safeAction.targetUserId)) safeAction = null;
    }

    return NextResponse.json({ data: { answer, proposedAction: safeAction } });
  } catch (err) {
    console.error('[ai/chat]', err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 });
  }
}

export const dynamic = 'force-dynamic';
