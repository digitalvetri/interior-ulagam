'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, MessageCircle, Bell, BellRing,
  MapPin,
  MoreVertical, Edit2, Trash2, ExternalLink,
} from 'lucide-react';
import { Lead, STAGE_LABELS, PRIORITY_CONFIG } from '@/types/leads';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';
import { FollowUpModal } from '@/components/leads/FollowUpModal';

/* ── Helpers ── */
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function isOverdue(dateIso?: string | null): boolean {
  if (!dateIso) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fd    = new Date(dateIso); fd.setHours(0, 0, 0, 0);
  return fd < today;
}
function isToday(dateIso?: string | null): boolean {
  if (!dateIso) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fd    = new Date(dateIso); fd.setHours(0, 0, 0, 0);
  return fd.getTime() === today.getTime();
}

const STAGE_STYLE: Record<string, { bg: string; color: string }> = {
  new:                  { bg: 'var(--accent-soft)',   color: 'var(--accent-text)' },
  site_visit_scheduled: { bg: '#FEF9C3',              color: '#854D0E' },
  consultation_done:    { bg: 'var(--warning-soft)',  color: '#C2410C' },
  proposal_sent:        { bg: '#EEF2FF',              color: '#4338CA' },
  negotiation:          { bg: 'var(--accent-soft)',   color: 'var(--accent-base)' },
  won:                  { bg: 'var(--success-soft)',  color: 'var(--success-text)' },
  lost:                 { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
};

/* ── Project card ── */
function ProjectCard({
  lead,
  index,
  onRefetch,
}: {
  lead: Lead;
  index: number;
  onRefetch: () => void;
}) {
  const router    = useRouter();
  const menuRef   = useRef<HTMLDivElement>(null);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  /* close menu on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const ss      = STAGE_STYLE[lead.stage] ?? { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' };
  const age     = daysSince(lead.lastActivityAt);
  const overdue = isOverdue(lead.followUpDate);
  const today   = isToday(lead.followUpDate);
  const value   = (lead.projectValuePaise ?? 0) > 0
    ? `₹${((lead.projectValuePaise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : null;
  const title   = lead.projectName ?? lead.propertyType ?? STAGE_LABELS[lead.stage];
  const subtype = lead.projectName && lead.propertyType ? lead.propertyType : null;
  const pc      = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;

  const bellColor = overdue ? 'var(--danger)'
    : today         ? 'var(--warning)'
    : lead.followUpDate ? 'var(--accent-base)'
    : 'var(--text-tertiary)';

  const bellTitle = overdue ? 'Overdue follow-up'
    : today         ? "Today's follow-up"
    : lead.followUpDate ? 'Upcoming follow-up'
    : 'Add follow-up';

  const handleDelete = async () => {
    setMenuOpen(false);
    const confirmed = window.confirm(
      `Delete "${title}"?\n\nThis will remove only this project and will not affect other projects for this customer.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await fetch(`/api/v1/leads/${lead.id}`, { method: 'DELETE' });
      onRefetch();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden w-full transition-all duration-150"
      style={{
        background: deleting ? 'var(--surface-muted)' : 'var(--surface-card)',
        border: '1.5px solid var(--border-subtle)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        opacity: deleting ? 0.5 : 1,
        borderLeft: `3px solid ${ss.color}`,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.09)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; }}
    >
      <div className="px-4 py-3.5 flex items-start gap-2">

        {/* Clickable content */}
        <Link href={`/leads/${lead.id}`} className="flex-1 min-w-0" style={{ textDecoration: 'none' }}>
          {/* Row 1: enquiry number + name + stage badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              Enquiry {index + 1}
            </span>
            <p className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--text-heading)' }}>
              {title}
            </p>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0"
              style={{ background: ss.bg, color: ss.color }}
            >
              {STAGE_LABELS[lead.stage]}
            </span>
            {pc && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0"
                style={{ background: pc.bg, color: pc.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: pc.dot }} />
                {pc.label}
              </span>
            )}
          </div>

          {/* Row 2: property type + location + budget + age */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {subtype && (
              <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{subtype}</span>
            )}
            {lead.projectLocation && (
              <span className="flex items-center gap-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                <MapPin className="h-3 w-3 flex-shrink-0" />{lead.projectLocation}
              </span>
            )}
            {value && (
              <span
                className="text-[13px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: '#FEF3C7', color: '#92400E' }}
              >
                {value}
              </span>
            )}
            {!value && lead.budgetBand && (
              <span className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>{lead.budgetBand}</span>
            )}
            <span className="text-[12px]" style={{ color: overdue ? 'var(--danger)' : 'var(--text-tertiary)' }}>
              {age === 0 ? 'Today' : `${age}d ago`}
            </span>
            {overdue && (
              <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--danger)' }}>
                <Bell className="h-3 w-3" /> Overdue
              </span>
            )}
          </div>
        </Link>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setFollowUpOpen(true)}
            className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-violet-50"
            title={bellTitle}
          >
            <BellRing className="h-3.5 w-3.5" style={{ color: bellColor }} />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
            >
              <MoreVertical className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-8 z-50 w-44 rounded-xl py-1 shadow-lg"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
              >
                <Link
                  href={`/leads/${lead.id}`}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-violet-50 transition-colors"
                  style={{ color: 'var(--text-heading)', textDecoration: 'none', display: 'flex' }}
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} /> View Details
                </Link>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-violet-50 transition-colors"
                  style={{ color: 'var(--text-heading)' }}
                  onClick={() => { setMenuOpen(false); setFollowUpOpen(true); }}
                >
                  <BellRing className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} /> Add Follow-up
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-violet-50 transition-colors"
                  style={{ color: 'var(--text-heading)' }}
                  onClick={() => { setMenuOpen(false); router.push(`/leads/${lead.id}?edit=1`); }}
                >
                  <Edit2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--violet-primary)' }} /> Edit Project
                </button>
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-red-50 transition-colors"
                  style={{ color: 'var(--danger)' }}
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3.5 w-3.5 flex-shrink-0" /> Delete Project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {followUpOpen && (
        <FollowUpModal
          lead={lead}
          onClose={() => setFollowUpOpen(false)}
          onSaved={() => { setFollowUpOpen(false); onRefetch(); }}
        />
      )}
    </div>
  );
}

