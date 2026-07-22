'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface FieldSiteLogForm {
  progressPct: number;
  stage: string;
  labourCount: string;
  delayFlag: boolean;
  blockers: string;
  transcript: string;
}

const INITIAL_FORM: FieldSiteLogForm = {
  progressPct: 0,
  stage: '',
  labourCount: '',
  delayFlag: false,
  blockers: '',
  transcript: '',
};

function SiteLogForm({ projectId }: { projectId: string }) {
  const [form, setForm] = useState<FieldSiteLogForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FieldSiteLogForm>(
    key: K,
    value: FieldSiteLogForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(false);

    const logDate = new Date().toISOString().slice(0, 10);
    const labourCount =
      form.labourCount !== '' ? Number(form.labourCount) : undefined;

    const blockersArray = form.blockers
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const payload: Record<string, unknown> = {
      logDate,
      source: 'manual',
      progressPct: form.progressPct,
      delayFlag: form.delayFlag,
    };

    if (form.stage.trim()) {
      payload.stage = form.stage.trim();
    }
    if (labourCount !== undefined && !Number.isNaN(labourCount)) {
      payload.labourCount = labourCount;
    }
    if (blockersArray.length > 0) {
      payload.blockersJson = blockersArray;
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
        setError(
          typeof body.error === 'string'
            ? body.error
            : 'Failed to submit log. Please try again.',
        );
        return;
      }

      setSuccess(true);
      setForm(INITIAL_FORM);
    } catch {
      setError('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Log Today&apos;s Site Update</h1>

      {/* Progress slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="field-progress" className="text-base font-semibold">
            Progress
          </Label>
          <span className="text-2xl font-bold text-gray-900">
            {form.progressPct}%
          </span>
        </div>
        <input
          id="field-progress"
          type="range"
          min={0}
          max={100}
          step={1}
          value={form.progressPct}
          onChange={(e) => setField('progressPct', Number(e.target.value))}
          className="w-full h-4 rounded-full accent-blue-600 cursor-pointer"
        />
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              form.progressPct < 40
                ? 'bg-red-500'
                : form.progressPct < 70
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${form.progressPct}%` }}
          />
        </div>
      </div>

      {/* Stage */}
      <div className="space-y-2">
        <Label htmlFor="field-stage" className="text-base font-semibold">
          Current Stage
        </Label>
        <Input
          id="field-stage"
          placeholder="e.g. False ceiling, Tile work…"
          value={form.stage}
          onChange={(e) => setField('stage', e.target.value)}
          className="h-12 text-base"
        />
      </div>

      {/* Labour count */}
      <div className="space-y-2">
        <Label htmlFor="field-labour" className="text-base font-semibold">
          Labour Count
        </Label>
        <Input
          id="field-labour"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Number of workers on site"
          value={form.labourCount}
          onChange={(e) => setField('labourCount', e.target.value)}
          className="h-12 text-base"
        />
      </div>

      {/* Delay toggle */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Delay Flag</Label>
        <button
          type="button"
          onClick={() => setField('delayFlag', !form.delayFlag)}
          className={`w-full rounded-xl py-4 text-base font-semibold transition-colors ${
            form.delayFlag
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {form.delayFlag ? 'DELAY FLAGGED — Tap to clear' : 'Tap to flag a delay'}
        </button>
      </div>

      {/* Blockers */}
      <div className="space-y-2">
        <Label htmlFor="field-blockers" className="text-base font-semibold">
          Blockers{' '}
          <span className="text-xs font-normal text-gray-400">
            (one per line)
          </span>
        </Label>
        <Textarea
          id="field-blockers"
          rows={3}
          placeholder={`Material not delivered\nElectrician absent`}
          value={form.blockers}
          onChange={(e) => setField('blockers', e.target.value)}
          className="text-base"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="field-notes" className="text-base font-semibold">
          Notes
        </Label>
        <Textarea
          id="field-notes"
          rows={4}
          placeholder="General observations, site conditions, next steps…"
          value={form.transcript}
          onChange={(e) => setField('transcript', e.target.value)}
          className="text-base"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium">
          Site log submitted successfully!
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full h-14 text-lg font-semibold"
      >
        {submitting ? 'Submitting…' : 'Submit Site Log'}
      </Button>
    </div>
  );
}

function SiteLogPageInner() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold text-gray-700">No Project Selected</p>
        <p className="text-sm text-gray-500">
          Please open this page from the project site tracker.
        </p>
      </div>
    );
  }

  return <SiteLogForm projectId={projectId} />;
}

export default function SiteLogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-32 items-center justify-center text-sm text-gray-500">
          Loading…
        </div>
      }
    >
      <SiteLogPageInner />
    </Suspense>
  );
}
