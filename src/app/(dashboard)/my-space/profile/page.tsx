'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Phone, Mail, MapPin, Briefcase, Building2,
  Edit3, Download, KeyRound, LogOut, ChevronRight,
  AlertTriangle, CheckCircle2, Loader2, Camera,
  Plus, Calendar, Shield, Hash, Clock,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface EmergencyContact { name: string; relation: string; phone: string }

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
  emergencyContact: EmergencyContact | null;
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

/* ── Avatar with camera overlay ────────────────────────────────────────────── */

function AvatarUpload({
  profile,
  onUploaded,
}: {
  profile: Profile;
  onUploaded: (url: string) => void;
}) {
  const inputRef                    = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/v1/me/avatar', { method: 'POST', body: fd });
      const json = await res.json() as { data?: { photoUrl: string }; error?: string };
      if (!res.ok) { setError(json.error ?? 'Upload failed'); return; }
      onUploaded(json.data!.photoUrl);
    } catch {
      setError('Network error — try again');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const size = 80;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* Avatar circle */}
      {profile.photoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={profile.photoUrl} alt={profile.fullName}
          className="rounded-full object-cover w-full h-full" />
      ) : (
        <div className="rounded-full w-full h-full flex items-center justify-center text-white font-bold"
          style={{ background: 'var(--accent-base)', fontSize: size * 0.3 }}>
          {getInitials(profile.fullName)}
        </div>
      )}

      {/* Camera overlay button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Change profile picture"
        className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: 'var(--accent-base)' }}>
        {uploading
          ? <Loader2 size={12} className="animate-spin text-white" />
          : <Camera size={12} className="text-white" />}
      </button>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) void handleFile(e.target.files[0]); }}
      />

      {/* Error tooltip */}
      {error && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-10 w-48 rounded-lg px-3 py-2 text-[11px] text-red-700 shadow-lg"
          style={{ background: '#fee2e2', border: '1px solid #fca5a5', whiteSpace: 'normal' }}>
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Info row ───────────────────────────────────────────────────────────────── */

function InfoRow({
  icon: Icon, label, value,
  iconColor = 'var(--accent-base)', iconBg = 'var(--accent-soft)',
}: {
  icon: React.ElementType; label: string; value: string | null | undefined;
  iconColor?: string; iconBg?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}>
        <Icon size={14} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-[13px] font-medium mt-0.5 break-words"
          style={{ color: 'var(--text-heading)' }}>{value}</p>
      </div>
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────────────────────────── */

function Card({
  title, action, children,
}: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-[13px] font-bold" style={{ color: 'var(--text-heading)' }}>{title}</p>
        {action}
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
      style={{ color: 'var(--accent-base)' }}>
      <Edit3 size={11} />Edit
    </button>
  );
}

/* ── Personal info edit form ────────────────────────────────────────────────── */

function EditPersonalForm({ profile, onSave, onCancel }: {
  profile: Profile;
  onSave: (p: Partial<Profile>) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone,    setPhone]    = useState(profile.phone ?? '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function save() {
    if (!fullName.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim() || null }),
      });
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? 'Failed'); return; }
      onSave({ fullName: fullName.trim(), phone: phone.trim() || null });
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Full Name</label>
        <input value={fullName} onChange={e => setFullName(e.target.value)} className="studio-input w-full text-sm" />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Mobile Number</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className="studio-input w-full text-sm" />
      </div>
      {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle size={11} />{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
        <button type="button" onClick={save} disabled={saving}
          className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1.5">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}Save
        </button>
      </div>
    </div>
  );
}

/* ── Contact edit form ──────────────────────────────────────────────────────── */

