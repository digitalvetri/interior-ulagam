'use client';
import { useEffect, useState } from 'react';
import { User, Phone, Mail, MapPin, Briefcase, Building2, Loader2, CheckCircle2, AlertCircle, Edit3 } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
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
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  } | null;
  status: string;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
const roleLabel: Record<string, string> = {
  owner: 'Owner', designer: 'Designer',
  supervisor: 'Site Supervisor', accountant: 'Accountant', employee: 'Employee',
};
const empTypeLabel: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time',
  contract: 'Contract', intern: 'Intern', freelance: 'Freelance',
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--accent-base)10' }}>
        <Icon size={15} style={{ color: 'var(--accent-base)' }} />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/* ── Edit form ──────────────────────────────────────────────────────────── */
function EditProfileForm({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const [fullName, setFullName]   = useState(profile.fullName);
  const [phone, setPhone]         = useState(profile.phone ?? '');
  const [location, setLocation]   = useState(profile.location ?? '');
  const [ecName, setEcName]       = useState(profile.emergencyContact?.name ?? '');
  const [ecRelation, setEcRelation] = useState(profile.emergencyContact?.relation ?? '');
  const [ecPhone, setEcPhone]     = useState(profile.emergencyContact?.phone ?? '');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError(null); setSuccess(false);

    const emergencyContact = ecName.trim() ? {
      name: ecName.trim(), relation: ecRelation.trim(), phone: ecPhone.trim(),
    } : null;

    try {
      const res = await fetch('/api/v1/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone:    phone.trim() || null,
          location: location.trim() || null,
          emergencyContact,
        }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Update failed'); return; }
      const j = await res.json();
      onSave({ ...profile, ...j.data, emergencyContact });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Full Name</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white"
            style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Mobile Number</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white"
            style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Location / City</label>
          <input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Coimbatore"
            className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white"
            style={{ borderColor: 'var(--border)' }} />
        </div>
      </div>

      {/* Emergency contact */}
      <div>
        <p className="text-[13px] font-semibold text-gray-700 mb-3">Emergency Contact</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl"
          style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <div>
            <label className="block text-[11px] font-semibold text-orange-500 mb-1.5 uppercase tracking-wider">Name</label>
            <input value={ecName} onChange={e => setEcName(e.target.value)}
              placeholder="Contact name"
              className="w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none"
              style={{ borderColor: '#fed7aa' }} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-orange-500 mb-1.5 uppercase tracking-wider">Relation</label>
            <input value={ecRelation} onChange={e => setEcRelation(e.target.value)}
              placeholder="e.g. Spouse, Parent"
              className="w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none"
              style={{ borderColor: '#fed7aa' }} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-orange-500 mb-1.5 uppercase tracking-wider">Phone</label>
            <input type="tel" value={ecPhone} onChange={e => setEcPhone(e.target.value)}
              placeholder="Mobile number"
              className="w-full px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none"
              style={{ borderColor: '#fed7aa' }} />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertCircle size={14} /> {error}</div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600"><CheckCircle2 size={14} /> Profile updated successfully!</div>
      )}

      <button type="submit" disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 hover:opacity-90 active:scale-95 transition-all"
        style={{ background: 'var(--accent-base)' }}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
        Save Changes
      </button>
    </form>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */
function Avatar({ name, photoUrl, size = 80 }: { name: string; photoUrl: string | null; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  if (photoUrl) {
    return (
      <img src={photoUrl} alt={name}
        className="rounded-full object-cover border-4 border-white shadow-md"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center border-4 border-white shadow-md text-white font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.3,
        background: 'linear-gradient(135deg, var(--accent-base) 0%, #7c3aed 100%)',
      }}>
      {initials}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch('/api/v1/me/profile')
      .then(r => r.json())
      .then(j => setProfile(j.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header card */}
      <div className="rounded-2xl p-6"
        style={{ background: 'linear-gradient(135deg, var(--accent-base)0c 0%, #7c3aed0c 100%)', border: '1.5px solid var(--accent-base)28' }}>
        <div className="flex items-start gap-5">
          <Avatar name={profile.fullName} photoUrl={profile.photoUrl} size={72} />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{profile.fullName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: 'var(--accent-base)14', color: 'var(--accent-base)' }}>
                {roleLabel[profile.role] ?? profile.role}
              </span>
              {profile.jobTitle && (
                <span className="text-[13px] text-gray-500">{profile.jobTitle}</span>
              )}
            </div>
            {profile.department && (
              <p className="text-[13px] text-gray-400 mt-1">{profile.department}</p>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: profile.status === 'active' ? '#16a34a' : '#d97706' }}
              />
              <span className="text-[12px] text-gray-500 capitalize">{profile.status}</span>
            </div>
          </div>
          <button onClick={() => setEditing(!editing)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-medium hover:bg-white/60 transition-colors"
            style={{ borderColor: 'var(--border)' }}>
            <Edit3 size={13} /> {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Edit form or info view */}
      {editing ? (
        <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-[15px] mb-5">Edit Profile</h2>
          <EditProfileForm profile={profile} onSave={p => { setProfile(p); setEditing(false); }} />
        </div>
      ) : (
        <div className="rounded-2xl border p-6 space-y-5" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-[15px]">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow icon={User}     label="Full Name"       value={profile.fullName} />
            <InfoRow icon={Mail}     label="Email"           value={profile.email} />
            <InfoRow icon={Phone}    label="Mobile"          value={profile.phone} />
            <InfoRow icon={MapPin}   label="Location"        value={profile.location} />
            <InfoRow icon={Briefcase} label="Job Title"      value={profile.jobTitle} />
            <InfoRow icon={Building2} label="Department"     value={profile.department} />
            {profile.employmentType && (
              <InfoRow icon={Briefcase} label="Employment"   value={empTypeLabel[profile.employmentType] ?? profile.employmentType} />
            )}
            {profile.hireDate && (
              <InfoRow icon={User}   label="Joined"          value={new Date(profile.hireDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
            )}
          </div>

          {profile.emergencyContact && (
            <>
              <div className="border-t my-2" style={{ borderColor: 'var(--border)' }} />
              <div>
                <h3 className="text-[13px] font-semibold text-gray-500 mb-3 uppercase tracking-wider">Emergency Contact</h3>
                <div className="rounded-xl p-4 space-y-2" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <p className="font-semibold text-sm">{profile.emergencyContact.name}</p>
                  <p className="text-[13px] text-orange-700">{profile.emergencyContact.relation}</p>
                  <a href={`tel:${profile.emergencyContact.phone}`}
                    className="flex items-center gap-1.5 text-[13px] text-orange-600 font-medium hover:underline">
                    <Phone size={13} /> {profile.emergencyContact.phone}
                  </a>
                </div>
              </div>
            </>
          )}

          {!profile.emergencyContact && (
            <div className="rounded-xl p-4 border border-dashed border-orange-200 text-center">
              <p className="text-[13px] text-gray-400">No emergency contact set.</p>
              <button onClick={() => setEditing(true)}
                className="text-[13px] font-medium mt-1"
                style={{ color: 'var(--accent-base)' }}>
                Add emergency contact →
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
