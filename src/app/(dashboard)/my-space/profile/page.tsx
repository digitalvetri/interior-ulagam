'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Phone, Mail, MapPin, Briefcase, Building2,
  Edit3, Download, KeyRound, LogOut, ChevronRight,
  AlertTriangle, CheckCircle2, Loader2, PhoneCall,
  Plus, Calendar, Star,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Profile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  photoUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  hireDate: string | null;
  dob: string | null;
  emergencyContact: { name: string; relation: string; phone: string } | null;
  status: string;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', designer: 'Designer',
  supervisor: 'Site Supervisor', accountant: 'Accountant', employee: 'Employee',
};
const EMP_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time',
  contract: 'Contract', intern: 'Intern', consultant: 'Consultant',
};
const TABS = ['Overview', 'Work Info', 'KRA & KPI', 'Attendance', 'Documents'] as const;
type Tab = typeof TABS[number];

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

/* ── Avatar ─────────────────────────────────────────────────────────────────── */

function Avatar({ name, photoUrl, size = 64 }: { name: string; photoUrl: string | null; size?: number }) {
  if (photoUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={photoUrl} alt={name} className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{
        width: size, height: size,
        fontSize: size * 0.32,
        background: 'var(--accent-base)',
        letterSpacing: '-0.02em',
      }}>
      {getInitials(name)}
    </div>
  );
}

/* ── Info row ───────────────────────────────────────────────────────────────── */

function InfoRow({
  icon: Icon, label, value, iconColor = 'var(--accent-base)', iconBg = 'var(--accent-soft)',
}: {
  icon: React.ElementType; label: string; value: string | null;
  iconColor?: string; iconBg?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}>
        <Icon size={14} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider leading-none"
          style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-[13px] font-medium mt-1 break-words leading-snug"
          style={{ color: 'var(--text-heading)' }}>{value}</p>
      </div>
    </div>
  );
}

/* ── Card section ───────────────────────────────────────────────────────────── */

function Card({
  title, onEdit, editing, children,
}: {
  title: string; onEdit?: () => void; editing?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border flex flex-col"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-0">
        <p className="text-[13px] font-bold" style={{ color: 'var(--text-heading)' }}>{title}</p>
        {onEdit && !editing && (
          <button type="button" onClick={onEdit}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
            style={{ color: 'var(--accent-base)' }}>
            <Edit3 size={11} />Edit
          </button>
        )}
      </div>
      <div className="p-5 flex-1 space-y-4">
        {children}
      </div>
    </div>
  );
}

/* ── Edit personal form ─────────────────────────────────────────────────────── */

function EditPersonalForm({
  profile, onSave, onCancel,
}: { profile: Profile; onSave: (p: Partial<Profile>) => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone,    setPhone]    = useState(profile.phone ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [saving, setSaving]     = useState(false);
  const [error,  setError]      = useState<string | null>(null);

  async function handleSave() {
    if (!fullName.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim() || null, location: location.trim() || null }),
      });
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? 'Update failed'); return; }
      onSave({ fullName: fullName.trim(), phone: phone.trim() || null, location: location.trim() || null });
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {[
        { label: 'Full Name', val: fullName, set: setFullName, type: 'text', ph: '' },
        { label: 'Phone', val: phone, set: setPhone, type: 'tel', ph: '+91 98765 43210' },
        { label: 'Location', val: location, set: setLocation, type: 'text', ph: 'Coimbatore' },
      ].map(({ label, val, set, type, ph }) => (
        <div key={label}>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: 'var(--text-tertiary)' }}>{label}</label>
          <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
            className="studio-input w-full text-sm" />
        </div>
      ))}
      {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle size={11} />{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1.5">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}Save
        </button>
      </div>
    </div>
  );
}

/* ── Edit emergency contact form ────────────────────────────────────────────── */

