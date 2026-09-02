import { Document, pdf, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ensureFonts } from './fonts';
import { DocPage, StudioHeader, type StudioBranding, S } from './DocumentLayout';
import { fmtDate } from './pdf-utils';

export interface MeasurementSheetRound {
  roundName: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  assignedToName?: string | null;
  notes?: string | null;
  items: {
    room: string;
    itemName: string;
    dimensionsJson: {
      length?: number;
      width?: number;
      height?: number;
      area?: number;
      unit: string;
    };
    qty: number;
    unit: string;
    notes?: string | null;
  }[];
}

export interface MeasurementSheetInput {
  docNumber: string;
  issuedAt: Date | string;
  studio: StudioBranding;
  client: { name: string; phone?: string | null };
  projectLocation?: string | null;
  rounds: MeasurementSheetRound[];
}

const ms = StyleSheet.create({
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 2,
    borderRadius: 3,
  },
  roundName: { fontSize: 10, fontWeight: 700, color: '#1a1a1a' },
  roundMeta: { fontSize: 8.5, color: '#6b7280' },

  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  colRoom:  { width: '20%' },
  colItem:  { width: '28%' },
  colDim:   { width: '30%' },
  colQty:   { width: '10%', textAlign: 'right' },
  colUnit:  { width: '12%', textAlign: 'right' },

  headText: { fontSize: 8, fontWeight: 700, color: '#6b7280' },
  cellText: { fontSize: 9, color: '#374151' },
  cellNote: { fontSize: 8, color: '#9ca3af', marginTop: 2 },

  roundBlock: { marginBottom: 16 },
  noItems:    { fontSize: 9, color: '#9ca3af', paddingVertical: 8 },

  clientBlock: {
    marginBottom: 16,
    flexDirection: 'row',
    gap: 24,
  },
  clientLabel: { fontSize: 7.5, fontWeight: 700, color: '#9ca3af', marginBottom: 3 },
  clientValue: { fontSize: 10, color: '#1a1a1a' },
  clientMeta:  { fontSize: 9, color: '#6b7280' },
});

function fmtDim(d: MeasurementSheetRound['items'][number]['dimensionsJson']): string {
  const parts: string[] = [];
  if (d.length) parts.push(`L:${d.length}`);
  if (d.width)  parts.push(`W:${d.width}`);
  if (d.height) parts.push(`H:${d.height}`);
  if (d.area)   parts.push(`A:${d.area}`);
  return parts.length > 0 ? `${parts.join(' × ')} ${d.unit}` : `—`;
}

function MeasurementDocument({ input }: { input: MeasurementSheetInput }) {
  return (
    <Document
      title={`Measurement Sheet — ${input.client.name}`}
      author={input.studio.name}
      subject={`Measurement Sheet ${input.docNumber}`}
    >
      <DocPage studioName={input.studio.name} docNumber={input.docNumber}>
        <StudioHeader
          studio={input.studio}
          meta={{
            docType: 'MEASUREMENT SHEET',
            docNumber: input.docNumber,
            issuedAt: input.issuedAt,
          }}
        />

        {/* Client block */}
        <View style={ms.clientBlock}>
          <View>
            <Text style={ms.clientLabel}>CLIENT</Text>
            <Text style={ms.clientValue}>{input.client.name}</Text>
            {input.client.phone && <Text style={ms.clientMeta}>{input.client.phone}</Text>}
          </View>
          {input.projectLocation && (
            <View>
              <Text style={ms.clientLabel}>SITE LOCATION</Text>
              <Text style={ms.clientValue}>{input.projectLocation}</Text>
            </View>
          )}
        </View>

        {/* Rounds */}
        {input.rounds.map((round, ri) => (
          <View key={ri} style={ms.roundBlock} wrap={false}>
            <View style={ms.roundHeader}>
              <Text style={ms.roundName}>{round.roundName}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {round.scheduledAt && (
                  <Text style={ms.roundMeta}>Scheduled: {fmtDate(round.scheduledAt)}</Text>
                )}
                {round.completedAt && (
                  <Text style={ms.roundMeta}>Completed: {fmtDate(round.completedAt)}</Text>
                )}
                {round.assignedToName && (
                  <Text style={ms.roundMeta}>By: {round.assignedToName}</Text>
                )}
              </View>
            </View>

            {round.notes && (
              <Text style={{ ...ms.cellNote, paddingBottom: 4 }}>{round.notes}</Text>
            )}

            {round.items.length === 0 ? (
              <Text style={ms.noItems}>No items recorded for this round.</Text>
            ) : (
              <>
                <View style={ms.tableHead}>
                  <Text style={{ ...ms.headText, ...ms.colRoom }}>Room</Text>
                  <Text style={{ ...ms.headText, ...ms.colItem }}>Item</Text>
                  <Text style={{ ...ms.headText, ...ms.colDim }}>Dimensions</Text>
                  <Text style={{ ...ms.headText, ...ms.colQty }}>Qty</Text>
                  <Text style={{ ...ms.headText, ...ms.colUnit }}>Unit</Text>
                </View>
                {round.items.map((item, ii) => (
                  <View key={ii} style={ms.tableRow}>
                    <View style={ms.colRoom}>
                      <Text style={ms.cellText}>{item.room}</Text>
                    </View>
                    <View style={ms.colItem}>
                      <Text style={ms.cellText}>{item.itemName}</Text>
                      {item.notes && <Text style={ms.cellNote}>{item.notes}</Text>}
                    </View>
                    <View style={ms.colDim}>
                      <Text style={ms.cellText}>{fmtDim(item.dimensionsJson)}</Text>
                    </View>
                    <View style={ms.colQty}>
                      <Text style={{ ...ms.cellText, textAlign: 'right' }}>{item.qty}</Text>
                    </View>
                    <View style={ms.colUnit}>
                      <Text style={{ ...ms.cellText, textAlign: 'right' }}>{item.unit}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        ))}

        {input.rounds.length === 0 && (
          <View style={{ ...S.page, paddingTop: 0, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#9ca3af' }}>No measurement rounds recorded.</Text>
          </View>
        )}
      </DocPage>
    </Document>
  );
}

export async function renderMeasurementSheetPdf(input: MeasurementSheetInput): Promise<Buffer> {
  ensureFonts();
  const stream = await pdf(<MeasurementDocument input={input} />).toBuffer();
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
