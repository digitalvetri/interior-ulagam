'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bot, CheckCircle2, ChevronDown, ChevronUp, Copy, CreditCard, ExternalLink,
  FileSpreadsheet, KeyRound, Loader2, MessageCircle, RefreshCw, XCircle,
} from 'lucide-react';
import { AI_PROVIDERS, AI_TASKS, providerInfo, providersFor, type AiTask } from '@/lib/ai/catalog';
import { copyText, NETWORK_ERROR, responseError } from '@/lib/client-feedback';

/* ── Types (mirror lib/integrations/service integrationStatus) ─────────────── */

type Source = 'app' | 'env' | 'none';
type TaskChoice = { provider: string; model: string };

interface Status {
  appUrl: string;
  ai: { source: Source; tasks: Partial<Record<AiTask, TaskChoice>>; customBaseUrl: string; keys: Record<string, string | null> };
  whatsapp: {
    source: Source; phoneNumberId: string; businessAccountId: string; verifyToken: string;
    accessToken: string | null; appSecret: string | null; webhookUrl: string;
  };
  razorpay: { source: Source; keyId: string; keySecret: string | null; webhookSecret: string | null; webhookUrl: string };
}

interface TestResult { name: string; ok: boolean; detail: string; ms: number }

/* ── Small shared pieces ──────────────────────────────────────────────────── */

const inputCls = 'h-9 w-full rounded-lg border bg-[var(--surface-card)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-base)]/30';
const inputStyle = { borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' };

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function SourceChip({ source }: { source: Source }) {
  const map = {
    app:  { label: 'Connected',            bg: 'var(--success-soft)',  fg: 'var(--success-text)' },
    env:  { label: 'Using server settings', bg: 'var(--accent-soft)',   fg: 'var(--accent-base)' },
    none: { label: 'Not connected',         bg: 'var(--surface-muted)', fg: 'var(--text-secondary)' },
  }[source];
  return (
    <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: map.bg, color: map.fg }}>
      {map.label}
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>}
    </div>
  );
}

function SecretInput({ value, onChange, saved, placeholder }: {
  value: string; onChange: (v: string) => void; saved: string | null; placeholder?: string;
}) {
  return (
    <input
      type="password" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={saved ? `${saved} saved — leave blank to keep` : (placeholder ?? 'Paste here')}
      className={inputCls} style={inputStyle}
    />
  );
}

function CopyField({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <Field label={label} hint={state === 'fail' ? 'Copy blocked — select the text and copy it manually.' : hint}>
      <div className="flex gap-2">
        <input readOnly value={value} className={`${inputCls} font-mono text-xs`} style={inputStyle} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          onClick={async () => { setState((await copyText(value)) ? 'ok' : 'fail'); setTimeout(() => setState('idle'), 2000); }}
          className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
        >
          <Copy className="h-3.5 w-3.5" /> {state === 'ok' ? 'Copied' : 'Copy'}
        </button>
      </div>
    </Field>
  );
}

