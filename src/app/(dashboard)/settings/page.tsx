'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2, Users, Bell, FileText, Shield, Plug, Download,
  Save, Eye, EyeOff, Check, ChevronRight, Loader2, KeyRound, Search, MailPlus, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmployeeAvatar } from '@/components/employees/Avatar';
import type { Employee, UserRole } from '@/types/employees';

/* ── Types ────────────────────────────────────────────────────────────────── */
type TabKey =
  | 'profile'
  | 'users'
  | 'notifications'
  | 'invoice'
  | 'security'
  | 'integrations'
  | 'export';

interface TabCfg {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}

const TABS: TabCfg[] = [
  { key: 'profile',       label: 'Business Profile',    icon: Building2 },
  { key: 'users',         label: 'Users & Roles',        icon: Users     },
  { key: 'notifications', label: 'Notifications',        icon: Bell      },
  { key: 'invoice',       label: 'Quotation & Invoice',  icon: FileText  },
  { key: 'security',      label: 'Security',             icon: Shield    },
  { key: 'integrations',  label: 'Integrations',         icon: Plug      },
  { key: 'export',        label: 'Data & Export',        icon: Download  },
];

/* ── UI helpers ───────────────────────────────────────────────────────────── */
function SaveToast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg z-50 animate-fade-in"
      style={{ background: 'var(--text-primary)', color: 'var(--surface-card)' }}>
      <Check className="h-4 w-4 text-green-400" />
      <span className="text-sm font-medium">Settings saved!</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text-heading)' }}>{children}</h3>;
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="sm:w-48 flex-shrink-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? 'var(--text-primary)' : 'var(--border-strong)' }}
        onClick={() => onChange(!checked)}>
        <div className="absolute top-1 w-4 h-4 bg-[var(--surface-card)] rounded-full transition-all"
          style={{ left: checked ? 22 : 4 }} />
      </div>
      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </label>
  );
}

