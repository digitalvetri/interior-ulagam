'use client';

import { useRef, useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { formatRupees } from '@/lib/utils';

interface ParsedRow {
  rowIndex: number;
  room: string;
  item: string;
  unit: string;
  qty: number;
  costRatePaise: number;
  clientRatePaise: number;
  errors: string[];
}

interface ImportBOQModalProps {
  quoteId: string;
  onImported: () => void;
  onClose: () => void;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_\-/]+/g, '');
}

const HEADER_MAP: Record<string, string> = {
  room:         'room',
  roomname:     'room',
  area:         'room',
  space:        'room',
  item:         'item',
  description:  'item',
  itemname:     'item',
  itemdesc:     'item',
  particulars:  'item',
  work:         'item',
  unit:         'unit',
  units:        'unit',
  uom:          'unit',
  qty:          'qty',
  quantity:     'qty',
  nos:          'qty',
  number:       'qty',
  costrate:     'cost',
  cost:         'cost',
  costprice:    'cost',
  purchaserate: 'cost',
  vendorrate:   'cost',
  buyingrate:   'cost',
  clientrate:   'client',
  sellingrate:  'client',
  sellrate:     'client',
  rate:         'client',
  price:        'client',
  mrp:          'client',
  quotedrate:   'client',
  billingrate:  'client',
};

