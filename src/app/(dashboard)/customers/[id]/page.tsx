'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Tag, User, Calendar, Trash2, Save, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Customer, CustomerSource, CustomerStage } from '@/types/customers';

const STAGES: { value: CustomerStage; label: string }[] = [
  { value: 'lead',        label: 'Lead'        },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'client',      label: 'Client'      },
  { value: 'past_client', label: 'Past client' },
];
const SOURCES: { value: CustomerSource; label: string }[] = [
  { value: 'referral',  label: 'Referral'  },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp',  label: 'WhatsApp'  },
  { value: 'website',   label: 'Website'   },
  { value: 'walk_in',   label: 'Walk-in'   },
  { value: 'imported',  label: 'Imported'  },
  { value: 'other',     label: 'Other'     },
];

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  // draft = edit buffer for the left properties panel
  const [draft, setDraft]       = useState<Partial<Customer>>({});
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveErr] = useState<string | null>(null);

  // notes are edited independently on the right pane
  const [notesDraft, setNotesDraft]   = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesErr]     = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/customers/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((res) => {
        if (!res) return;
        setCustomer(res.data);
        setDraft({});
        setNotesDraft(res.data?.notes ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const dirty = Object.keys(draft).length > 0;

  function set<K extends keyof Customer>(key: K, value: Customer[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function saveProps() {
    if (!dirty) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch(`/api/v1/customers/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Save failed (${res.status})`);
      setCustomer(body.data as Customer);
      setDraft({});
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!customer || notesDraft === (customer.notes ?? '')) return;
    setNotesSaving(true);
    setNotesErr(null);
    try {
      const res = await fetch(`/api/v1/customers/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Save failed (${res.status})`);
      setCustomer(body.data as Customer);
    } catch (e) {
      setNotesErr(e instanceof Error ? e.message : 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    const res = await fetch(`/api/v1/customers/${id}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/customers';
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading customer…</div>;
  }
  if (notFound || !customer) {
    return (
      <div className="p-8">
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <p className="mt-4 text-sm text-red-600">Customer not found.</p>
      </div>
    );
  }

  const displayed: Customer = { ...customer, ...(draft as Customer) };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-slate-950">
      {/* ─── Header strip ────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
            aria-label="Back to customers"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BigAvatar name={displayed.fullName} />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {displayed.fullName}
            </h1>
            <p className="text-xs text-slate-500">
              {displayed.company ?? 'No company'} · Created{' '}
              {new Date(customer.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {displayed.phone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${displayed.phone}`}><Phone className="h-4 w-4" /> Call</a>
            </Button>
          )}
          {displayed.email && (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${displayed.email}`}><Mail className="h-4 w-4" /> Email</a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={remove} className="text-red-600 hover:bg-red-50 hover:text-red-700">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </header>

      {/* ─── Two-column body ─────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-6 overflow-auto p-6">
        {/* Left: properties */}
        <aside className="w-[360px] flex-shrink-0">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                About this customer
              </h2>
              {dirty && (
                <Button size="sm" onClick={saveProps} disabled={saving} className="h-7 gap-1">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <Field label="Full name" icon={User}>
                <Input value={displayed.fullName} onChange={(e) => set('fullName', e.target.value)} />
              </Field>

              <Field label="Phone" icon={Phone}>
                <Input value={displayed.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>

              <Field label="Email" icon={Mail}>
                <Input
                  type="email"
                  value={displayed.email ?? ''}
                  onChange={(e) => set('email', (e.target.value || null) as Customer['email'])}
                  placeholder="—"
                />
              </Field>

              <Field label="Company" icon={Building2}>
                <Input
                  value={displayed.company ?? ''}
                  onChange={(e) => set('company', (e.target.value || null) as Customer['company'])}
                  placeholder="—"
                />
              </Field>

              <Field label="City" icon={MapPin}>
                <Input
                  value={displayed.city ?? ''}
                  onChange={(e) => set('city', (e.target.value || null) as Customer['city'])}
                  placeholder="—"
                />
              </Field>

              <Field label="Address" icon={MapPin}>
                <Textarea
                  rows={2}
                  value={displayed.address ?? ''}
                  onChange={(e) => set('address', (e.target.value || null) as Customer['address'])}
                  placeholder="—"
                />
              </Field>

              <Field label="Stage" icon={Tag}>
                <Select value={displayed.stage} onValueChange={(v) => set('stage', v as CustomerStage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Source" icon={Tag}>
                <Select value={displayed.source} onValueChange={(v) => set('source', v as CustomerSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Created" icon={Calendar}>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {new Date(customer.createdAt).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </Field>
            </div>

            {saveError && <p className="mt-3 text-xs text-red-600">{saveError}</p>}
          </div>
        </aside>

        {/* Right: activity + notes */}
        <section className="flex-1 min-w-0 space-y-6">
          {/* Notes card */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Notes</h2>
              {notesDraft !== (customer.notes ?? '') && (
                <Button size="sm" onClick={saveNotes} disabled={notesSaving} className="h-7 gap-1">
                  {notesSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save notes
                </Button>
              )}
            </div>
            <Textarea
              rows={6}
              placeholder="Log anything you want to remember about this customer — call summaries, preferences, follow-up plans…"
              value={notesDraft}
              onChange={(e) => { setNotesDraft(e.target.value); setNotesErr(null); }}
            />
            {notesError && (
              <p className="mt-1.5 text-xs text-red-600">{notesError}</p>
            )}
          </div>

          {/* Activity placeholder — timeline wired in a later pass */}
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950">
            <p className="text-sm text-slate-500">
              Activity timeline (calls, WhatsApp, meetings) will appear here once activities are wired to customers.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label, icon: Icon, children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      {children}
    </div>
  );
}

function BigAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}
