'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, HardHat, Plus, AlertTriangle, X, Users, TrendingUp,
  Calendar, FileText, Image as ImageIcon, ExternalLink,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface SiteLog {
  id: string;
  projectId: string;
  logDate: string;
  photos: string[];
  voiceNoteUrl: string | null;
  transcript: string | null;
  progressPct: number | null;
  stage: string | null;
  delayFlag: boolean;
  labourCount: number | null;
  blockersJson: unknown;
  source: 'whatsapp' | 'manual';
  createdAt: string;
}

interface AddLogForm {
  logDate: string;
  progressPct: string;
  stage: string;
  labourCount: string;
  delayFlag: boolean;
  transcript: string;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

const INITIAL_FORM: AddLogForm = {
  logDate: getTodayString(),
  progressPct: '',
  stage: '',
  labourCount: '',
  delayFlag: false,
  transcript: '',
};

function parseBlockers(blockersJson: unknown): string[] {
  if (!blockersJson || !Array.isArray(blockersJson)) return [];
  return blockersJson.filter((b): b is string => typeof b === 'string');
}

function progressColor(pct: number): string {
  if (pct < 40) return 'var(--danger)';
  if (pct < 70) return 'var(--warning)';
  return 'var(--success)';
}

/* ── Add Log Modal ─────────────────────────────────────────────────────────── */

function AddLogModal({
  projectId, onClose, onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm]         = useState<AddLogForm>({ ...INITIAL_FORM, logDate: getTodayString() });
  const [submitting, setSub]    = useState(false);
  const [error, setError]       = useState<string | null>(null);

  function set<K extends keyof AddLogForm>(k: K, v: AddLogForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    setError(null);
    if (!form.logDate) { setError('Log date is required'); return; }

    const progressPct = form.progressPct !== '' ? Number(form.progressPct) : undefined;
    const labourCount = form.labourCount !== '' ? Number(form.labourCount) : undefined;

    const payload: Record<string, unknown> = { logDate: form.logDate, source: 'manual', delayFlag: form.delayFlag };
    if (progressPct !== undefined && !Number.isNaN(progressPct)) payload.progressPct = progressPct;
    if (form.stage.trim())   payload.stage = form.stage.trim();
    if (labourCount !== undefined && !Number.isNaN(labourCount)) payload.labourCount = labourCount;
    if (form.transcript.trim()) payload.transcript = form.transcript.trim();

    setSub(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/site-logs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error ?? 'Failed to add log entry'); return;
      }
      onSuccess();
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSub(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <HardHat className="h-4 w-4" style={{ color: 'var(--accent-base)' }} />
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Add Log Entry</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)]">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">Log Date *</label>
              <input type="date" value={form.logDate} onChange={e => set('logDate', e.target.value)}
                className="studio-input w-full text-sm" />
            </div>
            <div>
              <label className="studio-label block mb-1.5">Progress % <span style={{ color: 'var(--text-tertiary)' }}>(0–100)</span></label>
              <input type="number" min={0} max={100} placeholder="e.g. 65" value={form.progressPct}
                onChange={e => set('progressPct', e.target.value)} className="studio-input w-full text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="studio-label block mb-1.5">Stage</label>
              <input type="text" placeholder="e.g. False ceiling" value={form.stage}
                onChange={e => set('stage', e.target.value)} className="studio-input w-full text-sm" />
            </div>
            <div>
              <label className="studio-label block mb-1.5">Labour Count</label>
              <input type="number" min={0} placeholder="e.g. 8" value={form.labourCount}
                onChange={e => set('labourCount', e.target.value)} className="studio-input w-full text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer px-1">
            <div className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ background: form.delayFlag ? 'var(--danger)' : 'var(--border-strong)' }}
              onClick={() => set('delayFlag', !form.delayFlag)}>
              <div className="absolute top-1 w-4 h-4 bg-[var(--surface-card)] rounded-full transition-all"
                style={{ left: form.delayFlag ? 22 : 4 }} />
            </div>
            <span className="text-sm" style={{ color: 'var(--text-heading)' }}>Flag as delayed</span>
          </label>
          <div>
            <label className="studio-label block mb-1.5">Notes / Observations</label>
            <textarea value={form.transcript} onChange={e => set('transcript', e.target.value)}
              rows={3} placeholder="Observations, progress details…"
              className="studio-input w-full text-sm resize-none" />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            {submitting ? 'Saving…' : 'Save Log'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [logs,    setLogs]    = useState<SiteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const loadLogs = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/projects/${projectId}/site-logs`)
      .then(r => r.json())
      .then(({ data }: { data: SiteLog[] }) => { setLogs(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const latestPct = logs.find(l => l.progressPct !== null)?.progressPct ?? null;
  const delayCount = logs.filter(l => l.delayFlag).length;

  return (
    <div className="p-6 space-y-5">

      {/* Back */}
      <Link href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="h-4 w-4" />Project Overview
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Site Execution Tracker</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Daily site logs from WhatsApp and manual entries</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl flex-shrink-0">
          <Plus className="h-4 w-4" />Add Log Entry
        </button>
      </div>

      {/* Progress summary */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Latest Progress</p>
            {latestPct !== null ? (
              <>
                <p className="text-2xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>{latestPct}%</p>
                <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--border-subtle)' }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${latestPct}%`, background: progressColor(latestPct) }} />
                </div>
              </>
            ) : <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Not logged yet</p>}
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Log Entries</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{logs.length}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {logs.filter(l => l.source === 'whatsapp').length} via WhatsApp
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--surface-card)', borderColor: delayCount > 0 ? 'var(--danger-soft)' : 'var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Delay Flags</p>
            <p className="text-2xl font-bold" style={{ color: delayCount > 0 ? 'var(--danger)' : 'var(--text-heading)' }}>{delayCount}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>out of {logs.length} entries</p>
          </div>
        </div>
      )}

      {/* Logs */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>

      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="relative">
            <div className="h-20 w-20 rounded-3xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <HardHat className="h-10 w-10" style={{ color: 'var(--accent-base)' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--success-soft)', border: '2px solid var(--surface-card)' }}>
              <Plus className="h-4 w-4" style={{ color: 'var(--success)' }} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-heading)' }}>No site logs yet</h3>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              Site supervisors can send daily updates via WhatsApp, or you can add manual entries here.
            </p>
          </div>
          <button type="button" onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl">
            <Plus className="h-4 w-4" />Add First Log Entry
          </button>
        </div>

      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const blockers = parseBlockers(log.blockersJson);
            return (
              <div key={log.id} className="rounded-2xl border p-5 transition-all hover:shadow-sm"
                style={{
                  background: 'var(--surface-card)',
                  borderColor: log.delayFlag ? 'var(--danger-soft)' : 'var(--border-subtle)',
                  borderLeftWidth: 4,
                  borderLeftColor: log.delayFlag ? 'var(--danger)' : log.progressPct !== null ? progressColor(log.progressPct) : 'var(--border-strong)',
                }}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--surface-muted)' }}>
                      <Calendar className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>
                        {new Date(log.logDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{log.source === 'whatsapp' ? 'via WhatsApp' : 'Manual entry'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.delayFlag && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                        <AlertTriangle className="h-3 w-3" />Delay Flagged
                      </span>
                    )}
                    {log.stage && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: 'var(--accent-soft)', color: 'var(--accent-base)' }}>
                        {log.stage}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {log.progressPct !== null && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />Progress</span>
                      <span className="font-semibold">{log.progressPct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full" style={{ background: 'var(--border-subtle)' }}>
                      <div className="h-2 rounded-full transition-all"
                        style={{ width: `${log.progressPct}%`, background: progressColor(log.progressPct) }} />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {log.labourCount !== null && (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />{log.labourCount} workers on site
                    </span>
                  )}
                </div>

                {/* Transcript */}
                {log.transcript && (
                  <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--surface-muted)' }}>
                    <p className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <FileText className="h-3 w-3" />Notes
                    </p>
                    <p className="text-sm line-clamp-3" style={{ color: 'var(--text-heading)' }}>{log.transcript}</p>
                  </div>
                )}

                {/* Blockers */}
                {blockers.length > 0 && (
                  <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--danger-soft)' }}>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--danger)' }}>
                      <AlertTriangle className="h-3 w-3" />Blockers
                    </p>
                    <ul className="space-y-1">
                      {blockers.map((b, i) => (
                        <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--danger-text)' }}>
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />{b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Photos */}
                {log.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {log.photos.slice(0, 4).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="relative group h-16 w-16 rounded-xl overflow-hidden border"
                        style={{ borderColor: 'var(--border-strong)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Site photo ${i + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                          <ExternalLink className="h-3 w-3 text-white opacity-0 group-hover:opacity-100" />
                        </div>
                      </a>
                    ))}
                    {log.photos.length > 4 && (
                      <div className="h-16 w-16 rounded-xl flex items-center justify-center text-xs font-medium"
                        style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        <ImageIcon className="h-4 w-4 mb-0.5" />+{log.photos.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <AddLogModal
          projectId={projectId}
          onClose={() => setModalOpen(false)}
          onSuccess={loadLogs}
        />
      )}
    </div>
  );
}
