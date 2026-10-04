import { Document, pdf, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ensureFonts } from './fonts';
import { DocPage, StudioHeader, PartiesBlock, type StudioBranding } from './DocumentLayout';
import { amountInWords } from './pdf-utils';

// Client account statement: every milestone that fell due, every payment and
// adjustment, with a running balance — what the client owes, at a glance.

export interface ClientStatementInput {
  studio: StudioBranding;
  client: { name: string; phone: string | null; address: string | null };
  scope: string;              // "All projects" or the project name
  rows: { date: string; label: string; projectName: string | null; owedPaise: number; paidPaise: number; balancePaise: number }[];
  totals: { contractWithGstPaise: number; duePaise: number; receivedPaise: number; outstandingPaise: number; overduePaise: number; advancePaise: number };
}

// Helvetica (the PDF default here) has no ₹ glyph, so amounts use "Rs.".
const rs = (p: number) => (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('-');
/** A negative balance means the client has paid ahead — accounts write that as "Cr". */
const bal = (p: number) => (p < 0 ? `${rs(-p)} Cr` : rs(p));

const st = StyleSheet.create({
  cards: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  card: { flex: 1, borderWidth: 1, borderColor: '#E8E2D6', backgroundColor: '#F6F3EC', borderRadius: 4, padding: 8 },
  cardDark: { flex: 1, backgroundColor: '#1F4A36', borderRadius: 4, padding: 8 },
  cardLabel: { fontSize: 7, color: '#6b7280', letterSpacing: 1 },
  cardLabelLight: { fontSize: 7, color: '#d1d5db', letterSpacing: 1 },
  cardValue: { fontSize: 12, fontWeight: 700, marginTop: 3 },
  cardValueLight: { fontSize: 12, fontWeight: 700, marginTop: 3, color: '#fff' },
  head: { flexDirection: 'row', backgroundColor: '#1F4A36', paddingVertical: 6, paddingHorizontal: 8 },
  th: { fontSize: 7.5, fontWeight: 700, color: '#fff' },
  row: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F1EDE4' },
  td: { fontSize: 8.5, color: '#262924' },
  sub: { fontSize: 7, color: '#6b7280', marginTop: 1 },
  cDate: { width: '13%' },
  cDesc: { width: '45%', paddingRight: 6 },
  cOwed: { width: '14%', textAlign: 'right' },
  cPaid: { width: '14%', textAlign: 'right' },
  cBal: { width: '14%', textAlign: 'right' },
  closing: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1.5, borderTopColor: '#1a1a1a' },
  bold: { fontSize: 9.5, fontWeight: 700 },
  words: { fontSize: 8, color: '#374151', fontStyle: 'italic', marginTop: 6, textAlign: 'right' },
  empty: { fontSize: 10, color: '#6b7280', paddingVertical: 20, textAlign: 'center' },
  note: { fontSize: 8, color: '#6b7280', marginTop: 18 },
});

function Card({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <View style={dark ? st.cardDark : st.card}>
      <Text style={dark ? st.cardLabelLight : st.cardLabel}>{label}</Text>
      <Text style={dark ? st.cardValueLight : st.cardValue}>{value}</Text>
    </View>
  );
}

function StatementDocument({ input }: { input: ClientStatementInput }) {
  const t = input.totals;
  const docNumber = `Statement · ${input.client.name}`;
  const owed = input.rows.reduce((s, r) => s + r.owedPaise, 0);
  const paid = input.rows.reduce((s, r) => s + r.paidPaise, 0);
  return (
    <Document title={docNumber} author={input.studio.name}>
      <DocPage studioName={input.studio.name} docNumber={docNumber}>
        <StudioHeader studio={input.studio} meta={{ docType: 'ACCOUNT STATEMENT', docNumber: input.scope, issuedAt: new Date() }} />
        <PartiesBlock billTo={{ name: input.client.name, phone: input.client.phone, address: input.client.address }} billToLabel="Client" />

        <View style={st.cards}>
          <Card label="CONTRACT (INCL. GST)" value={`Rs. ${rs(t.contractWithGstPaise)}`} />
          <Card label="DUE SO FAR" value={`Rs. ${rs(t.duePaise)}`} />
          <Card label="RECEIVED" value={`Rs. ${rs(t.receivedPaise)}`} />
          <Card label={t.advancePaise > 0 ? 'ADVANCE WITH US' : 'BALANCE DUE'} value={`Rs. ${rs(t.advancePaise > 0 ? t.advancePaise : t.outstandingPaise)}`} dark />
        </View>

        {input.rows.length === 0 ? (
          <Text style={st.empty}>No entries yet.</Text>
        ) : (
          <View>
            <View style={st.head} fixed>
              <Text style={[st.th, st.cDate]}>Date</Text>
              <Text style={[st.th, st.cDesc]}>Particulars</Text>
              <Text style={[st.th, st.cOwed]}>Due (Rs.)</Text>
              <Text style={[st.th, st.cPaid]}>Paid (Rs.)</Text>
              <Text style={[st.th, st.cBal]}>Balance (Rs.)</Text>
            </View>
            {input.rows.map((r, i) => (
              <View key={i} style={st.row} wrap={false}>
                <Text style={[st.td, st.cDate]}>{dmy(r.date)}</Text>
                <View style={st.cDesc}>
                  <Text style={st.td}>{r.label}</Text>
                  {r.projectName && <Text style={st.sub}>{r.projectName}</Text>}
                </View>
                <Text style={[st.td, st.cOwed]}>{r.owedPaise ? rs(r.owedPaise) : ''}</Text>
                <Text style={[st.td, st.cPaid]}>{r.paidPaise ? rs(r.paidPaise) : ''}</Text>
                <Text style={[st.td, st.cBal]}>{bal(r.balancePaise)}</Text>
              </View>
            ))}
            <View style={st.closing} wrap={false}>
              <Text style={[st.bold, st.cDate]} />
              <Text style={[st.bold, st.cDesc]}>Closing balance</Text>
              <Text style={[st.bold, st.cOwed]}>{rs(owed)}</Text>
              <Text style={[st.bold, st.cPaid]}>{rs(paid)}</Text>
              <Text style={[st.bold, st.cBal]}>{bal(owed - paid)}</Text>
            </View>
            {t.outstandingPaise > 0 && <Text style={st.words}>Balance due: {amountInWords(t.outstandingPaise)}</Text>}
          </View>
        )}

        <Text style={st.note}>
          Amounts include GST. Milestones appear on the date they fell due. Please quote the receipt number for any query.
        </Text>
      </DocPage>
    </Document>
  );
}

export async function renderClientStatementPdf(input: ClientStatementInput): Promise<Buffer> {
  ensureFonts();
  const stream = await pdf(<StatementDocument input={input} />).toBuffer();
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
