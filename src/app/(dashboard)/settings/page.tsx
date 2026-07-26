'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2, Users, Bell, FileText, Shield, Plug, Download,
  Save, Eye, EyeOff, Check, ChevronRight, Loader2, KeyRound, Search, MailPlus,
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
      style={{ background: '#221F1B', color: '#FFFFFF' }}>
      <Check className="h-4 w-4 text-green-400" />
      <span className="text-sm font-medium">Settings saved!</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold mb-4" style={{ color: '#1C1916' }}>{children}</h3>;
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 py-4" style={{ borderBottom: '1px solid #F0EEE9' }}>
      <div className="sm:w-48 flex-shrink-0">
        <p className="text-sm font-semibold" style={{ color: '#221F1B' }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: '#A79E8E' }}>{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? '#24211E' : '#D1D5DB' }}
        onClick={() => onChange(!checked)}>
        <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
          style={{ left: checked ? 22 : 4 }} />
      </div>
      <span className="text-sm" style={{ color: '#221F1B' }}>{label}</span>
    </label>
  );
}

/* ── Profile tab ──────────────────────────────────────────────────────────── */
function ProfileTab({ onSave }: { onSave: () => void }) {
  const [studio, setStudio]     = useState('');
  const [tagline, setTagline]   = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [address, setAddress]   = useState('');
  const [gst, setGst]           = useState('');
  const [pan, setPan]           = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Load current tenant profile
  useEffect(() => {
    fetch('/api/v1/settings/profile')
      .then((r) => r.json())
      .then((res) => {
        if (res?.data) {
          setStudio(res.data.studioName ?? '');
          setTagline(res.data.tagline   ?? '');
          setPhone(res.data.phone       ?? '');
          setEmail(res.data.email       ?? '');
          setAddress(res.data.address   ?? '');
          setGst(res.data.gstin         ?? '');
          setPan(res.data.pan           ?? '');
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
          studioName: studio.trim() || undefined,
          tagline:    tagline.trim() || null,
          phone:      phone.trim()   || null,
          email:      email.trim()   || null,
          address:    address.trim() || null,
          gstin:      gst.trim()     || null,
          pan:        pan.trim()     || null,
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

  if (loading) return <div className="py-12 text-center text-sm" style={{ color: '#6B6459' }}>Loading profile…</div>;

  return (
    <div>
      <SectionTitle>Business Profile</SectionTitle>
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
  owner:      'bg-slate-900 text-white',
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

  const hasLogin = (r: Employee) => Boolean(r.supabaseUid);

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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, email, role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {saveError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {saveError}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-[var(--surface-card)] dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
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
              <tr><td colSpan={5} className="p-10 text-center text-slate-500">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-slate-500">
                {search ? 'No members match your search.' : 'No members yet.'}
              </td></tr>
            ) : filtered.map((r) => {
              const draftRole = drafts[r.id];
              const dirty = draftRole && draftRole !== r.role;
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-900">
                  <td className="px-4 py-2.5">
                    <Link href={`/employees/${r.id}`} className="flex items-center gap-3 font-medium hover:text-emerald-600" style={{ color: 'var(--text-heading)' }}>
                      <EmployeeAvatar name={r.fullName} photoUrl={r.photoUrl} size={32} />
                      {r.fullName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{r.email ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {hasLogin(r) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <KeyRound className="h-3 w-3" /> Has login
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
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
                        className="h-7 gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
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

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500 dark:border-slate-700">
        <MailPlus className="mx-auto mb-1 h-4 w-4 text-slate-400" />
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
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#A79E8E' }}>WhatsApp</p>
        <div className="space-y-3">
          <Toggle checked={waLeadAlert}   onChange={setWaLeadAlert}   label="New lead received alert" />
          <Toggle checked={waPayment}     onChange={setWaPayment}     label="Payment captured notification" />
          <Toggle checked={waMilestone}   onChange={setWaMilestone}   label="Milestone due reminder to client" />
          <Toggle checked={followUpNudge} onChange={setFollowUpNudge} label="Follow-up nudge sequence" />
        </div>
      </div>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#A79E8E' }}>Email</p>
        <div className="space-y-3">
          <Toggle checked={emailDigest}  onChange={setEmailDigest}  label="Weekly digest (every Monday)" />
          <Toggle checked={emailInvoice} onChange={setEmailInvoice} label="Invoice sent confirmation" />
        </div>
      </div>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#A79E8E' }}>Alerts</p>
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
  const [gstType, setGstType]   = useState<'works_contract' | 'goods'>('works_contract');
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc]         = useState('');
  const [terms, setTerms]       = useState('Payment due within 7 days of invoice date. GST applicable as per works contract rate.');
  const [prefix, setPrefix]     = useState('INV-');
  const [eInvoice, setEInvoice] = useState(false);

  return (
    <div>
      <SectionTitle>Quotation & Invoice Settings</SectionTitle>
      <FormRow label="GST Rate" hint="Works contract: 18% (CGST 9% + SGST 9%)">
        <div className="flex gap-3 flex-wrap">
          {(['works_contract', 'goods'] as const).map(t => (
            <button key={t} type="button" onClick={() => setGstType(t)}
              className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
              style={{ background: gstType === t ? '#24211E' : '#FFFFFF', color: gstType === t ? '#FFFFFF' : '#24211E', borderColor: '#24211E' }}>
              {t === 'works_contract' ? 'Works Contract (18%)' : 'Goods (per HSN)'}
            </button>
          ))}
        </div>
      </FormRow>
      <FormRow label="Invoice Prefix">
        <input value={prefix} onChange={e => setPrefix(e.target.value)} className="studio-input w-36 text-sm" placeholder="e.g. INV-" />
      </FormRow>
      <FormRow label="e-Invoice (IRN/QR)">
        <Toggle checked={eInvoice} onChange={setEInvoice} label="Enable e-Invoicing via GSP API" />
      </FormRow>
      <FormRow label="Bank Name">
        <input value={bankName} onChange={e => setBankName(e.target.value)} className="studio-input w-full text-sm" placeholder="e.g. HDFC Bank" />
      </FormRow>
      <FormRow label="Account Number">
        <input value={accountNo} onChange={e => setAccountNo(e.target.value)} className="studio-input w-full text-sm" />
      </FormRow>
      <FormRow label="IFSC Code">
        <input value={ifsc} onChange={e => setIfsc(e.target.value)} className="studio-input w-full text-sm" placeholder="e.g. HDFC0001234" />
      </FormRow>
      <FormRow label="Payment Terms">
        <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3} className="studio-input w-full text-sm resize-none" />
      </FormRow>
      <div className="pt-4">
        <button type="button" onClick={onSave} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
          <Save className="h-4 w-4" />Save Invoice Settings
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
            className="flex items-center gap-1.5 text-xs" style={{ color: '#24211E' }}>
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
              style={{ border: '1px solid #F0EEE9', background: s.current ? '#FAF9F6' : '#FFFFFF' }}>
              <div>
                <p className="text-xs font-medium" style={{ color: '#221F1B' }}>{s.device}</p>
                <p className="text-[10px]" style={{ color: '#A79E8E' }}>{s.location}</p>
              </div>
              {s.current
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F0FDF4', color: '#14532D' }}>Current</span>
                : <button type="button" className="text-xs" style={{ color: '#DC2626' }}>Revoke</button>
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
            style={{ border: '1px solid #F0EEE9', background: '#FFFFFF' }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: i.status === 'connected' ? 'rgba(36,33,30,0.10)' : 'rgba(107,107,107,0.08)' }}>
                <Plug className="h-5 w-5" style={{ color: i.status === 'connected' ? '#24211E' : '#9CA3AF' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#221F1B' }}>{i.name}</p>
                <p className="text-xs" style={{ color: '#6B6459' }}>{i.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: i.status === 'connected' ? '#F0FDF4' : '#F3F4F6', color: i.status === 'connected' ? '#14532D' : '#6B7280' }}>
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
      <p className="text-sm mb-5" style={{ color: '#6B6459' }}>
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
              style={{ border: '1px solid #F0EEE9', background: '#FFFFFF' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#221F1B' }}>{e.label}</p>
                <p className="text-xs" style={{ color: '#6B6459' }}>{e.desc}</p>
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
      <div className="mt-6 p-4 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FCD34D' }}>
        <p className="text-sm font-semibold mb-1" style={{ color: '#92400E' }}>Data Retention</p>
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
        <h2 className="text-2xl font-bold" style={{ color: '#1C1916' }}>Settings</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6B6459' }}>Manage your studio workspace</p>
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
                  <Icon className="h-4 w-4 flex-shrink-0" style={{ color: isActive ? '#24211E' : '#A79E8E' }} />
                  <span className="text-sm font-semibold truncate" style={{ color: isActive ? '#1C1916' : '#6B6459' }}>
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
