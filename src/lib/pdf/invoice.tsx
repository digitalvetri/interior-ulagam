import { Document, pdf, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ensureFonts } from './fonts';
import {
  DocPage,
  PartiesBlock,
  StudioHeader,
  TotalsBlock,
  BankFooter,
  type StudioBranding,
  type PartyInfo,
  S,
} from './DocumentLayout';
import { amountInWords, fmtDate } from './pdf-utils';

export interface HsnLine {
  hsnSac?: string | null;
  description: string;
  amountPaise: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
}

export interface InvoicePdfInput {
  invoiceNumber: string;
  invoiceDate: Date | string;
  studio: StudioBranding;
  client: PartyInfo;
  project: { name: string };
  lines: HsnLine[];
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  isInterstate: boolean;
  placeOfSupply?: string | null;
  terms?: string | null;
}

const is = StyleSheet.create({
  poS: {
    fontSize: 8.5,
    color: '#6b7280',
    marginBottom: 14,
  },
  hsnTable: {
    marginBottom: 16,
  },
  hsnHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  hsnBodyRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  th: { fontSize: 8, fontWeight: 700, color: '#fff' },
  td: { fontSize: 9, color: '#1a1a1a' },
  colHsn: { width: '18%' },
  colDesc: { width: '40%' },
  colAmt: { width: '21%', textAlign: 'right' },
  colTax: { width: '21%', textAlign: 'right' },

  amtWords: {
    fontSize: 8.5,
    color: '#374151',
    fontStyle: 'italic',
    marginBottom: 12,
    textAlign: 'right',
  },
  placeOfSupply: {
    fontSize: 8.5,
    color: '#6b7280',
    marginBottom: 12,
  },
});

function InvoiceDocument({ input }: { input: InvoicePdfInput }) {
  const DEFAULT_TERMS =
    'Payment due within 7 days of invoice date. GST applicable as per works contract rate (18%). ' +
    'This is a computer generated invoice.';

  return (
    <Document
      title={`Invoice ${input.invoiceNumber}`}
      author={input.studio.name}
      subject={`Tax Invoice for ${input.project.name}`}
    >
      <DocPage studioName={input.studio.name} docNumber={input.invoiceNumber}>
        <StudioHeader
          studio={input.studio}
          meta={{
            docType: 'TAX INVOICE',
            docNumber: input.invoiceNumber,
            issuedAt: input.invoiceDate,
            extra: input.placeOfSupply
              ? [{ label: 'Place of Supply', value: input.placeOfSupply }]
              : [],
          }}
        />

        <PartiesBlock
          billTo={input.client}
          rightParty={{ name: input.project.name }}
          rightLabel="Project"
        />

        {/* HSN/SAC line items */}
        <View style={is.hsnTable}>
          <View style={is.hsnHeaderRow}>
            <Text style={[is.th, is.colHsn]}>HSN/SAC</Text>
            <Text style={[is.th, is.colDesc]}>Description</Text>
            <Text style={[is.th, is.colAmt]}>Taxable Value</Text>
            <Text style={[is.th, is.colTax]}>
              {input.isInterstate ? 'IGST' : 'CGST + SGST'}
            </Text>
          </View>
          {input.lines.map((line, i) => {
            const tax = input.isInterstate
              ? (line.igstPaise ?? 0)
              : (line.cgstPaise ?? 0) + (line.sgstPaise ?? 0);
            return (
              <View key={i} style={is.hsnBodyRow} wrap={false}>
                <Text style={[is.td, is.colHsn]}>{line.hsnSac ?? '9954'}</Text>
                <Text style={[is.td, is.colDesc]}>{line.description}</Text>
                <Text style={[is.td, is.colAmt]}>
                  ₹{(line.amountPaise / 100).toLocaleString('en-IN')}
                </Text>
                <Text style={[is.td, is.colTax]}>
                  ₹{(tax / 100).toLocaleString('en-IN')}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={is.amtWords}>{amountInWords(input.totalPaise)}</Text>

        <TotalsBlock
          subtotalPaise={input.subtotalPaise}
          cgstPaise={input.cgstPaise}
          sgstPaise={input.sgstPaise}
          igstPaise={input.igstPaise}
          totalPaise={input.totalPaise}
          isInterstate={input.isInterstate}
        />

        <BankFooter
          bank={input.studio}
          terms={input.terms ?? DEFAULT_TERMS}
          studioName={input.studio.name}
        />
      </DocPage>
    </Document>
  );
}

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  ensureFonts();
  const stream = await pdf(<InvoiceDocument input={input} />).toBuffer();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