/* ── Main exported view ── */
export interface CustomerLeadViewProps {
  leads: Lead[];
  loading: boolean;
  refetch: () => void;
}

export function CustomerLeadView({ leads, loading, refetch }: CustomerLeadViewProps) {
  const router   = useRouter();
  const customer = leads[0];
  const [addKey, setAddKey] = useState(0);
  const initials = customer
    ? customer.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '';

  return (
    <div className="min-h-full" style={{ background: 'var(--surface-app)' }}>
      <div className="px-6 pt-5 pb-8 space-y-3">

        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </button>

        {loading ? (
          <div className="space-y-3">
            {[68, 60, 60].map((h, i) => (
              <div key={i} className="rounded-xl animate-pulse" style={{ height: h, background: 'var(--surface-muted)' }} />
            ))}
          </div>
        ) : !customer ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No projects found for this customer.</p>
        ) : (
          <>
            {/* ── Customer header ── */}
            <div
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: 'var(--surface-card)', border: '1.5px solid var(--border-subtle)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              {/* Avatar */}
              <div
                className="h-11 w-11 rounded-full flex items-center justify-center text-[15px] font-bold text-white flex-shrink-0 select-none"
                style={{ background: 'linear-gradient(135deg, var(--accent-base) 0%, #9B8AFB 100%)' }}
              >
                {initials}
              </div>

              {/* Name + contact */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-[17px] font-bold truncate" style={{ color: 'var(--text-heading)' }}>
                    {customer.contactName}
                  </h1>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                  >
                    {leads.length} {leads.length === 1 ? 'enquiry' : 'enquiries'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <a href={`tel:${customer.contactPhone}`} className="flex items-center gap-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    <Phone className="h-3 w-3 flex-shrink-0" /> {customer.contactPhone}
                  </a>
                  {customer.contactEmail && (
                    <span className="text-[13px] truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>{customer.contactEmail}</span>
                  )}
                  {customer.contactCity && (
                    <span className="flex items-center gap-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                      <MapPin className="h-3 w-3 flex-shrink-0" />{customer.contactCity}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a
                  href={`tel:${customer.contactPhone}`}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium"
                  style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #DBEAFE' }}
                >
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
                <a
                  href={`https://wa.me/91${customer.contactPhone.replace(/\D/g, '')}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium"
                  style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <NewLeadDialog
                  onSuccess={refetch}
                  triggerLabel="+ Add Enquiry"
                  preselectedCustomer={{
                    fullName: customer.contactName,
                    phone: customer.contactPhone,
                    city: customer.contactCity ?? null,
                  }}
                />
              </div>
            </div>

            {/* ── Project list ── */}
            <div>
              <p
                className="text-[10px] font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                Projects & Enquiries
              </p>
              <div className="space-y-3">
                {leads.map((lead, i) => (
                  <ProjectCard key={lead.id} lead={lead} index={i} onRefetch={refetch} />
                ))}

                {/* Add another enquiry prompt */}
                <button
                  type="button"
                  className="w-full rounded-xl py-3 text-[13px] font-medium transition-all"
                  style={{ border: '1.5px dashed var(--border-subtle)', color: 'var(--text-tertiary)', background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-base)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-base)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                  onClick={() => setAddKey(k => k + 1)}
                >
                  + Add another enquiry
                </button>
                {addKey > 0 && (
                  <NewLeadDialog
                    key={addKey}
                    onSuccess={() => { refetch(); }}
                    defaultOpen
                    preselectedCustomer={{
                      fullName: customer.contactName,
                      phone: customer.contactPhone,
                      city: customer.contactCity ?? null,
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
