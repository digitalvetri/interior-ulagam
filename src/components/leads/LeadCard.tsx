'use client';

import Link from 'next/link';
import {
  Phone, MessageCircle, Eye, ArrowRight,
  Home, IndianRupee, Calendar, ExternalLink, User,
} from 'lucide-react';
import {
  Lead, LeadStage, STAGE_ORDER, STAGE_LABELS, PRIORITY_CONFIG,
} from '@/types/leads';

interface LeadCardProps {
  lead: Lead;
  onStageChange: (leadId: string, newStage: LeadStage) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  referral: 'Referral',
  website: 'Website',
  walk_in: 'Walk-in',
  other: 'Other',
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getDaysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
}

type FollowUpUrgency = 'overdue' | 'today' | 'upcoming' | null;

function getFollowUpUrgency(followUpDate?: string): FollowUpUrgency {
  if (!followUpDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fd = new Date(followUpDate);
  fd.setHours(0, 0, 0, 0);
  if (fd < today) return 'overdue';
  if (fd.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

export function LeadCard({ lead, onStageChange }: LeadCardProps) {
  const initials = getInitials(lead.contactName);
  const daysSince = getDaysSince(lead.lastActivityAt);
  const stageIndex = STAGE_ORDER.indexOf(lead.stage);
  const nextStage = stageIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[stageIndex + 1] : null;
  const priorityCfg = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const followUpUrgency = getFollowUpUrgency(lead.followUpDate);
  const followUpDate = lead.followUpDate ? new Date(lead.followUpDate) : null;

  const fuStyle =
    followUpUrgency === 'overdue' ? { bg: '#FEF2F2', color: '#DC2626' } :
    followUpUrgency === 'today'   ? { bg: '#FFF7ED', color: '#EA580C' } :
                                    { bg: '#F8F5F2', color: '#6B6B6B' };

  const isStale = daysSince > 7;

  return (
    <div
      className="premium-card p-4 mb-3 group transition-all"
      style={{ borderColor: isStale ? '#FCA5A5' : '#C8B7A6' }}
    >
      {/* ── Header: Avatar + Name + Priority + External Link ────────────── */}
      <div className="flex items-start gap-2.5 mb-3">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #A07048 0%, #6F4E37 100%)' }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: '#1C1C1C', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.contactName}
            </p>
            {priorityCfg && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                style={{ background: priorityCfg.bg, color: priorityCfg.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityCfg.dot }} />
                {priorityCfg.label}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#6B6B6B' }}>{lead.contactPhone}</p>
        </div>

        <Link
          href={`/leads/${lead.id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-[#E9DFD3]"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" style={{ color: '#6B6B6B' }} />
        </Link>
      </div>

      {/* ── Property + Budget ──────────────────────────────────────────── */}
      {(lead.propertyType || lead.budgetBand) && (
        <div className="flex items-center gap-3 mb-2.5 flex-wrap">
          {lead.propertyType && (
            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#6B6B6B' }}>
              <Home className="h-3 w-3" />
              {lead.propertyType}
            </span>
          )}
          {lead.budgetBand && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: '#6F4E37' }}>
              <IndianRupee className="h-3 w-3" />
              {lead.budgetBand}
            </span>
          )}
        </div>
      )}

      {/* ── Project Value ───────────────────────────────────────────────── */}
      {(lead.projectValuePaise ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-sm font-bold" style={{ color: '#C89B3C' }}>
            ₹{((lead.projectValuePaise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px]" style={{ color: '#6B6B6B' }}>est. value</span>
        </div>
      )}

      {/* ── Follow-up badge ─────────────────────────────────────────────── */}
      {followUpDate && (
        <div
          className="flex items-center gap-1.5 mb-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
          style={{ background: fuStyle.bg, color: fuStyle.color }}
        >
          <Calendar className="h-3 w-3 flex-shrink-0" />
          {followUpUrgency === 'overdue' ? 'Overdue · ' :
           followUpUrgency === 'today'   ? 'Today · '   : 'Follow-up · '}
          {followUpDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </div>
      )}

      {/* ── Footer: source + designer + age ────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: '#E9DFD3', color: '#6F4E37' }}
          >
            {SOURCE_LABELS[lead.source] ?? lead.source}
          </span>
          {lead.designerName && (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: '#6B6B6B' }}>
              <User className="h-2.5 w-2.5" />
              {lead.designerName}
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-medium"
          style={{ color: isStale ? '#EF4444' : '#6B6B6B' }}
        >
          {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
        </span>
      </div>

      {/* ── Action row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 pt-2.5" style={{ borderTop: '1px solid #E9DFD3' }}>
        <a
          href={`tel:${lead.contactPhone}`}
          className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[#E9DFD3]"
          style={{ color: '#6F4E37' }}
          onClick={e => e.stopPropagation()}
          title="Call"
        >
          <Phone className="h-3 w-3" />
          <span>Call</span>
        </a>

        <a
          href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[#E9DFD3]"
          style={{ color: '#6F4E37' }}
          onClick={e => e.stopPropagation()}
          title="WhatsApp"
        >
          <MessageCircle className="h-3 w-3" />
          <span>WA</span>
        </a>

        <Link
          href={`/leads/${lead.id}`}
          className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[#E9DFD3]"
          style={{ color: '#6F4E37' }}
          onClick={e => e.stopPropagation()}
          title="View Details"
        >
          <Eye className="h-3 w-3" />
          <span>View</span>
        </Link>

        {nextStage && (
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[#E9DFD3]"
            style={{ color: '#6F4E37' }}
            onClick={() => onStageChange(lead.id, nextStage)}
            title={`Move to ${STAGE_LABELS[nextStage]}`}
          >
            <ArrowRight className="h-3 w-3" />
            <span>Move</span>
          </button>
        )}
      </div>
    </div>
  );
}
