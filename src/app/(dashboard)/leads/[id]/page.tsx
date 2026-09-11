'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, Mail, MessageCircle, Calendar, FileText, Home,
  Users, MapPin, CheckCircle2, AlertCircle,
  Plus, FolderKanban, ChevronDown, ChevronUp,
  Zap,
  Edit2, Trash2, Archive, MoreVertical,
  Upload, ExternalLink, Download,
} from 'lucide-react';
import { Lead, STAGE_LABELS, STAGE_COLORS, PRIORITY_CONFIG, LeadActivity, MeasurementRound, MeasurementItem } from '@/types/leads';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { ProjectDetailsDialog } from '@/components/leads/ProjectDetailsDialog';
import { ScheduleSiteVisitModal } from '@/components/leads/ScheduleSiteVisitModal';
import { MarkContactedModal } from '@/components/leads/MarkContactedModal';
import { QualifyLeadModal } from '@/components/leads/QualifyLeadModal';
import { ConvertLeadModal } from '@/components/leads/ConvertLeadModal';
import type { Quote } from '@/types/quotes';
import type { DocumentRow } from '@/types/documents';
import type { SiteVisit } from '@/types/site-visits';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DesignDeliverablesTab } from '@/components/leads/DesignDeliverablesTab';

type LeadDocument = DocumentRow & { downloadUrl: string | null };

interface LeadFollowUp {
  id: string;
  followUpDate: string | null;
  stage: string;
  clientStatus: string;
  comments: string | null;
  completedAt: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WaMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  bodyPreview: string | null;
  createdAt: string;
}

