'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bot, X, Send, Loader2, CheckCircle2, XCircle,
  Bell, ListTodo, CalendarClock, Sparkles,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProposedAction {
  type: 'notify_employee' | 'create_task' | 'set_followup';
  label: string;
  // notify_employee
  targetUserId?: string;
  targetUserName?: string;
  message?: string;
  notificationTitle?: string;
  // create_task
  taskTitle?: string;
  assignToId?: string;
  assignToName?: string;
  dueAt?: string;
  // set_followup
  leadId?: string;
  followUpDate?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  proposedAction?: ProposedAction | null;
  actionStatus?: 'pending' | 'confirmed' | 'dismissed' | 'executing' | 'done' | 'error';
  actionResult?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pathToModule(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean);
  return seg[0] ?? 'dashboard';
}

function moduleLabel(module: string): string {
  const map: Record<string, string> = {
    leads: 'Leads', clients: 'Clients', projects: 'Projects',
    'site-visits': 'Site Visits', vendors: 'Vendors', finance: 'Finance',
    invoices: 'Invoices', attendance: 'Attendance', reports: 'Reports',
    employees: 'Employees', materials: 'Materials', quotes: 'Quotes',
    calendar: 'Calendar', 'work-orders': 'Work Orders', dashboard: 'Dashboard',
  };
  return map[module] ?? module;
}

const ACTION_ICONS = {
  notify_employee: Bell,
  create_task: ListTodo,
  set_followup: CalendarClock,
};

// ── Suggested prompts by module ───────────────────────────────────────────────

