'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { X, Phone, Mail, MessageSquare, ArrowUpRight } from 'lucide-react';
import type { Customer, CustomerActivity, CustomerStage } from '@/types/customers';

const STAGE_LABEL: Record<CustomerStage, string> = {
  lead:        'Lead',
  opportunity: 'Opportunity',
  client:      'Client',
  past_client: 'Past client',
};

const STAGE_STYLE: Record<CustomerStage, { bg: string; color: string; dot: string }> = {
  lead:        { bg: 'rgba(100,116,139,0.10)', color: '#475569', dot: '#94a3b8' },
  opportunity: { bg: 'rgba(245,158,11,0.12)',  color: '#b45309', dot: '#f59e0b' },
  client:      { bg: 'rgba(16,185,129,0.12)',  color: '#065f46', dot: '#10b981' },
  past_client: { bg: 'rgba(148,163,184,0.12)', color: '#64748b', dot: '#cbd5e1' },
};

function MiniAvatar({ name }: { name: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  return (
    <span
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
    >
      {initials || '?'}
    </span>
  );
}

const ACTIVITY_LABEL: Record<string, string> = {
  call:             'Call',
  whatsapp:         'WhatsApp message',
  note:             'Note',
  site_visit:       'Site visit',
  meeting:          'Meeting',
  stage_change:     'Stage changed',
  project_created:  'Project created',
  payment_received: 'Payment received',
  quote_sent:       'Quote sent',
  follow_up:        'Follow-up',
};

interface Props {
  customer: Customer;
  onClose: () => void;
}

export function CustomerQuickPane({ customer, onClose }: Props) {
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const stageSt = STAGE_STYLE[customer.stage];
  const waPhone = customer.phone.replace(/\D/g, '');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/customers/${customer.id}/activities`)
      .then((r) => r.json())
      .then(({ data }: { data: CustomerActivity[] | null }) => {
        if (!cancelled) setActivities((data ?? []).slice(0, 5));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [customer.id]);

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      className="flex w-80 flex-shrink-0 flex-col border-l"
      style={{
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderColor: 'var(--border-subtle, #e8eaf0)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.07)',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <MiniAvatar name={customer.fullName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
            {customer.fullName}
          </p>
          {customer.company && (
            <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{customer.company}</p>
          )}
          <span
            className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: stageSt.bg, color: stageSt.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: stageSt.dot }} />
            {STAGE_LABEL[customer.stage]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* Contact info strip */}
      {(customer.city || customer.lastContactedAt) && (
        <div className="px-4 pb-2">
          {customer.city && (
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {customer.city}
            </p>
          )}
          {customer.lastContactedAt && (
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Last contact{' '}
              {new Date(customer.lastContactedAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short',
              })}
            </p>
          )}
        </div>
      )}

      {/* Quick action buttons */}
      <div
        className="flex gap-2 px-4 py-2.5 border-t border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <a
          href={`tel:${customer.phone}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors hover:opacity-80"
          style={{ background: 'rgba(59,130,246,0.09)', color: '#2563eb' }}
        >
          <Phone className="h-3.5 w-3.5" />
          Call
        </a>
        <a
          href={`https://wa.me/${waPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors hover:opacity-80"
          style={{ background: 'rgba(16,185,129,0.09)', color: '#059669' }}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          WhatsApp
        </a>
        {customer.email && (
          <a
            href={`mailto:${customer.email}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors hover:opacity-80"
            style={{ background: 'rgba(124,92,252,0.09)', color: 'var(--violet-primary, #7c5cfc)' }}
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </a>
        )}
      </div>

      {/* Activity timeline */}
      <div className="flex-1 overflow-auto p-4">
        <p
          className="mb-3 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-secondary)' }}
        >
          Recent activity
        </p>
        {activities.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No activity recorded yet</p>
        ) : (
          <div className="relative space-y-4 pl-4">
            {/* Vertical timeline line */}
            <div
              className="absolute left-1.5 top-2 bottom-2 w-px"
              style={{ background: 'var(--border-subtle, #e8eaf0)' }}
            />
            {activities.map((a) => (
              <div key={a.id} className="relative">
                <span
                  className="absolute -left-2.5 top-1 h-2 w-2 rounded-full border-2 border-white"
                  style={{ background: 'var(--violet-primary, #7c5cfc)' }}
                />
                <p className="text-xs font-medium" style={{ color: 'var(--text-heading)' }}>
                  {ACTIVITY_LABEL[a.type] ?? a.type.replace(/_/g, ' ')}
                </p>
                {a.title && a.title !== (ACTIVITY_LABEL[a.type] ?? a.type) && (
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{a.title}</p>
                )}
                {a.body && (
                  <p className="mt-0.5 line-clamp-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {a.body}
                  </p>
                )}
                <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                  {new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <Link
          href={`/customers/${customer.id}`}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ background: 'var(--violet-primary, #7c5cfc)', color: '#fff' }}
        >
          Open full profile
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}