/* ── Helpers ───────────────────────────────────────────────── */
function fmt(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function followUpUrgency(dateIso: string): 'overdue' | 'today' | 'upcoming' {
  // Normalise to midnight local time — avoids IST/UTC offset false-positives.
  const dateStr = dateIso.length === 10 ? dateIso : dateIso.split('T')[0];
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}
function fmtFollowUpDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  if (t.getTime() === today.getTime())     return 'Today';
  if (t.getTime() === tomorrow.getTime())  return 'Tomorrow';
  if (t.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function relDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  if (t.getTime() === today.getTime())     return 'Today';
  if (t.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function fmtBudgetBand(band: string): string {
  // "10l_25l" → "10L – 25L"
  return band.replace(/(\d+(?:\.\d+)?)l/gi, (_, n: string) => `${n}L`).replace(/_/g, ' – ');
}
const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', whatsapp: 'WhatsApp', referral: 'Referral',
  website: 'Website', walk_in: 'Walk-in', other: 'Other',
};



/* ── MarkLostDialog ────────────────────────────────────────── */
function MarkLostDialog({ open, value, onChange, onConfirm, onCancel, loading }: {
  open: boolean; value: string; onChange: (v: string) => void;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-heading)' }}>Mark Lead as Lost</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Provide a reason to help improve the team&apos;s close rate.</p>
        <textarea rows={3} className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-2"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)', color: 'var(--text-heading)' }}
          placeholder="e.g. Budget exceeded, chose a competitor, project postponed…"
          value={value} onChange={e => onChange(e.target.value)}
          autoFocus />
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading || !value.trim()} className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50" style={{ background: 'var(--danger)', color: '#fff' }}>
            {loading ? 'Marking Lost…' : 'Mark as Lost'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Measurement form constants ────────────────────────────── */
const UNITS = [
  { value: 'sqft',  label: 'Sq.ft',      dim: 'area'   },
  { value: 'sqm',   label: 'Sq.m',       dim: 'area'   },
  { value: 'rft',   label: 'Running ft', dim: 'linear' },
  { value: 'ft',    label: 'ft',         dim: 'linear' },
  { value: 'm',     label: 'm',          dim: 'linear' },
  { value: 'nos',   label: 'Nos',        dim: 'count'  },
  { value: 'lot',   label: 'Lot',        dim: 'count'  },
  { value: 'each',  label: 'Each',       dim: 'count'  },
] as const;

type UnitDim = 'area' | 'linear' | 'count';

const WORK_ITEMS: { label: string; unit: string }[] = [
  { label: 'Tile Flooring',      unit: 'sqft' },
  { label: 'Marble Flooring',    unit: 'sqft' },
  { label: 'Wooden Flooring',    unit: 'sqft' },
  { label: 'Vinyl Flooring',     unit: 'sqft' },
  { label: 'False Ceiling',      unit: 'sqft' },
  { label: 'POP Ceiling',        unit: 'sqft' },
  { label: 'Gypsum Ceiling',     unit: 'sqft' },
  { label: 'Wall Painting',      unit: 'sqft' },
  { label: 'Wall Cladding',      unit: 'sqft' },
  { label: 'Wallpaper',          unit: 'sqft' },
  { label: 'Texture Painting',   unit: 'sqft' },
  { label: 'Glass Partition',    unit: 'sqft' },
  { label: 'Wardrobe',           unit: 'rft'  },
  { label: 'Kitchen Cabinet',    unit: 'rft'  },
  { label: 'TV Unit',            unit: 'rft'  },
  { label: 'Storage Cabinet',    unit: 'rft'  },
  { label: 'Curtain Track',      unit: 'rft'  },
  { label: 'Skirting',           unit: 'rft'  },
  { label: 'Countertop',         unit: 'rft'  },
  { label: 'Door',               unit: 'nos'  },
  { label: 'Window',             unit: 'nos'  },
  { label: 'Light Point',        unit: 'nos'  },
  { label: 'Fan Point',          unit: 'nos'  },
  { label: 'AC Point',           unit: 'nos'  },
  { label: 'Electrical Point',   unit: 'nos'  },
  { label: 'Plumbing Point',     unit: 'nos'  },
  { label: 'Sanitary Fixture',   unit: 'nos'  },
];

function unitDim(unit: string): UnitDim {
  return (UNITS.find(u => u.value === unit)?.dim ?? 'area') as UnitDim;
}

function computeArea(len: string, wid: string, unit: string): number | null {
  const l = parseFloat(len) || 0;
  const w = parseFloat(wid) || 0;
  const dim = unitDim(unit);
  if (dim === 'area')   return l > 0 && w > 0 ? parseFloat((l * w).toFixed(3)) : null;
  if (dim === 'linear') return l > 0 ? l : null;
  return null; // count-based: no area
}

/* ── MeasurementsTabContent ────────────────────────────────── */
function MeasurementsTabContent({ leadId, initialRounds, draftQuotes, onRoundAdded }: {
  leadId: string;
  initialRounds: MeasurementRound[];
  draftQuotes: Quote[];
  onRoundAdded: (round: MeasurementRound) => void;
}) {
  const [rounds, setRounds]           = useState<MeasurementRound[]>(initialRounds);
  const [showAddRound, setShowAddRound] = useState(false);
  const [roundName, setRoundName]     = useState('');
  const [savingRound, setSavingRound] = useState(false);
  const [roundErr, setRoundErr]       = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [addingTo, setAddingTo]       = useState<string | null>(null);
  const [iRoom, setIRoom]     = useState('');
  const [iItem, setIItem]     = useState('');
  const [iLen, setILen]       = useState('');
  const [iWid, setIWid]       = useState('');
  const [iHeight, setIHeight] = useState('');
  const [iQty, setIQty]       = useState('1');
  const [iUnit, setIUnit]     = useState('sqft');
  const [iNotes, setINotes]   = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [itemErr, setItemErr]       = useState<string | null>(null);

  // Push-to-quote state
  const [pushingRoundId, setPushingRoundId]   = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [pushLoading, setPushLoading]         = useState(false);
  const [pushResult, setPushResult]           = useState<string | null>(null);

  async function handlePushToQuote(roundId: string) {
    const quoteId = selectedQuoteId || draftQuotes[0]?.id;
    if (!quoteId) return;
    setPushLoading(true); setPushResult(null);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/measurements/${roundId}/push-to-quote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      });
      const json = await res.json() as { data?: { linesAdded: number }; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setPushResult(`${json.data?.linesAdded ?? 0} lines added to quote`);
      setPushingRoundId(null);
    } catch (e) {
      setPushResult(e instanceof Error ? e.message : 'Push failed');
    } finally { setPushLoading(false); }
  }

  async function createRound() {
    if (!roundName.trim()) return;
    setSavingRound(true); setRoundErr(null);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/measurements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundName: roundName.trim() }),
      });
      const json = await res.json() as { data?: MeasurementRound; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      const newRound: MeasurementRound = { ...json.data!, items: [] };
      setRounds(prev => [...prev, newRound]);
      onRoundAdded(newRound);
      setRoundName(''); setShowAddRound(false); setExpandedId(newRound.id);
    } catch (e) { setRoundErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setSavingRound(false); }
  }

  function clearItemForm() {
    setIRoom(''); setIItem(''); setILen(''); setIWid(''); setIHeight('');
    setIQty('1'); setIUnit('sqft'); setINotes(''); setItemErr(null);
  }

  async function addItem(roundId: string) {
    if (!iRoom.trim() || !iItem.trim()) { setItemErr('Room and item name are required'); return; }
    setSavingItem(true); setItemErr(null);
    const area = computeArea(iLen, iWid, iUnit);
    const dimensionsJson: Record<string, unknown> = { unit: iUnit };
    if (iLen)    dimensionsJson['length'] = parseFloat(iLen);
    if (iWid)    dimensionsJson['width']  = parseFloat(iWid);
    if (iHeight) dimensionsJson['height'] = parseFloat(iHeight);
    if (area !== null) dimensionsJson['area'] = area;
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/measurements/${roundId}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: iRoom.trim(), itemName: iItem.trim(), dimensionsJson,
          qty: parseInt(iQty) || 1, unit: iUnit, notes: iNotes.trim() || null,
        }),
      });
      const json = await res.json() as { data?: MeasurementItem; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setRounds(prev => prev.map(r =>
        r.id === roundId ? { ...r, items: [...(r.items ?? []), json.data!] } : r,
      ));
      clearItemForm(); setAddingTo(null);
    } catch (e) { setItemErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setSavingItem(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {rounds.length} Round{rounds.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          {rounds.length > 0 && (
            <a
              href={`/api/v1/leads/${leadId}/measurements/pdf`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
          )}
          <button type="button" onClick={() => setShowAddRound(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--violet-primary)', color: '#fff' }}>
            <Plus className="h-3.5 w-3.5" /> Add Round
          </button>
        </div>
      </div>

      {showAddRound && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)' }}>
          <input value={roundName} onChange={e => setRoundName(e.target.value)}
            placeholder="Round name — e.g. Initial Measurement"
            className="studio-input w-full text-sm" />
          {roundErr && <p className="text-xs text-red-600">{roundErr}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={createRound} disabled={savingRound || !roundName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: 'var(--violet-primary)', color: '#fff' }}>
              {savingRound ? 'Creating…' : 'Create Round'}
            </button>
            <button type="button" onClick={() => { setShowAddRound(false); setRoundName(''); setRoundErr(null); }}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {rounds.length === 0 && !showAddRound && (
        <div className="text-center py-10">
          <Home className="h-9 w-9 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>No measurement rounds yet</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Create a round to capture room dimensions for BOQ</p>
        </div>
      )}

      {rounds.map(round => (
        <div key={round.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <button type="button"
            onClick={() => setExpandedId(prev => prev === round.id ? null : round.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-muted)] transition-colors">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{round.roundName}</span>
              {round.completedAt && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>DONE</span>
              )}
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {(round.items?.length ?? 0)} item{(round.items?.length ?? 0) !== 1 ? 's' : ''}
              </span>
              {round.scheduledAt && (
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(round.scheduledAt)}</span>
              )}
            </div>
            {expandedId === round.id
              ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
              : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
            }
          </button>

          {expandedId === round.id && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {(round.items ?? []).length > 0 && (
                <div>
                  {(round.items ?? []).map((item, idx) => (
                    <div key={item.id} className="px-4 py-3" style={{ borderBottom: idx < (round.items ?? []).length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                        {item.room} — {item.itemName}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {(() => {
                          const d = item.dimensionsJson;
                          const dims = [d.length, d.width, d.height].filter(Boolean).join(' × ');
                          const areaStr = d.area != null ? `${d.area} ${item.unit}` : null;
                          return dims
                            ? `${dims}${areaStr ? ` = ${areaStr}` : ''}` + ` · qty ${item.qty}`
                            : areaStr
                            ? `${areaStr} · qty ${item.qty}`
                            : `qty ${item.qty} ${item.unit}`;
                        })()}
                      </p>
                      {item.notes && (
                        <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-tertiary)' }}>{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-3 space-y-2" style={{ background: 'var(--surface-muted)' }}>
                {addingTo !== round.id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => { setAddingTo(round.id); clearItemForm(); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--violet-primary)' }}>
                      <Plus className="h-3.5 w-3.5" /> Add Item
                    </button>
                    {/* Push to Quote */}
                    {draftQuotes.length > 0 && (round.items?.length ?? 0) > 0 && (
                      pushingRoundId === round.id ? (
                        <div className="flex items-center gap-2">
                          {draftQuotes.length > 1 && (
                            <select value={selectedQuoteId || draftQuotes[0].id}
                              onChange={e => setSelectedQuoteId(e.target.value)}
                              className="studio-input text-xs py-1.5">
                              {draftQuotes.map(q => (
                                <option key={q.id} value={q.id}>
                                  QUO-{q.id.slice(-6).toUpperCase()}
                                </option>
                              ))}
                            </select>
                          )}
                          <button type="button" onClick={() => handlePushToQuote(round.id)} disabled={pushLoading}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                            style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                            {pushLoading ? 'Pushing…' : 'Confirm Push'}
                          </button>
                          <button type="button" onClick={() => setPushingRoundId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs"
                            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button type="button"
                          onClick={() => { setPushingRoundId(round.id); setSelectedQuoteId(draftQuotes[0]?.id ?? ''); setPushResult(null); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                          <FileText className="h-3.5 w-3.5" /> Push to Quote
                        </button>
                      )
                    )}
                    {pushResult && pushingRoundId !== round.id && (
                      <span className="text-xs" style={{ color: 'var(--success-text)' }}>{pushResult}</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Row 1: Room / Work Item */}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={iRoom} onChange={e => setIRoom(e.target.value)}
                        placeholder="Room / Space" className="studio-input text-sm" list="room-suggestions"
                      />
                      <input
                        value={iItem}
                        onChange={e => {
                          setIItem(e.target.value);
                          const match = WORK_ITEMS.find(w => w.label.toLowerCase() === e.target.value.toLowerCase());
                          if (match) setIUnit(match.unit);
                        }}
                        placeholder="Work / Item" className="studio-input text-sm" list="work-item-suggestions"
                      />
                    </div>
                    <datalist id="work-item-suggestions">
                      {WORK_ITEMS.map(w => <option key={w.label} value={w.label} />)}
                    </datalist>

                    {/* Row 2: L / W / H (optional) */}
                    <div className="grid grid-cols-3 gap-2">
                      <input value={iLen}    onChange={e => setILen(e.target.value)}    placeholder="Length (ft)" type="number" min="0" step="0.01" className="studio-input text-sm" />
                      <input value={iWid}    onChange={e => setIWid(e.target.value)}    placeholder="Width (ft)"  type="number" min="0" step="0.01" className="studio-input text-sm" />
                      <input value={iHeight} onChange={e => setIHeight(e.target.value)} placeholder="Height (opt)" type="number" min="0" step="0.01" className="studio-input text-sm" />
                    </div>

                    {/* Row 3: Qty / Unit */}
                    <div className="grid grid-cols-3 gap-2">
                      <input value={iQty} onChange={e => setIQty(e.target.value)} placeholder="Qty" type="number" min="1" className="studio-input text-sm" />
                      <select value={iUnit} onChange={e => setIUnit(e.target.value)} className="studio-input text-sm col-span-2">
                        {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>

                    {/* Row 4: Auto-calculated area (read-only) */}
                    {(() => {
                      const area = computeArea(iLen, iWid, iUnit);
                      const dim  = unitDim(iUnit);
                      if (area === null) return null;
                      const total = area * (parseInt(iQty) || 1);
                      const label = dim === 'linear' ? 'Length' : 'Area';
                      const unitLabel = UNITS.find(u => u.value === iUnit)?.label ?? iUnit;
                      return (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>{label}:</span>
                          <span style={{ color: 'var(--text-heading)' }}>{area} {unitLabel}</span>
                          {parseInt(iQty) > 1 && (
                            <><span style={{ color: 'var(--text-tertiary)' }}>× {iQty} =</span>
                            <span style={{ color: 'var(--violet-primary)', fontWeight: 600 }}>{total} {unitLabel}</span></>
                          )}
                        </div>
                      );
                    })()}

                    {/* Row 5: Notes */}
                    <input value={iNotes} onChange={e => setINotes(e.target.value)} placeholder="Notes (optional)" className="studio-input w-full text-sm" />

                    {itemErr && <p className="text-xs text-red-600">{itemErr}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => addItem(round.id)} disabled={savingItem}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{ background: 'var(--violet-primary)', color: '#fff' }}>
                        {savingItem ? 'Saving…' : 'Save Item'}
                      </button>
                      <button type="button" onClick={() => { setAddingTo(null); clearItemForm(); }}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Shared micro-components ───────────────────────────────── */
function DetailField({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-heading)' }}>{value}</p>
    </div>
  );
}
function SidebarRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="text-[12px] flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-[12px] font-semibold text-right" style={{ color: 'var(--text-heading)' }}>{value}</span>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;
  const followUpRef = useRef<HTMLDivElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);

  const scrollToFollowUp = useCallback(() => {
    followUpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const [lead, setLead]                   = useState<Lead | null>(null);
  const [activities, setActivities]       = useState<LeadActivity[]>([]);
  const [customerId, setCustomerId]       = useState<string | null>(null);
  const [linkedProject, setLinkedProject] = useState<{ id: string; name: string; lifecycleStage: string } | null>(null);
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);

  const [leadQuotes, setLeadQuotes]       = useState<Quote[]>([]);
  const [leadDocs, setLeadDocs]           = useState<LeadDocument[]>([]);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [uploadingDoc, setUploadingDoc]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpError, setFUError]     = useState<string | null>(null);
  const [savingFU, setSavingFU]         = useState(false);
  const [fuSuccess, setFUSuccess]       = useState(false);
  const [markingDoneId, setMarkingDoneId]       = useState<string | null>(null);
  const [reschedulingFuId, setReschedulingFuId] = useState<string | null>(null);
  const [rescheduleInput, setRescheduleInput]   = useState('');
  const [quotedAmountInput, setQuotedAmountInput] = useState('');
  const [savingQuotedAmount, setSavingQuotedAmount] = useState(false);
  const [quotedAmountSaved, setQuotedAmountSaved] = useState(false);

  // Menus / dialogs
  const [showActionsMenu, setShowActionsMenu]       = useState(false);
  const [showEditDialog, setShowEditDialog]         = useState(false);
  const [showProjectDialog, setShowProjectDialog]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Stage actions
  const [markingWon, setMarkingWon]                   = useState(false);
  const [markingLost, setMarkingLost]                 = useState(false);
  const [reopening, setReopening]                     = useState(false);
  const [showMarkLostDialog, setShowMarkLostDialog]   = useState(false);
  const [lostReasonInput, setLostReasonInput]         = useState('');
  const [stageError, setStageError]                   = useState<string | null>(null);

  // Site visit modal
  const [showSiteVisitModal, setShowSiteVisitModal] = useState(false);

  // Stage-action modals
  const [showMarkContactedModal, setShowMarkContactedModal] = useState(false);
  const [showQualifyModal, setShowQualifyModal]             = useState(false);
  const [showWonFlowModal, setShowWonFlowModal]             = useState(false);

  // Tabs — overview and followups are now inline; only detail tabs remain
  type TabKey = 'sitevisits' | 'measurements' | 'design' | 'quotations' | 'documents' | 'activity';
  const [activeTab, setActiveTab]           = useState<TabKey | null>(null);
  const [siteVisitsData, setSiteVisitsData] = useState<SiteVisit[]>([]);
  const [measurementsData, setMeasurementsData] = useState<MeasurementRound[]>([]);
  const [followUps, setFollowUps]           = useState<LeadFollowUp[]>([]);
  const [followUpsLoaded, setFollowUpsLoaded] = useState(false);


  useEffect(() => {
    if (!showActionsMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowActionsMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActionsMenu]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/v1/leads/${id}`),
      fetch(`/api/v1/leads/${id}/activities`).catch(() => null),
      fetch(`/api/v1/leads/${id}/quotes`).catch(() => null),
      fetch(`/api/v1/leads/${id}/documents`).catch(() => null),
      fetch(`/api/v1/site-visits?leadId=${id}`).catch(() => null),
      fetch(`/api/v1/leads/${id}/measurements`).catch(() => null),
    ]).then(async ([leadRes, actRes, quotesRes, docsRes, svRes, mrRes]) => {
      if (leadRes.status === 404) { setNotFound(true); setLoading(false); return; }
      const { data: leadData } = await leadRes.json() as {
        data: Lead & {
          recentMessages?: WaMessage[];
          customerId?: string | null;
          linkedProject?: { id: string; name: string; lifecycleStage: string } | null;
        }
      };
      setCustomerId(leadData.customerId ?? null);
      setLinkedProject(leadData.linkedProject ?? null);
      setLead(leadData);
      if (leadData.projectValuePaise) setQuotedAmountInput(String(Math.round(leadData.projectValuePaise / 100)));
      if (actRes?.ok) {
        const { data: actData } = await actRes.json() as { data: LeadActivity[] };
        setActivities(actData ?? []);
      }
      if (quotesRes?.ok) {
        const { data: qData } = await quotesRes.json() as { data: Quote[] };
        setLeadQuotes(qData ?? []);
      }
      if (docsRes?.ok) {
        const { data: dData } = await docsRes.json() as { data: LeadDocument[] };
        setLeadDocs(dData ?? []);
      }
      if (svRes?.ok) {
        const svJson = await svRes.json() as { data: SiteVisit[] };
        setSiteVisitsData(svJson.data ?? []);
      }
      if (mrRes?.ok) {
        const mrJson = await mrRes.json() as { data: MeasurementRound[] };
        setMeasurementsData(mrJson.data ?? []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Load follow-ups on mount (shown inline, not behind a tab)
  useEffect(() => {
    if (followUpsLoaded || !id) return;
    fetch(`/api/v1/leads/${id}/follow-ups`)
      .then(r => r.json())
      .then((res: { data?: LeadFollowUp[] }) => {
        setFollowUps(res.data ?? []);
        setFollowUpsLoaded(true);
      })
      .catch(() => setFollowUpsLoaded(true));
  }, [activeTab, followUpsLoaded, id]);

  async function scheduleFollowUp() {
    if (!followUpDate) return;
    setSavingFU(true); setFUError(null); setFUSuccess(false);
    try {
      const followUpDateISO = new Date(followUpDate + 'T00:00:00').toISOString();
      const dueDateLabel = new Date(followUpDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

      // Map lead stage to a value accepted by the follow-ups endpoint
      const validFUStages = new Set(['new','contacted','qualified','site_visit','measurement','quotation','negotiation','won','lost','site_visit_scheduled','consultation_done','proposal_sent']);
      const fuStage = validFUStages.has(lead?.stage ?? '') ? (lead?.stage ?? 'new') : 'contacted';

      // 1. Create follow-up row (also updates lead.followUpDate + lastActivityAt via DB transaction)
      const fuRes = await fetch(`/api/v1/leads/${id}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUpDate: followUpDateISO,
          stage: fuStage,
          clientStatus: 'callback',
          comments: followUpNote.trim() || null,
          addToCalendar: true,
        }),
      });
      if (!fuRes.ok) {
        const j = await fuRes.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `Failed (${fuRes.status})`);
      }

      // 2. Refresh lead so At a Glance reflects the new followUpDate
      const leadRes = await fetch(`/api/v1/leads/${id}`);
      if (leadRes.ok) {
        const { data: leadData } = await leadRes.json() as { data: Lead };
        setLead(leadData);
      }

      // 3. Refresh follow-up history list from DB
      const fuListRes = await fetch(`/api/v1/leads/${id}/follow-ups`);
      if (fuListRes.ok) {
        const fuListData = await fuListRes.json() as { data?: LeadFollowUp[] };
        setFollowUps(fuListData.data ?? []);
      }

      // 4. Always log to activity feed (not just when note exists)
      const actRes = await fetch(`/api/v1/leads/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'follow_up',
          title: `Follow-up scheduled — ${dueDateLabel}`,
          description: followUpNote.trim() || null,
          scheduledAt: followUpDateISO,
          status: 'pending',
        }),
      });
      if (actRes.ok) {
        const actJson = await actRes.json() as { data?: LeadActivity };
        if (actJson.data) setActivities(prev => [actJson.data!, ...prev]);
      }

      setFollowUpDate(''); setFollowUpNote('');
      setFUSuccess(true); setTimeout(() => setFUSuccess(false), 3000);
    } catch (e) {
      setFUError(e instanceof Error ? e.message : 'Failed to schedule');
    } finally { setSavingFU(false); }
  }

  async function markFollowUpDone(fu: LeadFollowUp) {
    setMarkingDoneId(fu.id);
    try {
      const res = await fetch(`/api/v1/leads/${id}/follow-ups/${fu.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_done' }),
      });
      if (!res.ok) return;
      const now = new Date().toISOString();
      setFollowUps(prev => prev.map(f => f.id === fu.id ? { ...f, completedAt: now } : f));
    } finally {
      setMarkingDoneId(null);
    }
  }

  async function rescheduleFollowUp(fu: LeadFollowUp) {
    if (!rescheduleInput) return;
    const followUpDate = new Date(rescheduleInput + 'T00:00:00').toISOString();
    try {
      const res = await fetch(`/api/v1/leads/${id}/follow-ups/${fu.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', followUpDate }),
      });
      if (!res.ok) return;
      setFollowUps(prev => prev.map(f =>
        f.id === fu.id ? { ...f, followUpDate: rescheduleInput, completedAt: null } : f
      ));
      setReschedulingFuId(null);
      setRescheduleInput('');
    } catch { /* silent */ }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Delete failed');
      }
      router.push('/leads');
    } catch (e) {
      setShowDeleteConfirm(false);
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally { setDeleting(false); }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      const body = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Archive failed');
      router.push('/leads');
    } catch (e) {
      setShowArchiveConfirm(false);
      alert(e instanceof Error ? e.message : 'Archive failed');
    } finally { setArchiving(false); }
  }

  // Terminal transitions (won / lost / reopen). Uses the /stage endpoint.
  async function changeStage(targetStage: string, lostReason?: string) {
    const isWonTarget  = targetStage === 'won';
    const isLostTarget = targetStage === 'lost';
    if (isWonTarget) setMarkingWon(true);
    else if (isLostTarget) setMarkingLost(true);
    else setReopening(true);
    setStageError(null);
    try {
      const res = await fetch(`/api/v1/leads/${id}/stage`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage, ...(lostReason ? { lostReason } : {}) }),
      });
      const json = await res.json().catch(() => ({})) as { data?: Lead; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setLead(json.data!); setShowMarkLostDialog(false); setLostReasonInput('');
      if (isWonTarget) {
        const refreshRes = await fetch(`/api/v1/leads/${id}`);
        if (refreshRes.ok) {
          const { data } = await refreshRes.json() as { data: Lead & { linkedProject?: { id: string; name: string; lifecycleStage: string } | null } };
          if (data.linkedProject) setLinkedProject(data.linkedProject);
        }
      }
    } catch (e) {
      setStageError(e instanceof Error ? e.message : 'Stage change failed');
    } finally { setMarkingWon(false); setMarkingLost(false); setReopening(false); }
  }

  async function createQuote() {
    setCreatingQuote(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}/quotes`, { method: 'POST' });
      const json = await res.json() as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to create quote');
      router.push(`/quotes/${json.data!.id}`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to create quotation'); setCreatingQuote(false); }
  }

  async function uploadDocument(file: File) {
    setUploadingDoc(true);
    try {
      const form = new FormData();
      form.append('file', file); form.append('leadId', id);
      const res = await fetch('/api/v1/documents/upload', { method: 'POST', body: form });
      const json = await res.json() as { data?: LeadDocument; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setLeadDocs(prev => [{ ...json.data!, downloadUrl: null }, ...prev]);
    } catch (e) { alert(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploadingDoc(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  /* Loading / not-found */
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-32 w-full rounded-2xl" />
        <div className="skeleton h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="p-6">
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Lead not found.</p>
        <button type="button" className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm" onClick={() => router.push('/leads')}>
          <ArrowLeft className="h-4 w-4" />Back to Pipeline
        </button>
      </div>
    );
  }

  /* ── Derived ─────────────────────────────────────────── */
  const priorityCfg  = lead.priority ? PRIORITY_CONFIG[lead.priority] : null;
  const isWon        = lead.stage === 'won' || lead.stage === 'booked';
  const isLost       = lead.stage === 'lost';
  const isTerminal   = isWon || isLost;
  const initials     = lead.contactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const quickDates = [
    { label: 'Tomorrow', days: 1 },
    { label: '3 days',   days: 3 },
    { label: '1 week',   days: 7 },
  ];
  function applyQuickDate(days: number) {
    const d = new Date(); d.setDate(d.getDate() + days);
    setFollowUpDate(d.toISOString().split('T')[0]);
  }

  const stageActionsDisabled = markingWon || markingLost || reopening;
  const waPhone = lead.contactPhone.replace(/\D/g, '').slice(-10);

  async function handleSiteVisitSuccess() {
    // Refresh lead — API auto-advances stage to site_visit_scheduled
    const leadRes = await fetch(`/api/v1/leads/${id}`).catch(() => null);
    if (leadRes?.ok) {
      const { data } = await leadRes.json() as { data: Lead & { customerId?: string | null; linkedProject?: { id: string; name: string; lifecycleStage: string } | null } };
      setLead(data);
      setCustomerId(data.customerId ?? null);
      if (data.linkedProject) setLinkedProject(data.linkedProject);
    }
    const actRes = await fetch(`/api/v1/leads/${id}/activities`).catch(() => null);
    if (actRes?.ok) {
      const { data: actData } = await actRes.json() as { data: LeadActivity[] };
      setActivities(actData ?? []);
    }
  }

  return (
    <div className="min-h-full" style={{ background: 'var(--surface-app)' }}>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete lead?"
        message={`"${lead.contactName}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete" danger loading={deleting}
        onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive lead?"
        message={`"${lead.contactName}" will be moved to the archive and hidden from the active pipeline.`}
        confirmLabel="Archive" loading={archiving}
        onConfirm={handleArchive} onCancel={() => setShowArchiveConfirm(false)}
      />
      {showEditDialog && (
        <EditLeadDialog
          lead={lead} open={showEditDialog} onOpenChange={setShowEditDialog}
          onSuccess={updated => { setLead(updated); setShowEditDialog(false); }}
        />
      )}
      {showProjectDialog && (
        <ProjectDetailsDialog
          lead={lead} open={showProjectDialog} onOpenChange={setShowProjectDialog}
          onSuccess={updated => { setLead(updated); setShowProjectDialog(false); }}
        />
      )}
      <MarkLostDialog
        open={showMarkLostDialog} value={lostReasonInput} onChange={setLostReasonInput}
        loading={markingLost}
        onCancel={() => { setShowMarkLostDialog(false); setLostReasonInput(''); }}
        onConfirm={() => changeStage('lost', lostReasonInput)}
      />
      <ScheduleSiteVisitModal
        leadId={id}
        open={showSiteVisitModal}
        onOpenChange={setShowSiteVisitModal}
        defaultAddress={lead.projectLocation || [lead.contactCity, lead.pincode].filter(Boolean).join(', ')}
        onSuccess={(visit) => {
          setSiteVisitsData(prev => [visit as SiteVisit, ...prev]);
          void handleSiteVisitSuccess();
        }}
      />
      <MarkContactedModal
        leadId={id}
        contactName={lead.contactName}
        open={showMarkContactedModal}
        onClose={() => setShowMarkContactedModal(false)}
        onSuccess={(updatedLead, newActivity) => {
          setLead(updatedLead);
          setActivities(prev => [newActivity, ...prev]);
          setShowMarkContactedModal(false);
        }}
      />
      <QualifyLeadModal
        leadId={id}
        lead={lead}
        open={showQualifyModal}
        onClose={() => setShowQualifyModal(false)}
        onSuccess={(updatedLead) => {
          setLead(updatedLead);
          setShowQualifyModal(false);
        }}
      />
      <ConvertLeadModal
        lead={lead}
        open={showWonFlowModal}
        onClose={() => setShowWonFlowModal(false)}
      />

      <div className="p-6 lg:p-8 pb-24 space-y-5">

        {/* Back nav */}
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-xs font-medium hover:opacity-75" style={{ color: 'var(--text-tertiary)' }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Leads
        </Link>

        <div className="space-y-5">

          {/* ── HEADER CARD ──────────────────────────────────────── */}
          <div className="rounded-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            {isTerminal && (
              <div className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium" style={{
                background: isWon ? 'var(--success-soft)' : '#FEF2F2',
                borderBottom: `1px solid ${isWon ? '#86EFAC' : '#FCA5A5'}`,
                color: isWon ? 'var(--success-text)' : '#DC2626',
              }}>
                {isWon
                  ? <><CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Lead Won</>
                  : <><AlertCircle  className="h-4 w-4 flex-shrink-0" /> Lead Lost{lead.lostReason ? ` — ${lead.lostReason}` : ''}</>}
              </div>
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, var(--violet-primary) 0%, #9B8AFB 100%)' }}>
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
                        {lead.contactName}
                      </h1>
                      {priorityCfg && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: priorityCfg.bg, color: priorityCfg.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: priorityCfg.dot }} />
                          {priorityCfg.label.toUpperCase()}
                        </span>
                      )}
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${STAGE_COLORS[lead.stage]}`}>
                        {STAGE_LABELS[lead.stage]}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {[lead.propertyType, lead.contactCity, lead.source ? `via ${SOURCE_LABELS[lead.source] ?? lead.source}` : null]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={`tel:${lead.contactPhone}`}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-subtle)' }} title={lead.contactPhone}>
                    <Phone className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </a>
                  <a href={`https://wa.me/${lead.contactPhone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-subtle)' }} title="WhatsApp">
                    <MessageCircle className="h-3.5 w-3.5" style={{ color: '#25D366' }} />
                  </a>
                  {lead.contactEmail && (
                    <a href={`mailto:${lead.contactEmail}`}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ borderColor: 'var(--border-subtle)' }} title={lead.contactEmail}>
                      <Mail className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                    </a>
                  )}
                  <button type="button" onClick={() => setShowEditDialog(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)' }}>
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <div className="relative" ref={menuRef}>
                    <button type="button" onClick={() => setShowActionsMenu(v => !v)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-muted)]"
                      style={{ borderColor: 'var(--border-subtle)' }}>
                      <MoreVertical className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    {showActionsMenu && (
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl z-30 overflow-hidden"
                        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                        <button type="button" onClick={() => { setShowActionsMenu(false); setShowArchiveConfirm(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-muted)]"
                          style={{ color: 'var(--text-heading)' }}>
                          <Archive className="h-4 w-4 text-amber-500" /> Archive Lead
                        </button>
                        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <button type="button" onClick={() => { setShowActionsMenu(false); setShowDeleteConfirm(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-red-50 text-red-600">
                            <Trash2 className="h-4 w-4" /> Delete Lead
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {linkedProject && (
                <div className="mt-4 flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--success-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <FolderKanban className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--success)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--success-text)' }}>Linked Project</p>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{linkedProject.name}</p>
                  </div>
                  <Link href={`/projects/${linkedProject.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                    style={{ background: 'var(--success)', color: '#fff' }}>
                    View Project <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* ── ACTION BAR ───────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            {customerId && (
              <Link href={`/customers/${customerId}`}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--surface-muted)]"
                style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)', color: 'var(--success-text)' }}>
                <CheckCircle2 className="h-4 w-4" /> View Client
              </Link>
            )}
            {isLost && (
              <button type="button" onClick={() => changeStage('contacted')} disabled={stageActionsDisabled}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium border disabled:opacity-50"
                style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)', color: 'var(--violet-primary)' }}>
                <Zap className="h-4 w-4" />{reopening ? 'Reopening…' : 'Reopen Lead'}
              </button>
            )}
            {!isTerminal && (
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => setShowWonFlowModal(true)} disabled={stageActionsDisabled}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold border disabled:opacity-50"
                  style={{ borderColor: 'rgba(16,185,129,0.4)', color: 'var(--success-text)', background: 'var(--success-soft)' }}>
                  <CheckCircle2 className="h-4 w-4" />{markingWon ? 'Converting…' : 'Convert to Client'}
                </button>
                <button type="button" onClick={() => setShowMarkLostDialog(true)} disabled={stageActionsDisabled}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold border disabled:opacity-50"
                  style={{ borderColor: 'rgba(220,38,38,0.3)', color: '#DC2626', background: '#FEF2F2' }}>
                  <AlertCircle className="h-4 w-4" />{markingLost ? 'Marking…' : 'Lost'}
                </button>
              </div>
            )}
          </div>
          {stageError && <p className="text-xs text-red-600 -mt-3">{stageError}</p>}

          {/* ── TWO COLUMN LAYOUT ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

            {/* LEFT — Contact details + Tabs + Follow-up */}
            <div className="space-y-3">

              {/* Contact & Project card */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Contact & Project</p>
                  <button type="button" onClick={() => setShowEditDialog(true)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <Edit2 className="h-3 w-3" /> Edit
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <DetailField label="Mobile" value={
                    <a href={`tel:${lead.contactPhone}`} className="hover:underline">{lead.contactPhone}</a>
                  } />
                  {lead.contactEmail
                    ? <DetailField label="Email" value={<a href={`mailto:${lead.contactEmail}`} className="hover:underline truncate block">{lead.contactEmail}</a>} />
                    : <div />}
                  <DetailField label="Source" value={SOURCE_LABELS[lead.source] ?? lead.source} />
                  {lead.budgetBand
                    ? <DetailField label="Estimated Budget" value={fmtBudgetBand(lead.budgetBand)} />
                    : <div />}
                  {lead.propertyType && <DetailField label="Project Type" value={lead.propertyType} />}
                  {lead.contactCity && (
                    <DetailField label="City" value={lead.contactCity + (lead.pincode ? ` – ${lead.pincode}` : '')} />
                  )}
                  {lead.designerName && <DetailField label="Assigned To" value={lead.designerName} full />}
                </div>
                {lead.projectLocation && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <DetailField label="Site Address" value={lead.projectLocation} />
                  </div>
                )}
                {lead.notes && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <DetailField label="Requirement" value={<span className="leading-relaxed">{lead.notes}</span>} />
                  </div>
                )}
              </div>


              {/* Inline follow-up scheduler */}
              <div ref={followUpRef} className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>New Follow-up</p>
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Due</p>
                    <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                      className="studio-input text-sm h-9" min={new Date().toISOString().split('T')[0]}
                      suppressHydrationWarning />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Note</p>
                    <input type="text" value={followUpNote} onChange={e => setFollowUpNote(e.target.value)}
                      placeholder="What to talk about?" className="studio-input w-full text-sm h-9" />
                  </div>
                  <button type="button" onClick={scheduleFollowUp} disabled={!followUpDate || savingFU}
                    className="btn-primary h-9 px-5 text-sm font-semibold disabled:opacity-50 flex-shrink-0">
                    {savingFU ? 'Adding…' : 'Add'}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  {quickDates.map(({ label, days }) => (
                    <button key={label} type="button" onClick={() => applyQuickDate(days)}
                      className="px-2.5 py-1 text-xs rounded-lg transition-colors"
                      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', color: 'var(--text-heading)' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {followUpError && <p className="mt-2 text-xs text-red-600">{followUpError}</p>}
                {fuSuccess && <p className="mt-2 text-xs font-medium" style={{ color: 'var(--success)' }}>Follow-up scheduled!</p>}
              </div>

              {/* Follow-up history */}
              {followUpsLoaded && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold px-1" style={{ color: 'var(--text-heading)' }}>
                    Follow-up History {followUps.length > 0 && <span className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>({followUps.length})</span>}
                  </p>
                  {followUps.length === 0 && (
                    <div className="rounded-xl px-4 py-4 text-center" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No follow-ups scheduled yet</p>
                    </div>
                  )}
                  {followUps.map(fu => {
                    const isCompleted = !!fu.completedAt;
                    const urgency = (!isCompleted && fu.followUpDate) ? followUpUrgency(fu.followUpDate) : null;
                    const badgeCfg =
                      isCompleted                ? { bg: 'var(--surface-muted)', color: 'var(--text-secondary)',  label: 'Done'    } :
                      urgency === 'overdue'      ? { bg: 'var(--danger-soft)',   color: 'var(--danger)',          label: 'Overdue' } :
                      urgency === 'today'        ? { bg: 'var(--warning-soft)',  color: 'var(--warning)',         label: 'Today'   } :
                      urgency === 'upcoming'     ? { bg: 'var(--success-soft)',  color: 'var(--success-text)',    label: 'Pending' } :
                                                  { bg: 'var(--surface-muted)', color: 'var(--text-secondary)',  label: 'Done'    };
                    const isRescheduling = reschedulingFuId === fu.id;
                    const isMarkingDone  = markingDoneId === fu.id;
                    return (
                      <div key={fu.id} className="rounded-xl px-4 py-3.5"
                        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start gap-3">
                          <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5"
                            style={{ color: isCompleted ? 'var(--text-tertiary)' : urgency === 'overdue' ? 'var(--danger)' : 'var(--accent-base)' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                                {fu.followUpDate ? fmtFollowUpDate(fu.followUpDate.split('T')[0]) : fmtDate(fu.createdAt)}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: badgeCfg.bg, color: badgeCfg.color }}>
                                {badgeCfg.label}
                              </span>
                              <span className="text-[11px] capitalize" style={{ color: 'var(--text-secondary)' }}>
                                {fu.clientStatus.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {fu.comments && (
                              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{fu.comments}</p>
                            )}
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                              {fu.createdByName ? `by ${fu.createdByName} · ` : ''}{fmtDate(fu.createdAt)}
                            </p>
                            {/* Action buttons — only on pending follow-ups */}
                            {!isCompleted && !isRescheduling && (
                              <div className="flex items-center gap-2 mt-2.5">
                                <button
                                  onClick={() => markFollowUpDone(fu)}
                                  disabled={isMarkingDone}
                                  className="px-2.5 py-1 text-xs rounded-lg font-medium transition-colors disabled:opacity-50"
                                  style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                                  {isMarkingDone ? '…' : '✓ Mark Done'}
                                </button>
                                <button
                                  onClick={() => { setReschedulingFuId(fu.id); setRescheduleInput(''); }}
                                  className="px-2.5 py-1 text-xs rounded-lg font-medium transition-colors"
                                  style={{ background: 'var(--surface-muted)', color: 'var(--text-heading)', border: '1px solid var(--border-subtle)' }}>
                                  Reschedule
                                </button>
                              </div>
                            )}
                            {!isCompleted && isRescheduling && (
                              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                <input
                                  type="date"
                                  value={rescheduleInput}
                                  onChange={e => setRescheduleInput(e.target.value)}
                                  min={new Date().toISOString().split('T')[0]}
                                  className="studio-input h-8 text-xs px-2 w-36"
                                />
                                <button
                                  onClick={() => rescheduleFollowUp(fu)}
                                  disabled={!rescheduleInput}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                                  style={{ background: 'var(--accent-base)', color: '#fff' }}>
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setReschedulingFuId(null)}
                                  className="px-2 py-1.5 text-xs rounded-lg"
                                  style={{ color: 'var(--text-secondary)' }}>
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>{/* end left column */}


            {/* RIGHT SIDEBAR — AT A GLANCE + Quotations mini */}
            <div className="space-y-3">

              {/* AT A GLANCE */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>At a Glance</p>
                <SidebarRow label="Stage" value={STAGE_LABELS[lead.stage] ?? '—'} />
                <SidebarRow label="Assigned To" value={lead.designerName ?? '—'} />
                <SidebarRow label="Next Follow-up" value={lead.followUpDate ? fmtDate(lead.followUpDate) : '—'} />
                {(() => {
                  const now = new Date();
                  const nextVisit = siteVisitsData
                    .filter(v => v.status === 'scheduled' && new Date(v.scheduledAt) >= now)
                    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
                  const lastVisit = siteVisitsData
                    .filter(v => v.status === 'completed')
                    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0];
                  const displayVisit = nextVisit ?? lastVisit;
                  return (
                    <SidebarRow
                      label="Site Visit"
                      value={displayVisit ? fmtDate(displayVisit.scheduledAt) : '—'}
                    />
                  );
                })()}
                <SidebarRow label="Last Activity" value={relDate(lead.lastActivityAt) ?? '—'} />
                <SidebarRow label="Site Address" value={lead.projectLocation ?? '—'} />
              </div>

              {/* AMOUNT QUOTED */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>Amount Quoted</p>
                {lead.projectValuePaise ? (
                  <p className="text-2xl font-bold mb-3" style={{ color: 'var(--text-heading)' }}>
                    ₹{(lead.projectValuePaise / 100).toLocaleString('en-IN')}
                  </p>
                ) : (
                  <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>No amount entered yet</p>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none" style={{ color: 'var(--text-secondary)' }}>₹</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quotedAmountInput}
                      onChange={e => setQuotedAmountInput(e.target.value)}
                      className="studio-input w-full text-sm h-9"
                      style={{ paddingLeft: '1.75rem' }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingQuotedAmount || !quotedAmountInput}
                    onClick={async () => {
                      setSavingQuotedAmount(true);
                      try {
                        const paise = Math.round(parseFloat(quotedAmountInput) * 100);
                        const res = await fetch(`/api/v1/leads/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ projectValuePaise: paise }),
                        });
                        const json = await res.json().catch(() => ({})) as { data?: Lead };
                        if (res.ok && json.data) { setLead(json.data); setQuotedAmountSaved(true); setTimeout(() => setQuotedAmountSaved(false), 2000); }
                      } finally { setSavingQuotedAmount(false); }
                    }}
                    className="btn-primary h-9 px-4 text-sm font-semibold disabled:opacity-50 flex-shrink-0">
                    {savingQuotedAmount ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {quotedAmountSaved && <p className="mt-2 text-xs font-medium" style={{ color: 'var(--success)' }}>Saved!</p>}
              </div>

              {/* RECENT ACTIVITY */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Recent Activity</p>
                  {activities.length > 5 && (
                    <button type="button" onClick={() => setActiveTab('activity')}
                      className="text-[12px] font-semibold hover:underline" style={{ color: 'var(--violet-primary)' }}>
                      View all
                    </button>
                  )}
                </div>
                {activities.length === 0 ? (
                  <div className="px-5 py-6 text-center">
                    <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No activity yet</p>
                  </div>
                ) : (
                  <div>
                    {activities.slice(0, 5).map((act, i) => (
                      <div key={act.id}
                        className="flex items-start gap-2.5 px-4 py-3"
                        style={{ borderBottom: i < Math.min(activities.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <div className="h-1.5 w-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--accent-base)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium leading-snug" style={{ color: 'var(--text-heading)' }}>{act.title}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{relDate(act.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>{/* end right sidebar */}

          </div>{/* end two-column */}

        </div>{/* end space-y-5 */}
      </div>{/* end p-6 */}

      {/* Mobile floating bar */}
      <div className="lg:hidden floating-action-bar fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-4 py-3 gap-2"
        style={{ boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <a href={`tel:${lead.contactPhone}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-blue-50">
          <Phone className="h-5 w-5 text-blue-600" />
          <span className="text-[10px] font-medium text-blue-600">Call</span>
        </a>
        <a href={`https://wa.me/91${waPhone}`} target="_blank" rel="noreferrer"
          className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-green-50">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <span className="text-[10px] font-medium text-green-600">WhatsApp</span>
        </a>
        <button type="button" onClick={scrollToFollowUp} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-amber-50">
          <Calendar className="h-5 w-5 text-amber-600" />
          <span className="text-[10px] font-medium text-amber-600">Follow-up</span>
        </button>
        <button type="button" onClick={() => setShowEditDialog(true)} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl hover:bg-violet-50">
          <Edit2 className="h-5 w-5" style={{ color: 'var(--violet-primary)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'var(--violet-primary)' }}>Edit</span>
        </button>
        {linkedProject ? (
          <Link href={`/projects/${linkedProject.id}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl" style={{ background: 'var(--violet-primary)' }}>
            <FolderKanban className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Project</span>
          </Link>
        ) : isWon ? (
          <Link href={`/projects?leadId=${id}`} className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl" style={{ background: 'var(--violet-primary)' }}>
            <FolderKanban className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Convert</span>
          </Link>
        ) : !isTerminal ? (
          <button type="button"
            onClick={() => setShowWonFlowModal(true)}
            disabled={stageActionsDisabled}
            className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl disabled:opacity-50"
            style={{ background: 'var(--violet-primary)' }}>
            <CheckCircle2 className="h-5 w-5 text-white" />
            <span className="text-[10px] font-medium text-white">Won</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl" style={{ opacity: 0.35 }}>
            <FolderKanban className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Convert</span>
          </div>
        )}
      </div>

    </div>
  );
}
