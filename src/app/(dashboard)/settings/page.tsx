'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2, Users, Download, Save, Loader2, Upload, Check,
  FileText, IndianRupee, Users2, ArrowUpRight, ChevronRight,
  Globe, MapPin, Phone, Mail, Briefcase,
} from 'lucide-react';
import { EmployeeAvatar } from '@/components/employees/Avatar';
import type { Employee } from '@/types/employees';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon, iconBg, iconColor, title, subtitle,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string; iconColor: string;
  title: string; subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: iconBg }}>
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </span>
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{title}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
      </div>
    </div>
  );
}

function FormField({
  label, hint, children, className = '',
}: {
  label: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {hint && <span className="ml-1 font-normal" style={{ color: 'var(--text-tertiary)' }}>— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'h-9 w-full rounded-xl border bg-[var(--surface-card)] px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--accent-base)]/30';
const inputStyle = { borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' };

function SaveRow({
  saving, saved, error, label, onClick,
}: {
  saving: boolean; saved: boolean; error: string | null; label: string; onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={saving}
        className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {saving ? 'Saving…' : label}
      </button>
      {saved && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--success)' }}>
          <Check className="h-3.5 w-3.5" /> Saved
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadExport(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [loading, setLoading]           = useState(true);
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const logoInputRef                    = useRef<HTMLInputElement>(null);

  // My Profile
  const [ownerName, setOwnerName]       = useState('');
  const [ownerPhone, setOwnerPhone]     = useState('');
  const [ownerEmail, setOwnerEmail]     = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Studio Details
  const [logoUrl, setLogoUrl]           = useState('');
  const [studioName, setStudioName]     = useState('');
  const [tagline, setTagline]           = useState('');
  const [studioPhone, setStudioPhone]   = useState('');
  const [studioEmail, setStudioEmail]   = useState('');
  const [website, setWebsite]           = useState('');
  const [address, setAddress]           = useState('');
  const [city, setCity]                 = useState('');
  const [studioState, setStudioState]   = useState('');
  const [pinCode, setPinCode]           = useState('');
  const [gstin, setGstin]               = useState('');
  const [savingStudio, setSavingStudio] = useState(false);
  const [savedStudio, setSavedStudio]   = useState(false);
  const [studioError, setStudioError]   = useState<string | null>(null);

  // Export
  const [busyExport, setBusyExport]     = useState<string | null>(null);
  const [exportError, setExportError]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/settings/profile')
      .then((r) => r.json())
      .then(({ data }: { data: ProfileData | null }) => {
        if (!data) return;
        setOwnerName(data.ownerName   ?? '');
        setOwnerPhone(data.ownerPhone ?? '');
        setOwnerEmail(data.ownerEmail ?? '');
        setLogoUrl(data.logoUrl       ?? '');
        setStudioName(data.studioName ?? '');
        setTagline(data.tagline       ?? '');
        setStudioPhone(data.phone     ?? '');
        setStudioEmail(data.email     ?? '');
        setWebsite(data.website       ?? '');
        setAddress(data.address       ?? '');
        setCity(data.city             ?? '');
        setStudioState(data.state     ?? '');
        setPinCode(data.pinCode       ?? '');
        setGstin(data.gstin           ?? '');
      })
      .finally(() => setLoading(false));

    fetch('/api/v1/employees')
      .then((r) => r.json())
      .then(({ data }: { data: Employee[] | null }) => setEmployees(data ?? []))
      .catch(() => {});
  }, []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/v1/settings/logo', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({})) as { data?: { logoUrl?: string }; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Upload failed');
      if (body.data?.logoUrl) setLogoUrl(body.data.logoUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true); setSavedProfile(false); setProfileError(null);
    try {
      const res = await fetch('/api/v1/settings/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ownerName:  ownerName.trim()  || null,
          ownerPhone: ownerPhone.trim() || null,
          ownerEmail: ownerEmail.trim() || null,
        }),
      });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed to save');
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 3000);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveStudio() {
    setSavingStudio(true); setSavedStudio(false); setStudioError(null);
    try {
      const res = await fetch('/api/v1/settings/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          studioName: studioName.trim() || undefined,
          tagline:    tagline.trim()    || null,
          phone:      studioPhone.trim() || null,
          email:      studioEmail.trim() || null,
          website:    website.trim()    || null,
          address:    address.trim()    || null,
          city:       city.trim()       || null,
          state:      studioState.trim() || null,
          pinCode:    pinCode.trim()    || null,
          gstin:      gstin.trim()      || null,
          logoUrl:    logoUrl.trim()    || null,
        }),
      });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed to save');
      setSavedStudio(true);
      setTimeout(() => setSavedStudio(false), 3000);
    } catch (e) {
      setStudioError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingStudio(false);
    }
  }

  async function runExport(kind: string, ext: 'csv' | 'json') {
    setBusyExport(kind); setExportError(null);
    try {
      await downloadExport(
        `/api/v1/exports/${kind}`,
        `${kind}_${new Date().toISOString().slice(0, 10)}.${ext}`,
      );
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusyExport(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  const ROLE_COUNTS = employees.reduce<Record<string, number>>((acc, e) => {
    acc[e.role] = (acc[e.role] ?? 0) + 1;
    return acc;
  }, {});

  const EXPORTS: { kind: string; label: string; desc: string; ext: 'csv' | 'json' }[] = [
    { kind: 'leads',     label: 'Clients & Leads',    desc: 'Contact info and pipeline stage',          ext: 'csv'  },
    { kind: 'projects',  label: 'Projects',           desc: 'Contract values and lifecycle stage',       ext: 'csv'  },
    { kind: 'quotes',    label: 'Quotations',         desc: 'Quote totals and margin breakdown',         ext: 'csv'  },
    { kind: 'payments',  label: 'Payments',           desc: 'Payment history for reconciliation',        ext: 'csv'  },
    { kind: 'materials', label: 'Materials',          desc: 'Catalogue with cost and sell price',        ext: 'csv'  },
    { kind: 'backup',    label: 'Full Backup',        desc: 'Complete workspace — JSON format',          ext: 'json' },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your profile, studio details, team access and data</p>
      </div>

      {/* ── 1. My Profile ─────────────────────────────────────────────────── */}
      <SectionCard>
        <SectionHeader
          icon={Briefcase}
          iconBg="#EDE9FE"
          iconColor="#7C3AED"
          title="My Profile"
          subtitle="Your personal details as the studio owner"
        />
        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Full Name" className="sm:col-span-2">
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                className={inputCls}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Mobile Number">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={`${inputCls} pl-9`}
                  style={inputStyle}
                />
              </div>
            </FormField>
            <FormField label="Email Address">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@studio.com"
                  className={`${inputCls} pl-9`}
                  style={inputStyle}
                />
              </div>
            </FormField>
          </div>
          <SaveRow
            saving={savingProfile}
            saved={savedProfile}
            error={profileError}
            label="Save Profile"
            onClick={saveProfile}
          />
        </div>
      </SectionCard>

      {/* ── 2. Studio / Company Details ───────────────────────────────────── */}
      <SectionCard>
        <SectionHeader
          icon={Building2}
          iconBg="#E8F5F0"
          iconColor="#2D8A6A"
          title="Studio & Company Details"
          subtitle="Appears on invoices, quotations, and the client portal"
        />
        <div className="space-y-5 p-6">

          {/* Logo row */}
          <div className="flex items-center gap-5">
            <div
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed overflow-hidden"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Studio logo" className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Studio Logo</p>
              <div className="flex items-center gap-2">
                <label
                  className="btn-secondary inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs"
                  style={{ opacity: uploading ? 0.6 : 1 }}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? 'Uploading…' : 'Upload Logo'}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="text-xs"
                    style={{ color: 'var(--danger)' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {uploadError && <p className="mt-1 text-[11px] text-red-600">{uploadError}</p>}
              <p className="mt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>PNG, JPEG or SVG — max 2 MB</p>
            </div>
          </div>

          {/* Fields grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Studio Name">
              <input
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                placeholder="e.g. The Interior Studio"
                className={inputCls}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Tagline" hint="shown on invoices">
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Spaces that inspire"
                className={inputCls}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Phone">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  value={studioPhone}
                  onChange={(e) => setStudioPhone(e.target.value)}
                  placeholder="+91 44 0000 0000"
                  className={`${inputCls} pl-9`}
                  style={inputStyle}
                />
              </div>
            </FormField>
            <FormField label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="email"
                  value={studioEmail}
                  onChange={(e) => setStudioEmail(e.target.value)}
                  placeholder="studio@example.com"
                  className={`${inputCls} pl-9`}
                  style={inputStyle}
                />
              </div>
            </FormField>
            <FormField label="Website">
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.studio.com"
                  className={`${inputCls} pl-9`}
                  style={inputStyle}
                />
              </div>
            </FormField>
            <FormField label="GSTIN" hint="optional">
              <input
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="e.g. 33AABCS1429B1Z5"
                className={inputCls}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Office Address" className="sm:col-span-2">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder="Street / Building, Area"
                  className="w-full resize-none rounded-xl border bg-[var(--surface-card)] pb-2 pl-9 pr-3 pt-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--accent-base)]/30"
                  style={inputStyle}
                />
              </div>
            </FormField>
            <FormField label="City">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Coimbatore"
                className={inputCls}
                style={inputStyle}
              />
            </FormField>
            <FormField label="State">
              <input
                value={studioState}
                onChange={(e) => setStudioState(e.target.value)}
                placeholder="e.g. Tamil Nadu"
                className={inputCls}
                style={inputStyle}
              />
            </FormField>
            <FormField label="PIN Code">
              <input
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="e.g. 641001"
                className={inputCls}
                style={inputStyle}
              />
            </FormField>
          </div>

          <SaveRow
            saving={savingStudio}
            saved={savedStudio}
            error={studioError}
            label="Save Studio Details"
            onClick={saveStudio}
          />
        </div>
      </SectionCard>

      {/* ── 3. Users, Roles & Permissions ─────────────────────────────────── */}
      <SectionCard>
        <SectionHeader
          icon={Users}
          iconBg="#DBEAFE"
          iconColor="#2563EB"
          title="Users, Roles & Permissions"
          subtitle="Manage who has access and what they can do"
        />
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Team summary */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {employees.slice(0, 5).map((emp) => (
                  <div key={emp.id} className="ring-2 ring-[var(--surface-card)] rounded-full">
                    <EmployeeAvatar name={emp.fullName} photoUrl={emp.photoUrl} size={32} />
                  </div>
                ))}
                {employees.length > 5 && (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-[var(--surface-card)]"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                  >
                    +{employees.length - 5}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                  {employees.length} team member{employees.length !== 1 ? 's' : ''}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {Object.entries(ROLE_COUNTS)
                    .map(([role, count]) => `${count} ${role}${count > 1 ? 's' : ''}`)
                    .join(' · ')}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Link
                href="/employees"
                className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-muted)]"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <Users2 className="h-3.5 w-3.5" />
                Manage Team
                <ArrowUpRight className="h-3 w-3" />
              </Link>
              <Link
                href="/employees"
                className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-sm"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                Roles & Permissions
              </Link>
            </div>
          </div>

          {/* Role breakdown pills */}
          {employees.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {(['owner', 'designer', 'supervisor', 'accountant'] as const).map((role) => {
                const count = ROLE_COUNTS[role] ?? 0;
                if (count === 0) return null;
                const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
                  owner:      { bg: '#EDE9FE', color: '#7C3AED' },
                  designer:   { bg: '#D1FAE5', color: '#059669' },
                  supervisor: { bg: '#FEF3CD', color: '#D97706' },
                  accountant: { bg: '#DBEAFE', color: '#2563EB' },
                };
                const s = ROLE_STYLE[role];
                return (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {count} {role}{count > 1 ? 's' : ''}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 4. Data & Export ──────────────────────────────────────────────── */}
      <SectionCard>
        <SectionHeader
          icon={Download}
          iconBg="#FEF3CD"
          iconColor="#D97706"
          title="Data & Export"
          subtitle="Download your business data in standard formats anytime"
        />
        <div className="p-6">
          {exportError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
              {exportError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXPORTS.map((ex) => {
              const busy = busyExport === ex.kind;
              const ICON_MAP: Record<string, React.ReactNode> = {
                leads:     <Users className="h-4 w-4" style={{ color: '#7C3AED' }} />,
                projects:  <Briefcase className="h-4 w-4" style={{ color: '#2D8A6A' }} />,
                quotes:    <FileText className="h-4 w-4" style={{ color: '#2563EB' }} />,
                payments:  <IndianRupee className="h-4 w-4" style={{ color: '#D97706' }} />,
                materials: <Building2 className="h-4 w-4" style={{ color: '#059669' }} />,
                backup:    <Download className="h-4 w-4" style={{ color: '#6B7280' }} />,
              };
              return (
                <div
                  key={ex.kind}
                  className="flex items-center justify-between gap-3 rounded-xl border p-4"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'var(--surface-card)' }}
                    >
                      {ICON_MAP[ex.kind]}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--text-heading)' }}>
                        {ex.label}
                      </p>
                      <p className="truncate text-[10px]" style={{ color: 'var(--text-secondary)' }}>{ex.desc}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => runExport(ex.kind, ex.ext)}
                    disabled={busy}
                    className="btn-primary flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    {ex.ext.toUpperCase()}
                  </button>
                </div>
              );
            })}
          </div>

          <div
            className="mt-4 rounded-xl px-4 py-3 text-[11px]"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
          >
            Data is stored securely in Supabase (India region). Archived leads are retained for 7 years as per GST record-keeping requirements.
          </div>
        </div>
      </SectionCard>

    </div>
  );
}
