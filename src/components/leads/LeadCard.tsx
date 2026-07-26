'use client';

import Link from 'next/link';
import {
  Phone, MessageCircle, Eye, ArrowRight,
  Home, IndianRupee, Calendar, ExternalLink, User,
} from 'lucide-react';
import {
  Lead, LeadStage, STAGE_ORDER, STAGE_LABELS,
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

const PRIORITY_STYLES: Record<
  'hot' | 'warm' | 'cold',
  { label: string; chip: string; dot: string }
> = {
  hot:  { label: 'Hot',  chip: 'chip chip--neg', dot: 'var(--neg)' },
  warm: { label: 'Warm', chip: 'chip chip--warn', dot: 'var(--warn)' },
  cold: { label: 'Cold', chip: 'chip chip--acc', dot: 'var(--acc)' },
};

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
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
  const priorityCfg = lead.priority ? PRIORITY_STYLES[lead.priority] : null;
  const followUpUrgency = getFollowUpUrgency(lead.followUpDate);
  const followUpDate = lead.followUpDate ? new Date(lead.followUpDate) : null;
  const isStale = daysSince > 7;

  const followUpChip =
    followUpUrgency === 'overdue' ? 'chip chip--neg'  :
    followUpUrgency === 'today'   ? 'chip chip--warn' :
                                    'chip';

  return (
    <div
      className="card p-3.5 mb-2.5 group"
      style={
        isStale
          ? { borderColor: 'var(--neg)', boxShadow: '0 0 0 1px var(--neg-tint) inset' }
          : undefined
      }
    >
      {/* Header — avatar · name+priority · external */}
      <div className="flex items-start gap-2.5 mb-3">
        <span
          className="h-9 w-9 rounded-md flex items-center justify-center text-xs font-semibold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--acc), var(--acc-lo))',
            color: '#FFFFFF',
          }}
        >
          {initials}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--ink)', maxWidth: 130 }}
              title={lead.contactName}
            >
              {lead.contactName}
            </p>
            {priorityCfg && (
              <span className={priorityCfg.chip}>
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: priorityCfg.dot }}
                />
                {priorityCfg.label}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 num" style={{ color: 'var(--ink-4)' }}>
            {lead.contactPhone}
          </p>
        </div>

        <Link
          href={`/leads/${lead.id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded"
          style={{ color: 'var(--ink-3)' }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Open lead details"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      </div>

      {/* Property + budget */}
      {(lead.propertyType || lead.budgetBand) && (
        <div className="flex items-center gap-3 mb-2.5 flex-wrap">
          {lead.propertyType && (
            <span
              className="inline-flex items-center gap-1 text-[11px]"
              style={{ color: 'var(--ink-3)' }}
            >
              <Home className="h-3 w-3" strokeWidth={1.75} />
              {lead.propertyType}
            </span>
          )}
          {lead.budgetBand && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium"
              style={{ color: 'var(--ink-2)' }}
            >
              <IndianRupee className="h-3 w-3" strokeWidth={2} />
              {lead.budgetBand}
            </span>
          )}
        </div>
      )}

      {/* Project value */}
      {(lead.projectValuePaise ?? 0) > 0 && (
        <div className="flex items-baseline gap-1.5 mb-2.5">
          <span
            className="text-sm font-semibold num"
            style={{ color: 'var(--acc)' }}
          >
            ₹
            {((lead.projectValuePaise ?? 0) / 100).toLocaleString('en-IN', {
              maximumFractionDigits: 0,
            })}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
            est. value
          </span>
        </div>
      )}

      {/* Follow-up */}
      {followUpDate && (
        <div className="mb-2.5">
          <span className={followUpChip}>
            <Calendar className="h-3 w-3" strokeWidth={1.75} />
            {followUpUrgency === 'overdue'
              ? 'Overdue · '
              : followUpUrgency === 'today'
                ? 'Today · '
                : 'Follow-up · '}
            {followUpDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      )}

      {/* Meta row — source · designer · age */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="chip">{SOURCE_LABELS[lead.source] ?? lead.source}</span>
          {lead.designerName && (
            <span
              className="inline-flex items-center gap-1 text-[10px] truncate"
              style={{ color: 'var(--ink-4)' }}
            >
              <User className="h-2.5 w-2.5" strokeWidth={1.75} />
              {lead.designerName}
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-medium flex-shrink-0"
          style={{ color: isStale ? 'var(--neg)' : 'var(--ink-4)' }}
        >
          {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
        </span>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-0.5 pt-2.5"
        style={{ borderTop: '1px solid var(--line)' }}
      >
        <ActionButton href={`tel:${lead.contactPhone}`} icon={Phone} label="Call" />
        <ActionButton
          href={`https://wa.me/91${lead.contactPhone.replace(/\D/g, '')}`}
          icon={MessageCircle}
          label="WA"
          external
        />
        <ActionButton href={`/leads/${lead.id}`} icon={Eye} label="View" internal />
        {nextStage && (
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-colors"
            style={{ color: 'var(--ink-2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-hi)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => onStageChange(lead.id, nextStage)}
            title={`Move to ${STAGE_LABELS[nextStage]}`}
          >
            <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
            <span>Move</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  href,
  icon: Icon,
  label,
  external = false,
  internal = false,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
  internal?: boolean;
}) {
  const cls =
    'flex flex-1 items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-colors';
  const style: React.CSSProperties = { color: 'var(--ink-2)' };
  const handlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = 'var(--panel-hi)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = 'transparent';
    },
  };

  if (internal) {
    return (
      <Link
        href={href}
        className={cls}
        style={style}
        title={label}
        onClick={(e) => e.stopPropagation()}
        {...handlers}
      >
        <Icon className="h-3 w-3" strokeWidth={1.75} />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={cls}
      style={style}
      title={label}
      onClick={(e) => e.stopPropagation()}
      {...handlers}
    >
      <Icon className="h-3 w-3" strokeWidth={1.75} />
      <span>{label}</span>
    </a>
  );
}