const SUGGESTIONS: Record<string, string[]> = {
  leads:     ['How many leads are in each stage?', 'Which leads need follow-up today?'],
  projects:  ['What projects are in execution stage?', 'Summarise active projects'],
  finance:   ['What is our outstanding payment total?', 'Show revenue this month'],
  clients:   ['List clients with recent activity', 'Who are our top clients?'],
  default:   ['Summarise today\'s priorities', 'Send a message to an employee'],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AiAssistant() {
  const pathname = usePathname();
  const module   = pathToModule(pathname);

  const [open, setOpen]         = useState(false);
  const [input, setInput]       = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const panelRef    = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Build conversation history for multi-turn context
  const historyForApi = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setInput('');

    const userMsg: Message = { id: uid(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, module, conversationHistory: historyForApi }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const data = body.data as { answer: string; proposedAction: ProposedAction | null };

      // If action is notify_employee, pre-fill notificationTitle from message
      let action = data.proposedAction;
      if (action?.type === 'notify_employee' && !action.notificationTitle) {
        action = { ...action, notificationTitle: `Message from ${''} via AI Assistant` };
      }

      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: data.answer,
        proposedAction: action ?? undefined,
        actionStatus: action ? 'pending' : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: uid(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t process that. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(msgId: string, action: ProposedAction) {
    // Mark as executing
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, actionStatus: 'executing' } : m,
    ));

    let body: Record<string, unknown>;
    if (action.type === 'notify_employee') {
      body = {
        type: 'notify_employee',
        targetUserId: action.targetUserId,
        message: action.message ?? action.label,
        notificationTitle: action.notificationTitle ?? action.label,
      };
    } else if (action.type === 'create_task') {
      body = {
        type: 'create_task',
        taskTitle: action.taskTitle ?? action.label,
        assignToId: action.assignToId,
        dueAt: action.dueAt,
      };
    } else {
      body = {
        type: 'set_followup',
        leadId: action.leadId,
        followUpDate: action.followUpDate,
      };
    }

    try {
      const res = await fetch('/api/v1/ai/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Action failed' }));
        throw new Error(err.error ?? 'Action failed');
      }
      const result = await res.json();

      let resultText = 'Done.';
      if (action.type === 'notify_employee') {
        const wa = result.data?.whatsappStatus;
        resultText = `Notification sent to ${action.targetUserName ?? 'employee'}${wa === 'sent' ? ' (in-app + WhatsApp)' : ' (in-app only)'}.`;
      } else if (action.type === 'create_task') {
        resultText = `Task "${action.taskTitle ?? action.label}" created.`;
      } else if (action.type === 'set_followup') {
        resultText = `Follow-up date set.`;
      }

      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, actionStatus: 'done', actionResult: resultText } : m,
      ));
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? {
          ...m,
          actionStatus: 'error',
          actionResult: err instanceof Error ? err.message : 'Action failed',
        } : m,
      ));
    }
  }

  function dismissAction(msgId: string) {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, actionStatus: 'dismissed' } : m,
    ));
  }

  const suggestions = SUGGESTIONS[module] ?? SUGGESTIONS.default;

  return (
    <>
      {/* ── Trigger button (FAB) ─── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Open AI Assistant"
        title="AI Assistant"
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
        }}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {/* ── Panel ─── */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            width: 'min(420px, calc(100vw - 24px))',
            height: 'min(600px, calc(100vh - 120px))',
            background: 'var(--surface-card)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none" style={{ color: 'var(--text-heading)' }}>
                Konst Design AI
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {moduleLabel(module)} · Context-aware
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-muted)]"
              style={{ color: 'var(--text-tertiary)' }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: 'var(--surface-muted)' }}
                >
                  <Sparkles className="h-6 w-6" style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                    Ask me anything about {moduleLabel(module)}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    I can answer questions, summarise records, create tasks, and send messages to employees.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="w-full rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-muted)]"
                      style={{
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  >
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                )}

                <div className={`flex flex-col gap-1.5 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Bubble */}
                  <div
                    className="rounded-2xl px-3 py-2 text-xs leading-relaxed"
                    style={msg.role === 'user' ? {
                      background: 'var(--success)',
                      color: '#fff',
                      borderBottomRightRadius: 4,
                    } : {
                      background: 'var(--surface-muted)',
                      color: 'var(--text-primary)',
                      borderBottomLeftRadius: 4,
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Proposed action card */}
                  {msg.proposedAction && msg.actionStatus === 'pending' && (
                    <ActionCard
                      action={msg.proposedAction}
                      onConfirm={() => executeAction(msg.id, msg.proposedAction!)}
                      onDismiss={() => dismissAction(msg.id)}
                    />
                  )}
                  {msg.actionStatus === 'executing' && (
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Executing…
                    </div>
                  )}
                  {msg.actionStatus === 'done' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {msg.actionResult}
                    </div>
                  )}
                  {msg.actionStatus === 'error' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-red-500">
                      <XCircle className="h-3.5 w-3.5" />
                      {msg.actionResult ?? 'Failed'}
                    </div>
                  )}
                  {msg.actionStatus === 'dismissed' && (
                    <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      Action dismissed
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  <Bot className="h-3 w-3 text-white" />
                </div>
                <div
                  className="rounded-2xl px-3 py-2"
                  style={{ background: 'var(--surface-muted)', borderBottomLeftRadius: 4 }}
                >
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="flex items-center gap-2 border-t px-3 py-2 flex-shrink-0"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ask anything or type a command…"
              disabled={loading}
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--text-tertiary)] disabled:opacity-50"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
              style={{
                background: input.trim() && !loading ? 'var(--success)' : 'var(--surface-muted)',
                color: input.trim() && !loading ? '#fff' : 'var(--text-tertiary)',
              }}
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActionCard({
  action,
  onConfirm,
  onDismiss,
}: {
  action: ProposedAction;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const Icon = ACTION_ICONS[action.type] ?? Bell;

  return (
    <div
      className="rounded-xl border p-3 w-full"
      style={{
        background: 'var(--surface-app)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(16,185,129,0.12)' }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold" style={{ color: 'var(--text-heading)' }}>
            {action.label}
          </p>
          {action.type === 'notify_employee' && action.message && (
            <p className="mt-0.5 text-[10px] line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
              To: {action.targetUserName ?? 'employee'} — "{action.message}"
            </p>
          )}
          {action.type === 'create_task' && action.taskTitle && (
            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              Task: {action.taskTitle}{action.assignToName ? ` → ${action.assignToName}` : ''}
            </p>
          )}
          {action.type === 'set_followup' && action.followUpDate && (
            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              Follow-up: {new Date(action.followUpDate).toLocaleDateString('en-IN')}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-lg py-1.5 text-[11px] font-medium text-white transition-colors"
          style={{ background: 'var(--success)' }}
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--surface-muted)]"
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full animate-bounce"
          style={{
            background: 'var(--text-tertiary)',
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.8s',
          }}
        />
      ))}
    </div>
  );
}
