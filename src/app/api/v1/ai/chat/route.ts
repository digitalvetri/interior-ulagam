import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';
import { groqProvider } from '@/lib/ai';

// ── Request / response types ─────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const BodySchema = z.object({
  message: z.string().min(1).max(4000),
  module: z.string().default('dashboard'),
  conversationHistory: z.array(MessageSchema).default([]),
});

// What we ask Groq to return
const AiResponseSchema = z.object({
  answer: z.string(),
  proposedAction: z.object({
    type: z.enum(['notify_employee', 'create_task', 'set_followup']),
    label: z.string(),
    // notify_employee
    targetUserId: z.string().optional(),
    targetUserName: z.string().optional(),
    message: z.string().optional(),
    // create_task
    taskTitle: z.string().optional(),
    assignToId: z.string().optional(),
    assignToName: z.string().optional(),
    dueAt: z.string().optional(),
    // set_followup
    leadId: z.string().optional(),
    followUpDate: z.string().optional(),
  }).nullable(),
});

// ── Module-specific context lines ────────────────────────────────────────────

function moduleContext(module: string): string {
  const map: Record<string, string> = {
    leads:       'Leads pipeline — stages: new → contacted → qualified → site_visit → measurement → quotation → negotiation → won/lost',
    clients:     'Clients (customers) — client records, project history, payments, health status',
    projects:    'Projects — lifecycle: design_pending → design_in_progress → design_approved → procurement → execution → snagging → handover → complete',
    'site-visits': 'Site Visits — scheduled/in-progress/completed/cancelled visits linked to leads or projects',
    vendors:     'Vendors — supplier records, purchase orders, GRNs, vendor payments',
    finance:     'Finance — invoices, payments (captured via Razorpay), expenses, outstanding milestones',
    invoices:    'Invoices — lifecycle: draft → issued → part_paid → paid → void. GST: 18% works contract',
    attendance:  'Attendance — employee check-in/out, leave requests, half-days',
    reports:     'Reports — revenue trends, lead funnel, project profitability, KPI summary',
    employees:   'Employees (HR) — staff records, roles, employment type, attendance, leave',
    materials:   'Materials — catalogue with current/selling rate (paise), category, vendor links',
    quotes:      'Quotes — room-wise BOQ with margin engine. All amounts in paise (÷100 = ₹)',
    calendar:    'Calendar — scheduled events, site visits, follow-ups',
    'work-orders': 'Work Orders — design deliverables and site work tasks per project',
  };
  return map[module] ?? 'Konst Design CRM dashboard';
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

  // Fetch tenant employees for the directory (name, id, role, phone)
  const employees = await db
    .select({ id: users.id, fullName: users.fullName, role: users.role, phone: users.phone })
    .from(users)
    .where(eq(users.tenantId, ctx.tenantId));

  const employeeDir = employees
    .map(e => `  - "${e.fullName}" (${e.role}) — ID: ${e.id}${e.phone ? `, phone: ${e.phone}` : ''}`)
    .join('\n');

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const systemPrompt = `You are an AI assistant embedded in Konst Design CRM, a premium interior design firm's management platform.
You are helping ${ctx.fullName} (role: ${ctx.role}).
Today: ${today}.
Current section: ${moduleContext(module)}.

EMPLOYEES IN THIS ORGANISATION:
${employeeDir || '  (no employees found)'}

ACTIONS YOU CAN PROPOSE (propose at most ONE per reply):
1. notify_employee — send an in-app notification + WhatsApp message to an employee
2. create_task — create a task and optionally assign it to an employee
3. set_followup — set a follow-up date on a lead

RESPONSE FORMAT — you MUST return valid JSON with this exact shape:
{
  "answer": "<your natural-language reply here>",
  "proposedAction": null
}
OR when proposing an action:
{
  "answer": "<explain what you're about to do and why, ask for confirmation>",
  "proposedAction": {
    "type": "notify_employee",
    "label": "<short human-readable description of the action>",
    "targetUserId": "<employee ID from directory>",
    "targetUserName": "<employee name>",
    "message": "<the notification message text>"
  }
}

RULES:
- For notify_employee: match the employee name from the directory above; include their exact ID.
- For set_followup: only propose if the user mentions a specific lead or follow-up date.
- For create_task: include taskTitle; assignToId/assignToName are optional.
- Keep answers concise (2–4 sentences max unless a detailed summary is requested).
- Monetary values are stored in paise (integers); display as ₹ by dividing by 100.
- Role-based: ${ctx.role === 'owner' || ctx.role === 'admin' ? 'full access to all data including finance and margins' : `limited to own records; ${ctx.permissions.canSeeFinance ? 'can see finance' : 'cannot see finance data'}`}.
- If unsure about a record ID or date, ask the user to confirm before proposing an action.`;

  // Build messages array for multi-turn: use chatJSON which wraps with system + user
  // We fold prior turns into the user message for simplicity (Groq's chatJSON sends one system + one user)
  const priorTurns = conversationHistory
    .slice(-6) // last 3 exchanges = 6 messages
    .map(m => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`)
    .join('\n');

  const userContent = priorTurns
    ? `Previous conversation:\n${priorTurns}\n\n[User]: ${message}`
    : message;

  try {
    const result = await groqProvider.chatJSON({
      system: systemPrompt,
      user: userContent,
      schema: AiResponseSchema,
      model: 'heavy',
    });

    // Validate proposed action references a real employee in our tenant
    if (result.proposedAction?.type === 'notify_employee' && result.proposedAction.targetUserId) {
      const emp = employees.find(e => e.id === result.proposedAction!.targetUserId);
      if (!emp) {
        // LLM hallucinated an employee ID — strip the action
        result.proposedAction = null;
      }
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('[ai/chat]', err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 });
  }
}

export const dynamic = 'force-dynamic';