function Results({ results }: { results: TestResult[] }) {
  return (
    <ul className="space-y-1.5 rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}>
      {results.map((r) => (
        <li key={r.name} className="flex items-start gap-2 text-xs">
          {r.ok
            ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--success-text)' }} />
            : <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-600" />}
          <span>
            <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{r.name}</span>
            <span style={{ color: r.ok ? 'var(--text-secondary)' : '#b91c1c' }}> — {r.detail}{r.ms ? ` (${(r.ms / 1000).toFixed(1)}s)` : ''}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Test / Save / Disconnect row shared by every section. */
function Actions({ kind, body, source, onStatus, valid }: {
  kind: 'ai' | 'whatsapp' | 'razorpay';
  body: () => unknown;
  source: Source;
  onStatus: (s: Status) => void;
  valid: boolean;
}) {
  const [busy, setBusy] = useState<'test' | 'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);

  async function run(action: 'test' | 'save' | 'delete') {
    if (action === 'delete' && !confirm('Disconnect? The saved keys are deleted; any server settings take over.')) return;
    setBusy(action); setError(null); setSaved(false);
    if (action !== 'test') setResults(null);
    try {
      const url = `/api/v1/settings/integrations/${kind}${action === 'test' ? '/test' : ''}`;
      const res = await fetch(url, {
        method: action === 'test' ? 'POST' : action === 'save' ? 'PUT' : 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: action === 'delete' ? undefined : JSON.stringify(body()),
      });
      if (!res.ok) { setError(await responseError(res, 'Request failed')); return; }
      const json = await res.json();
      if (action === 'test') setResults(json.data.results as TestResult[]);
      else { onStatus(json.data as Status); if (action === 'save') setSaved(true); }
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(null);
    }
  }

  const btn = 'flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold disabled:opacity-50';
  return (
    <div className="space-y-3">
      {results && <Results results={results} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm font-medium" style={{ color: 'var(--success-text)' }}>Saved. It is used from now on.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!valid || busy !== null} onClick={() => run('test')}
          className={`${btn} border`} style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
          {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Test connection
        </button>
        <button type="button" disabled={!valid || busy !== null} onClick={() => run('save')}
          className={`${btn} text-white`} style={{ background: 'var(--accent-base)' }}>
          {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </button>
        {source === 'app' && (
          <button type="button" disabled={busy !== null} onClick={() => run('delete')}
            className={`${btn} ml-auto text-red-600 hover:bg-red-50`}>
            {busy === 'delete' && <Loader2 className="h-4 w-4 animate-spin" />} Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, source, open, onToggle, children }: {
  icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string; source: Source;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 px-5 py-4 text-left">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{title}</span>
          <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</span>
        </span>
        <SourceChip source={source} />
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="space-y-5 border-t px-5 py-5" style={{ borderColor: 'var(--border-subtle)' }}>{children}</div>}
    </div>
  );
}

/* ── AI ───────────────────────────────────────────────────────────────────── */

function AiSection({ status, onStatus, open, onToggle }: { status: Status; onStatus: (s: Status) => void; open: boolean; onToggle: () => void }) {
  const [keys, setKeys] = useState<Record<string, string | null>>({});
  const [tasks, setTasks] = useState<Partial<Record<AiTask, TaskChoice>>>(status.ai.tasks);
  const [customBaseUrl, setCustomBaseUrl] = useState(status.ai.customBaseUrl);

  const hasKey = (id: string) => (keys[id] !== null && !!(keys[id] || status.ai.keys[id])) || id === 'custom';
  const setTask = (t: AiTask, patch: Partial<TaskChoice>) =>
    setTasks((prev) => {
      const cur = prev[t] ?? { provider: '', model: '' };
      const next = { ...cur, ...patch };
      if (patch.provider !== undefined && patch.provider !== cur.provider) next.model = providerInfo(patch.provider)?.models[t]?.[0] ?? '';
      return { ...prev, [t]: next };
    });

  const chosen = Object.fromEntries(Object.entries(tasks).filter(([, c]) => c && c.provider && c.model));
  const valid = Object.keys(chosen).length > 0 && Object.values(chosen).every((c) => hasKey(c!.provider));
  const body = () => ({ tasks: chosen, customBaseUrl, keys });

  return (
    <Section icon={Bot} title="AI" open={open} onToggle={onToggle} source={status.ai.source}
      subtitle="Lead briefs, quote drafts, the AI assistant, site-photo checks and voice notes">
      <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
        Whichever provider you choose receives the studio data the AI features work on (client names, project details, amounts).
      </p>

      <div>
        <h4 className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>1 · Add API keys</h4>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>Add a key for each provider you want to use — one is enough.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {AI_PROVIDERS.map((p) => (
            <div key={p.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{p.label}</span>
                {status.ai.keys[p.id] && keys[p.id] !== null && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--success-text)' }}>
                    <KeyRound className="h-3 w-3" /> {status.ai.keys[p.id]}
                  </span>
                )}
              </div>
              <p className="mb-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                {p.blurb}{' '}
                <span className="whitespace-nowrap">
                  {p.supports.vision && '· photos '}{p.supports.voice && '· voice'}
                </span>
              </p>
              {p.id === 'custom' && (
                <input value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="Base URL, e.g. http://my-server:11434/v1" className={`${inputCls} mb-2`} style={inputStyle} />
              )}
              <div className="flex gap-2">
                <SecretInput value={typeof keys[p.id] === 'string' ? (keys[p.id] as string) : ''}
                  onChange={(v) => setKeys((k) => ({ ...k, [p.id]: v }))}
                  saved={keys[p.id] === null ? null : status.ai.keys[p.id]}
                  placeholder={p.id === 'custom' ? 'API key (if your server needs one)' : 'Paste API key'} />
                {status.ai.keys[p.id] && keys[p.id] !== null && (
                  <button type="button" onClick={() => setKeys((k) => ({ ...k, [p.id]: null }))}
                    className="flex-shrink-0 rounded-lg px-2 text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button>
                )}
              </div>
              {p.keyUrl && (
                <a href={p.keyUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--accent-base)' }}>
                  Get a key <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>2 · Choose what runs each job</h4>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Pick a suggested model or type any model name your provider offers. Leave &quot;Quick replies&quot; empty to reuse &quot;Text &amp; briefs&quot;.
        </p>
        <div className="space-y-3">
          {AI_TASKS.map(({ key, label, hint }) => {
            const choice = tasks[key] ?? { provider: '', model: '' };
            const options = providersFor(key);
            const suggestions = providerInfo(choice.provider)?.models[key] ?? [];
            return (
              <div key={key} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[180px_1fr_1fr]" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{label}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{hint}</div>
                </div>
                <select value={choice.provider} onChange={(e) => setTask(key, { provider: e.target.value })} className={inputCls} style={inputStyle}>
                  <option value="">{key === 'fast' ? 'Same as Text & briefs' : 'Not used'}</option>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}{hasKey(p.id) ? '' : ' (add key)'}</option>
                  ))}
                </select>
                <div>
                  <input list={`models-${key}`} value={choice.model} disabled={!choice.provider}
                    onChange={(e) => setTask(key, { model: e.target.value })}
                    placeholder={choice.provider ? 'Model name' : 'Choose a provider first'} className={inputCls} style={inputStyle} />
                  <datalist id={`models-${key}`}>{suggestions.map((m) => <option key={m} value={m} />)}</datalist>
                  {choice.provider && !hasKey(choice.provider) && (
                    <p className="mt-1 text-[11px] text-red-600">Add a {providerInfo(choice.provider)?.label} key above.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Actions kind="ai" body={body} source={status.ai.source} onStatus={(s) => { onStatus(s); setKeys({}); }} valid={valid} />
    </Section>
  );
}

/* ── WhatsApp ─────────────────────────────────────────────────────────────── */

function WhatsAppSection({ status, onStatus, open, onToggle }: { status: Status; onStatus: (s: Status) => void; open: boolean; onToggle: () => void }) {
  const w = status.whatsapp;
  const [phoneNumberId, setPhone] = useState(w.phoneNumberId);
  const [businessAccountId, setWaba] = useState(w.businessAccountId);
  const [verifyToken, setVerify] = useState(w.verifyToken || '');
  const [accessToken, setAccess] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const valid = !!phoneNumberId.trim() && verifyToken.trim().length >= 8 && (!!accessToken || !!w.accessToken);

  return (
    <Section icon={MessageCircle} title="WhatsApp Cloud API" open={open} onToggle={onToggle} source={w.source}
      subtitle="Send quotes, reminders and receipts; receive client messages and site photos">
      <ol className="list-decimal space-y-1 pl-5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <li>In <a className="font-semibold underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">Meta for Developers</a>, open your app → WhatsApp → API Setup for the Phone Number ID and Business Account ID.</li>
        <li>Create a permanent access token: Business Settings → System users → Generate token (whatsapp_business_messaging).</li>
        <li>App settings → Basic → App secret.</li>
        <li>WhatsApp → Configuration → Webhook: paste the Callback URL and Verify token below, then subscribe to <b>messages</b>.</li>
      </ol>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Phone Number ID"><input value={phoneNumberId} onChange={(e) => setPhone(e.target.value)} className={inputCls} style={inputStyle} /></Field>
        <Field label="Business Account ID (optional)"><input value={businessAccountId} onChange={(e) => setWaba(e.target.value)} className={inputCls} style={inputStyle} /></Field>
        <Field label="Permanent access token"><SecretInput value={accessToken} onChange={setAccess} saved={w.accessToken} /></Field>
        <Field label="App secret" hint="Used to check that incoming messages really come from Meta.">
          <SecretInput value={appSecret} onChange={setAppSecret} saved={w.appSecret} />
        </Field>
      </div>
      <CopyField label="Webhook callback URL — paste into Meta" value={w.webhookUrl} />
      <Field label="Verify token — paste into Meta" hint="Any secret phrase; Meta sends it back once to confirm the webhook.">
        <div className="flex gap-2">
          <input value={verifyToken} onChange={(e) => setVerify(e.target.value)} className={`${inputCls} font-mono text-xs`} style={inputStyle} />
          <button type="button" onClick={() => setVerify(randomToken())} className="flex-shrink-0 rounded-lg border px-3 text-xs font-semibold"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>Generate</button>
          <button type="button" onClick={() => void copyText(verifyToken)} className="flex-shrink-0 rounded-lg border px-3 text-xs font-semibold"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>Copy</button>
        </div>
      </Field>
      <Actions kind="whatsapp" source={w.source} valid={valid}
        onStatus={(s) => { onStatus(s); setAccess(''); setAppSecret(''); }}
        body={() => ({ phoneNumberId, businessAccountId, verifyToken, accessToken, appSecret })} />
    </Section>
  );
}

/* ── Razorpay ─────────────────────────────────────────────────────────────── */

function RazorpaySection({ status, onStatus, open, onToggle }: { status: Status; onStatus: (s: Status) => void; open: boolean; onToggle: () => void }) {
  const r = status.razorpay;
  const [keyId, setKeyId] = useState(r.keyId);
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const valid = /^rzp_(test|live)_/.test(keyId.trim()) && (!!keySecret || !!r.keySecret);

  return (
    <Section icon={CreditCard} title="Razorpay" open={open} onToggle={onToggle} source={r.source}
      subtitle="Payment links for milestones; payments are recorded automatically when the client pays">
      <ol className="list-decimal space-y-1 pl-5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <li>In the <a className="font-semibold underline" href="https://dashboard.razorpay.com/app/website-app-settings/api-keys" target="_blank" rel="noreferrer">Razorpay Dashboard</a> → Account &amp; Settings → API Keys, generate a key (use <b>Test mode</b> first).</li>
        <li>Account &amp; Settings → Webhooks → Add: paste the URL below, set a secret, and tick <b>payment_link.paid</b> and <b>payment.captured</b>.</li>
      </ol>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Key ID"><input value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_test_…" className={inputCls} style={inputStyle} /></Field>
        <Field label="Key secret"><SecretInput value={keySecret} onChange={setKeySecret} saved={r.keySecret} /></Field>
      </div>
      <CopyField label="Webhook URL — paste into Razorpay" value={r.webhookUrl} />
      <Field label="Webhook secret — the same value you set in Razorpay">
        <div className="flex gap-2">
          <SecretInput value={webhookSecret} onChange={setWebhookSecret} saved={r.webhookSecret} />
          <button type="button" onClick={() => { const t = randomToken(); setWebhookSecret(t); void copyText(t); }}
            className="flex-shrink-0 rounded-lg border px-3 text-xs font-semibold" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}
            title="Generates a secret and copies it, ready to paste into Razorpay">Generate &amp; copy</button>
        </div>
      </Field>
      <Actions kind="razorpay" source={r.source} valid={valid}
        onStatus={(s) => { onStatus(s); setKeySecret(''); setWebhookSecret(''); }}
        body={() => ({ keyId: keyId.trim(), keySecret, webhookSecret })} />
    </Section>
  );
}

/* ── Panel ────────────────────────────────────────────────────────────────── */

export function IntegrationsPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<'ai' | 'whatsapp' | 'razorpay' | null>('ai');
  // Remount sections after a save/disconnect so their forms reflect what was stored.
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/v1/settings/integrations');
      if (!res.ok) { setError(await responseError(res, 'Could not load integrations')); return; }
      setStatus((await res.json()).data as Status);
    } catch {
      setError(NETWORK_ERROR);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const onStatus = (s: Status) => { setStatus(s); setVersion((v) => v + 1); };
  const toggle = (k: 'ai' | 'whatsapp' | 'razorpay') => setOpen((o) => (o === k ? null : k));

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!status) {
    return <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <AiSection key={`ai-${version}`} status={status} onStatus={onStatus} open={open === 'ai'} onToggle={() => toggle('ai')} />
      <WhatsAppSection key={`wa-${version}`} status={status} onStatus={onStatus} open={open === 'whatsapp'} onToggle={() => toggle('whatsapp')} />
      <RazorpaySection key={`rz-${version}`} status={status} onStatus={onStatus} open={open === 'razorpay'} onToggle={() => toggle('razorpay')} />
      <div className="flex items-center gap-4 rounded-2xl border px-5 py-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Tally</span>
          <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>No connection needed — export Tally XML from Finance → Payments and import it in Tally.</span>
        </span>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>Manual export</span>
      </div>
    </div>
  );
}
