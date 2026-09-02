/**
 * DocumentLayout — shared react-pdf building blocks for all studio documents.
 *
 * Each document (quote.tsx, invoice.tsx, receipt.tsx, purchase-order.tsx)
 * assembles its own <Document><Page> from these exported section components.
 * That way Receipt and PO can use a completely different body without forcing
 * a quote-shaped template on documents that don't need one.
 */
import { View, Text, Image, StyleSheet, Page } from '@react-pdf/renderer';
import { fmtDate } from './pdf-utils';

// ─── Shared interfaces ────────────────────────────────────────────────────────

export interface StudioBranding {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  logoUrl?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIFSC?: string | null;
  bankUPI?: string | null;
}

export interface PartyInfo {
  name: string;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
}

export interface DocHeaderMeta {
  /** e.g. "QUOTATION", "TAX INVOICE", "PAYMENT RECEIPT", "PURCHASE ORDER" */
  docType: string;
  docNumber: string;
  issuedAt: Date | string;
  extra?: { label: string; value: string }[];
}

// ─── Base styles ──────────────────────────────────────────────────────────────

export const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    paddingTop: 44,
    paddingBottom: 64,
    paddingHorizontal: 44,
    lineHeight: 1.4,
  },

  // ── Header row ──────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: '#1a1a1a',
    paddingBottom: 14,
    marginBottom: 20,
  },
  logo: { width: 48, height: 48, objectFit: 'contain', marginBottom: 6 },
  studioName: { fontSize: 15, fontWeight: 700 },
  studioMeta: { fontSize: 8, color: '#6b7280', marginTop: 2 },

  docBlock: { alignItems: 'flex-end' },
  docTypeLabel: { fontSize: 8, color: '#6b7280', letterSpacing: 2, marginBottom: 3 },
  docNumber: { fontSize: 14, fontWeight: 700 },
  docMeta: { fontSize: 9, color: '#6b7280', marginTop: 3 },

  // ── Parties block ────────────────────────────────────────────────────────────
  partiesRow: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  partyBox: { flex: 1 },
  sectionLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: '#9ca3af',
    letterSpacing: 1.5,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  partyName: { fontSize: 11, fontWeight: 600 },
  partyMeta: { fontSize: 8.5, color: '#6b7280', marginTop: 2 },

  // ── Line items table ─────────────────────────────────────────────────────────
  table: { marginBottom: 16 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableBodyRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableRoomRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tableFooterRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  th: { fontSize: 8, fontWeight: 700, color: '#fff' },
  td: { fontSize: 9, color: '#1a1a1a' },
  tdSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  tdRoom: { fontSize: 8.5, fontWeight: 700, color: '#374151' },

  colRoom: { width: '16%' },
  colItem: { width: '34%' },
  colUnit: { width: '10%', textAlign: 'center' },
  colQty:  { width: '10%', textAlign: 'right' },
  colRate: { width: '15%', textAlign: 'right' },
  colAmt:  { width: '15%', textAlign: 'right' },

  // ── Totals block ─────────────────────────────────────────────────────────────
  totalsSection: { alignSelf: 'flex-end', width: '46%', marginBottom: 24 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 9.5, color: '#4b5563' },
  totalValue: { fontSize: 9.5, color: '#1a1a1a' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: '#1a1a1a',
    marginTop: 6,
    paddingTop: 8,
  },
  grandLabel: { fontSize: 11.5, fontWeight: 700 },
  grandValue: { fontSize: 11.5, fontWeight: 700 },

  // ── Bank / footer section ─────────────────────────────────────────────────────
  footerSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 14,
    flexDirection: 'row',
    gap: 32,
  },
  footerCol: { flex: 1 },
  footerColLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: '#9ca3af',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  footerRow: { fontSize: 8.5, color: '#374151', marginBottom: 2 },
  footerRowBold: { fontWeight: 700, color: '#1a1a1a' },
  termsText: { fontSize: 8, color: '#6b7280', lineHeight: 1.5 },

  // ── Signatory block ───────────────────────────────────────────────────────────
  signatoryBox: { marginTop: 32, alignItems: 'flex-end' },
  signatoryLine: { borderTopWidth: 1, borderTopColor: '#9ca3af', width: 140, paddingTop: 4 },
  signatoryLabel: { fontSize: 8, color: '#6b7280', textAlign: 'center' },

  // ── Page number footer (fixed) ─────────────────────────────────────────────
  pageFooter: {
    position: 'absolute',
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: '#9ca3af',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
});

// ─── Section components ───────────────────────────────────────────────────────

