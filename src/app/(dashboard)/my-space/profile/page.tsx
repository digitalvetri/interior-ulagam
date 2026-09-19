'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Phone, Mail, MapPin, Briefcase, Building2,
  Edit3, Download, KeyRound, LogOut, ChevronRight,
  AlertTriangle, CheckCircle2, Loader2, PhoneCall,
  Plus, Calendar,
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

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

/* ── Avatar ─────────────────────────────────────────────────────────────────── */

function Avatar({ name, photoUrl, size = 72 }: { name: string; photoUrl: string | null; size?: number }) {
  if (photoUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={photoUrl} alt={name}
        className="rounded-full object-cover ring-4 ring-white shadow-lg"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center ring-4 ring-white shadow-lg text-white font-bold"
      style={{
        width: size, height: size,
        fontSize: size * 0.32,
        background: 'linear-gradient(135deg, var(--accent-base) 0%, #7c3aed 100%)',
      }}>
      {initials(name)}
    </div>
  );
}

/* ── Info row ───────────────────────────────────────────────────────────────── */

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--accent-soft)' }}>
        <Icon size={14} style={{ color: 'var(--accent-base)' }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-sm font-medium truncate mt-0.5" style={{ color: 'var(--text-heading)' }}>{value}</p>
      </div>
    </div>
  );
}

/* ── Quick action row ───────────────────────────────────────────────────────── */

function ActionRow({ icon: Icon, label, onClick, danger }: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors hover:bg-[var(--surface-muted)] group"
      style={danger ? { color: 'var(--danger)' } : {}}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: danger ? 'var(--danger-soft, #fee2e2)' : 'var(--surface-muted)' }}>
          <Icon size={14} style={{ color: danger ? 'var(--danger)' : 'var(--text-secondary)' }} />
        </div>
        <span className="text-sm font-medium"
          style={{ color: danger ? 'var(--danger)' : 'var(--text-primary)' }}>
          {label}
        </span>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
    </button>
  );
}

/* ── Personal info edit form ────────────────────────────────────────────────── */

function EditPersonalForm({
  profile, onSave, onCancel,
}: { profile: Profile; onSave: (p: Partial<Profile>) => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone]       = useState(profile.phone ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!fullName.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          location: location.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? 'Update failed'); return;
      }
      onSave({ fullName: fullName.trim(), phone: phone.trim() || null, location: location.trim() || null });
    } catch { setError('Network error — try again'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {[
          { label: 'Full Name', val: fullName, set: setFullName, type: 'text' },
          { label: 'Phone', val: phone, set: setPhone, type: 'tel' },
          { label: 'Location', val: location, set: setLocation, type: 'text' },
        ].map(({ label, val, set, type }) => (
          <div key={label}>
            <label className="studio-label block mb-1">{label}</label>
            <input type={type} value={val} onChange={e => set(e.target.value)}
              className="studio-input w-full text-sm" />
          </div>
        ))}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertTriangle size={12} />{error}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1.5">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          Save
        </button>
      </div>
    </div>
  );
}

/* ── Emergency contact edit form ────────────────────────────────────────────── */

function EditContactForm({
  profile, onSave, onCancel,
}: { profile: Profile; onSave: (p: Partial<Profile>) => void; onCancel: () => void }) {
  const [ecName,     setEcName]     = useState(profile.emergencyContact?.name ?? '');
  const [ecRelation, setEcRelation] = useState(profile.emergencyContact?.relation ?? '');
  const [ecPhone,    setEcPhone]    = useState(profile.emergencyContact?.phone ?? '');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

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
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? 'Update failed'); return;
      }
      onSave({ emergencyContact });
    } catch { setError('Network error — try again'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Emergency Contact</p>
      {[
        { label: 'Name', val: ecName, set: setEcName },
        { label: 'Relation (e.g. Spouse, Parent)', val: ecRelation, set: setEcRelation },
        { label: 'Phone', val: ecPhone, set: setEcPhone },
      ].map(({ label, val, set }) => (
        <div key={label}>
          <label className="studio-label block mb-1">{label}</label>
          <input value={val} onChange={e => set(e.target.value)} className="studio-input w-full text-sm" />
        </div>
      ))}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertTriangle size={12} />{error}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1.5">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          Save
        </button>
      </div>
    </div>
  );
}

