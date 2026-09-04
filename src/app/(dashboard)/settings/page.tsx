'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2, Users, Download, Loader2, Upload, Check,
  FileText, IndianRupee, Users2, ArrowUpRight, ChevronRight,
  Globe, MapPin, Phone, Mail, Briefcase, Pencil, X, Save,
} from 'lucide-react';
import { EmployeeAvatar } from '@/components/employees/Avatar';
import type { Employee } from '@/types/employees';

interface ProfileData {
  studioName: string;
  gstin: string | null;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  logoUrl: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerPhotoUrl: string | null;
}

const DEFAULTS: ProfileData = {
  ownerName: 'Mohammed Sheriff', ownerPhone: '+91 98943 31115',
  ownerEmail: 'mohasher11@gmail.com', ownerPhotoUrl: null,
  logoUrl: null, studioName: 'Konst Design',
  tagline: 'Your Experience Starts Here',
  phone: '+91 98943 31115', email: 'mohasher11@gmail.com',
  website: 'https://konstdesign.in',
  address: 'No.11 Barathi Nagar, Rathinapuri (PO)',
  city: 'Coimbatore', state: 'Tamil Nadu', pinCode: '641027', gstin: null,
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border overflow-hidden ${className}`}
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
    >
      {children}
    </div>
  );
}

function CardHead({
  icon: Icon, iconBg, iconColor, title, subtitle,
  editing, onEdit, onCancel, saving, onSave,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string; iconColor: string; title: string; subtitle: string;
  editing: boolean; onEdit: () => void; onCancel: () => void;
  saving?: boolean; onSave?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: iconBg }}>
          <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
        </span>
        <div>
          <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>{title}</p>
          <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {editing ? (
          <>
            <button type="button" onClick={onCancel}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <X className="h-3 w-3" /> Cancel
            </button>
            <button type="button" onClick={onSave} disabled={saving}
              className="btn-primary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] disabled:opacity-60">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <button type="button" onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: {
  label: string; value: string | null | undefined;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />}
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          {label}
        </span>
        <p className="text-sm truncate mt-0.5" style={{ color: value ? 'var(--text-heading)' : 'var(--text-tertiary)' }}>
          {value || '—'}
        </p>
      </div>
    </div>
  );
}

const inputCls = 'h-8 w-full rounded-lg border bg-[var(--surface-card)] px-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-base)]/30';
const inputStyle = { borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

async function downloadExport(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) { const b = await res.json().catch(() => ({})) as { error?: string }; throw new Error(b.error ?? `Export failed`); }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [loading, setLoading]           = useState(true);
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const logoInputRef                    = useRef<HTMLInputElement>(null);
  const [profile, setProfile]           = useState<ProfileData>(DEFAULTS);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingStudio, setEditingStudio]   = useState(false);

  // Profile drafts
  const [dName, setDName]   = useState('');
  const [dPhone, setDPhone] = useState('');
  const [dEmail, setDEmail] = useState('');

  // Studio drafts
  const [dLogo, setDLogo]         = useState('');
  const [dStName, setDStName]     = useState('');
  const [dTagline, setDTagline]   = useState('');
  const [dStPhone, setDStPhone]   = useState('');
  const [dStEmail, setDStEmail]   = useState('');
  const [dWebsite, setDWebsite]   = useState('');
  const [dAddress, setDAddress]   = useState('');
  const [dCity, setDCity]         = useState('');
  const [dState, setDState]       = useState('');
  const [dPin, setDPin]           = useState('');
  const [dGstin, setDGstin]       = useState('');

  const [savingP, setSavingP]     = useState(false);
  const [savedP, setSavedP]       = useState(false);
  const [savingS, setSavingS]     = useState(false);
  const [savedS, setSavedS]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyExport, setBusyExport] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/settings/profile')
      .then(r => r.json())
      .then(({ data }: { data: ProfileData | null }) => {
        const m: ProfileData = {
          ownerName:    data?.ownerName    || DEFAULTS.ownerName,
          ownerPhone:   data?.ownerPhone   || DEFAULTS.ownerPhone,
          ownerEmail:   data?.ownerEmail   || DEFAULTS.ownerEmail,
          ownerPhotoUrl: data?.ownerPhotoUrl || null,
          logoUrl:      data?.logoUrl      || null,
          studioName:   data?.studioName   || DEFAULTS.studioName,
          tagline:      data?.tagline      || DEFAULTS.tagline,
          phone:        data?.phone        || DEFAULTS.phone,
          email:        data?.email        || DEFAULTS.email,
          website:      data?.website      || DEFAULTS.website,
          address:      data?.address      || DEFAULTS.address,
          city:         data?.city         || DEFAULTS.city,
          state:        data?.state        || DEFAULTS.state,
          pinCode:      data?.pinCode      || DEFAULTS.pinCode,
          gstin:        data?.gstin        || null,
        };
        setProfile(m);
      })
      .finally(() => setLoading(false));

    fetch('/api/v1/employees')
      .then(r => r.json())
      .then(({ data }: { data: Employee[] | null }) => setEmployees(data ?? []))
      .catch(() => {});
  }, []);

  function openProfileEdit() { setDName(profile.ownerName ?? ''); setDPhone(profile.ownerPhone ?? ''); setDEmail(profile.ownerEmail ?? ''); setEditingProfile(true); }
  function cancelProfileEdit() { setEditingProfile(false); }
  async function saveProfile() {
    setSavingP(true);
    try {
      const res = await fetch('/api/v1/settings/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ownerName: dName.trim() || null, ownerPhone: dPhone.trim() || null, ownerEmail: dEmail.trim() || null }) });
      if (!res.ok) throw new Error();
      setProfile(p => ({ ...p, ownerName: dName, ownerPhone: dPhone, ownerEmail: dEmail }));
      setSavedP(true); setEditingProfile(false); setTimeout(() => setSavedP(false), 3000);
    } catch { /* ignore */ } finally { setSavingP(false); }
  }

  function openStudioEdit() { setDLogo(profile.logoUrl ?? ''); setDStName(profile.studioName ?? ''); setDTagline(profile.tagline ?? ''); setDStPhone(profile.phone ?? ''); setDStEmail(profile.email ?? ''); setDWebsite(profile.website ?? ''); setDAddress(profile.address ?? ''); setDCity(profile.city ?? ''); setDState(profile.state ?? ''); setDPin(profile.pinCode ?? ''); setDGstin(profile.gstin ?? ''); setEditingStudio(true); }
  function cancelStudioEdit() { setEditingStudio(false); }
  async function saveStudio() {
    setSavingS(true);
    try {
      const res = await fetch('/api/v1/settings/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ studioName: dStName.trim() || undefined, tagline: dTagline.trim() || null, phone: dStPhone.trim() || null, email: dStEmail.trim() || null, website: dWebsite.trim() || null, address: dAddress.trim() || null, city: dCity.trim() || null, state: dState.trim() || null, pinCode: dPin.trim() || null, gstin: dGstin.trim() || null, logoUrl: dLogo.trim() || null }) });
      if (!res.ok) throw new Error();
      setProfile(p => ({ ...p, studioName: dStName, tagline: dTagline, phone: dStPhone, email: dStEmail, website: dWebsite, address: dAddress, city: dCity, state: dState, pinCode: dPin, gstin: dGstin, logoUrl: dLogo }));
      setSavedS(true); setEditingStudio(false); setTimeout(() => setSavedS(false), 3000);
    } catch { /* ignore */ } finally { setSavingS(false); }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/v1/settings/logo', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({})) as { data?: { logoUrl?: string } };
      if (body.data?.logoUrl) setDLogo(body.data.logoUrl);
    } catch { /* ignore */ } finally { setUploading(false); }
  }

  async function runExport(kind: string, ext: 'csv' | 'json') {
    setBusyExport(kind); setExportError(null);
    try { await downloadExport(`/api/v1/exports/${kind}`, `${kind}_${new Date().toISOString().slice(0, 10)}.${ext}`); }
    catch (e) { setExportError(e instanceof Error ? e.message : 'Export failed'); }
    finally { setBusyExport(null); }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} /></div>;
  }

  const ROLE_COUNTS = employees.reduce<Record<string, number>>((acc, e) => { acc[e.role] = (acc[e.role] ?? 0) + 1; return acc; }, {});
  const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
    owner: { bg: '#EDE9FE', color: '#7C3AED' }, designer: { bg: '#D1FAE5', color: '#059669' },
    supervisor: { bg: '#FEF3CD', color: '#D97706' }, accountant: { bg: '#DBEAFE', color: '#2563EB' },
  };

  const EXPORTS: { kind: string; label: string; desc: string; ext: 'csv' | 'json' }[] = [
    { kind: 'leads',     label: 'Clients & Leads',  desc: 'Contact info + pipeline stage',   ext: 'csv'  },
    { kind: 'projects',  label: 'Projects',          desc: 'Contract values + lifecycle',     ext: 'csv'  },
    { kind: 'quotes',    label: 'Quotations',        desc: 'Quote totals + margin',           ext: 'csv'  },
    { kind: 'payments',  label: 'Payments',          desc: 'Payment history',                 ext: 'csv'  },
    { kind: 'materials', label: 'Materials',         desc: 'Catalogue with prices',           ext: 'csv'  },
    { kind: 'backup',    label: 'Full Backup',       desc: 'Complete workspace — JSON',       ext: 'json' },
  ];
  const ICON_MAP: Record<string, React.ReactNode> = {
    leads:     <Users        className="h-5 w-5" style={{ color: '#7C3AED' }} />,
    projects:  <Briefcase    className="h-5 w-5" style={{ color: '#2D8A6A' }} />,
    quotes:    <FileText     className="h-5 w-5" style={{ color: '#2563EB' }} />,
    payments:  <IndianRupee  className="h-5 w-5" style={{ color: '#D97706' }} />,
    materials: <Building2    className="h-5 w-5" style={{ color: '#059669' }} />,
    backup:    <Download     className="h-5 w-5" style={{ color: '#6B7280' }} />,
  };

  const fullAddress = [profile.address, profile.city, profile.state, profile.pinCode].filter(Boolean).join(', ');

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* Header */}
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your profile, studio details, team and data</p>
      </div>

      {/* ── Row 1: Studio (left) + Profile & Users (right) ────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">

        {/* Studio Details — LEFT */}
        <Card>
          {/* Header: logo + studio name acts as the card title */}
          <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}>
                {profile.logoUrl
                  ? <img src={profile.logoUrl} alt="" className="h-full w-full object-contain" />
                  : <Building2 className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />}
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>{profile.studioName}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{profile.tagline}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {editingStudio ? (
                <>
                  <button type="button" onClick={cancelStudioEdit}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <X className="h-3 w-3" /> Cancel
                  </button>
                  <button type="button" onClick={saveStudio} disabled={savingS}
                    className="btn-primary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] disabled:opacity-60">
                    {savingS ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    {savingS ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <button type="button" onClick={openStudioEdit}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
          </div>

          {editingStudio ? (
            <div className="p-4 space-y-3">
              {/* Logo upload */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed overflow-hidden" style={{ borderColor: 'var(--border-strong)' }}>
                  {dLogo ? <img src={dLogo} alt="" className="h-full w-full object-contain" /> : <Building2 className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />}
                </div>
                <label className="btn-secondary inline-flex cursor-pointer items-center gap-1 px-2.5 py-1 text-[11px]" style={{ opacity: uploading ? 0.6 : 1 }}>
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {uploading ? 'Uploading…' : 'Upload Logo'}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                </label>
                {dLogo && <button type="button" onClick={() => setDLogo('')} className="text-[11px]" style={{ color: 'var(--danger)' }}>Remove</button>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Studio Name"><input value={dStName} onChange={e => setDStName(e.target.value)} className={inputCls} style={inputStyle} /></Field>
                <Field label="Tagline"><input value={dTagline} onChange={e => setDTagline(e.target.value)} className={inputCls} style={inputStyle} /></Field>
                <Field label="Phone">
                  <div className="relative"><Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} /><input value={dStPhone} onChange={e => setDStPhone(e.target.value)} className={`${inputCls} pl-8`} style={inputStyle} /></div>
                </Field>
                <Field label="Email">
                  <div className="relative"><Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} /><input type="email" value={dStEmail} onChange={e => setDStEmail(e.target.value)} className={`${inputCls} pl-8`} style={inputStyle} /></div>
                </Field>
                <Field label="Website">
                  <div className="relative"><Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} /><input value={dWebsite} onChange={e => setDWebsite(e.target.value)} className={`${inputCls} pl-8`} style={inputStyle} /></div>
                </Field>
                <Field label="GSTIN"><input value={dGstin} onChange={e => setDGstin(e.target.value)} placeholder="33AABCS1429B1Z5" className={inputCls} style={inputStyle} /></Field>
                <Field label="City"><input value={dCity} onChange={e => setDCity(e.target.value)} className={inputCls} style={inputStyle} /></Field>
                <Field label="State"><input value={dState} onChange={e => setDState(e.target.value)} className={inputCls} style={inputStyle} /></Field>
                <Field label="PIN Code"><input value={dPin} onChange={e => setDPin(e.target.value)} className={inputCls} style={inputStyle} /></Field>
                <Field label="Address">
                  <textarea value={dAddress} onChange={e => setDAddress(e.target.value)} rows={2} className="w-full resize-none rounded-lg border bg-[var(--surface-card)] px-2.5 pt-1.5 pb-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-base)]/30" style={inputStyle} />
                </Field>
              </div>
            </div>
          ) : (
            <div className="px-5 py-1 pb-2">
              <InfoRow label="Phone"   value={profile.phone}   icon={Phone} />
              <InfoRow label="Email"   value={profile.email}   icon={Mail} />
              <InfoRow label="Website" value={profile.website} icon={Globe} />
              <InfoRow label="GSTIN"   value={profile.gstin} />
              <InfoRow label="Address" value={fullAddress}     icon={MapPin} />
            </div>
          )}
          {savedS && (
            <div className="flex items-center gap-1 px-5 pb-3 text-[11px] font-medium" style={{ color: 'var(--success)' }}>
              <Check className="h-3 w-3" /> Saved
            </div>
          )}
        </Card>

        {/* RIGHT COLUMN — Profile + Users stacked */}
        <div className="flex flex-col gap-4">

          {/* My Profile */}
          <Card>
            <CardHead
              icon={Briefcase} iconBg="#EDE9FE" iconColor="#7C3AED"
              title="My Profile" subtitle="Your personal details as owner"
              editing={editingProfile} onEdit={openProfileEdit}
              onCancel={cancelProfileEdit} saving={savingP} onSave={saveProfile}
            />
            {editingProfile ? (
              <div className="p-4 space-y-3">
                <Field label="Full Name">
                  <input value={dName} onChange={e => setDName(e.target.value)} className={inputCls} style={inputStyle} />
                </Field>
                <Field label="Mobile Number">
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                    <input value={dPhone} onChange={e => setDPhone(e.target.value)} className={`${inputCls} pl-8`} style={inputStyle} />
                  </div>
                </Field>
                <Field label="Email Address">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                    <input type="email" value={dEmail} onChange={e => setDEmail(e.target.value)} className={`${inputCls} pl-8`} style={inputStyle} />
                  </div>
                </Field>
              </div>
            ) : (
              <div className="px-5 py-1 pb-3">
                <InfoRow label="Full Name" value={profile.ownerName} />
                <InfoRow label="Mobile"    value={profile.ownerPhone} icon={Phone} />
                <InfoRow label="Email"     value={profile.ownerEmail} icon={Mail} />
              </div>
            )}
            {savedP && (
              <div className="flex items-center gap-1 px-5 pb-3 text-[11px] font-medium" style={{ color: 'var(--success)' }}>
                <Check className="h-3 w-3" /> Saved
              </div>
            )}
          </Card>

          {/* Users & Roles */}
          <Card>
            <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: '#DBEAFE' }}>
                <Users className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />
              </span>
              <div>
                <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>Users & Roles</p>
                <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-secondary)' }}>Manage team access and permissions</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {employees.slice(0, 4).map(emp => (
                      <div key={emp.id} className="ring-2 ring-[var(--surface-card)] rounded-full">
                        <EmployeeAvatar name={emp.fullName} photoUrl={emp.photoUrl} size={28} />
                      </div>
                    ))}
                    {employees.length > 4 && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-[var(--surface-card)]" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                        +{employees.length - 4}
                      </div>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                    {employees.length} member{employees.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link href="/employees" className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium hover:bg-[var(--surface-muted)]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <Users2 className="h-3 w-3" /> Manage <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  <Link href="/employees" className="btn-primary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]">
                    <ChevronRight className="h-3 w-3" /> Permissions
                  </Link>
                </div>
              </div>
              {employees.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {(['owner', 'designer', 'supervisor', 'accountant'] as const).map(role => {
                    const count = ROLE_COUNTS[role] ?? 0;
                    if (!count) return null;
                    const s = ROLE_STYLE[role];
                    return (
                      <span key={role} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize" style={{ background: s.bg, color: s.color }}>
                        {count} {role}{count > 1 ? 's' : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

        </div>{/* end right column */}
      </div>

      {/* ── Data & Export — full-width horizontal strip ────────────────────── */}
      <Card>
        <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: '#FEF3CD' }}>
            <Download className="h-3.5 w-3.5" style={{ color: '#D97706' }} />
          </span>
          <div>
            <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>Data & Export</p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-secondary)' }}>Download your business data anytime</p>
          </div>
        </div>
        <div className="p-4">
          {exportError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{exportError}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXPORTS.map(ex => {
              const busy = busyExport === ex.kind;
              return (
                <div
                  key={ex.kind}
                  className="flex items-center justify-between gap-4 rounded-xl border px-5 py-4"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--surface-card)' }}>
                      {ICON_MAP[ex.kind]}
                    </span>
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{ex.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runExport(ex.kind, ex.ext)}
                    disabled={busy}
                    className="btn-primary flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 text-sm disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {ex.ext.toUpperCase()}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

    </div>
  );
}