/* ── Profile tab ──────────────────────────────────────────────────────────── */
function ProfileTab({ onSave }: { onSave: () => void }) {
  const [studio, setStudio]         = useState('');
  const [tagline, setTagline]       = useState('');
  const [phone, setPhone]           = useState('');
  const [email, setEmail]           = useState('');
  const [address, setAddress]       = useState('');
  const [gst, setGst]               = useState('');
  const [pan, setPan]               = useState('');
  const [logoUrl, setLogoUrl]       = useState('');
  const [bankName, setBankName]     = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIFSC, setBankIFSC]     = useState('');
  const [bankUPI, setBankUPI]       = useState('');
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/settings/profile')
      .then((r) => r.json())
      .then((res) => {
        if (res?.data) {
          setStudio(res.data.studioName   ?? '');
          setTagline(res.data.tagline     ?? '');
          setPhone(res.data.phone         ?? '');
          setEmail(res.data.email         ?? '');
          setAddress(res.data.address     ?? '');
          setGst(res.data.gstin           ?? '');
          setPan(res.data.pan             ?? '');
          setLogoUrl(res.data.logoUrl     ?? '');
          setBankName(res.data.bankName   ?? '');
          setBankAccount(res.data.bankAccount ?? '');
          setBankIFSC(res.data.bankIFSC   ?? '');
          setBankUPI(res.data.bankUPI     ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/settings/logo', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({})) as { data?: { logoUrl?: string }; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Upload failed');
      if (body.data?.logoUrl) setLogoUrl(body.data.logoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/settings/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          studioName:  studio.trim()      || undefined,
          tagline:     tagline.trim()     || null,
          phone:       phone.trim()       || null,
          email:       email.trim()       || null,
          address:     address.trim()     || null,
          gstin:       gst.trim()         || null,
          pan:         pan.trim()         || null,
          logoUrl:     logoUrl.trim()     || null,
          bankName:    bankName.trim()    || null,
          bankAccount: bankAccount.trim() || null,
          bankIFSC:    bankIFSC.trim()    || null,
          bankUPI:     bankUPI.trim()     || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed to save');
      onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Loading profile…</div>;

  return (
    <div>
      <SectionTitle>Business Profile</SectionTitle>

      <FormRow label="Studio Logo" hint="PNG, JPEG or SVG — max 2 MB. Appears on all PDFs.">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Studio logo" className="h-14 w-14 rounded-lg object-contain border border-[var(--border-subtle)]" />
          ) : (
            <div className="h-14 w-14 rounded-lg border border-dashed border-[var(--border-strong)] flex items-center justify-center">
              <Building2 className="h-6 w-6" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          )}
          <div>
            <label className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading…' : 'Upload Logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
            </label>
            {logoUrl && (
              <button type="button" onClick={() => setLogoUrl('')} className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}>
                Remove
              </button>
            )}
          </div>
        </div>
      </FormRow>

      <FormRow label="Studio Name">
        <input value={studio} onChange={e => setStudio(e.target.value)} className="studio-input w-full text-sm" />
      </FormRow>
      <FormRow label="Tagline" hint="Shown on invoices and client portal">
        <input value={tagline} onChange={e => setTagline(e.target.value)} className="studio-input w-full text-sm" />
      </FormRow>
      <FormRow label="Phone">
        <input value={phone} onChange={e => setPhone(e.target.value)} className="studio-input w-full text-sm" />
      </FormRow>
      <FormRow label="Email">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="studio-input w-full text-sm" />
      </FormRow>
      <FormRow label="Office Address">
        <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="studio-input w-full text-sm resize-none" />
      </FormRow>
      <FormRow label="GST Number" hint="e.g. 33AABCS1429B1Z5">
        <input value={gst} onChange={e => setGst(e.target.value)} className="studio-input w-full text-sm" placeholder="Optional" />
      </FormRow>
      <FormRow label="PAN">
        <input value={pan} onChange={e => setPan(e.target.value)} className="studio-input w-full text-sm" placeholder="Optional" />
      </FormRow>

      <p className="text-xs font-bold uppercase tracking-wider mt-6 mb-1" style={{ color: 'var(--text-tertiary)' }}>Bank Details (printed on invoices)</p>
      <FormRow label="Bank Name">
        <input value={bankName} onChange={e => setBankName(e.target.value)} className="studio-input w-full text-sm" placeholder="e.g. HDFC Bank" />
      </FormRow>
      <FormRow label="Account Number">
        <input value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="studio-input w-full text-sm" />
      </FormRow>
      <FormRow label="IFSC Code">
        <input value={bankIFSC} onChange={e => setBankIFSC(e.target.value)} className="studio-input w-full text-sm" placeholder="e.g. HDFC0001234" />
      </FormRow>
      <FormRow label="UPI ID" hint="e.g. studio@upi">
        <input value={bankUPI} onChange={e => setBankUPI(e.target.value)} className="studio-input w-full text-sm" placeholder="Optional" />
      </FormRow>

      {error && <p className="pt-2 text-xs text-red-600">{error}</p>}
      <div className="pt-4">
        <button type="button" onClick={submit} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

/* ── Users tab (roles & access, inline) ──────────────────────────────────── */
const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Owner', designer: 'Designer', supervisor: 'Supervisor', accountant: 'Accountant',
};
const ROLE_COLORS: Record<UserRole, string> = {
  owner:      'bg-[var(--surface-card)] text-white',
  designer:   'bg-emerald-600 text-white',
  supervisor: 'bg-amber-500 text-white',
  accountant: 'bg-violet-600 text-white',
};

function UsersTab() {
  const [rows, setRows]           = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [drafts, setDrafts]       = useState<Record<string, UserRole>>({});
  const [savingId, setSavingId]   = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/employees')
      .then((r) => r.json())
      .then(({ data }: { data: Employee[] | null }) => {
        setRows(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const hasLogin = (r: Employee) => Boolean(r.hasLogin);

  async function saveRole(row: Employee) {
    const newRole = drafts[row.id];
    if (!newRole || newRole === row.role) return;
    setSavingId(row.id);
    setSaveError(null);
    try {
      const res = await fetch(`/api/v1/employees/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : `Save failed (${res.status})`);
      setRows((prev) => prev.map((r) => r.id === row.id ? body.data : r));
      setDrafts(({ [row.id]: _, ...rest }) => rest);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle>Users &amp; Roles</SectionTitle>
        <div className="relative w-full max-w-xs">
          <Search className="studio-search-icon" />
          <Input
            placeholder="Search name, email, role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-[48px]"
          />
        </div>
      </div>

      {saveError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {saveError}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] ">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-secondary)] ">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Member</th>
              <th className="px-3 py-3 text-left font-semibold">Email</th>
              <th className="px-3 py-3 text-left font-semibold">Access</th>
              <th className="px-3 py-3 text-left font-semibold">Role</th>
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center text-[var(--text-secondary)]">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-[var(--text-secondary)]">
                {search ? 'No members match your search.' : 'No members yet.'}
              </td></tr>
            ) : filtered.map((r) => {
              const draftRole = drafts[r.id];
              const dirty = draftRole && draftRole !== r.role;
              return (
                <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-b-0 ">
                  <td className="px-4 py-2.5">
                    <Link href={`/employees/${r.id}`} className="flex items-center gap-3 font-medium hover:text-emerald-600" style={{ color: 'var(--text-heading)' }}>
                      <EmployeeAvatar name={r.fullName} photoUrl={r.photoUrl} size={32} />
                      {r.fullName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)] ">{r.email ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {hasLogin(r) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <KeyRound className="h-3 w-3" /> Has login
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] ">
                        No login
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      value={draftRole ?? r.role}
                      onValueChange={(v) => setDrafts((d) => ({ ...d, [r.id]: v as UserRole }))}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue>
                          <span className={'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ' + ROLE_COLORS[(draftRole ?? r.role) as UserRole]}>
                            {ROLE_LABEL[(draftRole ?? r.role) as UserRole]}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABEL) as UserRole[]).map((k) => (
                          <SelectItem key={k} value={k}>{ROLE_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {dirty && (
                      <Button
                        size="sm"
                        onClick={() => saveRole(r)}
                        disabled={savingId === r.id}
                        className="h-7 gap-1"
                      >
                        {savingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Save
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
            </div>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-[var(--border-strong)] p-3 text-center text-xs text-[var(--text-secondary)] ">
        <MailPlus className="mx-auto mb-1 h-4 w-4 text-[var(--text-tertiary)]" />
        To grant login access to a new member, add them in{' '}
        <Link href="/employees" className="font-medium text-emerald-600 underline">People</Link>{' '}
        first.
      </div>
    </div>
  );
}

/* ── Notifications tab ────────────────────────────────────────────────────── */
function NotificationsTab({ onSave }: { onSave: () => void }) {
  const [waLeadAlert, setWaLeadAlert]     = useState(true);
  const [waPayment, setWaPayment]         = useState(true);
  const [waMilestone, setWaMilestone]     = useState(true);
  const [emailDigest, setEmailDigest]     = useState(false);
  const [emailInvoice, setEmailInvoice]   = useState(true);
  const [overdueAlert, setOverdueAlert]   = useState(true);
  const [mondayBrief, setMondayBrief]     = useState(true);
  const [followUpNudge, setFollowUpNudge] = useState(true);

  return (
    <div>
      <SectionTitle>Notification Preferences</SectionTitle>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>WhatsApp</p>
        <div className="space-y-3">
          <Toggle checked={waLeadAlert}   onChange={setWaLeadAlert}   label="New lead received alert" />
          <Toggle checked={waPayment}     onChange={setWaPayment}     label="Payment captured notification" />
          <Toggle checked={waMilestone}   onChange={setWaMilestone}   label="Milestone due reminder to client" />
          <Toggle checked={followUpNudge} onChange={setFollowUpNudge} label="Follow-up nudge sequence" />
        </div>
      </div>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Email</p>
        <div className="space-y-3">
          <Toggle checked={emailDigest}  onChange={setEmailDigest}  label="Weekly digest (every Monday)" />
          <Toggle checked={emailInvoice} onChange={setEmailInvoice} label="Invoice sent confirmation" />
        </div>
      </div>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Alerts</p>
        <div className="space-y-3">
          <Toggle checked={overdueAlert} onChange={setOverdueAlert} label="Overdue payment alert (Day 3, 7, 10)" />
          <Toggle checked={mondayBrief}  onChange={setMondayBrief}  label="Monday AI project brief" />
        </div>
      </div>
      <button type="button" onClick={onSave} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
        <Save className="h-4 w-4" />Save Preferences
      </button>
    </div>
  );
}

/* ── Invoice tab ──────────────────────────────────────────────────────────── */
function InvoiceTab({ onSave }: { onSave: () => void }) {
  const [quotePrefix,   setQuotePrefix]   = useState('QUO-');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [poPrefix,      setPoPrefix]      = useState('PO-');
  const [validityDays,  setValidityDays]  = useState('30');
  const [quotationTerms, setQuotationTerms] = useState('');
  const [invoiceTerms,   setInvoiceTerms]   = useState('');
  const [poTerms,        setPoTerms]        = useState('');
  const [eInvoice,       setEInvoice]       = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/settings/profile')
      .then((r) => r.json())
      .then((res) => {
        if (res?.data) {
          setQuotePrefix(res.data.quoteNumberPrefix     ?? 'QUO-');
          setInvoicePrefix(res.data.invoiceNumberPrefix ?? 'INV-');
          setPoPrefix(res.data.poNumberPrefix           ?? 'PO-');
          setValidityDays(String(res.data.quoteValidityDays ?? 30));
          setQuotationTerms(res.data.quotationTerms     ?? '');
          setInvoiceTerms(res.data.invoiceTerms         ?? '');
          setPoTerms(res.data.poTerms                   ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/settings/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          quoteNumberPrefix:   quotePrefix.trim()   || null,
          invoiceNumberPrefix: invoicePrefix.trim() || null,
          poNumberPrefix:      poPrefix.trim()      || null,
          quoteValidityDays:   parseInt(validityDays, 10) || 30,
          quotationTerms:      quotationTerms.trim() || null,
          invoiceTerms:        invoiceTerms.trim()   || null,
          poTerms:             poTerms.trim()        || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed to save');
      onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</div>;

  return (
    <div>
      <SectionTitle>Quotation & Invoice Settings</SectionTitle>

      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Numbering</p>
      <FormRow label="Quote Prefix" hint="e.g. QUO- → QUO-A1B2C3">
        <input value={quotePrefix} onChange={e => setQuotePrefix(e.target.value)} className="studio-input w-32 text-sm" placeholder="QUO-" />
      </FormRow>
      <FormRow label="Invoice Prefix">
        <input value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)} className="studio-input w-32 text-sm" placeholder="INV-" />
      </FormRow>
      <FormRow label="PO Prefix">
        <input value={poPrefix} onChange={e => setPoPrefix(e.target.value)} className="studio-input w-32 text-sm" placeholder="PO-" />
      </FormRow>
      <FormRow label="Quote Validity" hint="Days after issue date">
        <div className="flex items-center gap-2">
          <input type="number" min="1" max="365" value={validityDays} onChange={e => setValidityDays(e.target.value)} className="studio-input w-24 text-sm" />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>days</span>
        </div>
      </FormRow>

      <p className="text-xs font-bold uppercase tracking-wider mt-6 mb-1" style={{ color: 'var(--text-tertiary)' }}>Terms &amp; Conditions (printed on PDFs)</p>
      <FormRow label="Quotation Terms">
        <textarea value={quotationTerms} onChange={e => setQuotationTerms(e.target.value)} rows={3}
          placeholder="e.g. Prices valid for 30 days. 50% advance on confirmation…"
          className="studio-input w-full text-sm resize-none" />
      </FormRow>
      <FormRow label="Invoice Terms">
        <textarea value={invoiceTerms} onChange={e => setInvoiceTerms(e.target.value)} rows={3}
          placeholder="e.g. Payment due within 7 days of invoice date…"
          className="studio-input w-full text-sm resize-none" />
      </FormRow>
      <FormRow label="PO Terms">
        <textarea value={poTerms} onChange={e => setPoTerms(e.target.value)} rows={3}
          placeholder="e.g. Goods to be delivered by agreed date. Quality conformance required…"
          className="studio-input w-full text-sm resize-none" />
      </FormRow>

      <p className="text-xs font-bold uppercase tracking-wider mt-6 mb-1" style={{ color: 'var(--text-tertiary)' }}>GST &amp; Compliance</p>
      <FormRow label="e-Invoice (IRN/QR)">
        <Toggle checked={eInvoice} onChange={setEInvoice} label="Enable e-Invoicing via GSP API" />
      </FormRow>

      {error && <p className="pt-2 text-xs text-red-600">{error}</p>}
      <div className="pt-4">
        <button type="button" onClick={submit} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Invoice Settings'}
        </button>
      </div>
    </div>
  );
}

/* ── Security tab ─────────────────────────────────────────────────────────── */
function SecurityTab({ onSave }: { onSave: () => void }) {
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [twoFa, setTwoFa]     = useState(false);

  return (
    <div>
      <SectionTitle>Security Settings</SectionTitle>
      <FormRow label="Change Password">
        <div className="space-y-2 max-w-sm">
          <input type={showPw ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)}
            placeholder="Current password" className="studio-input w-full text-sm" />
          <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
            placeholder="New password (min 8 chars)" className="studio-input w-full text-sm" />
          <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Confirm new password" className="studio-input w-full text-sm" />
          <button type="button" onClick={() => setShowPw(s => !s)}
            className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-primary)' }}>
            {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPw ? 'Hide' : 'Show'} passwords
          </button>
        </div>
      </FormRow>
      <FormRow label="Two-Factor Auth" hint="Adds a TOTP layer via authenticator app">
        <Toggle checked={twoFa} onChange={setTwoFa} label="Enable 2FA" />
      </FormRow>
      <FormRow label="Active Sessions">
        <div className="space-y-2 max-w-sm">
          {[
            { device: 'Chrome — Windows 11', location: 'Coimbatore, India', current: true },
            { device: 'Safari — iPhone',     location: 'Coimbatore, India', current: false },
          ].map(s => (
            <div key={s.device} className="flex items-center justify-between p-3 rounded-xl"
              style={{ border: '1px solid var(--border-subtle)', background: s.current ? '#FAF9F6' : 'var(--surface-card)' }}>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{s.device}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{s.location}</p>
              </div>
              {s.current
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>Current</span>
                : <button type="button" className="text-xs" style={{ color: 'var(--danger)' }}>Revoke</button>
              }
            </div>
          ))}
        </div>
      </FormRow>
      <div className="pt-4">
        <button type="button" onClick={onSave} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
          <Save className="h-4 w-4" />Save Security Settings
        </button>
      </div>
    </div>
  );
}

/* ── Integrations tab ─────────────────────────────────────────────────────── */
function IntegrationsTab() {
  const integrations = [
    { name: 'WhatsApp Cloud API',  desc: 'Meta WhatsApp — send templates, receive messages', status: 'connected' },
    { name: 'Razorpay',           desc: 'Payment links, webhooks and reconciliation',       status: 'connected' },
    { name: 'Groq AI',            desc: 'LLM — message parsing, Monday brief, BOQ draft',  status: 'connected' },
    { name: 'Gemini Flash',       desc: 'Vision AI — site photo analysis',                 status: 'connected' },
    { name: 'Tally Prime',        desc: 'Export vouchers to Tally XML format',             status: 'available' },
    { name: 'e-Invoice GSP',      desc: 'IRN generation and QR code for B2B invoices',    status: 'available' },
  ];

  return (
    <div>
      <SectionTitle>Integrations</SectionTitle>
      <div className="space-y-3">
        {integrations.map(i => (
          <div key={i.name} className="flex items-center justify-between px-4 py-4 rounded-xl"
            style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: i.status === 'connected' ? 'rgba(36,33,30,0.10)' : 'rgba(107,107,107,0.08)' }}>
                <Plug className="h-5 w-5" style={{ color: i.status === 'connected' ? 'var(--text-primary)' : 'var(--text-tertiary)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{i.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{i.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: i.status === 'connected' ? 'var(--success-soft)' : 'var(--surface-muted)', color: i.status === 'connected' ? 'var(--success-text)' : 'var(--text-secondary)' }}>
                {i.status === 'connected' ? 'Live' : 'Available'}
              </span>
              {i.status === 'available' && (
                <button type="button" className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1">
                  Connect <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Export tab ───────────────────────────────────────────────────────────── */
function ExportTab() {
  const exports: { kind: string; label: string; desc: string; ext: 'csv' | 'json' }[] = [
    { kind: 'leads',     label: 'Leads (CSV)',              desc: 'All leads with contact info and pipeline stage',            ext: 'csv'  },
    { kind: 'projects',  label: 'Projects (CSV)',           desc: 'Project list with contract values and lifecycle stage',     ext: 'csv'  },
    { kind: 'quotes',    label: 'Quotations (CSV)',         desc: 'All quotes with totals and margin breakdown',               ext: 'csv'  },
    { kind: 'payments',  label: 'Payments (CSV)',           desc: 'Payment history for accounting reconciliation',             ext: 'csv'  },
    { kind: 'materials', label: 'Materials Catalogue (CSV)', desc: 'Full material list with cost, sell price and vendor',      ext: 'csv'  },
    { kind: 'backup',    label: 'Full Data Backup (JSON)',  desc: 'Complete workspace export — leads, projects, quotes, more', ext: 'json' },
  ];

  const [downloadingKind, setDownloadingKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: string, ext: 'csv' | 'json') {
    setDownloadingKind(kind);
    setError(null);
    try {
      const res = await fetch(`/api/v1/exports/${kind}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.error === 'string' ? body.error : `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kind}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setDownloadingKind(null);
    }
  }

  return (
    <div>
      <SectionTitle>Data Export & Backup</SectionTitle>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        Your data belongs to you. Export anytime in standard formats.
      </p>
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-3">
        {exports.map(e => {
          const busy = downloadingKind === e.kind;
          return (
            <div key={e.kind} className="flex items-center justify-between px-4 py-4 rounded-xl"
              style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{e.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{e.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => download(e.kind, e.ext)}
                disabled={busy}
                className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm flex-shrink-0 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {busy ? 'Preparing…' : 'Export'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-6 p-4 rounded-xl" style={{ background: 'var(--warning-soft)', border: '1px solid #FCD34D' }}>
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--warning-text)' }}>Data Retention</p>
        <p className="text-xs" style={{ color: '#A16207' }}>
          Data is stored securely in Supabase (India region). Archived leads are retained for 7 years as per
          GST record-keeping requirements. GDPR erasure requests can be submitted via this settings page.
        </p>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [showToast, setShowToast] = useState(false);

  function handleSave() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  }

  const PANEL: Record<TabKey, React.ReactNode> = {
    profile:       <ProfileTab       onSave={handleSave} />,
    users:         <UsersTab />,
    notifications: <NotificationsTab onSave={handleSave} />,
    invoice:       <InvoiceTab       onSave={handleSave} />,
    security:      <SecurityTab      onSave={handleSave} />,
    integrations:  <IntegrationsTab />,
    export:        <ExportTab />,
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Settings</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Manage your studio workspace</p>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* ── Sidebar nav ────────────────────────────────────────────── */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="premium-card p-2">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors mb-0.5"
                  style={{
                    background: isActive ? 'rgba(36,33,30,0.10)' : 'transparent',
                    borderLeft: isActive ? '3px solid #8F6F2E' : '3px solid transparent',
                  }}>
                  <Icon className="h-4 w-4 flex-shrink-0" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }} />
                  <span className="text-sm font-semibold truncate" style={{ color: isActive ? 'var(--text-heading)' : 'var(--text-secondary)' }}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content panel ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="premium-card p-6">{PANEL[activeTab]}</div>
        </div>
      </div>

      <SaveToast show={showToast} />
    </div>
  );
}