function EditEmergencyForm({
  profile, onSave, onCancel,
}: { profile: Profile; onSave: (p: Partial<Profile>) => void; onCancel: () => void }) {
  const [ecName,     setEcName]     = useState(profile.emergencyContact?.name ?? '');
  const [ecRelation, setEcRelation] = useState(profile.emergencyContact?.relation ?? '');
  const [ecPhone,    setEcPhone]    = useState(profile.emergencyContact?.phone ?? '');
  const [saving,  setSaving]        = useState(false);
  const [error,   setError]         = useState<string | null>(null);

  async function handleSave() {
    setSaving(true); setError(null);
    const emergencyContact = ecName.trim()
      ? { name: ecName.trim(), relation: ecRelation.trim(), phone: ecPhone.trim() }
      : null;
    try {
      const res = await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emergencyContact }),
      });
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? 'Update failed'); return; }
      onSave({ emergencyContact });
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {[
        { label: 'Name', val: ecName, set: setEcName, ph: 'Contact name' },
        { label: 'Relation', val: ecRelation, set: setEcRelation, ph: 'e.g. Spouse, Parent' },
        { label: 'Phone', val: ecPhone, set: setEcPhone, ph: '+91 XXXXX XXXXX' },
      ].map(({ label, val, set, ph }) => (
        <div key={label}>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: 'var(--text-tertiary)' }}>{label}</label>
          <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
            className="studio-input w-full text-sm" />
        </div>
      ))}
      {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle size={11} />{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1.5">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}Save
        </button>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const router = useRouter();

  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<Tab>('Overview');
  const [editPersonal, setEditPersonal] = useState(false);
  const [editContact,  setEditContact]  = useState(false);
  const [signingOut,   setSigningOut]   = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/v1/me/profile');
      const json = await res.json() as { data: Profile };
      setProfile(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function merge(patch: Partial<Profile>) {
    setProfile(p => p ? { ...p, ...patch } : p);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    router.push('/login');
    router.refresh();
  }

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="h-32 rounded-2xl skeleton" />
        <div className="h-10 rounded-xl skeleton" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-2xl skeleton" />)}
        </div>
        <div className="h-40 rounded-2xl skeleton" />
      </div>
    );
  }

  if (!profile) return null;

  const roleLabel    = ROLE_LABEL[profile.role] ?? profile.role;
  const empTypeLabel = profile.employmentType ? (EMP_TYPE_LABEL[profile.employmentType] ?? profile.employmentType) : null;

  return (
    <div className="p-6 space-y-5 max-w-7xl">

      {/* ── Hero card ────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-start justify-between gap-4">

          {/* Left: avatar + info */}
          <div className="flex items-center gap-4">
            <Avatar name={profile.fullName} photoUrl={profile.photoUrl} size={68} />
            <div>
              <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                {profile.fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
                  {roleLabel}
                </span>
                <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  <Star size={10} className="fill-current" style={{ color: '#f59e0b' }} />
                  Konst Design
                </span>
              </div>
              <button type="button"
                onClick={() => { setEditPersonal(true); setEditContact(false); }}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium hover:bg-[var(--surface-muted)] transition-colors"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}>
                <Edit3 size={12} />Edit Profile
              </button>
            </div>
          </div>

          {/* Right: decorative note */}
          <div className="hidden sm:flex flex-col items-end justify-start gap-1 flex-shrink-0 mt-1"
            style={{ transform: 'rotate(2deg)' }}>
            <div className="rounded-xl px-5 py-3 shadow-sm"
              style={{ background: '#fef9c3', border: '1px solid #fde68a', minWidth: 120 }}>
              <p className="text-[11px] font-semibold text-yellow-800 text-center leading-relaxed"
                style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.01em' }}>
                Interior<br />Design<br />Studio
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map(tab => {
          const active   = tab === activeTab;
          const disabled = tab !== 'Overview';
          return (
            <button key={tab} type="button"
              onClick={() => !disabled && setActiveTab(tab)}
              disabled={disabled}
              className="relative px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors"
              style={{
                color: active ? 'var(--accent-base)' : disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                cursor: disabled ? 'default' : 'pointer',
                borderBottom: active ? '2px solid var(--accent-base)' : '2px solid transparent',
                marginBottom: '-1px',
              }}>
              {tab}
            </button>
          );
        })}
      </div>

      {/* ── Overview tab content ─────────────────────────────────────────────── */}
      {activeTab === 'Overview' && (
        <div className="space-y-5">

          {/* Three equal columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Card 1: Personal Information ── */}
            <Card
              title="Personal Information"
              onEdit={() => { setEditPersonal(true); setEditContact(false); }}
              editing={editPersonal}>
              {editPersonal ? (
                <EditPersonalForm
                  profile={profile}
                  onSave={patch => { merge(patch); setEditPersonal(false); }}
                  onCancel={() => setEditPersonal(false)} />
              ) : (
                <div className="space-y-4">
                  <InfoRow icon={User}     label="Full Name"     value={profile.fullName} />
                  <InfoRow icon={Mail}     label="Email"         value={profile.email} />
                  <InfoRow icon={Phone}    label="Mobile"        value={profile.phone} />
                  <InfoRow icon={MapPin}   label="Address"       value={profile.location} />
                  <InfoRow icon={Calendar} label="Working Since" value={fmtDate(profile.hireDate)} />
                </div>
              )}
            </Card>

            {/* ── Card 2: Contact Details ── */}
            <Card
              title="Contact Details"
              onEdit={() => { setEditContact(true); setEditPersonal(false); }}
              editing={editContact}>
              {editContact ? (
                <EditEmergencyForm
                  profile={profile}
                  onSave={patch => { merge(patch); setEditContact(false); }}
                  onCancel={() => setEditContact(false)} />
              ) : (
                <div className="space-y-4">
                  <InfoRow icon={PhoneCall} label="Mobile"         value={profile.phone}
                    iconColor="#16a34a" iconBg="#dcfce7" />
                  <InfoRow icon={Mail}      label="Email Address"  value={profile.email}
                    iconColor="#2563eb" iconBg="#dbeafe" />
                  <InfoRow icon={MapPin}    label="Office Address" value={profile.location}
                    iconColor="#7c3aed" iconBg="#ede9fe" />

                  {/* Emergency contact sub-section */}
                  <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}>
                        Emergency Contact
                      </p>
                      {!profile.emergencyContact && (
                        <button type="button"
                          onClick={() => { setEditContact(true); setEditPersonal(false); }}
                          className="flex items-center gap-0.5 text-[11px] font-semibold hover:underline"
                          style={{ color: 'var(--accent-base)' }}>
                          <Plus size={11} />Add Contact
                        </button>
                      )}
                    </div>

                    {profile.emergencyContact ? (
                      <div className="rounded-xl p-3 space-y-1.5"
                        style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                        <p className="text-[13px] font-semibold text-orange-900">
                          {profile.emergencyContact.name}
                          {profile.emergencyContact.relation && (
                            <span className="text-[11px] font-normal text-orange-600 ml-1.5">
                              · {profile.emergencyContact.relation}
                            </span>
                          )}
                        </p>
                        <a href={`tel:${profile.emergencyContact.phone}`}
                          className="flex items-center gap-1.5 text-[12px] text-orange-700 font-medium hover:underline">
                          <Phone size={11} />{profile.emergencyContact.phone}
                        </a>
                      </div>
                    ) : (
                      <p className="text-[12px] italic" style={{ color: 'var(--text-tertiary)' }}>
                        No emergency contact added yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* ── Card 3: Quick Actions ── */}
            <Card title="Quick Actions">
              <div className="space-y-1">
                {[
                  {
                    icon: Download, label: 'Download Profile',
                    onClick: () => window.print(),
                    color: 'var(--text-secondary)', bg: 'var(--surface-muted)',
                  },
                  {
                    icon: Edit3, label: 'Update Information',
                    onClick: () => { setEditPersonal(true); setEditContact(false); },
                    color: 'var(--accent-base)', bg: 'var(--accent-soft)',
                  },
                  {
                    icon: KeyRound, label: 'Change Password',
                    onClick: () => router.push('/settings'),
                    color: '#7c3aed', bg: '#ede9fe',
                  },
                ].map(({ icon: Icon, label, onClick, color, bg }) => (
                  <button key={label} type="button" onClick={onClick}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[var(--surface-muted)] transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: bg }}>
                        <Icon size={14} style={{ color }} />
                      </div>
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        {label}
                      </span>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                ))}

                <div className="h-px my-1" style={{ background: 'var(--border-subtle)' }} />

                <button type="button" onClick={handleSignOut} disabled={signingOut}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: '#fee2e2' }}>
                      <LogOut size={14} style={{ color: 'var(--danger)' }} />
                    </div>
                    <span className="text-[13px] font-medium" style={{ color: 'var(--danger)' }}>
                      {signingOut ? 'Signing out…' : 'Log Out'}
                    </span>
                  </div>
                  {!signingOut && <ChevronRight size={14} style={{ color: '#fca5a5' }} />}
                  {signingOut && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--danger)' }} />}
                </button>
              </div>
            </Card>
          </div>

          {/* ── Work Information ─────────────────────────────────────────────── */}
          <div className="rounded-2xl border p-5"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[13px] font-bold mb-5" style={{ color: 'var(--text-heading)' }}>
              Work Information
            </p>
            {(profile.department || profile.jobTitle || profile.employmentType) ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <InfoRow icon={Building2} label="Department"      value={profile.department}
                  iconColor="#2563eb" iconBg="#dbeafe" />
                <InfoRow icon={Briefcase} label="Designation"     value={profile.jobTitle}
                  iconColor="#7c3aed" iconBg="#ede9fe" />
                <InfoRow icon={User}      label="Employment Type" value={empTypeLabel}
                  iconColor="#16a34a" iconBg="#dcfce7" />
                <InfoRow icon={Building2} label="Job Role"        value={roleLabel}
                  iconColor="#f59e0b" iconBg="#fef3c7" />
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Work details are managed by the owner. Contact admin to update your profile.
              </p>
            )}
          </div>

          {/* ── Recent Activity placeholder ───────────────────────────────────── */}
          <div className="rounded-2xl border p-5"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[13px] font-bold mb-1" style={{ color: 'var(--text-heading)' }}>
              Recent Activity
            </p>
            <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
              Activity tracking coming soon.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