function EditContactForm({ profile, onSave, onCancel }: {
  profile: Profile;
  onSave: (p: Partial<Profile>) => void;
  onCancel: () => void;
}) {
  const [location, setLocation] = useState(profile.location ?? '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: location.trim() || null }),
      });
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? 'Failed'); return; }
      onSave({ location: location.trim() || null });
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Work Location</label>
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Coimbatore" className="studio-input w-full text-sm" />
      </div>
      {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle size={11} />{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
        <button type="button" onClick={save} disabled={saving}
          className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1.5">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}Save
        </button>
      </div>
    </div>
  );
}

/* ── Emergency contact form ─────────────────────────────────────────────────── */

function EmergencyContactForm({ profile, onSave, onCancel }: {
  profile: Profile;
  onSave: (p: Partial<Profile>) => void;
  onCancel: () => void;
}) {
  const [name,     setName]     = useState(profile.emergencyContact?.name ?? '');
  const [relation, setRelation] = useState(profile.emergencyContact?.relation ?? '');
  const [phone,    setPhone]    = useState(profile.emergencyContact?.phone ?? '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!phone.trim()) { setError('Phone is required'); return; }
    setSaving(true); setError(null);
    const emergencyContact = { name: name.trim(), relation: relation.trim(), phone: phone.trim() };
    try {
      const res = await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emergencyContact }),
      });
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? 'Failed'); return; }
      onSave({ emergencyContact });
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {[
        { label: 'Contact Name', val: name, set: setName, ph: 'e.g. Priya Krishnamurthy' },
        { label: 'Relationship', val: relation, set: setRelation, ph: 'e.g. Spouse, Parent, Sibling' },
        { label: 'Phone Number', val: phone, set: setPhone, ph: '+91 98765 43210' },
      ].map(({ label, val, set, ph }) => (
        <div key={label}>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
          <input value={val} onChange={e => set(e.target.value)} placeholder={ph} className="studio-input w-full text-sm" />
        </div>
      ))}
      {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle size={11} />{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
        <button type="button" onClick={save} disabled={saving}
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
  const [editPersonal, setEditPersonal] = useState(false);
  const [editContact,  setEditContact]  = useState(false);
  const [editEmergency,setEditEmergency]= useState(false);
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
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    router.push('/login');
    router.refresh();
  }

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="p-6 space-y-5 max-w-5xl">
        <div className="h-28 rounded-2xl skeleton" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
          <div className="space-y-5">
            {[1, 2].map(i => <div key={i} className="h-52 rounded-2xl skeleton" />)}
          </div>
          <div className="h-64 rounded-2xl skeleton" />
        </div>
        {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl skeleton" />)}
      </div>
    );
  }

  if (!profile) return null;

  const roleLabel    = ROLE_LABEL[profile.role] ?? profile.role;
  const empTypeLabel = profile.employmentType ? (EMP_TYPE_LABEL[profile.employmentType] ?? profile.employmentType) : null;

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* ── Profile Header ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border px-6 py-5"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-5">

          {/* Avatar with upload overlay */}
          <AvatarUpload
            profile={profile}
            onUploaded={url => merge({ photoUrl: url })} />

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight truncate" style={{ color: 'var(--text-heading)' }}>
              {profile.fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {profile.jobTitle && (
                <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  {profile.jobTitle}
                </span>
              )}
              {profile.jobTitle && profile.department && (
                <span style={{ color: 'var(--border-strong)' }}>·</span>
              )}
              {profile.department && (
                <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  {profile.department}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
                {roleLabel}
              </span>
              <span className="flex items-center gap-1 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: profile.status === 'active' ? 'var(--success)' : '#d97706' }} />
                <span className="capitalize" style={{ color: 'var(--text-tertiary)' }}>
                  {profile.status}
                </span>
              </span>
            </div>
          </div>

          {/* Edit profile button */}
          <button type="button"
            onClick={() => { setEditPersonal(true); setEditContact(false); setEditEmergency(false); }}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-medium hover:bg-[var(--surface-muted)] transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}>
            <Edit3 size={13} />Edit Profile
          </button>
        </div>

        {/* Upload hint */}
        <p className="mt-3 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Click the camera icon on your photo to upload a new profile picture (JPG / PNG, max 5 MB).
        </p>
      </div>

      {/* ── Two-column layout: main + sidebar ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">

        {/* ── Main column ── */}
        <div className="space-y-5">

          {/* Personal Information */}
          <Card
            title="Personal Information"
            action={!editPersonal
              ? <EditBtn onClick={() => { setEditPersonal(true); setEditContact(false); setEditEmergency(false); }} />
              : undefined}>
            {editPersonal ? (
              <EditPersonalForm
                profile={profile}
                onSave={patch => { merge(patch); setEditPersonal(false); }}
                onCancel={() => setEditPersonal(false)} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={User}      label="Full Name"   value={profile.fullName} />
                <InfoRow icon={Mail}      label="Email"       value={profile.email}
                  iconColor="#2563eb" iconBg="#dbeafe" />
                <InfoRow icon={Phone}     label="Mobile"      value={profile.phone}
                  iconColor="#16a34a" iconBg="#dcfce7" />
                <InfoRow icon={Building2} label="Department"  value={profile.department}
                  iconColor="#7c3aed" iconBg="#ede9fe" />
                <InfoRow icon={Briefcase} label="Designation" value={profile.jobTitle}
                  iconColor="#f59e0b" iconBg="#fef3c7" />
                <InfoRow icon={Hash}      label="Employee ID" value={profile.id.slice(0, 8).toUpperCase()}
                  iconColor="var(--text-secondary)" iconBg="var(--surface-muted)" />
                <InfoRow icon={Calendar}  label="Joining Date" value={fmtDate(profile.hireDate)} />
              </div>
            )}
          </Card>

          {/* Contact Details */}
          <Card
            title="Contact Details"
            action={!editContact
              ? <EditBtn onClick={() => { setEditContact(true); setEditPersonal(false); setEditEmergency(false); }} />
              : undefined}>
            {editContact ? (
              <EditContactForm
                profile={profile}
                onSave={patch => { merge(patch); setEditContact(false); }}
                onCancel={() => setEditContact(false)} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={Mail}     label="Email Address"  value={profile.email}
                  iconColor="#2563eb" iconBg="#dbeafe" />
                <InfoRow icon={Phone}    label="Mobile Number"  value={profile.phone}
                  iconColor="#16a34a" iconBg="#dcfce7" />
                <InfoRow icon={MapPin}   label="Work Location"  value={profile.location}
                  iconColor="#7c3aed" iconBg="#ede9fe" />
              </div>
            )}
          </Card>
        </div>

        {/* ── Sidebar: Quick Actions ── */}
        <div className="lg:sticky lg:top-6">
          <Card title="Quick Actions">
            <div className="space-y-1">
              {[
                {
                  icon: Edit3, label: 'Update Information',
                  color: 'var(--accent-base)', bg: 'var(--accent-soft)',
                  onClick: () => { setEditPersonal(true); setEditContact(false); setEditEmergency(false); },
                },
                {
                  icon: Download, label: 'Download Profile',
                  color: 'var(--text-secondary)', bg: 'var(--surface-muted)',
                  onClick: () => window.print(),
                },
                {
                  icon: KeyRound, label: 'Change Password',
                  color: '#7c3aed', bg: '#ede9fe',
                  onClick: () => router.push('/settings'),
                },
              ].map(({ icon: Icon, label, color, bg, onClick }) => (
                <button key={label} type="button" onClick={onClick}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[var(--surface-muted)] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: bg }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                  </div>
                  <ChevronRight size={13} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))}

              <div className="my-1 h-px" style={{ background: 'var(--border-subtle)' }} />

              <button type="button" onClick={handleSignOut} disabled={signingOut}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: '#fee2e2' }}>
                    {signingOut
                      ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--danger)' }} />
                      : <LogOut size={14} style={{ color: 'var(--danger)' }} />}
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--danger)' }}>
                    {signingOut ? 'Signing out…' : 'Log Out'}
                  </span>
                </div>
                {!signingOut && <ChevronRight size={13} style={{ color: '#fca5a5' }} />}
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Work Information ─────────────────────────────────────────────────── */}
      <Card title="Work Information">
        {(profile.department || profile.jobTitle || profile.employmentType || profile.hireDate) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            <InfoRow icon={Building2} label="Department"      value={profile.department}
              iconColor="#2563eb" iconBg="#dbeafe" />
            <InfoRow icon={Briefcase} label="Designation"     value={profile.jobTitle}
              iconColor="#7c3aed" iconBg="#ede9fe" />
            <InfoRow icon={User}      label="Role"            value={roleLabel} />
            <InfoRow icon={Clock}     label="Employment Type" value={empTypeLabel}
              iconColor="#16a34a" iconBg="#dcfce7" />
            <InfoRow icon={Calendar}  label="Joining Date"    value={fmtDate(profile.hireDate)} />
            <InfoRow icon={MapPin}    label="Work Location"   value={profile.location}
              iconColor="#f59e0b" iconBg="#fef3c7" />
          </div>
        ) : (
          <p className="text-sm py-2" style={{ color: 'var(--text-tertiary)' }}>
            Work details are set by the admin. Contact your manager to update this information.
          </p>
        )}
      </Card>

      {/* ── Emergency Contact ────────────────────────────────────────────────── */}
      <Card
        title="Emergency Contact"
        action={!editEmergency
          ? (profile.emergencyContact
              ? <EditBtn onClick={() => { setEditEmergency(true); setEditPersonal(false); setEditContact(false); }} />
              : <button type="button"
                  onClick={() => { setEditEmergency(true); setEditPersonal(false); setEditContact(false); }}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
                  style={{ color: 'var(--accent-base)' }}>
                  <Plus size={11} />Add Contact
                </button>)
          : undefined}>
        {editEmergency ? (
          <EmergencyContactForm
            profile={profile}
            onSave={patch => { merge(patch); setEditEmergency(false); }}
            onCancel={() => setEditEmergency(false)} />
        ) : profile.emergencyContact ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoRow icon={User}  label="Name"         value={profile.emergencyContact.name} />
            <InfoRow icon={Phone} label="Phone"        value={profile.emergencyContact.phone}
              iconColor="#16a34a" iconBg="#dcfce7" />
            <InfoRow icon={User}  label="Relationship" value={profile.emergencyContact.relation}
              iconColor="#f59e0b" iconBg="#fef3c7" />
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--surface-muted)' }}>
              <Phone size={18} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              No emergency contact added yet
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Add a contact who can be reached in case of emergency.
            </p>
            <button type="button"
              onClick={() => { setEditEmergency(true); setEditPersonal(false); setEditContact(false); }}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
              style={{ color: 'var(--accent-base)' }}>
              <Plus size={13} />Add Emergency Contact
            </button>
          </div>
        )}
      </Card>

      {/* ── Account Information ──────────────────────────────────────────────── */}
      <Card title="Account Information">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          <InfoRow icon={Shield}    label="Access Role"     value={roleLabel} />
          <InfoRow icon={Hash}      label="Employee ID"     value={profile.id.slice(0, 8).toUpperCase()}
            iconColor="var(--text-secondary)" iconBg="var(--surface-muted)" />
          <InfoRow icon={Mail}      label="Login Email"     value={profile.email}
            iconColor="#2563eb" iconBg="#dbeafe" />
          <InfoRow icon={User}      label="Account Status"  value={profile.status === 'active' ? 'Active' : profile.status === 'on_leave' ? 'On Leave' : 'Inactive'}
            iconColor={profile.status === 'active' ? '#16a34a' : '#d97706'}
            iconBg={profile.status === 'active' ? '#dcfce7' : '#fef3c7'} />
        </div>
      </Card>

    </div>
  );
}
