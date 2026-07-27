// ─── Tally Prime import serializer ─────────────────────────────────────────
// Emits both:
//   1. CSV in the "Daybook — Sales/Receipt Voucher Import" column format
//      (accepted by Tally Prime → Import → File Type: CSV)
//   2. XML in the classic <ENVELOPE><IMPORTDATA><VOUCHER> format
//      (accepted by Tally Prime → Import → File Type: XML)
//
// Both are voucher-level; a single invoice becomes two ledger entries
// (customer Dr, sales Cr) so double-entry accounting stays intact.
// GST split (CGST/SGST/IGST) is preserved as separate ledger lines.
//
// All rupee values are printed with 2 decimals as Tally expects rupees, not
// paise. Dates use YYYYMMDD for XML and DD-MMM-YYYY for CSV (Tally's default).

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;          // ISO or YYYY-MM-DD
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  placeOfSupply: string | null;
  isInterstate: boolean;
  projectId: string;
  // Enriched at query time from projects → customers → leads
  customerName: string;
  projectName: string;
}

interface PaymentRow {
  id: string;
  invoiceId: string;
  amountPaise: number;
  status: string;
  reconciledAt: string | null;
  createdAt: string;
  // Enriched
  invoiceNumber: string | null;
  customerName: string;
  source: 'razorpay' | 'manual';
  reference: string | null;   // razorpayPaymentId
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

function toTallyCsvDate(iso: string): string {
  // Tally accepts DD-MMM-YYYY (e.g. 27-Jul-2026)
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function toTallyXmlDate(iso: string): string {
  // Tally XML wants YYYYMMDD, no separators
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function escapeCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeXml(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Sales voucher — CSV ───────────────────────────────────────────────────
// Tally's "Daybook" CSV format is one row per ledger entry. For each invoice
// we emit at least 2 rows (customer Dr + sales Cr). If GST is applied, we
// add rows for CGST/SGST or IGST.

const SALES_CSV_HEADERS = [
  'Date',
  'Voucher Type Name',
  'Voucher Number',
  'Reference No',
  'Reference Date',
  'Party Ledger Name',
  'Ledger Name',
  'Ledger Amount',
  'Ledger Amount Dr/Cr',
  'Narration',
];

export function toTallySalesCsv(invoices: InvoiceRow[]): string {
  const lines: string[] = [SALES_CSV_HEADERS.join(',')];
  for (const inv of invoices) {
    const date = toTallyCsvDate(inv.invoiceDate);
    const total = inv.subtotalPaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
    const narration = `Sales for ${inv.projectName}`;

    // 1) Customer (Party) — Dr for the gross amount
    lines.push([
      escapeCsv(date),
      'Sales',
      escapeCsv(inv.invoiceNumber),
      escapeCsv(inv.invoiceNumber),
      escapeCsv(date),
      escapeCsv(inv.customerName),
      escapeCsv(inv.customerName),
      paiseToRupees(total),
      'Dr',
      escapeCsv(narration),
    ].join(','));

    // 2) Sales ledger — Cr for the subtotal (excluding tax)
    lines.push([
      escapeCsv(date),
      'Sales',
      escapeCsv(inv.invoiceNumber),
      escapeCsv(inv.invoiceNumber),
      escapeCsv(date),
      escapeCsv(inv.customerName),
      'Sales',
      paiseToRupees(inv.subtotalPaise),
      'Cr',
      escapeCsv(narration),
    ].join(','));

    // 3) GST — either interstate (IGST) or intrastate (CGST + SGST)
    if (inv.isInterstate && inv.igstPaise > 0) {
      lines.push([
        escapeCsv(date), 'Sales', escapeCsv(inv.invoiceNumber), escapeCsv(inv.invoiceNumber), escapeCsv(date),
        escapeCsv(inv.customerName),
        'Output IGST',
        paiseToRupees(inv.igstPaise),
        'Cr',
        escapeCsv(narration),
      ].join(','));
    } else {
      if (inv.cgstPaise > 0) {
        lines.push([
          escapeCsv(date), 'Sales', escapeCsv(inv.invoiceNumber), escapeCsv(inv.invoiceNumber), escapeCsv(date),
          escapeCsv(inv.customerName),
          'Output CGST',
          paiseToRupees(inv.cgstPaise),
          'Cr',
          escapeCsv(narration),
        ].join(','));
      }
      if (inv.sgstPaise > 0) {
        lines.push([
          escapeCsv(date), 'Sales', escapeCsv(inv.invoiceNumber), escapeCsv(inv.invoiceNumber), escapeCsv(date),
          escapeCsv(inv.customerName),
          'Output SGST',
          paiseToRupees(inv.sgstPaise),
          'Cr',
          escapeCsv(narration),
        ].join(','));
      }
    }
  }
  return lines.join('\n') + '\n';
}

// ─── Receipt voucher — CSV ────────────────────────────────────────────────
// Every payment becomes 2 rows: Bank Dr, Customer Cr

const RECEIPT_CSV_HEADERS = [
  'Date',
  'Voucher Type Name',
  'Voucher Number',
  'Reference No',
  'Party Ledger Name',
  'Ledger Name',
  'Ledger Amount',
  'Ledger Amount Dr/Cr',
  'Narration',
];

function receiptDate(p: PaymentRow): string {
  return p.reconciledAt ?? p.createdAt;
}

function receiptBankLedger(source: PaymentRow['source']): string {
  // Tally-side ledger names; user renames these to match their books.
  return source === 'razorpay' ? 'Razorpay Bank' : 'Bank Account';
}

function receiptVoucherNumber(p: PaymentRow): string {
  // Short 8-char id is stable + fits Tally's voucher number field
  return `RCT-${p.id.slice(0, 8).toUpperCase()}`;
}

export function toTallyReceiptCsv(payments: PaymentRow[]): string {
  const lines: string[] = [RECEIPT_CSV_HEADERS.join(',')];
  for (const p of payments) {
    if (p.status !== 'paid' && p.status !== 'captured') continue;
    const date = toTallyCsvDate(receiptDate(p));
    const bank = receiptBankLedger(p.source);
    const vch  = receiptVoucherNumber(p);
    const ref  = p.reference ?? p.invoiceNumber ?? '';
    const narration = p.invoiceNumber ? `Received against ${p.invoiceNumber}` : 'Payment received';

    // Bank Dr
    lines.push([
      escapeCsv(date), 'Receipt', escapeCsv(vch), escapeCsv(ref),
      escapeCsv(p.customerName),
      escapeCsv(bank),
      paiseToRupees(p.amountPaise),
      'Dr',
      escapeCsv(narration),
    ].join(','));

    // Customer Cr
    lines.push([
      escapeCsv(date), 'Receipt', escapeCsv(vch), escapeCsv(ref),
      escapeCsv(p.customerName),
      escapeCsv(p.customerName),
      paiseToRupees(p.amountPaise),
      'Cr',
      escapeCsv(narration),
    ].join(','));
  }
  return lines.join('\n') + '\n';
}

// ─── XML — shared envelope ─────────────────────────────────────────────────

function xmlEnvelope(vouchers: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
`;
}

function ledgerEntry(ledger: string, amount: number, isDeemedPositive: boolean): string {
  // Tally convention: for a Dr entry, ISDEEMEDPOSITIVE=Yes and AMOUNT is negative;
  // for a Cr entry, ISDEEMEDPOSITIVE=No and AMOUNT is positive.
  const signed = isDeemedPositive ? -amount : amount;
  return `        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${isDeemedPositive ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <AMOUNT>${paiseToRupees(signed)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
}

// ─── Sales voucher — XML ───────────────────────────────────────────────────

export function toTallySalesXml(invoices: InvoiceRow[]): string {
  const vouchers = invoices.map(inv => {
    const date = toTallyXmlDate(inv.invoiceDate);
    const total = inv.subtotalPaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
    const entries: string[] = [
      ledgerEntry(inv.customerName, total, true),          // Party Dr
      ledgerEntry('Sales', inv.subtotalPaise, false),      // Sales Cr
    ];
    if (inv.isInterstate && inv.igstPaise > 0) {
      entries.push(ledgerEntry('Output IGST', inv.igstPaise, false));
    } else {
      if (inv.cgstPaise > 0) entries.push(ledgerEntry('Output CGST', inv.cgstPaise, false));
      if (inv.sgstPaise > 0) entries.push(ledgerEntry('Output SGST', inv.sgstPaise, false));
    }
    return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${date}</DATE>
            <NARRATION>${escapeXml(`Sales for ${inv.projectName}`)}</NARRATION>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(inv.invoiceNumber)}</VOUCHERNUMBER>
            <REFERENCE>${escapeXml(inv.invoiceNumber)}</REFERENCE>
            <PARTYLEDGERNAME>${escapeXml(inv.customerName)}</PARTYLEDGERNAME>
${entries.join('\n')}
          </VOUCHER>
        </TALLYMESSAGE>`;
  }).join('\n');
  return xmlEnvelope(vouchers);
}

// ─── Receipt voucher — XML ─────────────────────────────────────────────────

export function toTallyReceiptXml(payments: PaymentRow[]): string {
  const vouchers = payments
    .filter(p => p.status === 'paid' || p.status === 'captured')
    .map(p => {
      const date = toTallyXmlDate(receiptDate(p));
      const bank = receiptBankLedger(p.source);
      const vch  = receiptVoucherNumber(p);
      const narration = p.invoiceNumber ? `Received against ${p.invoiceNumber}` : 'Payment received';
      const entries = [
        ledgerEntry(bank, p.amountPaise, true),               // Bank Dr
        ledgerEntry(p.customerName, p.amountPaise, false),    // Party Cr
      ];
      return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${date}</DATE>
            <NARRATION>${escapeXml(narration)}</NARRATION>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(vch)}</VOUCHERNUMBER>
            <REFERENCE>${escapeXml(p.reference ?? '')}</REFERENCE>
            <PARTYLEDGERNAME>${escapeXml(p.customerName)}</PARTYLEDGERNAME>
${entries.join('\n')}
          </VOUCHER>
        </TALLYMESSAGE>`;
    }).join('\n');
  return xmlEnvelope(vouchers);
}

export type { InvoiceRow, PaymentRow };
