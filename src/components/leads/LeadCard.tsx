'use client';

import Link from 'next/link';
import {
  Phone, MessageCircle, Eye, ArrowRight,
  Home, IndianRupee, Calendar, ExternalLink, User,
} from 'lucide-react';
import {
  Lead, LeadStage, ScoreBreakdown, STAGE_ORDER, STAGE_LABELS, PRIORITY_CONFIG,
} from '@/types/leads';

interface LeadCardProps {
  lead: Lead;
  onStageChange: (leadId: string, newStage: LeadStage) => void;
  onSelect?: (lead: Lead) => void;
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

type RottingStatus = 'fresh' | 'stale' | 'rotting';

function getRottingStatus(lastActivityAt: string): RottingStatus {
  const days = getDaysSince(lastActivityAt);
  if (days <= 7)  return 'fresh';
  if (days <= 14) return 'stale';
  return 'rotting';
}

const ROTTING_RING: Record<RottingStatus, string> = {
  fresh:   'transparent',
  stale:   '#F59E0B',
  rotting: '#EF4444',
};

type FollowUpUrgency = 'overdue' | 'today' | 'upcoming' | null;

// ── Score arc (SVG) ──────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return '#16A34A'; // green
  if (score >= 40) return '#EA580C'; // amber
  return '#6B7280';                   // grey
}

function ScoreArc({ score, breakdown }: { score: number; breakdown?: ScoreBreakdown }) {
  const r = 12;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(100, Math.max(0, score)) / 100;
  const dash = pct * circ;
  const color = scoreColor(score);

  const tooltip = breakdown
    ? `Score: ${score}/100\nRecency: ${breakdown.recency}/30 · Value: ${breakdown.value}/25 · Completeness: ${breakdown.completeness}/20 · Source: ${breakdown.source}/15 · Engagement: ${breakdown.engagement}/10`
    : `Score: ${score}/100`;

  return (
    <div title={tooltip} className="flex flex-col items-center flex-shrink-0" style={{ width: 32, height: 32 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="16" cy="16" r={r} fill="none" stroke="#E5E7EB" strokeWidth="3" />
        {/* Arc */}
        <circle
          cx="16" cy="16" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <span
        className="text-[9px] font-bold leading-none -mt-[26px] relative z-10"
        style={{ color, transform: 'rotate(0deg)' }}
      >
        {score}
      </span>
    </div>
  );
}

function getFollowUpUrgency(followUpDate?: string | null): FollowUpUrgency {
  if (!followUpDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fd = new Date(followUpDate);
  fd.setHours(0, 0, 0, 0);
  if (fd < today) return 'overdue';
  if (fd.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

export function LeadCard({ lead, onStageChange, onSelect }: LeadCardProps) {
  const initials = getInitials(lead.contactName);
  const daysSince = getDaysSince(lead.lastActivityAt);
  const rottingStatus = getRottingStatus(lead.lastActivityAt);
  const stageIndex = STAGE_ORDER.indexOf(lead.stage);
  const nextStage = stageIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[stageIndex + 1] : null;
  const priorityCfg = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const followUpUrgency = getFollowUpUrgency(lead.followUpDate);
  const followUpDate = lead.followUpDate ? new Date(lead.followUpDate) : null;

  const fuStyle =
    followUpUrgency === 'overdue' ? { bg: '#FEF2F2', color: '#DC2626' } :
    followUpUrgency === 'today'   ? { bg: '#FFF7ED', color: '#EA580C' } :
                                    { bg: '#FAF9F6', color: '#6B6459' };

  const ringColor = ROTTING_RING[rottingStatus];

  return (
    <div
      className="premium-card p-4 mb-3 group transition-all cursor-pointer"
      style={{
        borderColor: ringColor !== 'transparent' ? ringColor : '#E2DED5',
        boxShadow: rottingStatus === 'rotting'
          ? '0 0 0 1px #EF4444, 0 0 8px #EF444430'
          : undefined,
      }}
      onClick={() => onSelect?.(lead)}
    >
      {/* ── Header: Score + Avatar + Name + Priority + External Link ──── */}
      <div className="flex items-start gap-2.5 mb-3">
        <ScoreArc score={lead.score ?? 0} breakdown={lead.scoreBreakdown} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: '#221F1B', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            {rottingStatus === 'rotting' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                Rotting
              </span>
            )}
            {rottingStatus === 'stale' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0" style={{ background: '#FFF3CD', color: '#92400E' }}>
                Stale
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#6B6459' }}>{lead.contactPhone}</p>
        </div>

        <Link
          href={`/leads/${lead.id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-[#F0EEE9]"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" style={{ color: '#6B6459' }} />
        </Link>
      </div>

      {/* ── Property + Budget ──────────────────────────────────────────── */}
      {(lead.propertyType || lead.budgetBand) && (
        <div className="flex items-center gap-3 mb-2.5 flex-wrap">
          {lead.propertyType && (
            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#6B6459' }}>
              <Home className="h-3 w-3" />
              {lead.propertyType}
            </span>
          )}
          {lead.budgetBand && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: '#24211E' }}>
              <IndianRupee className="h-3 w-3" />
              {lead.budgetBand}
            </span>
          )}
        </div>
      )}

      {/* ── Project Value ───────────────────────────────────────────────── */}
      {(lead.projectValuePaise ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-sm font-bold" style={{ color: '#8F6F2E' }}>
            ₹{((lead.projectValuePaise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px]" style={{ color: '#6B6459' }}>est. value</span>
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
            style={{ background: '#F0EEE9', color: '#24211E' }}
          >
            {SOURCE_LABELS[lead.source] ?? lead.source}
          </span>
          {lead.designerName && (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: '#6B6459' }}>
              <User className="h-2.5 w-2.5" />
              {lead.designerName}
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-medium"
          style={{ color: rottingStatus === 'rotting' ? '#EF4444' : rottingStatus === 'stale' ? '#D97706' : '#6B6459' }}
        >
          {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
        </span>
      </div>

      {/* ── Action row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 pt-2.5" style={{ borderTop: '1px solid #F0EEE9' }}>
        <a
          href={`tel:${lead.contactPhone}`}
          className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[#F0EEE9]"
          style={{ color: '#24211E' }}
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
          className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[#F0EEE9]"
          style={{ color: '#24211E' }}
          onClick={e => e.stopPropagation()}
          title="WhatsApp"
        >
          <MessageCircle className="h-3 w-3" />
          <span>WA</span>
        </a>

        <Link
          href={`/leads/${lead.id}`}
          className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[#F0EEE9]"
          style={{ color: '#24211E' }}
          onClick={e => e.stopPropagation()}
          title="View Details"
        >
          <Eye className="h-3 w-3" />
          <span>View</span>
        </Link>

        {nextStage && (
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[#F0EEE9]"
            style={{ color: '#24211E' }}
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
