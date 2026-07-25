'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

function progressBarColor(pct: number): string {
  if (pct < 40) return 'bg-red-500';
  if (pct < 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

function parseBlockers(blockersJson: unknown): string[] {
  if (!blockersJson) return [];
  if (Array.isArray(blockersJson)) {
    return blockersJson.filter((b): b is string => typeof b === 'string');
  }
  return [];
}

export default function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [logs, setLogs] = useState<SiteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AddLogForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function loadLogs() {
    setLoading(true);
    fetch(`/api/v1/projects/${projectId}/site-logs`)
      .then((r) => r.json())
      .then(({ data }: { data: SiteLog[] }) => {
        setLogs(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function setField<K extends keyof AddLogForm>(key: K, value: AddLogForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openDialog() {
    setForm({ ...INITIAL_FORM, logDate: getTodayString() });
    setSubmitError(null);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setSubmitError(null);

    if (!form.logDate) {
      setSubmitError('Log date is required');
      return;
    }

    const progressPct = form.progressPct !== '' ? Number(form.progressPct) : undefined;
    const labourCount = form.labourCount !== '' ? Number(form.labourCount) : undefined;

    const payload: Record<string, unknown> = {
      logDate: form.logDate,
      source: 'manual',
      delayFlag: form.delayFlag,
    };

    if (progressPct !== undefined && !Number.isNaN(progressPct)) {
      payload.progressPct = progressPct;
    }
    if (form.stage.trim()) {
      payload.stage = form.stage.trim();
    }
    if (labourCount !== undefined && !Number.isNaN(labourCount)) {
      payload.labourCount = labourCount;
    }
    if (form.transcript.trim()) {
      payload.transcript = form.transcript.trim();
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/site-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setSubmitError(
          typeof body.error === 'string' ? body.error : 'Failed to add log entry',
        );
        return;
      }

      setDialogOpen(false);
      loadLogs();
    } catch {
      setSubmitError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">
            Site Execution Tracker
          </h2>
        </div>
        <button className="btn-primary" onClick={openDialog}>+ Add Log Entry</button>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">Loading site logs…</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No site logs yet.</p>
          <button className="btn-secondary" onClick={openDialog}>
            Add your first log entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const blockers = parseBlockers(log.blockersJson);
            return (
              <div key={log.id} className="premium-card p-5">
                <div className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-semibold text-gray-900">
                      {new Date(log.logDate + 'T00:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <div className="flex items-center gap-2">
                      {log.delayFlag && (
                        <span
                          style={{
                            backgroundColor: '#6F4E37',
                            color: '#F8F5F2',
                            padding: '2px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                          }}
                        >
                          DELAY FLAGGED
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  {/* Progress bar */}
                  {log.progressPct !== null && log.progressPct !== undefined && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Progress</span>
                        <span>{log.progressPct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${progressBarColor(log.progressPct)}`}
                          style={{ width: `${log.progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-gray-600">
                    {log.stage && (
                      <span>
                        <span className="font-medium text-gray-700">
                          Stage:
                        </span>{' '}
                        {log.stage}
                      </span>
                    )}
                    {log.labourCount !== null && log.labourCount !== undefined && (
                      <span>
                        <span className="font-medium text-gray-700">
                          Labour:
                        </span>{' '}
                        {log.labourCount}
                      </span>
                    )}
                  </div>

                  {/* Photos */}
                  {log.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {log.photos.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Site photo ${i + 1}`}
                          className="h-16 w-16 rounded object-cover border border-gray-200"
                        />
                      ))}
                    </div>
                  )}

                  {/* Transcript snippet */}
                  {log.transcript && (
                    <p className="text-gray-600 line-clamp-3">
                      <span className="font-medium text-gray-700">
                        Notes:
                      </span>{' '}
                      {log.transcript}
                    </p>
                  )}

                  {/* Blockers */}
                  {blockers.length > 0 && (
                    <div>
                      <p className="font-medium text-red-700 mb-1">
                        Blockers:
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-red-600">
                        {blockers.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Log Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Log Entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="log-date">Log Date</Label>
              <Input
                id="log-date"
                type="date"
                value={form.logDate}
                onChange={(e) => setField('logDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-progress">
                Progress %{' '}
                <span className="text-xs text-gray-400">(0–100)</span>
              </Label>
              <Input
                id="log-progress"
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 65"
                value={form.progressPct}
                onChange={(e) => setField('progressPct', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-stage">Stage</Label>
              <Input
                id="log-stage"
                placeholder="e.g. False ceiling"
                value={form.stage}
                onChange={(e) => setField('stage', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-labour">Labour Count</Label>
              <Input
                id="log-labour"
                type="number"
                min={0}
                placeholder="e.g. 8"
                value={form.labourCount}
                onChange={(e) => setField('labourCount', e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="log-delay"
                type="checkbox"
                checked={form.delayFlag}
                onChange={(e) => setField('delayFlag', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600 cursor-pointer"
              />
              <Label htmlFor="log-delay" className="cursor-pointer">
                Flag as delayed
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-notes">Notes</Label>
              <Textarea
                id="log-notes"
                rows={3}
                placeholder="Observations, progress details…"
                value={form.transcript}
                onChange={(e) => setField('transcript', e.target.value)}
              />
            </div>

            {submitError && (
              <p className="text-xs text-red-600">
                {submitError}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              className="btn-secondary"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Save Log'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
