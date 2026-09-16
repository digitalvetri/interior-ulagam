/**
 * Generates one sample PDF of each document type with seed data.
 * Run with: npx tsx scripts/gen-pdf-samples.ts
 * Output: scripts/samples/{quote,invoice,receipt,po}.pdf
 */

import fs from 'fs';
import path from 'path';

// Ensure fonts module doesn't break in script context
process.env.NODE_ENV = 'development';

async function main() {
  const outDir = path.join(process.cwd(), 'scripts', 'samples');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const studio = {
    name: 'The Interior Studio',
    address: '42, Design Quarter, Racecourse Road, Coimbatore 641018',
    phone: '+91 98765 43210',
    email: 'hello@theinteriorstudio.in',
    gstin: '33AABCT1234A1Z5',
    logoUrl: null,
    bankName: 'HDFC Bank',
    bankAccount: '50100123456789',
    bankIFSC: 'HDFC0002345',
    bankUPI: 'interiorstudio@upi',
  };

  const client = {
    name: 'Priya Krishnamurthy',
    phone: '+91 98400 11223',
    address: '15, Saraswathi Nagar, Coimbatore 641011',
    gstin: null,
  };

  // ── 1. QUOTATION ───────────────────────────────────────────────────────────
  console.log('Generating quote.pdf…');
  const { renderQuotePdf } = await import('../src/lib/pdf/quote.js');
  const quotePdf = await renderQuotePdf({
    quoteNumber: 'QUO-A1B2C3',
    version: 2,
    issuedAt: new Date('2026-09-02'),
    validUntil: new Date('2026-10-02'),
    studio,
    client,
    project: { name: 'Priya Residence — Full Home Interior' },
    lines: [
      { room: 'Living Room', item: 'Modular TV Unit', description: 'Laminate finish, 8ft width', unit: 'nos', qty: 1, clientRatePaise: 6500000 },
      { room: 'Living Room', item: 'False Ceiling', description: 'Gypsum with cove lighting', unit: 'sqft', qty: 320, clientRatePaise: 10000 },
      { room: 'Master Bedroom', item: 'Wardrobe — 6 door', description: 'Sliding shutters, mirror panel', unit: 'nos', qty: 1, clientRatePaise: 9500000 },
      { room: 'Master Bedroom', item: 'Study Table + Shelving', description: 'Wall-mounted, engineered wood', unit: 'nos', qty: 1, clientRatePaise: 3500000 },
      { room: 'Kitchen', item: 'Modular Kitchen', description: 'L-shaped, Hafele hardware, quartz countertop', unit: 'nos', qty: 1, clientRatePaise: 18000000 },
    ],
    subtotalPaise: 40700000,
    gstPaise: 7326000,
    totalPaise: 48026000,
    terms: 'Prices valid 30 days from date of issue. 50% advance on confirmation, balance as per project milestones. Scope changes quoted separately before execution.',
  });
  fs.writeFileSync(path.join(outDir, 'quote.pdf'), quotePdf);
  console.log(`  ✓ quote.pdf (${Math.round(quotePdf.length / 1024)} KB)`);

  // ── 2. TAX INVOICE ────────────────────────────────────────────────────────
  console.log('Generating invoice.pdf…');
  const { renderInvoicePdf } = await import('../src/lib/pdf/invoice.js');
  const invoicePdf = await renderInvoicePdf({
    invoiceNumber: 'INV-2026-001',
    invoiceDate: new Date('2026-09-02'),
    studio,
    client,
    project: { name: 'Priya Residence — Full Home Interior' },
    lines: [
      {
        hsnSac: '9954',
        description: 'Interior Design Works — Design Phase (Milestone 2)',
        amountPaise: 16268000,
        cgstPaise: 1464120,
        sgstPaise: 1464120,
        igstPaise: 0,
      },
    ],
    subtotalPaise: 16268000,
    cgstPaise: 1464120,
    sgstPaise: 1464120,
    igstPaise: 0,
    totalPaise: 19196240,
    isInterstate: false,
    placeOfSupply: 'Tamil Nadu (33)',
    terms: 'Payment due within 7 days of invoice date. This is a computer generated invoice.',
  });
  fs.writeFileSync(path.join(outDir, 'invoice.pdf'), invoicePdf);
  console.log(`  ✓ invoice.pdf (${Math.round(invoicePdf.length / 1024)} KB)`);

  // ── 3. PAYMENT RECEIPT ────────────────────────────────────────────────────
  console.log('Generating receipt.pdf…');
  const { renderReceiptPdf } = await import('../src/lib/pdf/receipt.js');
  const receiptPdf = await renderReceiptPdf({
    receiptNumber: 'REC-A1B2C3',
    paymentDate: new Date('2026-09-02'),
    studio,
    client,
    project: { name: 'Priya Residence — Full Home Interior' },
    invoiceNumber: 'INV-2026-001',
    invoiceDate: new Date('2026-09-01'),
    amountPaise: 19196240,
    paymentMode: 'Razorpay (Online)',
    referenceId: 'pay_QZxkL9mBnPqR7w',
    terms: 'This is an acknowledgement of payment received. Kindly retain for your records.',
  });
  fs.writeFileSync(path.join(outDir, 'receipt.pdf'), receiptPdf);
  console.log(`  ✓ receipt.pdf (${Math.round(receiptPdf.length / 1024)} KB)`);

  // ── 4. PURCHASE ORDER ─────────────────────────────────────────────────────
  console.log('Generating po.pdf…');
  const { renderPurchaseOrderPdf } = await import('../src/lib/pdf/purchase-order.js');
  const poPdf = await renderPurchaseOrderPdf({
    poNumber: 'PO-2026-042',
    issuedAt: new Date('2026-09-02'),
    expectedDeliveryAt: new Date('2026-09-20'),
    studio,
    vendor: {
      name: 'Greenwood Laminates Pvt Ltd',
      phone: '+91 422 2345678',
      address: '78 SIDCO Industrial Estate, Coimbatore 641021',
      gstin: '33AABCG5678B2Z1',
    },
    project: { name: 'Priya Residence — Full Home Interior' },
    lines: [
      { item: 'Prelam Board — Teak Finish (8×4 ft)', hsnSac: '4410', unit: 'sheets', qty: 40, ratePaise: 250000 },
      { item: 'MDF Board 18mm (8×4 ft)', hsnSac: '4411', unit: 'sheets', qty: 25, ratePaise: 180000 },
      { item: 'Edge Banding Tape — 2mm PVC', hsnSac: '3916', unit: 'metres', qty: 500, ratePaise: 2500 },
      { item: 'White Primer (20L drum)', hsnSac: '3210', unit: 'nos', qty: 5, ratePaise: 450000 },
    ],
    subtotalPaise: 15750000,
    advancePaidPaise: 5000000,
    balanceDuePaise: 10750000,
    terms: 'Goods to be delivered by agreed date. Vendor is responsible for quality conformance. Substitutions require prior written approval.',
  });
  fs.writeFileSync(path.join(outDir, 'po.pdf'), poPdf);
  console.log(`  ✓ po.pdf (${Math.round(poPdf.length / 1024)} KB)`);

  console.log('\n✅ All 4 PDFs generated in scripts/samples/');
  console.log('   Open them to verify: logo placeholder, GST, totals, bank block, page numbers.');
}

main().catch((e) => { console.error(e); process.exit(1); });
