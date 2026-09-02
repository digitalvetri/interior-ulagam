import { Document, pdf, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ensureFonts } from './fonts';
import {
  DocPage,
  StudioHeader,
  BankFooter,
  type StudioBranding,
  S,
} from './DocumentLayout';
import { amountInWords, fmtDate } from './pdf-utils';

export interface ReceiptPdfInput {
  receiptNumber: string;
  paymentDate: Date | string;
  studio: StudioBranding;
  client: { name: string; phone?: string | null };
  project: { name: string };
  invoiceNumber: string;
  invoiceDate: Date | string;
  amountPaise: number;
  paymentMode: string;
  referenceId?: string | null;
  terms?: string | null;
}

const rs = StyleSheet.create({
  body: {
    marginTop: 8,
    marginBottom: 24,
    padding: 24,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  receivedBanner: {
    fontSize: 11,
    fontWeight: 700,
    color: '#166534',
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  label: { fontSize: 9, color: '#6b7280' },
  value: { fontSize: 9.5, fontWeight: 600, color: '#1a1a1a', textAlign: 'right' },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#1a1a1a',
  },
  amountLabel: { fontSize: 12, fontWeight: 700 },
  amountValue: { fontSize: 14, fontWeight: 700, color: '#166534' },
  amountWords: {
    fontSize: 8.5,
    color: '#374151',
    fontStyle: 'italic',
    marginTop: 8,
  },
  stamp: {
    marginTop: 20,
    alignItems: 'center',
  },
  stampBox: {
    borderWidth: 1.5,
    borderColor: '#166534',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  stampText: { fontSize: 11, fontWeight: 700, color: '#166534' },
  stampSub: { fontSize: 8, color: '#6b7280', textAlign: 'center' },
});

function ReceiptDocument({ input }: { input: ReceiptPdfInput }) {
  return (
    <Document
      title={`Receipt ${input.receiptNumber}`}
      author={input.studio.name}
      subject={`Payment Receipt — ${input.project.name}`}
    >
      <DocPage studioName={input.studio.name} docNumber={input.receiptNumber}>
        <StudioHeader
          studio={input.studio}
          meta={{
            docType: 'PAYMENT RECEIPT',
            docNumber: input.receiptNumber,
            issuedAt: input.paymentDate,
          }}
        />

        <View style={rs.body}>
          <Text style={rs.receivedBanner}>✓ Payment Received</Text>

          <View style={rs.row}>
            <Text style={rs.label}>Received from</Text>
            <Text style={rs.value}>{input.client.name}</Text>
          </View>
          <View style={rs.row}>
            <Text style={rs.label}>Against Invoice</Text>
            <Text style={rs.value}>{input.invoiceNumber}</Text>
          </View>
          <View style={rs.row}>
            <Text style={rs.label}>Invoice Date</Text>
            <Text style={rs.value}>{fmtDate(input.invoiceDate)}</Text>
          </View>
          <View style={rs.row}>
            <Text style={rs.label}>Project</Text>
            <Text style={rs.value}>{input.project.name}</Text>
          </View>
          <View style={rs.row}>
            <Text style={rs.label}>Payment Mode</Text>
            <Text style={rs.value}>{input.paymentMode}</Text>
          </View>
          {input.referenceId ? (
            <View style={rs.row}>
              <Text style={rs.label}>Reference ID</Text>
              <Text style={rs.value}>{input.referenceId}</Text>
            </View>
          ) : null}

          <View style={rs.amountRow}>
            <Text style={rs.amountLabel}>Amount Received</Text>
            <Text style={rs.amountValue}>
              ₹{(input.amountPaise / 100).toLocaleString('en-IN')}
            </Text>
          </View>
          <Text style={rs.amountWords}>{amountInWords(input.amountPaise)}</Text>
        </View>

        <BankFooter
          terms={
            input.terms ??
            'This is an acknowledgement of payment received. For queries contact us.'
          }
          studioName={input.studio.name}
        />
      </DocPage>
    </Document>
  );
}

export async function renderReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
  ensureFonts();
  const stream = await pdf(<ReceiptDocument input={input} />).toBuffer();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
