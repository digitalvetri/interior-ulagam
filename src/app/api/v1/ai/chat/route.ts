import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
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
    leads:         'Leads pipeline (stages: new→contacted→qualified→site_visit→measurement→quotation→negotiation→won/lost)',
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
// The model is instructed to embed a JSON block only when proposing an action.
// We extract it with a lightweight parse — if anything is wrong we return null.

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
  // Look for ```json ... ``` block (model-friendly format)
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  // Also accept a bare { ... } block if no fenced block
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

  // Fetch employee directory for the system prompt
  const employees = await db
    .select({ id: users.id, fullName: users.fullName, role: users.role, phone: users.phone })
    .from(users)
    .where(eq(users.tenantId, ctx.tenantId));

  const employeeDir = employees.length > 0
    ? employees.map(e =>
        `  • ${e.fullName} (${e.role}) — ID: ${e.id}${e.phone ? `, phone: ${e.phone}` : ''}`
      ).join('\n')
    : '  (no employees found)';

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const systemPrompt = `You are an intelligent AI assistant built into Konst Design CRM — a premium interior design firm's management platform based in Coimbatore, Tamil Nadu.

You are talking to: ${ctx.fullName} (role: ${ctx.role})
Today: ${today}
Current section: ${moduleContext(module)}

You can answer ANY question the user asks — whether it's about the CRM, interior design, business calculations, general knowledge, or anything else. Be helpful, concise, and friendly.

ORGANISATION EMPLOYEES:
${employeeDir}

SPECIAL ACTIONS (only use when the user clearly requests one):
You can propose one of these actions by embedding a JSON block in your reply:

1. Notify an employee (in-app + WhatsApp):
Your explanation text here.
\`\`\`json
{"type":"notify_employee","label":"Short description","targetUserId":"<ID from directory>","targetUserName":"<Name>","message":"<message text>"}
\`\`\`

2. Create a task:
\`\`\`json
{"type":"create_task","label":"Short description","taskTitle":"<title>","assignToId":"<optional ID>","assignToName":"<optional name>","dueAt":"<optional ISO date>"}
\`\`\`

3. Set a lead follow-up date:
\`\`\`json
{"type":"set_followup","label":"Short description","leadId":"<lead UUID>","followUpDate":"<ISO datetime>"}
\`\`\`

RULES:
- For notify_employee: use the exact employee ID from the directory above.
- Only propose an action when the user explicitly asks for one. For regular questions, just answer in plain text — no JSON needed.
- Monetary values in the CRM are stored in paise; display as ₹ by dividing by 100.
- Keep answers concise unless the user asks for detail.
- You can ask clarifying questions when an action is ambiguous (e.g. which employee, which lead).`;

  // Build multi-turn message array (last 6 turns = 3 exchanges)
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

    // Validate: strip any action that references an employee not in our tenant
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