/** Top header: logo + studio info on left, doc type + number on right. */
export function StudioHeader({
  studio,
  meta,
}: {
  studio: StudioBranding;
  meta: DocHeaderMeta;
}) {
  return (
    <View style={S.headerRow}>
      <View>
        {studio.logoUrl ? (
          <Image src={studio.logoUrl} style={S.logo} />
        ) : null}
        <Text style={S.studioName}>{studio.name}</Text>
        {studio.address ? <Text style={S.studioMeta}>{studio.address}</Text> : null}
        {(studio.phone || studio.email) ? (
          <Text style={S.studioMeta}>
            {[studio.phone, studio.email].filter(Boolean).join('  ·  ')}
          </Text>
        ) : null}
        {studio.gstin ? <Text style={S.studioMeta}>GSTIN: {studio.gstin}</Text> : null}
      </View>
      <View style={S.docBlock}>
        <Text style={S.docTypeLabel}>{meta.docType}</Text>
        <Text style={S.docNumber}>{meta.docNumber}</Text>
        <Text style={S.docMeta}>{fmtDate(meta.issuedAt)}</Text>
        {meta.extra?.map(({ label, value }) => (
          <Text key={label} style={S.docMeta}>{label}: {value}</Text>
        ))}
      </View>
    </View>
  );
}

