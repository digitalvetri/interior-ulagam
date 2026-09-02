import { Document, pdf, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ensureFonts } from './fonts';
import {
  DocPage,
  PartiesBlock,
  StudioHeader,
  BankFooter,
  type StudioBranding,
  type PartyInfo,
  S,
} from './DocumentLayout';
import { fmtDate } from './pdf-utils';

export interface POLine {
  item: string;
  description?: string | null;
  unit: string;
  qty: number;
  ratePaise: number;
  hsnSac?: string | null;
}

export interface PurchaseOrderPdfInput {
  poNumber: string;
  issuedAt: Date | string;
  expectedDeliveryAt?: Date | string | null;
  studio: StudioBranding;
  vendor: PartyInfo;
  project: { name: string };
  lines: POLine[];
  subtotalPaise: number;
  advancePaidPaise: number;
  balanceDuePaise: number;
  terms?: string | null;
}

const pos = StyleSheet.create({
  poTable: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  bodyRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  th: { fontSize: 8, fontWeight: 700, color: '#fff' },
  td: { fontSize: 9, color: '#1a1a1a' },
  tdSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  colHsn: { width: '12%' },
  colItem: { width: '36%' },
  colUnit: { width: '10%', textAlign: 'center' },
  colQty:  { width: '10%', textAlign: 'right' },
  colRate: { width: '16%', textAlign: 'right' },
  colAmt:  { width: '16%', textAlign: 'right' },

  totalsSection: { alignSelf: 'flex-end', width: '46%', marginBottom: 24 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 9.5, color: '#4b5563' },
  totalValue: { fontSize: 9.5, color: '#1a1a1a' },
  advanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginVertical: 4,
  },
  advanceLabel: { fontSize: 9.5, color: '#92400e', fontWeight: 600 },
  advanceValue: { fontSize: 9.5, color: '#92400e', fontWeight: 600 },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: '#1a1a1a',
    marginTop: 4,
    paddingTop: 8,
  },
  balanceLabel: { fontSize: 11.5, fontWeight: 700 },
  balanceValue: { fontSize: 11.5, fontWeight: 700 },

  deliveryBadge: {
    fontSize: 8.5,
    color: '#6b7280',
    marginBottom: 14,
  },
});

function PurchaseOrderDocument({ input }: { input: PurchaseOrderPdfInput }) {
  const DEFAULT_TERMS =
    'Goods must be delivered as per the agreed schedule. Vendor is responsible for quality ' +
    'conformance. Any substitution of items requires prior approval. Partial deliveries are ' +
    'accepted only if agreed in writing.';

  const subtotal = input.lines.reduce((s, l) => s + l.ratePaise * l.qty, 0);

  return (
    <Document
      title={`PO ${input.poNumber}`}
      author={input.studio.name}
      subject={`Purchase Order for ${input.project.name}`}
    >
      <DocPage studioName={input.studio.name} docNumber={input.poNumber}>
        <StudioHeader
          studio={input.studio}
          meta={{
            docType: 'PURCHASE ORDER',
            docNumber: input.poNumber,
            issuedAt: input.issuedAt,
            extra: input.expectedDeliveryAt
              ? [{ label: 'Deliver by', value: fmtDate(input.expectedDeliveryAt) }]
              : [],
          }}
        />

        <PartiesBlock
          billTo={input.vendor}
          billToLabel="To (Vendor)"
          rightParty={{ name: input.project.name }}
          rightLabel="For Project"
        />

        {/* Line items table */}
        <View style={pos.poTable}>
          <View style={pos.headerRow}>
            <Text style={[pos.th, pos.colHsn]}>HSN/SAC</Text>
            <Text style={[pos.th, pos.colItem]}>Item</Text>
            <Text style={[pos.th, pos.colUnit]}>Unit</Text>
            <Text style={[pos.th, pos.colQty]}>Qty</Text>
            <Text style={[pos.th, pos.colRate]}>Unit Rate</Text>
            <Text style={[pos.th, pos.colAmt]}>Amount</Text>
          </View>
          {input.lines.map((line, i) => (
            <View key={i} style={pos.bodyRow} wrap={false}>
              <Text style={[pos.td, pos.colHsn]}>{line.hsnSac ?? '—'}</Text>
              <View style={pos.colItem}>
                <Text style={pos.td}>{line.item}</Text>
                {line.description ? (
                  <Text style={pos.tdSub}>{line.description}</Text>
                ) : null}
              </View>
              <Text style={[pos.td, pos.colUnit]}>{line.unit}</Text>
              <Text style={[pos.td, pos.colQty]}>{line.qty}</Text>
              <Text style={[pos.td, pos.colRate]}>
                ₹{(line.ratePaise / 100).toLocaleString('en-IN')}
              </Text>
              <Text style={[pos.td, pos.colAmt]}>
                ₹{((line.ratePaise * line.qty) / 100).toLocaleString('en-IN')}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={pos.totalsSection}>
          <View style={pos.totalRow}>
            <Text style={pos.totalLabel}>Subtotal</Text>
            <Text style={pos.totalValue}>
              ₹{(subtotal / 100).toLocaleString('en-IN')}
            </Text>
          </View>
          {input.advancePaidPaise > 0 ? (
            <View style={pos.advanceRow}>
              <Text style={pos.advanceLabel}>Advance Paid</Text>
              <Text style={pos.advanceValue}>
                ₹{(input.advancePaidPaise / 100).toLocaleString('en-IN')}
              </Text>
            </View>
          ) : null}
          <View style={pos.balanceRow}>
            <Text style={pos.balanceLabel}>Balance Due</Text>
            <Text style={pos.balanceValue}>
              ₹{(input.balanceDuePaise / 100).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        <BankFooter
          bank={input.studio}
          terms={input.terms ?? DEFAULT_TERMS}
          studioName={input.studio.name}
        />
      </DocPage>
    </Document>
  );
}

export async function renderPurchaseOrderPdf(
  input: PurchaseOrderPdfInput,
): Promise<Buffer> {
  ensureFonts();
  const stream = await pdf(<PurchaseOrderDocument input={input} />).toBuffer();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
