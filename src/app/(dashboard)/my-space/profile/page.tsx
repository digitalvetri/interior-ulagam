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

/* ── Avatar upload ──────────────────────────────────────────────────────────── */

function AvatarUpload({ profile, onUploaded }: {
  profile: Profile;
  onUploaded: (url: string) => void;
}) {
  const inputRef                  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

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

  return (
    <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
      {profile.photoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={profile.photoUrl} alt={profile.fullName}
          className="rounded-full object-cover w-full h-full" />
      ) : (
        <div className="rounded-full w-full h-full flex items-center justify-center text-white font-bold text-base"
          style={{ background: 'var(--accent-base)' }}>
          {getInitials(profile.fullName)}
        </div>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        title="Change profile picture"
        className="absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center shadow border-2 border-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: 'var(--accent-base)' }}>
        {uploading
          ? <Loader2 size={9} className="animate-spin text-white" />
          : <Camera size={9} className="text-white" />}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png" className="hidden"
        onChange={e => { if (e.target.files?.[0]) void handleFile(e.target.files[0]); }} />
      {error && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-20 w-44 rounded-lg px-2.5 py-1.5 text-[11px] text-red-700 shadow-lg"
          style={{ background: '#fee2e2', border: '1px solid #fca5a5', whiteSpace: 'normal' }}>
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Compact info row — horizontal label + value on one line ────────────────── */

function InfoRow({
  icon: Icon, label, value,
  iconColor = 'var(--text-tertiary)',
}: {
  icon: React.ElementType; label: string; value: string | null | undefined;
  iconColor?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon size={12} style={{ color: iconColor, flexShrink: 0 }} />
      <span className="text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 w-[80px]"
        style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-heading)' }}>{value}</span>
    </div>
  );
}

/* ── Compact card ───────────────────────────────────────────────────────────── */

function Card({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-[12px] font-bold" style={{ color: 'var(--text-heading)' }}>{title}</p>
        {action}
      </div>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md hover:bg-[var(--surface-muted)] transition-colors"
      style={{ color: 'var(--accent-base)' }}>
      <Edit3 size={10} />Edit
    </button>
  );
}

/* ── Edit forms ─────────────────────────────────────────────────────────────── */

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
    <div className="space-y-2.5">
      {[
        { label: 'Full Name', val: fullName, set: setFullName, ph: 'Your name', type: 'text' },
        { label: 'Mobile', val: phone, set: setPhone, ph: '+91 98765 43210', type: 'tel' },
      ].map(({ label, val, set, ph, type }) => (
        <div key={label}>
          <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1"
            style={{ color: 'var(--text-tertiary)' }}>{label}</label>
          <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
            className="studio-input w-full text-[13px]" />
        </div>
      ))}
      {error && <p className="flex items-center gap-1 text-[11px] text-red-600"><AlertTriangle size={10} />{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-1.5 text-[12px]">Cancel</button>
        <button type="button" onClick={save} disabled={saving}
          className="btn-primary flex-1 py-1.5 text-[12px] flex items-center justify-center gap-1">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}Save
        </button>
      </div>
    </div>
  );
}

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
    <div className="space-y-2.5">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1"
          style={{ color: 'var(--text-tertiary)' }}>Work Location</label>
        <input value={location} onChange={e => setLocation(e.target.value)}
          placeholder="e.g. Coimbatore" className="studio-input w-full text-[13px]" />
      </div>
      {error && <p className="flex items-center gap-1 text-[11px] text-red-600"><AlertTriangle size={10} />{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-1.5 text-[12px]">Cancel</button>
        <button type="button" onClick={save} disabled={saving}
          className="btn-primary flex-1 py-1.5 text-[12px] flex items-center justify-center gap-1">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}Save
        </button>
      </div>
    </div>
  );
}

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
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Name', val: name, set: setName, ph: 'Full name' },
          { label: 'Relationship', val: relation, set: setRelation, ph: 'e.g. Spouse' },
          { label: 'Phone', val: phone, set: setPhone, ph: '+91 98765 43210' },
        ].map(({ label, val, set, ph }) => (
          <div key={label}>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1"
              style={{ color: 'var(--text-tertiary)' }}>{label}</label>
            <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
              className="studio-input w-full text-[13px]" />
          </div>
        ))}
      </div>
      {error && <p className="flex items-center gap-1 text-[11px] text-red-600"><AlertTriangle size={10} />{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-1.5 text-[12px]">Cancel</button>
        <button type="button" onClick={save} disabled={saving}
          className="btn-primary flex-1 py-1.5 text-[12px] flex items-center justify-center gap-1">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}Save
        </button>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const router = useRouter();

  const [profile,       setProfile]       = useState<Profile | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [editPersonal,  setEditPersonal]  = useState(false);
  const [editContact,   setEditContact]   = useState(false);
  const [editEmergency, setEditEmergency] = useState(false);
  const [signingOut,    setSigningOut]    = useState(false);

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

  function closeAll() { setEditPersonal(false); setEditContact(false); setEditEmergency(false); }

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
      <div className="p-4 space-y-3 max-w-5xl">
        <div className="h-16 rounded-xl skeleton" />
        <div className="grid grid-cols-[1fr_200px] gap-3">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-40 rounded-xl skeleton" />
              <div className="h-40 rounded-xl skeleton" />
            </div>
            <div className="h-32 rounded-xl skeleton" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-28 rounded-xl skeleton" />
              <div className="h-28 rounded-xl skeleton" />
            </div>
          </div>
          <div className="h-64 rounded-xl skeleton" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const roleLabel    = ROLE_LABEL[profile.role] ?? profile.role;
  const empTypeLabel = profile.employmentType ? (EMP_TYPE_LABEL[profile.employmentType] ?? profile.employmentType) : null;

  return (
    <div className="p-4 space-y-3 max-w-5xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border px-4 py-3 flex items-center gap-4"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>

        <AvatarUpload profile={profile} onUploaded={url => merge({ photoUrl: url })} />

        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold leading-tight truncate" style={{ color: 'var(--text-heading)' }}>
            {profile.fullName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {profile.jobTitle && (
              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{profile.jobTitle}</span>
            )}
            {profile.jobTitle && profile.department && (
              <span style={{ color: 'var(--border-strong)' }}>·</span>
            )}
            {profile.department && (
              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{profile.department}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
              {roleLabel}
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: profile.status === 'active' ? 'var(--success)' : '#d97706' }} />
              <span className="capitalize" style={{ color: 'var(--text-tertiary)' }}>
                {profile.status}
              </span>
            </span>
          </div>
        </div>

        <button type="button"
          onClick={() => { closeAll(); setEditPersonal(true); }}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium hover:bg-[var(--surface-muted)] transition-colors"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}>
          <Edit3 size={12} />Edit Profile
        </button>
      </div>

      {/* ── Main grid: left content + right sidebar ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_210px] gap-3 items-start">

        {/* ── Left: info cards ── */}
        <div className="space-y-3">

          {/* Personal + Contact side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* Personal Information */}
            <Card
              title="Personal Information"
              action={!editPersonal
                ? <EditBtn onClick={() => { closeAll(); setEditPersonal(true); }} />
                : undefined}>
              {editPersonal ? (
                <EditPersonalForm
                  profile={profile}
                  onSave={patch => { merge(patch); setEditPersonal(false); }}
                  onCancel={() => setEditPersonal(false)} />
              ) : (
                <div className="space-y-0.5">
                  <InfoRow icon={User}      label="Name"       value={profile.fullName} />
                  <InfoRow icon={Mail}      label="Email"      value={profile.email}      iconColor="#2563eb" />
                  <InfoRow icon={Phone}     label="Mobile"     value={profile.phone}      iconColor="#16a34a" />
                  <InfoRow icon={Building2} label="Dept"       value={profile.department} iconColor="#7c3aed" />
                  <InfoRow icon={Briefcase} label="Title"      value={profile.jobTitle}   iconColor="#f59e0b" />
                  <InfoRow icon={Hash}      label="Emp ID"     value={profile.id.slice(0, 8).toUpperCase()} />
                  <InfoRow icon={Calendar}  label="Joined"     value={fmtDate(profile.hireDate)} />
                </div>
              )}
            </Card>

            {/* Contact Details */}
            <Card
              title="Contact Details"
              action={!editContact
                ? <EditBtn onClick={() => { closeAll(); setEditContact(true); }} />
                : undefined}>
              {editContact ? (
                <EditContactForm
                  profile={profile}
                  onSave={patch => { merge(patch); setEditContact(false); }}
                  onCancel={() => setEditContact(false)} />
              ) : (
                <div className="space-y-0.5">
                  <InfoRow icon={Mail}  label="Email"    value={profile.email}    iconColor="#2563eb" />
                  <InfoRow icon={Phone} label="Mobile"   value={profile.phone}    iconColor="#16a34a" />
                  <InfoRow icon={MapPin} label="Location" value={profile.location} iconColor="#7c3aed" />
                </div>
              )}
            </Card>
          </div>

          {/* Work Information — full width */}
          <Card title="Work Information">
            {(profile.department || profile.jobTitle || profile.employmentType || profile.hireDate) ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-0.5">
                <InfoRow icon={Building2} label="Dept"         value={profile.department}  iconColor="#2563eb" />
                <InfoRow icon={Briefcase} label="Designation"  value={profile.jobTitle}    iconColor="#7c3aed" />
                <InfoRow icon={User}      label="Role"         value={roleLabel} />
                <InfoRow icon={Clock}     label="Emp Type"     value={empTypeLabel}        iconColor="#16a34a" />
                <InfoRow icon={Calendar}  label="Joined"       value={fmtDate(profile.hireDate)} />
                <InfoRow icon={MapPin}    label="Location"     value={profile.location}    iconColor="#f59e0b" />
              </div>
            ) : (
              <p className="text-[12px] py-1" style={{ color: 'var(--text-tertiary)' }}>
                Work details are set by the admin.
              </p>
            )}
          </Card>

          {/* Emergency Contact + Account Info side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* Emergency Contact */}
            <Card
              title="Emergency Contact"
              action={!editEmergency
                ? (profile.emergencyContact
                    ? <EditBtn onClick={() => { closeAll(); setEditEmergency(true); }} />
                    : <button type="button"
                        onClick={() => { closeAll(); setEditEmergency(true); }}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md hover:bg-[var(--surface-muted)] transition-colors"
                        style={{ color: 'var(--accent-base)' }}>
                        <Plus size={10} />Add
                      </button>)
                : undefined}>
              {editEmergency ? (
                <EmergencyContactForm
                  profile={profile}
                  onSave={patch => { merge(patch); setEditEmergency(false); }}
                  onCancel={() => setEditEmergency(false)} />
              ) : profile.emergencyContact ? (
                <div className="space-y-0.5">
                  <InfoRow icon={User}  label="Name"         value={profile.emergencyContact.name} />
                  <InfoRow icon={User}  label="Relation"     value={profile.emergencyContact.relation} iconColor="#f59e0b" />
                  <InfoRow icon={Phone} label="Phone"        value={profile.emergencyContact.phone}    iconColor="#16a34a" />
                </div>
              ) : (
                <div className="py-2 text-center">
                  <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    No emergency contact
                  </p>
                  <button type="button"
                    onClick={() => { closeAll(); setEditEmergency(true); }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold"
                    style={{ color: 'var(--accent-base)' }}>
                    <Plus size={11} />Add contact
                  </button>
                </div>
              )}
            </Card>

            {/* Account Information */}
            <Card title="Account Information">
              <div className="space-y-0.5">
                <InfoRow icon={Shield} label="Role"    value={roleLabel} />
                <InfoRow icon={Hash}   label="Emp ID"  value={profile.id.slice(0, 8).toUpperCase()} />
                <InfoRow icon={Mail}   label="Login"   value={profile.email} iconColor="#2563eb" />
                <InfoRow icon={User}   label="Status"  value={profile.status === 'active' ? 'Active' : profile.status === 'on_leave' ? 'On Leave' : 'Inactive'}
                  iconColor={profile.status === 'active' ? '#16a34a' : '#d97706'} />
              </div>
            </Card>
          </div>
        </div>

        {/* ── Right sidebar: Quick Actions ── */}
        <div className="xl:sticky xl:top-4">
          <Card title="Quick Actions">
            <div className="space-y-0.5 -mx-1">
              {[
                {
                  icon: Edit3, label: 'Update Information',
                  color: 'var(--accent-base)', bg: 'var(--accent-soft)',
                  onClick: () => { closeAll(); setEditPersonal(true); },
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
                  className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-[var(--surface-muted)] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: bg }}>
                      <Icon size={12} style={{ color }} />
                    </div>
                    <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                  </div>
                  <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))}

              <div className="my-1.5 h-px mx-1" style={{ background: 'var(--border-subtle)' }} />

              <button type="button" onClick={handleSignOut} disabled={signingOut}
                className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: '#fee2e2' }}>
                    {signingOut
                      ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--danger)' }} />
                      : <LogOut size={12} style={{ color: 'var(--danger)' }} />}
                  </div>
                  <span className="text-[12px] font-medium" style={{ color: 'var(--danger)' }}>
                    {signingOut ? 'Signing out…' : 'Log Out'}
                  </span>
                </div>
                {!signingOut && <ChevronRight size={12} style={{ color: '#fca5a5' }} />}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