/** Parties row: Bill To on left, optional Project / Vendor on right. */
export function PartiesBlock({
  billTo,
  billToLabel,
  rightParty,
  rightLabel,
}: {
  billTo: PartyInfo;
  billToLabel?: string;
  rightParty?: PartyInfo | null;
  rightLabel?: string;
}) {
  return (
    <View style={S.partiesRow}>
      <View style={S.partyBox}>
        <Text style={S.sectionLabel}>{billToLabel ?? 'Bill To'}</Text>
        <Text style={S.partyName}>{billTo.name}</Text>
        {billTo.phone ? <Text style={S.partyMeta}>{billTo.phone}</Text> : null}
        {billTo.address ? <Text style={S.partyMeta}>{billTo.address}</Text> : null}
        {billTo.gstin ? <Text style={S.partyMeta}>GSTIN: {billTo.gstin}</Text> : null}
      </View>
      {rightParty ? (
        <View style={S.partyBox}>
          <Text style={S.sectionLabel}>{rightLabel ?? 'Project'}</Text>
          <Text style={S.partyName}>{rightParty.name}</Text>
          {rightParty.phone ? <Text style={S.partyMeta}>{rightParty.phone}</Text> : null}
          {rightParty.address ? <Text style={S.partyMeta}>{rightParty.address}</Text> : null}
          {rightParty.gstin ? <Text style={S.partyMeta}>GSTIN: {rightParty.gstin}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Line items table for quotes and POs. Renders room subtotal shaded rows. */
export interface LineItem {
  room?: string;
  item: string;
  description?: string | null;
  unit: string;
  qty: number;
  ratePaise: number;
}

export function LineItemsTable({
  items,
  groupByRoom,
}: {
  items: LineItem[];
  groupByRoom?: boolean;
}) {
  const roomGroups = new Map<string, LineItem[]>();
  for (const item of items) {
    const key = item.room ?? 'Items';
    const g = roomGroups.get(key) ?? [];
    g.push(item);
    roomGroups.set(key, g);
  }

  return (
    <View style={S.table}>
      {/* Header */}
      <View style={S.tableHeaderRow}>
        <Text style={[S.th, S.colRoom]}>Room</Text>
        <Text style={[S.th, S.colItem]}>Item</Text>
        <Text style={[S.th, S.colUnit]}>Unit</Text>
        <Text style={[S.th, S.colQty]}>Qty</Text>
        <Text style={[S.th, S.colRate]}>Rate</Text>
        <Text style={[S.th, S.colAmt]}>Amount</Text>
      </View>

      {groupByRoom
        ? [...roomGroups.entries()].map(([room, roomItems]) => {
            const roomTotal = roomItems.reduce(
              (sum, l) => sum + l.ratePaise * l.qty,
              0,
            );
            return (
              <View key={room}>
                {/* Room sub-heading */}
                <View style={S.tableRoomRow}>
                  <Text style={[S.tdRoom, { flex: 1 }]}>{room.toUpperCase()}</Text>
                </View>
                {roomItems.map((line, i) => (
                  <View key={i} style={S.tableBodyRow} wrap={false}>
                    <Text style={[S.td, S.colRoom]}> </Text>
                    <View style={S.colItem}>
                      <Text style={S.td}>{line.item}</Text>
                      {line.description ? (
                        <Text style={S.tdSub}>{line.description}</Text>
                      ) : null}
                    </View>
                    <Text style={[S.td, S.colUnit]}>{line.unit}</Text>
                    <Text style={[S.td, S.colQty]}>{line.qty}</Text>
                    <Text style={[S.td, S.colRate]}>
                      ₹{(line.ratePaise / 100).toLocaleString('en-IN')}
                    </Text>
                    <Text style={[S.td, S.colAmt]}>
                      ₹{((line.ratePaise * line.qty) / 100).toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
                {/* Room subtotal */}
                <View style={S.tableFooterRow}>
                  <Text style={[S.td, { flex: 1, fontWeight: 600 }]}>
                    {room} subtotal
                  </Text>
                  <Text style={[S.td, S.colAmt, { fontWeight: 600 }]}>
                    ₹{(roomTotal / 100).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            );
          })
        : items.map((line, i) => (
            <View key={i} style={S.tableBodyRow} wrap={false}>
              <Text style={[S.td, S.colRoom]}>{line.room ?? ''}</Text>
              <View style={S.colItem}>
                <Text style={S.td}>{line.item}</Text>
                {line.description ? (
                  <Text style={S.tdSub}>{line.description}</Text>
                ) : null}
              </View>
              <Text style={[S.td, S.colUnit]}>{line.unit}</Text>
              <Text style={[S.td, S.colQty]}>{line.qty}</Text>
              <Text style={[S.td, S.colRate]}>
                ₹{(line.ratePaise / 100).toLocaleString('en-IN')}
              </Text>
              <Text style={[S.td, S.colAmt]}>
                ₹{((line.ratePaise * line.qty) / 100).toLocaleString('en-IN')}
              </Text>
            </View>
          ))}
    </View>
  );
}

/** GST totals block (right-aligned). Handles both intra-state and interstate. */
export function TotalsBlock({
  subtotalPaise,
  cgstPaise,
  sgstPaise,
  igstPaise,
  totalPaise,
  isInterstate,
}: {
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  isInterstate?: boolean;
}) {
  return (
    <View style={S.totalsSection}>
      <View style={S.totalRow}>
        <Text style={S.totalLabel}>Subtotal</Text>
        <Text style={S.totalValue}>
          ₹{(subtotalPaise / 100).toLocaleString('en-IN')}
        </Text>
      </View>
      {isInterstate ? (
        <View style={S.totalRow}>
          <Text style={S.totalLabel}>IGST (18%)</Text>
          <Text style={S.totalValue}>
            ₹{(igstPaise / 100).toLocaleString('en-IN')}
          </Text>
        </View>
      ) : (
        <>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>CGST (9%)</Text>
            <Text style={S.totalValue}>
              ₹{(cgstPaise / 100).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>SGST (9%)</Text>
            <Text style={S.totalValue}>
              ₹{(sgstPaise / 100).toLocaleString('en-IN')}
            </Text>
          </View>
        </>
      )}
      <View style={S.grandTotalRow}>
        <Text style={S.grandLabel}>Total</Text>
        <Text style={S.grandValue}>
          ₹{(totalPaise / 100).toLocaleString('en-IN')}
        </Text>
      </View>
    </View>
  );
}

/** Bank + terms footer section. */
export function BankFooter({
  bank,
  terms,
  studioName,
}: {
  bank?: Pick<StudioBranding, 'bankName' | 'bankAccount' | 'bankIFSC' | 'bankUPI'>;
  terms?: string | null;
  studioName: string;
}) {
  const hasBank = bank?.bankName || bank?.bankAccount || bank?.bankIFSC || bank?.bankUPI;

  return (
    <View style={S.footerSection}>
      {hasBank ? (
        <View style={S.footerCol}>
          <Text style={S.footerColLabel}>Bank Details</Text>
          {bank?.bankName ? (
            <Text style={S.footerRow}>
              <Text style={S.footerRowBold}>Bank  </Text>
              {bank.bankName}
            </Text>
          ) : null}
          {bank?.bankAccount ? (
            <Text style={S.footerRow}>
              <Text style={S.footerRowBold}>A/C  </Text>
              {bank.bankAccount}
            </Text>
          ) : null}
          {bank?.bankIFSC ? (
            <Text style={S.footerRow}>
              <Text style={S.footerRowBold}>IFSC  </Text>
              {bank.bankIFSC}
            </Text>
          ) : null}
          {bank?.bankUPI ? (
            <Text style={S.footerRow}>
              <Text style={S.footerRowBold}>UPI  </Text>
              {bank.bankUPI}
            </Text>
          ) : null}
        </View>
      ) : null}

      {terms ? (
        <View style={S.footerCol}>
          <Text style={S.footerColLabel}>Terms &amp; Conditions</Text>
          <Text style={S.termsText}>{terms}</Text>
        </View>
      ) : null}

      <View style={S.signatoryBox}>
        <View style={S.signatoryLine} />
        <Text style={S.signatoryLabel}>For {studioName}</Text>
        <Text style={[S.signatoryLabel, { marginTop: 2 }]}>Authorised Signatory</Text>
      </View>
    </View>
  );
}

/** Fixed page-number footer rendered on every page. */
export function PageFooter({
  studioName,
  docNumber,
}: {
  studioName: string;
  docNumber: string;
}) {
  return (
    <Text
      style={S.pageFooter}
      render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `${studioName}  ·  ${docNumber}  ·  Page ${pageNumber} of ${totalPages}`
      }
      fixed
    />
  );
}

/** Standard A4 page wrapper with the fixed footer wired in. */
export function DocPage({
  studioName,
  docNumber,
  children,
}: {
  studioName: string;
  docNumber: string;
  children: React.ReactNode;
}) {
  return (
    <Page size="A4" style={S.page}>
      {children}
      <PageFooter studioName={studioName} docNumber={docNumber} />
    </Page>
  );
}
