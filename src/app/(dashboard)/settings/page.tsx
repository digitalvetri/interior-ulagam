'use client';

import { useState } from 'react';
import {
  Building2, Users, Bell, Palette, FileText, Shield, Plug, Download,
  Save, Eye, EyeOff, Check, ChevronRight,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────────────────── */
type TabKey =
  | 'profile'
  | 'users'
  | 'notifications'
  | 'branding'
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
  { key: 'branding',      label: 'Branding & Theme',     icon: Palette   },
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
      style={{ background: '#1C1C1C', color: '#FFFFFF' }}>
      <Check className="h-4 w-4 text-green-400" />
      <span className="text-sm font-medium">Settings saved!</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold mb-4" style={{ color: '#3D2314' }}>{children}</h3>;
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 py-4" style={{ borderBottom: '1px solid #E9DFD3' }}>
      <div className="sm:w-48 flex-shrink-0">
        <p className="text-sm font-semibold" style={{ color: '#1C1C1C' }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: '#A8927F' }}>{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? '#6F4E37' : '#D1D5DB' }}
        onClick={() => onChange(!checked)}>
        <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
          style={{ left: checked ? 22 : 4 }} />
      </div>
      <span className="text-sm" style={{ color: '#1C1C1C' }}>{label}</span>
    </label>
  );
}

/* ── Profile tab ──────────────────────────────────────────────────────────── */
function ProfileTab({ onSave }: { onSave: () => void }) {
  const [studio, setStudio]   = useState('The Interior Studio');
  const [tagline, setTagline] = useState('Transforming Spaces, Elevating Lives');
  const [phone, setPhone]     = useState('+91 9876543210');
  const [email, setEmail]     = useState('info@theinteriorstudios.in');
  const [address, setAddress] = useState('Coimbatore, Tamil Nadu');
  const [gst, setGst]         = useState('');
  const [pan, setPan]         = useState('');

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
      <div className="pt-4">
        <button type="button" onClick={onSave} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
          <Save className="h-4 w-4" />Save Profile
        </button>
      </div>
    </div>
  );
}

/* ── Users tab ────────────────────────────────────────────────────────────── */
function UsersTab() {
  const mockUsers = [
    { name: 'Ramesh Kumar', email: 'ramesh@studio.com', role: 'owner',      active: true },
    { name: 'Priya Sharma', email: 'priya@studio.com',  role: 'designer',   active: true },
    { name: 'Anand R',      email: 'anand@studio.com',  role: 'accountant', active: true },
    { name: 'Suresh V',     email: 'suresh@studio.com', role: 'supervisor', active: false },
  ];
  const roleStyle: Record<string, { bg: string; color: string }> = {
    owner:      { bg: '#FDF3E8', color: '#92400E' },
    designer:   { bg: '#F0FDF4', color: '#14532D' },
    accountant: { bg: '#EFF6FF', color: '#1E40AF' },
    supervisor: { bg: '#F5F3FF', color: '#6B21A8' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Team Members</SectionTitle>
        <button type="button" className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Users className="h-4 w-4" />Invite Member
        </button>
      </div>
      <div className="space-y-2">
        {mockUsers.map(u => {
          const rs = roleStyle[u.role] ?? roleStyle.owner;
          return (
            <div key={u.email} className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ border: '1px solid #E9DFD3', background: u.active ? '#FFFFFF' : '#F9FAFB' }}>
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #A07048, #6F4E37)' }}>
                {u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: u.active ? '#1C1C1C' : '#6B6B6B' }}>{u.name}</p>
                <p className="text-xs" style={{ color: '#A8927F' }}>{u.email}</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize flex-shrink-0" style={rs}>{u.role}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: u.active ? '#F0FDF4' : '#F3F4F6', color: u.active ? '#14532D' : '#6B7280' }}>
                {u.active ? 'Active' : 'Inactive'}
              </span>
              <button type="button" className="text-xs hover:underline flex-shrink-0" style={{ color: '#6F4E37' }}>Edit</button>
            </div>
          );
        })}
      </div>
      <div className="mt-5 p-4 rounded-xl" style={{ background: '#F8F5F2', border: '1px solid #E9DFD3' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: '#3D2314' }}>Role Permissions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { role: 'Owner',      access: 'Full access — all modules, settings, P&L, export' },
            { role: 'Designer',   access: 'Own projects, leads, quotations, site visits' },
            { role: 'Accountant', access: 'Accounts, invoices, payments, expenses (read + export)' },
            { role: 'Supervisor', access: 'Field app only — site logs, snag items' },
          ].map(r => (
            <div key={r.role} className="p-3 rounded-lg bg-white">
              <p className="text-xs font-bold" style={{ color: '#6F4E37' }}>{r.role}</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B6B6B' }}>{r.access}</p>
            </div>
          ))}
        </div>
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
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#A8927F' }}>WhatsApp</p>
        <div className="space-y-3">
          <Toggle checked={waLeadAlert}   onChange={setWaLeadAlert}   label="New lead received alert" />
          <Toggle checked={waPayment}     onChange={setWaPayment}     label="Payment captured notification" />
          <Toggle checked={waMilestone}   onChange={setWaMilestone}   label="Milestone due reminder to client" />
          <Toggle checked={followUpNudge} onChange={setFollowUpNudge} label="Follow-up nudge sequence" />
        </div>
      </div>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#A8927F' }}>Email</p>
        <div className="space-y-3">
          <Toggle checked={emailDigest}  onChange={setEmailDigest}  label="Weekly digest (every Monday)" />
          <Toggle checked={emailInvoice} onChange={setEmailInvoice} label="Invoice sent confirmation" />
        </div>
      </div>
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#A8927F' }}>Alerts</p>
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