export function ImportBOQModal({ quoteId, onImported, onClose }: ImportBOQModalProps) {
  const fileRef                         = useRef<HTMLInputElement>(null);
  const [fileName,    setFileName]      = useState<string | null>(null);
  const [rows,        setRows]          = useState<ParsedRow[]>([]);
  const [parseError,  setParseError]    = useState<string | null>(null);
  const [importing,   setImporting]     = useState(false);
  const [importError, setImportError]   = useState<string | null>(null);
  const [imported,    setImported]      = useState(false);

  const validRows   = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  async function parseFile(file: File) {
    setParseError(null);
    setRows([]);
    setFileName(file.name);

    try {
      const XLSX    = await import('xlsx');
      const buffer  = await file.arrayBuffer();
      const wb      = XLSX.read(buffer, { type: 'array' });
      const ws      = wb.Sheets[wb.SheetNames[0]];
      const raw     = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });

      if (!raw || raw.length < 2) {
        setParseError('File appears empty — need at least a header row and one data row.');
        return;
      }

      const headers = (raw[0] as (string | number)[]).map((h) => normalizeHeader(String(h)));
      const colMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        const canon = HEADER_MAP[h];
        if (canon && !(canon in colMap)) colMap[canon] = i;
      });

      const missing = ['room', 'item', 'unit', 'qty', 'client'].filter((k) => !(k in colMap));
      if (missing.length > 0) {
        setParseError(
          `Could not find required columns: ${missing.join(', ')}. ` +
          `Make sure the first row contains headers like: Room, Item, Unit, Qty, Client Rate.`,
        );
        return;
      }

      const parsed: ParsedRow[] = [];
      for (let i = 1; i < raw.length; i++) {
        const row    = raw[i] as (string | number)[];
        const cell   = (k: string) => String(row[colMap[k]] ?? '').trim();
        const numVal = (k: string) =>
          Number(String(row[colMap[k]] ?? '').replace(/[₹,\s]/g, '')) || 0;

        const room   = cell('room');
        const item   = cell('item');
        const unit   = cell('unit');
        const qty    = Math.round(numVal('qty'));
        const cost   = Math.round(numVal('cost') * 100);
        const client = Math.round(numVal('client') * 100);

        // Skip fully blank rows
        if (!room && !item && !unit && !qty) continue;

        const errors: string[] = [];
        if (!room)    errors.push('Room is required');
        if (!item)    errors.push('Item is required');
        if (!unit)    errors.push('Unit is required');
        if (qty < 1)  errors.push('Qty must be ≥ 1');
        if (cost < 0) errors.push('Cost rate must be ≥ 0');
        if (client < 0) errors.push('Client rate must be ≥ 0');

        parsed.push({ rowIndex: i + 1, room, item, unit, qty, costRatePaise: cost, clientRatePaise: client, errors });
      }

      if (parsed.length === 0) {
        setParseError('No data rows found after the header row.');
        return;
      }

      setRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
    }
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/v1/quotes/${quoteId}/lines/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: validRows.map(({ room, item, unit, qty, costRatePaise, clientRatePaise }) => ({
            room, item, unit, qty, costRatePaise, clientRatePaise,
          })),
        }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Import failed (${res.status})`);
      setImported(true);
      setTimeout(() => { onImported(); onClose(); }, 1500);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed — please try again.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <FileSpreadsheet className="h-5 w-5" style={{ color: 'var(--accent-base)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Import BOQ</h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Upload Excel (.xlsx, .xls) or CSV</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="inline-flex items-center rounded-lg p-2 transition-all hover:bg-[var(--surface-muted)]"
            style={{ color: 'var(--text-secondary)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Success banner */}
          {imported ? (
            <div className="flex items-center gap-3 rounded-xl p-5"
              style={{ background: 'var(--success-soft)', border: '1px solid var(--success-soft)' }}>
              <CheckCircle2 className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--success)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--success-text)' }}>
                  {validRows.length} line{validRows.length !== 1 ? 's' : ''} imported successfully!
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--success)' }}>Refreshing quotation…</p>
              </div>
            </div>
          ) : (
            <>
              {/* Drop zone / file picker */}
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors hover:border-violet-400"
                style={{ borderColor: rows.length > 0 ? 'var(--accent-soft)' : '#E5E0F8', background: rows.length > 0 ? 'var(--surface-muted)' : undefined }}
                onClick={() => fileRef.current?.click()}>
                <Upload className="h-7 w-7" style={{ color: 'var(--accent-base)' }} />
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                    {fileName ?? 'Click to select file'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {rows.length > 0 ? 'Click to replace with a different file' : '.xlsx, .xls, or .csv — first row must be headers'}
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) parseFile(f);
                    e.target.value = '';
                  }}
                />
              </div>

              {/* Expected columns hint */}
              {rows.length === 0 && !parseError && (
                <div className="rounded-xl p-4 text-xs space-y-2" style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>Expected column headers (case-insensitive):</p>
                  <div className="grid grid-cols-2 gap-y-1.5">
                    <span><strong>Room</strong> — e.g. Kitchen, Living Room</span>
                    <span><strong>Item</strong> or Description — item name</span>
                    <span><strong>Unit</strong> — sqft, nos, rft, …</span>
                    <span><strong>Qty</strong> or Quantity — whole number</span>
                    <span><strong>Cost Rate</strong> — your cost in ₹</span>
                    <span><strong>Client Rate</strong> or Rate — selling price in ₹</span>
                  </div>
                </div>
              )}

              {/* Parse error */}
              {parseError && (
                <div className="flex items-start gap-2 rounded-xl p-4"
                  style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-soft)' }}>
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--danger)' }} />
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{parseError}</p>
                </div>
              )}

              {/* Preview table */}
              {rows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                      {rows.length} rows parsed
                    </span>
                    {validRows.length > 0 && (
                      <span className="text-xs rounded-full px-2 py-0.5 font-semibold"
                        style={{ background: 'var(--success-soft)', color: 'var(--success-text)' }}>
                        {validRows.length} valid
                      </span>
                    )}
                    {invalidRows.length > 0 && (
                      <span className="text-xs rounded-full px-2 py-0.5 font-semibold"
                        style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                        {invalidRows.length} with errors — will be skipped
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <th className="px-3 py-2 text-left font-semibold w-10" style={{ color: 'var(--text-tertiary)' }}>#</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-tertiary)' }}>Room</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-tertiary)' }}>Item</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-tertiary)' }}>Unit</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-tertiary)' }}>Qty</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-tertiary)' }}>Cost ₹</th>
                          <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--text-tertiary)' }}>Client ₹</th>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-tertiary)' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr
                            key={r.rowIndex}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: r.errors.length > 0 ? '#FEF9F9' : undefined,
                            }}>
                            <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{r.rowIndex}</td>
                            <td className="px-3 py-2" style={{ color: r.room ? 'var(--text-heading)' : 'var(--danger)' }}>
                              {r.room || '—'}
                            </td>
                            <td className="px-3 py-2 max-w-[200px] truncate" style={{ color: r.item ? 'var(--text-heading)' : 'var(--danger)' }}>
                              {r.item || '—'}
                            </td>
                            <td className="px-3 py-2" style={{ color: r.unit ? 'var(--text-secondary)' : 'var(--danger)' }}>
                              {r.unit || '—'}
                            </td>
                            <td className="px-3 py-2 text-right" style={{ color: r.qty >= 1 ? 'var(--text-heading)' : 'var(--danger)' }}>
                              {r.qty}
                            </td>
                            <td className="px-3 py-2 text-right" style={{ color: 'var(--text-heading)' }}>
                              {formatRupees(r.costRatePaise)}
                            </td>
                            <td className="px-3 py-2 text-right" style={{ color: 'var(--text-heading)' }}>
                              {formatRupees(r.clientRatePaise)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {r.errors.length > 0 ? (
                                <span title={r.errors.join('; ')} style={{ color: 'var(--danger)' }}>
                                  ✗ {r.errors[0]}{r.errors.length > 1 ? ` +${r.errors.length - 1}` : ''}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--success)' }}>✓ OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import error */}
              {importError && (
                <div className="flex items-start gap-2 rounded-xl p-4"
                  style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-soft)' }}>
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--danger)' }} />
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{importError}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && !imported && (
          <div className="flex items-center justify-between px-6 py-4"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {invalidRows.length > 0
                ? `${invalidRows.length} row${invalidRows.length !== 1 ? 's' : ''} with errors will be skipped.`
                : 'All rows valid — ready to import.'}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose}
                className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium transition-all hover:bg-[var(--surface-muted)]"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={validRows.length === 0 || importing}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--accent-base)' }}>
                {importing ? 'Importing…' : `Import ${validRows.length} line${validRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
