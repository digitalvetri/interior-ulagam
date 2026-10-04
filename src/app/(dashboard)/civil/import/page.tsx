'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight, Info,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { parseCivilWorkbook } from '@/lib/civil/import-parser';
import { apiError, dmy } from '@/components/civil/format';
import type { CivilBranchOption, CivilCity, CivilCompany } from '@/components/civil/types';
import type { CivilImportCommitInput, ParsedCivilJob, ParsedCivilWorkbook } from '@/types/civil';

/* ── Types ──────────────────────────────────────────────────────────────────── */

type Step = 1 | 2 | 3 | 4;

interface StoreRow {
  storeName: string;
  companyName: string;
  cityName: string;
  branchName: string;
}

interface ImportResult {
  created: number;
  skipped: number[];
  companiesCreated: number;
  branchesCreated: number;
  managersCreated: number;
}

const STEPS = ['Upload', 'Check names', 'Confirm'] as const;

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g, ' ').trim();
}

const norm = (s: string) => s.trim().toLowerCase();

function branchIn(branches: CivilBranchOption[], s: StoreRow): boolean {
  return branches.some(b =>
    norm(b.companyName) === norm(s.companyName) && norm(b.cityName) === norm(s.cityName) && norm(b.name) === norm(s.branchName));
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function CivilImportPage() {
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedCivilWorkbook | null>(null);
  // Kept so switching sheet re-parses without asking for the file again.
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [companies, setCompanies] = useState<CivilCompany[]>([]);
  const [cities, setCities] = useState<CivilCity[]>([]);
  const [branches, setBranches] = useState<CivilBranchOption[]>([]);

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [allCompany, setAllCompany] = useState('');

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch('/api/v1/civil/companies').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/civil/cities').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/civil/branches').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([co, ci, br]: { data?: unknown[] }[]) => {
      setCompanies((co.data ?? []) as CivilCompany[]);
      setCities((ci.data ?? []) as CivilCity[]);
      setBranches((br.data ?? []) as CivilBranchOption[]);
    });
  }, []);

  /* ── Step 1: read the file in the browser ───────────────────────────────────── */

  function loadWorkbook(data: ArrayBuffer, sheetName?: string) {
    const wb = parseCivilWorkbook(data, sheetName);
    if (!wb.jobs.length) throw new Error('The sheet has the right columns but no numbered jobs under them.');
    setParsed(wb);
    setFileData(data);
    return wb;
  }

  function switchSheet(sheetName: string) {
    if (!fileData) return;
    try {
      const wb = loadWorkbook(fileData, sheetName);
      setStores(wb.storeNames.map(storeName => stores.find(s => s.storeName === storeName) ?? ({
        storeName,
        companyName: companies.length === 1 ? companies[0].name : '',
        cityName: '',
        branchName: titleCase(storeName),
      })));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Could not read that sheet.');
    }
  }

  async function readFile(file: File) {
    setReading(true); setParseError(null); setFileName(file.name);
    try {
      const wb = loadWorkbook(await file.arrayBuffer());
      setStores(wb.storeNames.map(storeName => ({
        storeName,
        companyName: companies.length === 1 ? companies[0].name : '',
        cityName: '',
        branchName: titleCase(storeName),
      })));
      setStep(2);
    } catch (e) {
      setParsed(null);
      setParseError(e instanceof Error ? e.message : 'Could not read this file. Is it an Excel workbook?');
    } finally {
      setReading(false);
    }
  }

  /* ── Derived ────────────────────────────────────────────────────────────────── */

  const lineCount = parsed?.jobs.reduce((s, j) => s + j.lines.length, 0) ?? 0;

  const storesComplete = stores.every(s => s.companyName.trim() && s.cityName.trim() && s.branchName.trim());

  const branchExists = (s: StoreRow) => branchIn(branches, s);

  const review = useMemo(() => {
    const jobs = parsed?.jobs ?? [];
    const counts = new Map<number, number>();
    jobs.forEach(j => counts.set(j.jobNo, (counts.get(j.jobNo) ?? 0) + 1));
    const missingDate = jobs.filter(j => !j.jobDate);
    const mismatch = jobs.filter(j => j.mismatch);
    const noLines = jobs.filter(j => j.lines.length === 0);
    const duplicates = jobs.filter(j => (counts.get(j.jobNo) ?? 0) > 1);
    const importable = jobs.filter(j => j.jobDate);
    const billed = importable.filter(j => j.billNo || j.billDate).length;
    return { missingDate, mismatch, noLines, duplicates, importable, billed };
  }, [parsed]);

  const plan = useMemo(() => {
    const newCompanies = new Set(stores.map(s => s.companyName.trim()).filter(n => n && !companies.some(c => norm(c.name) === norm(n))).map(norm));
    const newCities = new Set(stores.map(s => s.cityName.trim()).filter(n => n && !cities.some(c => norm(c.name) === norm(n))).map(norm));
    const newBranches = stores.filter(s => !branchIn(branches, s)).length;
    return { newCompanies: newCompanies.size, newCities: newCities.size, newBranches };
  }, [stores, companies, cities, branches]);

  /* ── Handlers ───────────────────────────────────────────────────────────────── */

  function updateStore(i: number, patch: Partial<StoreRow>) {
    setStores(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function applyCompanyToAll() {
    if (!allCompany.trim()) return;
    setStores(prev => prev.map(s => ({ ...s, companyName: allCompany.trim() })));
  }

  async function commit() {
    if (!parsed) return;
    setCommitting(true); setCommitError(null);
    const body: CivilImportCommitInput = {
      storeMap: stores.map(s => ({
        storeName: s.storeName,
        companyName: s.companyName.trim(),
        cityName: s.cityName.trim(),
        branchName: s.branchName.trim(),
      })),
      jobs: review.importable.map((j: ParsedCivilJob) => ({
        jobNo: j.jobNo,
        jobDate: j.jobDate!,
        storeName: j.storeName,
        heading: j.heading,
        remark: j.remark,
        managerName: j.managerName,
        billNo: j.billNo,
        billDate: j.billDate,
        lines: j.lines,
      })),
    };
    try {
      const res = await fetch('/api/v1/civil/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { setCommitError(await apiError(res, 'Import failed.')); return; }
      const json = await res.json() as { data: ImportResult };
      setResult(json.data);
      setStep(4);
    } catch {
      setCommitError('Network error.');
    } finally {
      setCommitting(false);
    }
  }

  function restart() {
    setStep(1); setParsed(null); setFileData(null); setStores([]); setResult(null); setFileName(''); setParseError(null); setCommitError(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  /* ── Render ─────────────────────────────────────────────────────────────────── */

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Import old Excel</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Bring your existing job sheet into Civil Management. Nothing is saved until you confirm.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = step > n;
          const on = step === n;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-6" style={{ background: 'var(--border-strong)' }} />}
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                style={on || done
                  ? { background: 'var(--accent-base)', color: '#fff' }
                  : { background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{n}</span>}
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Step 1 ─────────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs mb-4"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            Import your old sheet before adding new jobs so numbering continues from your last S.No.
          </div>
          <label
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) void readFile(f);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors"
            style={{
              borderColor: dragOver ? 'var(--accent-base)' : 'var(--border-strong)',
              background: dragOver ? 'var(--accent-soft)' : 'var(--surface-muted)',
            }}>
            {reading
              ? <div className="skeleton h-10 w-10 rounded-xl" />
              : <Upload className="h-10 w-10" style={{ color: 'var(--accent-base)' }} />}
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                {reading ? `Reading ${fileName}…` : 'Drop your Excel file here, or click to choose'}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                .xlsx or .xls — the sheet with S,NO · DATE · STORE NAME · COMPLAINTS · MATRIAL / LABOUR columns
              </p>
            </div>
            <input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f); }} />
          </label>
          {parseError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span><span className="font-semibold">{fileName}:</span> {parseError}</span>
            </div>
          )}
        </Card>
      )}

      {/* ── Step 2 ─────────────────────────────────────────────────────────────── */}
      {step === 2 && parsed && (
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Found <b style={{ color: 'var(--text-heading)' }}>{parsed.jobs.length} jobs</b>, {lineCount} lines,{' '}
            {parsed.storeNames.length} store names, {parsed.managerNames.length} managers in sheet{' '}
            <b style={{ color: 'var(--text-heading)' }}>&ldquo;{parsed.sheetName}&rdquo;</b>.
            Tell us where each store belongs.
          </p>

          {parsed.sheets.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--warning-soft)', color: 'var(--warning-text)' }}>
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{parsed.sheets.length} sheets have job columns. Importing from:</span>
              <select value={parsed.sheetName} onChange={e => switchSheet(e.target.value)}
                className="studio-input h-8 text-xs" style={{ color: 'var(--text-heading)' }}>
                {parsed.sheets.map(sh => (
                  <option key={sh.name} value={sh.name}>{sh.name} — {sh.jobCount} jobs</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>Same company for all stores</label>
              <input list="civil-companies" value={allCompany} onChange={e => setAllCompany(e.target.value)}
                placeholder="e.g. D-Mart" className="studio-input h-9 w-56 text-sm" />
            </div>
            <button type="button" onClick={applyCompanyToAll} disabled={!allCompany.trim()}
              className="btn-secondary px-3 py-2 text-sm disabled:opacity-50">
              Apply to all
            </button>
          </div>

          <datalist id="civil-companies">{companies.map(c => <option key={c.id} value={c.name} />)}</datalist>
          <datalist id="civil-cities">{cities.map(c => <option key={c.id} value={c.name} />)}</datalist>

          <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Store name in Excel', 'Jobs', 'Company', 'City', 'Branch name', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold tracking-wide"
                      style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((s, i) => {
                  const ready = s.companyName.trim() && s.cityName.trim() && s.branchName.trim();
                  return (
                    <tr key={s.storeName} style={{ borderBottom: i < stores.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>{s.storeName}</td>
                      <td className="px-4 py-2.5 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {parsed.jobs.filter(j => j.storeName === s.storeName).length}
                      </td>
                      <td className="px-4 py-2.5">
                        <input list="civil-companies" value={s.companyName} placeholder="Company"
                          onChange={e => updateStore(i, { companyName: e.target.value })}
                          className="studio-input h-9 w-full min-w-[140px] text-sm" />
                      </td>
                      <td className="px-4 py-2.5">
                        <input list="civil-cities" value={s.cityName} placeholder="City"
                          onChange={e => updateStore(i, { cityName: e.target.value })}
                          className="studio-input h-9 w-full min-w-[120px] text-sm" />
                      </td>
                      <td className="px-4 py-2.5">
                        <input value={s.branchName} placeholder="Branch"
                          onChange={e => updateStore(i, { branchName: e.target.value })}
                          className="studio-input h-9 w-full min-w-[140px] text-sm" />
                      </td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                        {!ready ? (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        ) : branchExists(s) ? (
                          <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>existing</span>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>(new)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={restart} className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-sm">
              <ArrowLeft className="h-4 w-4" />Choose another file
            </button>
            <div className="flex items-center gap-3">
              {!storesComplete && (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Fill company, city and branch for every store.</span>
              )}
              <button type="button" onClick={() => setStep(3)} disabled={!storesComplete}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50">
                Review<ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Step 3 ─────────────────────────────────────────────────────────────── */}
      {step === 3 && parsed && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Jobs to import" value={review.importable.length} />
            <Stat label="New companies" value={plan.newCompanies} />
            <Stat label="New cities" value={plan.newCities} />
            <Stat label="New branches" value={plan.newBranches} />
          </div>

          <Card>
            <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--accent-base)' }} />
              <div className="space-y-2">
                <p>
                  Jobs with a bill number or billing date come in as <b style={{ color: 'var(--text-heading)' }}>Billed</b>{' '}
                  ({review.billed}), the rest as <b style={{ color: 'var(--text-heading)' }}>Done</b>{' '}
                  ({review.importable.length - review.billed}). Jobs whose S.No is already in the app are skipped, so
                  importing the same file twice is safe.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Jobs that need a look</h2>
            {review.mismatch.length + review.missingDate.length + review.noLines.length + review.duplicates.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 text-sm" style={{ color: 'var(--success-text)' }}>
                <CheckCircle2 className="h-4 w-4" />Everything looks consistent.
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                <Issue title="Total doesn't match its lines (imported with the sum of the lines)" jobs={review.mismatch}
                  detail={j => `Sheet total ${formatRupees(j.statedTotalPaise ?? 0)} · lines ${formatRupees(j.lines.reduce((s, l) => s + l.amountPaise, 0))}`} />
                <Issue title="No date — these will be EXCLUDED" jobs={review.missingDate} danger
                  detail={() => 'Add a date in Excel and re-upload to include them'} />
                <Issue title="No amount lines (imported as ₹0)" jobs={review.noLines}
                  detail={j => j.remark ?? 'No lines found'} />
                <Issue title="Same S.No used twice in the file (only the first is imported)" jobs={review.duplicates}
                  detail={j => j.heading} />
              </div>
            )}
          </Card>

          {commitError && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{commitError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setStep(2)} disabled={committing}
              className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-sm">
              <ArrowLeft className="h-4 w-4" />Back to names
            </button>
            <button type="button" onClick={() => void commit()} disabled={committing || review.importable.length === 0}
              className="btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-sm disabled:opacity-50">
              {committing ? 'Importing…' : `Confirm import of ${review.importable.length} jobs`}
            </button>
          </div>
        </div>
      )}

      {/* ── Done ───────────────────────────────────────────────────────────────── */}
      {step === 4 && result && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12" style={{ color: 'var(--success)' }} />
            <p className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>Imported {result.created} jobs</p>
            <p className="max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
              {result.companiesCreated} companies, {result.branchesCreated} branches and {result.managersCreated} managers created.
              {result.skipped.length > 0 && (
                <> Skipped {result.skipped.length} already in the app (S.No {result.skipped.slice(0, 10).join(', ')}
                  {result.skipped.length > 10 ? '…' : ''}).</>
              )}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Link href="/civil" className="btn-secondary px-4 py-2 text-sm">Go to companies</Link>
              <Link href="/civil/jobs" className="btn-primary px-4 py-2 text-sm">See all jobs</Link>
              <button type="button" onClick={restart} className="px-3 py-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Import another file
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border p-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{value}</p>
    </div>
  );
}

function Issue({ title, jobs, detail, danger }: {
  title: string; jobs: ParsedCivilJob[]; detail: (j: ParsedCivilJob) => string; danger?: boolean;
}) {
  if (!jobs.length) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: danger ? 'var(--danger-text)' : 'var(--warning-text)' }}>
        <FileSpreadsheet className="h-3.5 w-3.5" />{title} · {jobs.length}
      </p>
      <ul className="mt-1.5 divide-y rounded-xl border text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
        {jobs.slice(0, 50).map((j, i) => (
          <li key={`${j.jobNo}-${i}`} className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>#{j.jobNo}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{dmy(j.jobDate)}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{j.storeName}</span>
            <span className="font-medium uppercase" style={{ color: 'var(--text-heading)' }}>{j.heading}</span>
            <span className="w-full sm:w-auto sm:ml-auto" style={{ color: 'var(--text-tertiary)' }}>{detail(j)}</span>
          </li>
        ))}
        {jobs.length > 50 && <li className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>…and {jobs.length - 50} more</li>}
      </ul>
    </div>
  );
}
