'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, User, Save, Loader2, Trash2, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmployeeAvatar } from '@/components/employees/Avatar';
import type { Employee, EmploymentType, UserRole } from '@/types/employees';

type TabKey = 'personal' | 'job' | 'contact';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'designer',   label: 'Designer'   },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'owner',      label: 'Owner'      },
];
const TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'full_time',  label: 'Full-time'  },
  { value: 'part_time',  label: 'Part-time'  },
  { value: 'contract',   label: 'Contract'   },
  { value: 'intern',     label: 'Intern'     },
  { value: 'consultant', label: 'Consultant' },
];

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [emp, setEmp]           = useState<Employee | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab]           = useState<TabKey>('personal');

  const [draft, setDraft]       = useState<Partial<Employee>>({});
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/employees/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((res) => {
        if (!res) return;
        setEmp(res.data);
        setDraft({});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const dirty = Object.keys(draft).length > 0;

  function set<K extends keyof Employee>(key: K, value: Employee[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch(`/api/v1/employees/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Save failed (${res.status})`);
      setEmp(body.data as Employee);
      setDraft({});
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Remove this employee? This cannot be undone.')) return;
    const res = await fetch(`/api/v1/employees/${id}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/employees';
  }

  if (loading) return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading…</div>;
  if (notFound || !emp) {
    return (
      <div className="p-8">
        <Link href="/employees" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-heading)]">
          <ArrowLeft className="h-4 w-4" /> Back to people
        </Link>
        <p className="mt-4 text-sm text-red-600">Employee not found.</p>
      </div>
    );
  }

  const displayed: Employee = { ...emp, ...(draft as Employee) };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Back link */}
      <div className="border-b border-[var(--border-subtle)] px-6 py-3 ">
        <Link href="/employees" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-emerald-600 ">
          <ArrowLeft className="h-4 w-4" /> Back to people
        </Link>
      </div>

      {/* Hero */}
      <header className="border-b border-[var(--border-subtle)] bg-gradient-to-r from-emerald-50 via-emerald-50/40 to-transparent px-6 py-6 dark:from-emerald-950/40 dark:via-emerald-950/10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <EmployeeAvatar name={displayed.fullName} photoUrl={displayed.photoUrl} size={92} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>
                {displayed.fullName}
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {displayed.jobTitle ?? '—'}{displayed.department ? ' · ' + displayed.department : ''}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)] ">
                {displayed.email && (
                  <a href={`mailto:${displayed.email}`} className="inline-flex items-center gap-1.5 hover:text-emerald-700">
                    <Mail className="h-3.5 w-3.5" /> {displayed.email}
                  </a>
                )}
                {displayed.phone && (
                  <a href={`tel:${displayed.phone}`} className="inline-flex items-center gap-1.5 hover:text-emerald-700">
                    <Phone className="h-3.5 w-3.5" /> {displayed.phone}
                  </a>
                )}
                {displayed.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {displayed.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={remove} className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700">
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="mt-6 flex items-center gap-1 text-sm">
          {(['personal', 'job', 'contact'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                'relative rounded-md px-3 py-1.5 font-medium capitalize transition-colors ' +
                (tab === k
                  ? 'text-[var(--accent-base)] dark:text-[#A98EFF]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] ')
              }
            >
              {k === 'personal' ? 'Personal' : k === 'job' ? 'Job' : 'Contact'}
              {tab === k && (
                <span className="absolute -bottom-[calc(1.5rem_+_1px)] left-1 right-1 h-0.5 rounded bg-[var(--accent-base)]" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {saveError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {saveError}
            </div>
          )}

          {tab === 'personal' && (
            <Section title="Personal information">
              <Field label="Full name" icon={User}>
                <Input value={displayed.fullName} onChange={(e) => set('fullName', e.target.value)} />
              </Field>
              <Field label="Date of birth" icon={Calendar}>
                <Input type="date" value={displayed.dob ?? ''} onChange={(e) => set('dob', (e.target.value || null) as Employee['dob'])} />
              </Field>
              <Field label="Photo URL" icon={User}>
                <Input value={displayed.photoUrl ?? ''} onChange={(e) => set('photoUrl', (e.target.value || null) as Employee['photoUrl'])} placeholder="https://…" />
              </Field>
              <Field label="Location" icon={MapPin}>
                <Input value={displayed.location ?? ''} onChange={(e) => set('location', (e.target.value || null) as Employee['location'])} />
              </Field>
            </Section>
          )}

          {tab === 'job' && (
            <Section title="Job details">
              <Field label="Job title" icon={Briefcase}>
                <Input value={displayed.jobTitle ?? ''} onChange={(e) => set('jobTitle', (e.target.value || null) as Employee['jobTitle'])} />
              </Field>
              <Field label="Department" icon={Building2}>
                <Input value={displayed.department ?? ''} onChange={(e) => set('department', (e.target.value || null) as Employee['department'])} />
              </Field>
              <Field label="Role (system)" icon={User}>
                <Select value={displayed.role} onValueChange={(v) => set('role', v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Employment type" icon={Briefcase}>
                <Select
                  value={displayed.employmentType ?? ''}
                  onValueChange={(v) => set('employmentType', v as EmploymentType)}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Hire date" icon={Calendar}>
                <Input type="date" value={displayed.hireDate ?? ''} onChange={(e) => set('hireDate', (e.target.value || null) as Employee['hireDate'])} />
              </Field>
              <Field label="Status" icon={User}>
                <Select
                  value={displayed.status}
                  onValueChange={(v) => set('status', v as Employee['status'])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On leave</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Section>
          )}

          {tab === 'contact' && (
            <>
              <Section title="Work contact">
                <Field label="Work email" icon={Mail}>
                  <Input type="email" value={displayed.email ?? ''} onChange={(e) => set('email', (e.target.value || null) as Employee['email'])} />
                </Field>
                <Field label="Phone" icon={Phone}>
                  <Input value={displayed.phone ?? ''} onChange={(e) => set('phone', (e.target.value || null) as Employee['phone'])} />
                </Field>
              </Section>
              <Section title="Emergency contact">
                <Field label="Name" icon={User}>
                  <Input
                    value={displayed.emergencyContact?.name ?? ''}
                    onChange={(e) => set('emergencyContact', { ...(displayed.emergencyContact ?? {}), name: e.target.value })}
                  />
                </Field>
                <Field label="Relation" icon={User}>
                  <Input
                    value={displayed.emergencyContact?.relation ?? ''}
                    onChange={(e) => set('emergencyContact', { ...(displayed.emergencyContact ?? {}), relation: e.target.value })}
                  />
                </Field>
                <Field label="Phone" icon={Phone}>
                  <Input
                    value={displayed.emergencyContact?.phone ?? ''}
                    onChange={(e) => set('emergencyContact', { ...(displayed.emergencyContact ?? {}), phone: e.target.value })}
                  />
                </Field>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm ">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function Field({
  label, icon: Icon, children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      {children}
    </div>
  );
}
