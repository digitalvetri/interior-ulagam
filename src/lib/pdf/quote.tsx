import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';

export interface QuotePdfLine {
  room: string;
  item: string;
  description: string | null;
  unit: string;
  qty: number;
  clientRatePaise: number;
}

export interface QuotePdfInput {
  quoteNumber: string;
  version: number;
  issuedAt: Date;
  studio: {
    name: string;
    gstin: string | null;
  };
  client: {
    name: string;
    phone: string | null;
  };
  project: {
    name: string;
  };
  lines: QuotePdfLine[];
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 16,
  },
  studioName: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  studioGstin: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  quoteBlock: { alignItems: 'flex-end' },
  quoteLabel: { fontSize: 9, color: '#6b7280', letterSpacing: 1 },
  quoteNumber: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  quoteMeta: { fontSize: 9, color: '#6b7280', marginTop: 2 },

  section: { marginTop: 20 },
  sectionLabel: {
    fontSize: 8,
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 4,
  },
  clientName: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  clientMeta: { fontSize: 9, color: '#6b7280', marginTop: 2 },

  table: { marginTop: 24, borderWidth: 1, borderColor: '#e5e7eb' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151' },
  td: { fontSize: 9, color: '#1f2937' },
  colRoom: { width: '18%' },
  colItem: { width: '34%' },
  colUnit: { width: '10%', textAlign: 'center' },
  colQty: { width: '10%', textAlign: 'right' },
  colRate: { width: '14%', textAlign: 'right' },
  colAmount: { width: '14%', textAlign: 'right' },
  itemDesc: { fontSize: 8, color: '#6b7280', marginTop: 2 },

  totals: {
    marginTop: 16,
    alignSelf: 'flex-end',
    width: '45%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    marginTop: 6,
    paddingTop: 8,
  },
  totalLabel: { fontSize: 10, color: '#374151' },
  totalValue: { fontSize: 10, color: '#1f2937' },
  grandLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 12, fontFamily: 'Helvetica-Bold' },

  terms: {
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  termsHeading: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  termsBody: { fontSize: 8, color: '#6b7280', lineHeight: 1.5 },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
});

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return '₹ ' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function QuoteDocument({ input }: { input: QuotePdfInput }) {
  return (
    <Document
      title={`Quote ${input.quoteNumber}`}
      author={input.studio.name}
      subject={`Quote for ${input.project.name}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.studioName}>{input.studio.name}</Text>
            {input.studio.gstin ? (
              <Text style={styles.studioGstin}>GSTIN {input.studio.gstin}</Text>
            ) : null}
          </View>
          <View style={styles.quoteBlock}>
            <Text style={styles.quoteLabel}>QUOTATION</Text>
            <Text style={styles.quoteNumber}>{input.quoteNumber}</Text>
            <Text style={styles.quoteMeta}>Rev {input.version}</Text>
            <Text style={styles.quoteMeta}>{formatDate(input.issuedAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PREPARED FOR</Text>
          <Text style={styles.clientName}>{input.client.name}</Text>
          {input.client.phone ? (
            <Text style={styles.clientMeta}>{input.client.phone}</Text>
          ) : null}
          <Text style={styles.clientMeta}>Project · {input.project.name}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colRoom]}>Room</Text>
            <Text style={[styles.th, styles.colItem]}>Item</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colRate]}>Rate</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>
          {input.lines.map((line, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, styles.colRoom]}>{line.room}</Text>
              <View style={styles.colItem}>
                <Text style={styles.td}>{line.item}</Text>
                {line.description ? (
                  <Text style={styles.itemDesc}>{line.description}</Text>
                ) : null}
              </View>
              <Text style={[styles.td, styles.colUnit]}>{line.unit}</Text>
              <Text style={[styles.td, styles.colQty]}>{line.qty}</Text>
              <Text style={[styles.td, styles.colRate]}>
                {formatRupees(line.clientRatePaise)}
              </Text>
              <Text style={[styles.td, styles.colAmount]}>
                {formatRupees(line.clientRatePaise * line.qty)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatRupees(input.subtotalPaise)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (18%)</Text>
            <Text style={styles.totalValue}>
              {formatRupees(input.gstPaise)}
            </Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>
              {formatRupees(input.totalPaise)}
            </Text>
          </View>
        </View>

        <View style={styles.terms}>
          <Text style={styles.termsHeading}>Terms</Text>
          <Text style={styles.termsBody}>
            Prices valid for 30 days from date of issue. 50% advance on
            confirmation, balance in tranches per project milestones. GST
            included as shown. Site conditions, material substitutions or
            scope changes may revise line items — a revised quotation will be
            shared before any change is executed.
          </Text>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `${input.studio.name}  ·  ${input.quoteNumber}  ·  Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  const stream = await pdf(<QuoteDocument input={input} />).toBuffer();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