/* ── Card wrapper with optional edit header ─────────────────────────────────── */

function SectionCard({
  title, onEdit, editing, children,
}: {
  title: string; onEdit?: () => void; editing?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="premium-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold" style={{ color: 'var(--text-heading)' }}>{title}</p>
        {onEdit && !editing && (
          <button type="button" onClick={onEdit}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
            style={{ color: 'var(--accent-base)' }}>
            <Edit3 size={11} />Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile]           = useState<Profile | null>(null);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<typeof TABS[number]>('Overview');
  const [editPersonal, setEditPersonal] = useState(false);
  const [editContact,  setEditContact]  = useState(false);
  const [signingOut,   setSigningOut]   = useState(false);

  const loadProfile = useCallback(async () => {
    const res  = await fetch('/api/v1/me/profile');
    const json = await res.json() as { data: Profile };
    setProfile(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    router.push('/login');
    router.refresh();
  }

  function mergeProfile(patch: Partial<Profile>) {
    setProfile(p => p ? { ...p, ...patch } : p);
  }

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-36 rounded-2xl" />
        <div className="skeleton h-10 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-56 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const roleLabel    = ROLE_LABEL[profile.role] ?? profile.role;
  const empTypeLabel = profile.employmentType ? (EMP_TYPE_LABEL[profile.employmentType] ?? profile.employmentType) : null;

  return (
    <div className="p-6 space-y-5">

      {/* ── Hero header ──────────────────────────────────────────────────────── */}
      <div className="premium-card overflow-hidden">
        {/* Gradient banner */}
        <div className="h-24 relative"
          style={{ background: 'linear-gradient(135deg, var(--accent-base) 0%, #7c3aed 60%, #a855f7 100%)' }}>
          {/* Decorative circles */}
          <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full opacity-20"
            style={{ background: 'white' }} />
          <div className="absolute right-24 -bottom-4 w-20 h-20 rounded-full opacity-10"
            style={{ background: 'white' }} />
          {/* Konst Design badge */}
          <div className="absolute right-5 top-5 flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Konst Design</span>
            <span className="text-[11px] text-white/40 italic">Interior Studio</span>
          </div>
        </div>

        {/* Avatar + info */}
        <div className="px-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10">
            <div className="flex items-end gap-4">
              <Avatar name={profile.fullName} photoUrl={profile.photoUrl} size={76} />
              <div className="pb-1 min-w-0">
                <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>
                  {profile.fullName}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
                    {roleLabel}
                  </span>
                  {profile.department && (
                    <span className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      <Building2 size={11} />{profile.department}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full"
                      style={{ background: profile.status === 'active' ? 'var(--success)' : '#d97706' }} />
                    <span style={{ color: 'var(--text-tertiary)' }} className="capitalize">{profile.status}</span>
                  </span>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setEditPersonal(true)}
              className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl self-end sm:self-auto">
              <Edit3 size={13} />Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map(tab => {
          const isActive = tab === activeTab;
          const isDisabled = tab !== 'Overview';
          return (
            <button key={tab} type="button"
              onClick={() => !isDisabled && setActiveTab(tab)}
              className="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
              style={{
                borderBottomColor: isActive ? 'var(--accent-base)' : 'transparent',
                color: isActive ? 'var(--accent-base)' : isDisabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                cursor: isDisabled ? 'default' : 'pointer',
                marginBottom: '-1px',
              }}>
              {tab}
            </button>
          );
        })}
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'Overview' && (
        <div className="space-y-5">

          {/* Three-column cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Personal Information */}
            <SectionCard title="Personal Information"
              onEdit={() => { setEditPersonal(true); setEditContact(false); }}
              editing={editPersonal}>
              {editPersonal ? (
                <EditPersonalForm profile={profile}
                  onSave={patch => { mergeProfile(patch); setEditPersonal(false); }}
                  onCancel={() => setEditPersonal(false)} />
              ) : (
                <div className="space-y-4">
                  <InfoRow icon={User}     label="Full Name"      value={profile.fullName} />
                  <InfoRow icon={Mail}     label="Email"          value={profile.email} />
                  <InfoRow icon={Phone}    label="Mobile"         value={profile.phone} />
                  <InfoRow icon={MapPin}   label="Location"       value={profile.location} />
                  <InfoRow icon={Calendar} label="Working Since"  value={fmtDate(profile.hireDate)} />
                </div>
              )}
            </SectionCard>

            {/* Contact Details */}
            <SectionCard title="Contact Details"
              onEdit={() => { setEditContact(true); setEditPersonal(false); }}
              editing={editContact}>
              {editContact ? (
                <EditContactForm profile={profile}
                  onSave={patch => { mergeProfile(patch); setEditContact(false); }}
                  onCancel={() => setEditContact(false)} />
              ) : (
                <div className="space-y-4">
                  <InfoRow icon={PhoneCall} label="Mobile"         value={profile.phone} />
                  <InfoRow icon={Mail}      label="Email Address"  value={profile.email} />
                  <InfoRow icon={MapPin}    label="Office Address" value={profile.location} />

                  <div className="pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}>
                        Emergency Contact
                      </p>
                      {!profile.emergencyContact && (
                        <button type="button"
                          onClick={() => { setEditContact(true); setEditPersonal(false); }}
                          className="flex items-center gap-0.5 text-[11px] font-semibold"
                          style={{ color: 'var(--accent-base)' }}>
                          <Plus size={11} />Add Contact
                        </button>
                      )}
                    </div>
                    {profile.emergencyContact ? (
                      <div className="rounded-xl p-3 space-y-1.5"
                        style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                        <p className="text-sm font-semibold text-orange-900">
                          {profile.emergencyContact.name}
                        </p>
                        <p className="text-[11px] text-orange-600">{profile.emergencyContact.relation}</p>
                        <a href={`tel:${profile.emergencyContact.phone}`}
                          className="flex items-center gap-1.5 text-[12px] text-orange-700 font-medium hover:underline">
                          <Phone size={11} />{profile.emergencyContact.phone}
                        </a>
                      </div>
                    ) : (
                      <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                        No emergency contact set.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Quick Actions */}
            <SectionCard title="Quick Actions">
              <div className="space-y-1 -mx-1">
                <ActionRow icon={Download} label="Download Profile"
                  onClick={() => window.print()} />
                <ActionRow icon={Edit3} label="Update Information"
                  onClick={() => { setEditPersonal(true); setEditContact(false); }} />
                <ActionRow icon={KeyRound} label="Change Password"
                  onClick={() => router.push('/settings/security')} />
                <div className="h-px my-1" style={{ background: 'var(--border-subtle)' }} />
                <ActionRow icon={LogOut} label={signingOut ? 'Signing out…' : 'Log Out'}
                  onClick={handleSignOut} danger />
              </div>
            </SectionCard>
          </div>

          {/* Work Information */}
          <div className="premium-card p-5">
            <p className="text-[13px] font-bold mb-4" style={{ color: 'var(--text-heading)' }}>
              Work Information
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <InfoRow icon={Building2}  label="Department"       value={profile.department} />
              <InfoRow icon={Briefcase}  label="Designation"      value={profile.jobTitle} />
              <InfoRow icon={User}       label="Employment Type"  value={empTypeLabel} />
              <InfoRow icon={Building2}  label="Job Role"         value={ROLE_LABEL[profile.role] ?? profile.role} />
            </div>
            {!profile.department && !profile.jobTitle && (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Work information is managed by the owner in Settings.
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
