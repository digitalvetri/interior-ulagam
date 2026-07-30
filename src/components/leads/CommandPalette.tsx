'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Users, LayoutDashboard, ArrowRight } from 'lucide-react';
import { Lead, STAGE_LABELS } from '@/types/leads';
import { NAV_GROUPS } from '@/lib/nav-items';

function scoreColor(score: number): string {
  if (score >= 70) return '#16A34A';
  if (score >= 40) return '#EA580C';
  return '#6B7280';
}

export function CommandPalette() {
  const [open, setOpen]               = useState(false);
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const router = useRouter();

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Lazy-fetch leads when first opened
  useEffect(() => {
    if (open && !leadsLoaded) {
      fetch('/api/v1/leads')
        .then(r => r.json())
        .then(({ data }: { data: Lead[] | null }) => {
          setLeads(data ?? []);
          setLeadsLoaded(true);
        })
        .catch(() => setLeadsLoaded(true));
    }
  }, [open, leadsLoaded]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center"
      style={{ paddingTop: '12vh', background: 'rgba(0,0,0,0.45)' }}
      onClick={() => setOpen(false)}
    >
      <Command
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          maxWidth: 560,
          maxHeight: '65vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          margin: '0 16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />
          <Command.Input
            autoFocus
            placeholder="Search leads, pages, actions…"
            style={{
              flex: 1,
              outline: 'none',
              fontSize: 14,
              background: 'transparent',
              color: '#111827',
            }}
          />
          <button
            type="button"
            className="text-[11px] px-2 py-1 rounded-lg flex-shrink-0"
            style={{ background: '#F3F4F6', color: '#6B7280' }}
            onClick={() => setOpen(false)}
          >
            Esc
          </button>
        </div>

        {/* Results */}
        <Command.List style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
          <Command.Empty style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
            No results found
          </Command.Empty>

          {/* Navigation */}
          <Command.Group>
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 mb-1"
              style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em' }}
            >
              <LayoutDashboard className="h-3 w-3" />
              NAVIGATE
            </div>
            {NAV_GROUPS.flatMap(g => g.items).map(item => {
              const Icon = item.icon;
              return (
                <Command.Item
                  key={item.href}
                  value={`nav ${item.label}`}
                  onSelect={() => { router.push(item.href); setOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#374151',
                  }}
                  className="command-item"
                >
                  <Icon className="h-4 w-4 flex-shrink-0" style={{ color: '#7C5CFC' }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <ArrowRight className="h-3 w-3" style={{ color: '#D1D5DB' }} />
                </Command.Item>
              );
            })}
          </Command.Group>

          {/* Leads */}
          {leads.length > 0 && (
            <Command.Group>
              <div
                className="flex items-center gap-1.5 px-2 py-1.5 mt-2 mb-1"
                style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em' }}
              >
                <Users className="h-3 w-3" />
                LEADS
              </div>
              {leads.slice(0, 12).map(lead => (
                <Command.Item
                  key={lead.id}
                  value={`lead ${lead.contactName} ${lead.contactPhone} ${lead.projectLocation ?? ''}`}
                  onSelect={() => { router.push(`/leads/${lead.id}`); setOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                  className="command-item"
                >
                  {/* Score dot */}
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: scoreColor(lead.score ?? 0) }}
                    title={`Score: ${lead.score}`}
                  >
                    {lead.score ?? 0}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.contactName}
                    </p>
                    <p style={{ fontSize: 11, color: '#6B7280' }}>
                      {lead.contactPhone}
                      {lead.projectLocation ? ` · ${lead.projectLocation}` : ''}
                      {' · '}
                      <span style={{ color: '#7C5CFC' }}>{STAGE_LABELS[lead.stage]}</span>
                    </p>
                  </div>
                  <ArrowRight className="h-3 w-3 flex-shrink-0" style={{ color: '#D1D5DB' }} />
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        {/* Footer hint */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderTop: '1px solid #F3F4F6', fontSize: 11, color: '#9CA3AF' }}
        >
          <span>↑↓ navigate · Enter select · Esc close</span>
          <span style={{ color: '#D1D5DB' }}>⌘K</span>
        </div>
      </Command>

      <style>{`
        .command-item:hover,
        [data-selected=true].command-item {
          background: #F5F3FF !important;
          color: #7C5CFC !important;
        }
      `}</style>
    </div>
  );
}
