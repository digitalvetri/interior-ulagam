import { Document, pdf, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ensureFonts } from './fonts';
import { DocPage, StudioHeader, PartiesBlock, type StudioBranding, type PartyInfo } from './DocumentLayout';
import { amountInWords } from './pdf-utils';

// Work statement for the Civil Management division: every job at a branch (or
// company) over a period, with its lines and the grand total.

export interface CivilStatementJob {
  jobNo: number;
  jobDate: string;
  heading: string;
  branchName: string;
  status: string;
  billNo: string | null;
  totalPaise: number;
  lines: { description: string; kind: 'material' | 'labour'; amountPaise: number }[];
}

export interface CivilStatementInput {
  studio: StudioBranding;
  title: string;          // e.g. "Sep 2026" or "21-09-2026"
  company: PartyInfo | null;
  branch: PartyInfo | null; // null when the statement spans several branches
  showBranch: boolean;
  jobs: CivilStatementJob[];
  materialPaise: number;
  labourPaise: number;
  totalPaise: number;
}

// Helvetica (the PDF default here) has no ₹ glyph, so amounts use "Rs.".
function rs(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function dmy(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

const st = StyleSheet.create({
  table: { marginBottom: 16 },
  head: { flexDirection: 'row', backgroundColor: '#1F4A36', paddingVertical: 6, paddingHorizontal: 8 },
  th: { fontSize: 7.5, fontWeight: 700, color: '#fff' },
  jobRow: {
    flexDirection: 'row', backgroundColor: '#F1EDE4', paddingVertical: 5, paddingHorizontal: 8,
    borderTopWidth: 1, borderTopColor: '#E8E2D6',
  },
  lineRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 8 },
  jobNo: { fontSize: 8.5, fontWeight: 700 },
  jobText: { fontSize: 8.5, fontWeight: 700 },
  jobSub: { fontSize: 7, color: '#6b7280', marginTop: 1 },
  td: { fontSize: 8.5, color: '#262924' },
  tdMuted: { fontSize: 8.5, color: '#8C8E86' },
  cNo: { width: '7%' },
  cDate: { width: '12%' },
  cDesc: { width: '42%', paddingRight: 6 },
  cMat: { width: '13%', textAlign: 'right' },
  cLab: { width: '13%', textAlign: 'right' },
  cTot: { width: '13%', textAlign: 'right' },

  totals: { alignSelf: 'flex-end', width: '50%', marginTop: 4 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totLabel: { fontSize: 9, color: '#4b5563' },
  totValue: { fontSize: 9, color: '#1a1a1a' },
  grand: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 6,
    borderTopWidth: 1.5, borderTopColor: '#1a1a1a',
  },
  grandText: { fontSize: 12, fontWeight: 700 },
  words: { fontSize: 8, color: '#374151', fontStyle: 'italic', marginTop: 6, textAlign: 'right' },
  empty: { fontSize: 10, color: '#6b7280', paddingVertical: 20, textAlign: 'center' },
  sign: { marginTop: 48, alignItems: 'flex-end' },
  signLine: { borderTopWidth: 1, borderTopColor: '#9ca3af', width: 160, paddingTop: 4 },
  signLabel: { fontSize: 8, color: '#6b7280', textAlign: 'center' },
});

function StatementDocument({ input }: { input: CivilStatementInput }) {
  const docNumber = `Work statement · ${input.title}`;
  return (
    <Document title={docNumber} author={input.studio.name}>
      <DocPage studioName={input.studio.name} docNumber={docNumber}>
        <StudioHeader
          studio={input.studio}
          meta={{
            docType: 'WORK STATEMENT',
            docNumber: input.title,
            issuedAt: new Date(),
            extra: [{ label: 'Jobs', value: String(input.jobs.length) }],
          }}
        />

        {input.company && (
          <PartiesBlock
            billTo={input.company}
            billToLabel="Company"
            rightParty={input.branch}
            rightLabel="Branch"
          />
        )}

        {input.jobs.length === 0 ? (
          <Text style={st.empty}>No jobs in this period.</Text>
        ) : (
          <View style={st.table}>
            <View style={st.head} fixed>
              <Text style={[st.th, st.cNo]}>S.No</Text>
              <Text style={[st.th, st.cDate]}>Date</Text>
              <Text style={[st.th, st.cDesc]}>Work / Description</Text>
              <Text style={[st.th, st.cMat]}>Material (Rs.)</Text>
              <Text style={[st.th, st.cLab]}>Labour (Rs.)</Text>
              <Text style={[st.th, st.cTot]}>Total (Rs.)</Text>
            </View>

            {input.jobs.map(j => (
              <View key={j.jobNo}>
                <View style={st.jobRow} wrap={false} minPresenceAhead={30}>
                  <Text style={[st.jobNo, st.cNo]}>{j.jobNo}</Text>
                  <Text style={[st.td, st.cDate]}>{dmy(j.jobDate)}</Text>
                  <View style={st.cDesc}>
                    <Text style={st.jobText}>{j.heading.toUpperCase()}</Text>
                    <Text style={st.jobSub}>
                      {[input.showBranch ? j.branchName : null, j.status, j.billNo ? `Bill ${j.billNo}` : null]
                        .filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                  <Text style={st.cMat} />
                  <Text style={st.cLab} />
                  <Text style={[st.jobText, st.cTot]}>{rs(j.totalPaise)}</Text>
                </View>
                {j.lines.map((l, i) => (
                  <View key={i} style={st.lineRow} wrap={false}>
                    <Text style={st.cNo} />
                    <Text style={st.cDate} />
                    <Text style={[st.td, st.cDesc]}>{l.description}</Text>
                    <Text style={[l.kind === 'material' ? st.td : st.tdMuted, st.cMat]}>
                      {l.kind === 'material' ? rs(l.amountPaise) : ''}
                    </Text>
                    <Text style={[l.kind === 'labour' ? st.td : st.tdMuted, st.cLab]}>
                      {l.kind === 'labour' ? rs(l.amountPaise) : ''}
                    </Text>
                    <Text style={st.cTot} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={st.totals} wrap={false}>
          <View style={st.totRow}>
            <Text style={st.totLabel}>Material</Text>
            <Text style={st.totValue}>Rs. {rs(input.materialPaise)}</Text>
          </View>
          <View style={st.totRow}>
            <Text style={st.totLabel}>Labour</Text>
            <Text style={st.totValue}>Rs. {rs(input.labourPaise)}</Text>
          </View>
          <View style={st.grand}>
            <Text style={st.grandText}>Grand Total</Text>
            <Text style={st.grandText}>Rs. {rs(input.totalPaise)}</Text>
          </View>
          {input.totalPaise > 0 && <Text style={st.words}>{amountInWords(input.totalPaise)}</Text>}
        </View>

        <View style={st.sign} wrap={false}>
          <View style={st.signLine}>
            <Text style={st.signLabel}>For {input.studio.name}</Text>
          </View>
        </View>
      </DocPage>
    </Document>
  );
}

export async function renderCivilStatementPdf(input: CivilStatementInput): Promise<Buffer> {
  ensureFonts();
  const stream = await pdf(<StatementDocument input={input} />).toBuffer();
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
