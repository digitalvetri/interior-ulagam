import { Document, pdf } from '@react-pdf/renderer';
import { ensureFonts } from './fonts';
import {
  DocPage,
  LineItemsTable,
  PartiesBlock,
  StudioHeader,
  TotalsBlock,
  BankFooter,
  type StudioBranding,
} from './DocumentLayout';
import { fmtDate } from './pdf-utils';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

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
  validUntil?: Date | null;
  studio: StudioBranding;
  client: {
    name: string;
    phone: string | null;
    address?: string | null;
  };
  project: {
    name: string;
  };
  lines: QuotePdfLine[];
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  terms?: string | null;
}

const qs = StyleSheet.create({
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 8,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  validUntil: {
    fontSize: 8,
    color: '#6b7280',
  },
});

function QuoteDocument({ input }: { input: QuotePdfInput }) {
  const DEFAULT_TERMS =
    'Prices valid for 30 days from date of issue. 50% advance on confirmation, ' +
    'balance as per project milestones. GST included as shown. ' +
    'Scope changes or material substitutions will be quoted separately.';

  return (
    <Document
      title={`Quotation ${input.quoteNumber}`}
      author={input.studio.name}
      subject={`Quotation for ${input.project.name}`}
    >
      <DocPage studioName={input.studio.name} docNumber={input.quoteNumber}>
        <StudioHeader
          studio={input.studio}
          meta={{
            docType: 'QUOTATION',
            docNumber: input.quoteNumber,
            issuedAt: input.issuedAt,
            extra: [
              { label: 'Version', value: `Rev ${input.version}` },
              ...(input.validUntil
                ? [{ label: 'Valid until', value: fmtDate(input.validUntil) }]
                : []),
            ],
          }}
        />

        <PartiesBlock
          billTo={{
            name: input.client.name,
            phone: input.client.phone,
            address: input.client.address,
          }}
          rightParty={{ name: input.project.name }}
          rightLabel="Project"
        />

        {input.version > 1 ? (
          <View style={qs.versionBadge}>
            <Text style={qs.versionText}>Revision {input.version}</Text>
          </View>
        ) : null}

        <LineItemsTable
          items={input.lines.map((l) => ({
            room: l.room,
            item: l.item,
            description: l.description,
            unit: l.unit,
            qty: l.qty,
            ratePaise: l.clientRatePaise,
          }))}
          groupByRoom
        />

        <TotalsBlock
          subtotalPaise={input.subtotalPaise}
          cgstPaise={Math.round(input.gstPaise / 2)}
          sgstPaise={Math.round(input.gstPaise / 2)}
          igstPaise={input.gstPaise}
          totalPaise={input.totalPaise}
          isInterstate={false}
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

export async function renderQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  ensureFonts();
  const stream = await pdf(<QuoteDocument input={input} />).toBuffer();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