/* ── Branding tab ─────────────────────────────────────────────────────────── */
function BrandingTab({ onSave }: { onSave: () => void }) {
  return (
    <div>
      <SectionTitle>Branding & Theme</SectionTitle>
      <FormRow label="Studio Logo" hint="Used on invoices and client portal">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 rounded-xl flex items-center justify-center" style={{ background: 'rgba(111,78,55,0.10)' }}>
            <Building2 className="h-8 w-8" style={{ color: '#C8B7A6' }} />
          </div>
          <button type="button" className="btn-secondary px-4 py-2 text-sm">Upload Logo</button>
        </div>
      </FormRow>
      <FormRow label="Primary Color" hint="Brand color for buttons and accents">
        <div className="flex items-center gap-3">
          <input type="color" defaultValue="#6F4E37" className="h-10 w-16 rounded-lg cursor-pointer" style={{ border: '1px solid #C8B7A6' }} />
          <span className="text-sm" style={{ color: '#6B6B6B' }}>#6F4E37 (Walnut Brown)</span>
        </div>
      </FormRow>
      <FormRow label="Gold Accent">
        <div className="flex items-center gap-3">
          <input type="color" defaultValue="#C89B3C" className="h-10 w-16 rounded-lg cursor-pointer" style={{ border: '1px solid #C8B7A6' }} />
          <span className="text-sm" style={{ color: '#6B6B6B' }}>#C89B3C (Gold)</span>
        </div>
      </FormRow>
      <FormRow label="Client Portal Theme">
        <div className="flex gap-3 flex-wrap">
          {['Cream & Brown', 'White & Gold', 'Dark & Premium'].map((t, i) => (
            <button key={t} type="button"
              className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
              style={{ borderColor: i === 0 ? '#6F4E37' : '#C8B7A6', background: i === 0 ? '#F8F5F2' : '#FFFFFF', color: '#6F4E37' }}>
              {t}
            </button>
          ))}
        </div>
      </FormRow>
      <div className="pt-4">
        <button type="button" onClick={onSave} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
          <Save className="h-4 w-4" />Save Branding
        </button>
      </div>
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
              style={{ background: gstType === t ? '#6F4E37' : '#FFFFFF', color: gstType === t ? '#FFFFFF' : '#6F4E37', borderColor: '#6F4E37' }}>
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
            className="flex items-center gap-1.5 text-xs" style={{ color: '#6F4E37' }}>
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
              style={{ border: '1px solid #E9DFD3', background: s.current ? '#F8F5F2' : '#FFFFFF' }}>
              <div>
                <p className="text-xs font-medium" style={{ color: '#1C1C1C' }}>{s.device}</p>
                <p className="text-[10px]" style={{ color: '#A8927F' }}>{s.location}</p>
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
            style={{ border: '1px solid #E9DFD3', background: '#FFFFFF' }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: i.status === 'connected' ? 'rgba(111,78,55,0.10)' : 'rgba(107,107,107,0.08)' }}>
                <Plug className="h-5 w-5" style={{ color: i.status === 'connected' ? '#6F4E37' : '#9CA3AF' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1C1C1C' }}>{i.name}</p>
                <p className="text-xs" style={{ color: '#6B6B6B' }}>{i.desc}</p>
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
  const exports = [
    { label: 'Leads (CSV)',              desc: 'All leads with contact info and pipeline stage' },
    { label: 'Projects (CSV)',           desc: 'Project list with contract values and lifecycle stage' },
    { label: 'Quotations (CSV)',         desc: 'All quotes with line items and margin breakdown' },
    { label: 'Payments (CSV)',           desc: 'Payment history for accounting reconciliation' },
    { label: 'Materials Catalogue',     desc: 'Full material list with cost, sell price and vendor' },
    { label: 'Full Data Backup (JSON)', desc: 'Complete workspace export — all tables, all records' },
  ];

  return (
    <div>
      <SectionTitle>Data Export & Backup</SectionTitle>
      <p className="text-sm mb-5" style={{ color: '#6B6B6B' }}>
        Your data belongs to you. Export anytime in standard formats.
      </p>
      <div className="space-y-3">
        {exports.map(e => (
          <div key={e.label} className="flex items-center justify-between px-4 py-4 rounded-xl"
            style={{ border: '1px solid #E9DFD3', background: '#FFFFFF' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1C1C1C' }}>{e.label}</p>
              <p className="text-xs" style={{ color: '#6B6B6B' }}>{e.desc}</p>
            </div>
            <button type="button" className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm flex-shrink-0">
              <Download className="h-3.5 w-3.5" />Export
            </button>
          </div>
        ))}
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
    branding:      <BrandingTab      onSave={handleSave} />,
    invoice:       <InvoiceTab       onSave={handleSave} />,
    security:      <SecurityTab      onSave={handleSave} />,
    integrations:  <IntegrationsTab />,
    export:        <ExportTab />,
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: '#3D2314' }}>Settings</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6B6B6B' }}>Manage your studio workspace</p>
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
                    background: isActive ? 'rgba(111,78,55,0.10)' : 'transparent',
                    borderLeft: isActive ? '3px solid #C89B3C' : '3px solid transparent',
                  }}>
                  <Icon className="h-4 w-4 flex-shrink-0" style={{ color: isActive ? '#6F4E37' : '#A8927F' }} />
                  <span className="text-sm font-semibold truncate" style={{ color: isActive ? '#3D2314' : '#6B6B6B' }}>
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
