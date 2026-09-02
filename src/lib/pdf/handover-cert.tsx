import { Document, pdf, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ensureFonts } from './fonts';
import { DocPage, StudioHeader, type StudioBranding } from './DocumentLayout';
import { fmtDate } from './pdf-utils';

export interface HandoverCertInput {
  docNumber: string;
  handoverDate: Date | string;
  studio: StudioBranding;
  project: { name: string; startedAt?: string | null; expectedEndAt?: string | null };
  client: { name: string; phone?: string | null };
  snagItems: {
    description: string;
    status: 'resolved' | 'client_confirmed';
    clientConfirmedAt?: string | null;
  }[];
}

const hc = StyleSheet.create({
  banner: {
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerMark: { fontSize: 16, color: '#166534' },
  bannerText: { fontSize: 12, fontWeight: 700, color: '#166534' },
  bannerSub:  { fontSize: 9,  color: '#15803d', marginTop: 2 },

  infoGrid: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  infoBox: { flex: 1 },
  infoLabel: { fontSize: 7.5, fontWeight: 700, color: '#9ca3af', marginBottom: 4, letterSpacing: 0.5 },
  infoValue: { fontSize: 10, color: '#1a1a1a', fontWeight: 600 },
  infoMeta:  { fontSize: 9, color: '#6b7280', marginTop: 2 },

  sectionTitle: { fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 8, marginTop: 16 },
  snagRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
    gap: 8,
  },
  snagNum: { fontSize: 8.5, color: '#9ca3af', width: 20 },
  snagDesc: { flex: 1, fontSize: 9, color: '#374151' },
  snagBadge: { fontSize: 8, color: '#166534', fontWeight: 600 },

  signBlock: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 40,
  },
  signCol: { flex: 1 },
  signLine: { borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 6, marginTop: 32 },
  signLabel: { fontSize: 8.5, color: '#6b7280' },

  declaration: {
    fontSize: 8.5,
    color: '#6b7280',
    marginTop: 20,
    fontStyle: 'italic',
    lineHeight: 1.6,
  },
});

function HandoverCertDocument({ input }: { input: HandoverCertInput }) {
  return (
    <Document
      title={`Handover Certificate — ${input.project.name}`}
      author={input.studio.name}
      subject={`Project Handover Certificate ${input.docNumber}`}
    >
      <DocPage studioName={input.studio.name} docNumber={input.docNumber}>
        <StudioHeader
          studio={input.studio}
          meta={{
            docType: 'PROJECT HANDOVER CERTIFICATE',
            docNumber: input.docNumber,
            issuedAt: input.handoverDate,
          }}
        />

        {/* Completion banner */}
        <View style={hc.banner}>
          <Text style={hc.bannerMark}>✓</Text>
          <View>
            <Text style={hc.bannerText}>Project Completed & Handed Over</Text>
            <Text style={hc.bannerSub}>
              This certificate confirms the satisfactory completion and handover of the project.
            </Text>
          </View>
        </View>

        {/* Project + client info */}
        <View style={hc.infoGrid}>
          <View style={hc.infoBox}>
            <Text style={hc.infoLabel}>PROJECT</Text>
            <Text style={hc.infoValue}>{input.project.name}</Text>
            {input.project.startedAt && (
              <Text style={hc.infoMeta}>Started: {fmtDate(input.project.startedAt)}</Text>
            )}
          </View>
          <View style={hc.infoBox}>
            <Text style={hc.infoLabel}>CLIENT</Text>
            <Text style={hc.infoValue}>{input.client.name}</Text>
            {input.client.phone && (
              <Text style={hc.infoMeta}>{input.client.phone}</Text>
            )}
          </View>
          <View style={hc.infoBox}>
            <Text style={hc.infoLabel}>HANDOVER DATE</Text>
            <Text style={hc.infoValue}>{fmtDate(input.handoverDate)}</Text>
          </View>
        </View>

        {/* Snag items */}
        {input.snagItems.length > 0 && (
          <>
            <Text style={hc.sectionTitle}>RESOLVED PUNCH-LIST ITEMS ({input.snagItems.length})</Text>
            {input.snagItems.map((item, i) => (
              <View key={i} style={hc.snagRow}>
                <Text style={hc.snagNum}>{i + 1}.</Text>
                <Text style={hc.snagDesc}>{item.description}</Text>
                <Text style={hc.snagBadge}>
                  {item.status === 'client_confirmed' ? '✓ Confirmed' : '✓ Resolved'}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Declaration */}
        <Text style={hc.declaration}>
          This certificate confirms that all project deliverables have been completed to the agreed specification,
          all punch-list items have been resolved, and the project has been formally handed over to the client.
          Both parties agree that the project is complete as of the date stated above.
        </Text>

        {/* Signature blocks */}
        <View style={hc.signBlock}>
          <View style={hc.signCol}>
            <View style={hc.signLine}>
              <Text style={hc.signLabel}>{input.studio.name}</Text>
              <Text style={hc.signLabel}>Authorised Signatory</Text>
            </View>
          </View>
          <View style={hc.signCol}>
            <View style={hc.signLine}>
              <Text style={hc.signLabel}>{input.client.name}</Text>
              <Text style={hc.signLabel}>Client Signature</Text>
            </View>
          </View>
        </View>
      </DocPage>
    </Document>
  );
}

export async function renderHandoverCertPdf(input: HandoverCertInput): Promise<Buffer> {
  ensureFonts();
  const stream = await pdf(<HandoverCertDocument input={input} />).toBuffer();
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
