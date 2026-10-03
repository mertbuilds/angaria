import {
  Document,
  Font,
  Image,
  Page,
  Path,
  pdf,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';
import { encode } from 'uqr';
import { PDF_FONT_FILES } from '@/components/invoice-pdf-fonts.ts';
import { invoiceTotals, lineTotals, parseDecimal, vatByRate } from '@/lib/invoice-form.ts';
import {
  BILINGUAL_SEPARATOR,
  buildInvoicePDFFilename,
  formatPDFAmount,
  formatPDFCountry,
  formatPDFDate,
  formatPDFNumber,
  formatPDFPercent,
  formatPDFQuantityUnit,
  PDF_LABELS,
  pdfUpper,
  resolvePDFStyle,
  type PDFLabels,
} from '@/lib/invoice-pdf-i18n.ts';
import { saveFile } from '@/lib/save-file.ts';
import type {
  CompanyInfo,
  InvoiceItem,
  InvoiceSettings,
  PDFLanguage,
  PDFStyle,
  Recipient,
} from '@/lib/types.ts';

// Two families from the same files: TEXT for words, FIGURES for numbers,
// dates and codes, laid out with tabular figures so columns line up.
const TEXT = 'InvoiceText';
const FIGURES = 'InvoiceFigures';

for (const family of [TEXT, FIGURES]) {
  Font.register({
    family,
    fonts: [
      { fontWeight: 400, src: PDF_FONT_FILES.regular },
      { fontWeight: 500, src: PDF_FONT_FILES.medium },
    ],
  });
}

Font.registerHyphenationCallback((word) => [word]);

type Style = Parameters<typeof StyleSheet.create>[0][string];

// ── Design tokens ──

const INK = '#000000';
const MUTED = '#8a8a8a';
const LINE = '#d4d4d4';
const SHADE = '#f5f5f5';
const HAIRLINE = 0.75;
const MARGIN = 48;

// ── Helpers ──

/** An address as typed, one PDF line per line */
function addressLines(addr: string): Array<string> {
  return addr
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** One line of a party block: an optional muted label before the text */
interface PartyLine {
  figures?: boolean;
  label?: string;
  text: string;
}

const present = <T,>(entry: T | false | null | undefined | ''): entry is T => Boolean(entry);

function senderLines(company: CompanyInfo, t: PDFLabels): Array<PartyLine> {
  return [
    ...addressLines(company.address).map((text) => ({ text })),
    company.taxID && { figures: true, label: t.taxID, text: company.taxID },
    company.taxOffice && { label: t.taxOffice, text: company.taxOffice },
    company.phone && { figures: true, text: company.phone },
    company.email && { text: company.email },
  ].filter(present);
}

function recipientLines(
  recipient: Recipient,
  language: PDFLanguage,
  t: PDFLabels,
): Array<PartyLine> {
  const person = [recipient.name, recipient.surname].filter(Boolean).join(' ');
  const address = recipient.fullAddress.toLocaleLowerCase('tr-TR');
  // District and city often sit in the address already.
  const place = [recipient.district, recipient.city]
    .map((part) => part.trim())
    .filter((part) => part && !address.includes(part.toLocaleLowerCase('tr-TR')))
    .join(', ');
  return [
    person && person !== recipient.title && { text: person },
    ...addressLines(recipient.fullAddress).map((text) => ({ text })),
    place && { text: place },
    recipient.country && { text: formatPDFCountry(language, recipient.country) },
    recipient.taxIDOrTRID && { figures: true, label: t.taxID, text: recipient.taxIDOrTRID },
    recipient.taxOffice && { label: t.taxOffice, text: recipient.taxOffice },
  ].filter(present);
}

/** Dark modules as one path, a rectangle per run of a row, so no seams show. */
function qrPath(value: string) {
  const { data, size } = encode(value, { border: 0, ecc: 'M' });
  let d = '';
  data.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < size && row[x]) {
        x += 1;
      }
      d += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return { d, size };
}

function QRCode({ size, value }: { size: number; value: string }) {
  const { d, size: modules } = qrPath(value);
  return (
    <Svg height={size} viewBox={`0 0 ${modules} ${modules}`} width={size}>
      <Path d={d} fill={INK} />
    </Svg>
  );
}

// ── Data interface ──

export interface InvoicePDFData {
  company: CompanyInfo;
  /** dd/MM/yyyy */
  date: string;
  /** dd/MM/yyyy */
  dueDate?: string;
  entityName?: string;
  /** GİB's document id, once the draft exists */
  ettn?: string;
  /** GİB's document number, once the draft exists */
  gibNumber?: string;
  grandTotal: number;
  items: Array<InvoiceItem>;
  language: PDFLanguage;
  note?: string;
  paymentTotal?: number;
  /** The text GİB's QR code encodes; unsigned drafts have none */
  qrValue?: string;
  recipient: Recipient;
  settings: InvoiceSettings;
  /** Missing means the company's choice */
  style?: PDFStyle;
  time?: string;
  total: number;
  totalDiscount?: number;
  totalVAT: number;
}

/** Everything both layouts print, formatted for the PDF's language. */
function invoiceView(data: InvoicePDFData) {
  const { company, items, language, recipient, settings } = data;
  const t = PDF_LABELS[language];
  const number = (n: number) => formatPDFNumber(language, n);
  const currency = settings.currency;
  const totals = invoiceTotals(items);
  const rate = currency === 'TRY' ? null : parseDecimal(settings.currencyRate);

  return {
    bank: [
      company.bankName && { label: t.bankName, value: company.bankName },
      company.accountHolder && { label: t.accountHolder, value: company.accountHolder },
      company.iban && { figures: true, label: t.iban, value: company.iban },
      company.swiftCode && { figures: true, label: t.swiftCode, value: company.swiftCode },
      company.bankAddress && { label: t.bankAddress, value: company.bankAddress },
    ].filter(present),
    exchange: rate
      ? [
          {
            label: t.exchangeRate,
            value: `1 ${currency} = ${formatPDFNumber(language, rate, 4)} TRY`,
          },
          { label: t.totalInTRY, value: formatPDFAmount(language, 'TRY', data.total * rate) },
        ]
      : [],
    meta: [
      data.gibNumber && { label: t.invoiceNumber, value: data.gibNumber },
      { label: t.date, value: formatPDFDate(language, data.date) },
      data.dueDate && { label: t.dueDate, value: formatPDFDate(language, data.dueDate) },
      data.ettn && { label: t.ettn, value: data.ettn },
    ].filter(present),
    rows: items.map((item) => {
      const line = lineTotals(item);
      return {
        amount: number(line.gross),
        discount: line.discount > 0 ? `${t.discount} −${number(line.discount)}` : null,
        id: item.id,
        name: item.name,
        quantity: formatPDFQuantityUnit(language, item.quantity, item.unitType),
        unitPrice: number(item.unitPrice),
        vat: formatPDFPercent(language, item.VATRate),
      };
    }),
    recipient: recipientLines(recipient, language, t),
    sender: senderLines(company, t),
    /** A bilingual label on two lines, for narrow cells */
    stack: (text: string) => text.replace(BILINGUAL_SEPARATOR, '\n'),
    t,
    totals: [
      { label: t.subtotal, value: number(totals.gross) },
      totals.discount > 0 && { label: t.discount, value: `−${number(totals.discount)}` },
      ...vatByRate(items).map(({ rate: vatRate, vat }) => ({
        label: `${t.vat} ${formatPDFPercent(language, vatRate)}`,
        value: number(vat),
      })),
    ].filter(present),
    total: formatPDFAmount(language, currency, data.total),
    upper: (text: string) => pdfUpper(language, text),
  };
}

type InvoiceView = ReturnType<typeof invoiceView>;

// ── Shared pieces ──

const s = StyleSheet.create({
  eArchive: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  eArchiveText: { fontSize: 7, lineHeight: 1.5 },
  eArchiveTitle: { fontWeight: 500 },
  figures: { fontFamily: FIGURES },
  logo: { maxHeight: 44, maxWidth: 180, objectFit: 'contain', objectPositionX: 0 },
  muted: { color: MUTED },
  // react-pdf turns a unitless line height into points with the font size
  // beside it, and on the page it hides the page number, so it sits here.
  body: { fontSize: 9, lineHeight: 1.4 },
  page: {
    color: INK,
    fontFamily: TEXT,
    fontSize: 9,
    paddingBottom: MARGIN + 8,
    paddingHorizontal: MARGIN,
    paddingTop: MARGIN,
  },
  pageNumber: {
    bottom: MARGIN / 2,
    color: MUTED,
    fontFamily: FIGURES,
    fontSize: 7.5,
    left: MARGIN,
    position: 'absolute',
    right: MARGIN,
    textAlign: 'right',
  },
  summary: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
});

/** "1 / 2" at the foot of every page of a multi-page invoice */
function PageNumber() {
  return (
    <Text
      fixed
      render={({ pageNumber, totalPages }) =>
        totalPages > 1 ? `${pageNumber} / ${totalPages}` : ''
      }
      style={s.pageNumber}
    />
  );
}

function Brand({
  company,
  nameStyle,
  t,
}: {
  company: CompanyInfo;
  nameStyle: Style;
  t: PDFLabels;
}) {
  return company.logo ? (
    <Image src={company.logo} style={s.logo} />
  ) : (
    <Text style={nameStyle}>{company.name || t.companyNameFallback}</Text>
  );
}

function PartyText({ line }: { line: PartyLine }) {
  return (
    <Text>
      {line.label ? <Text style={s.muted}>{line.label} </Text> : null}
      <Text style={line.figures ? s.figures : undefined}>{line.text}</Text>
    </Text>
  );
}

/**
 * The e-Arşiv mark beside the totals: GİB's QR code (signed invoices only),
 * GİB's number and the ETTN. Empty until GİB has the draft.
 */
function EArchive({ data, view }: { data: InvoicePDFData; view: InvoiceView }) {
  const { t } = view;
  if (!data.gibNumber && !data.ettn) {
    return <View />;
  }
  return (
    <View style={s.eArchive}>
      {data.qrValue ? <QRCode size={76} value={data.qrValue} /> : null}
      <View style={s.eArchiveText}>
        <Text style={s.eArchiveTitle}>{t.eArchiveInvoice}</Text>
        {data.gibNumber ? (
          <Text>
            <Text style={s.muted}>{t.gibNumber} </Text>
            <Text style={s.figures}>{data.gibNumber}</Text>
          </Text>
        ) : null}
        {data.ettn ? (
          <>
            <Text style={s.muted}>{t.ettn}</Text>
            <Text style={s.figures}>{data.ettn}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

// ── Minimal: hairlines and whitespace, no boxes or fills ──

const COLUMNS = {
  amount: { textAlign: 'right' as const, width: 84 },
  description: { flex: 1, paddingRight: 12 },
  quantity: { textAlign: 'right' as const, width: 70 },
  unitPrice: { textAlign: 'right' as const, width: 80 },
  vat: { textAlign: 'right' as const, width: 44 },
};

const m = StyleSheet.create({
  amountCell: { ...COLUMNS.amount, fontFamily: FIGURES },
  bankColumn: { width: 300 },
  bankLabel: { color: MUTED, fontSize: 8, paddingRight: 8, width: 92 },
  bankRow: { flexDirection: 'row', marginBottom: 3 },
  bankValue: { flex: 1, fontSize: 8.5 },
  brandName: { fontSize: 14, fontWeight: 500, lineHeight: 1 },
  cellSub: { color: MUTED, fontSize: 7.5, marginTop: 2 },
  details: { flexDirection: 'row', gap: 32, marginTop: 32 },
  exchange: { color: MUTED, fontSize: 7.5 },
  exchangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  grandLabel: { fontSize: 9, paddingBottom: 3 },
  grandRow: {
    alignItems: 'flex-end',
    borderTopColor: INK,
    borderTopWidth: HAIRLINE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
  },
  grandValue: { fontFamily: FIGURES, fontSize: 16, lineHeight: 1.2 },
  // A logo centers on the title, a name shares its baseline.
  header: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  headerWithLogo: { alignItems: 'center' },
  label: { color: MUTED, fontSize: 7.5, marginBottom: 4 },
  // A field that does not fit (the ETTN beside long labels or dates) wraps to
  // its own line instead of running past the margin.
  meta: { columnGap: 20, flexDirection: 'row', flexWrap: 'wrap', marginTop: 32, rowGap: 14 },
  metaValue: { fontFamily: FIGURES },
  note: { fontSize: 8.5 },
  noteColumn: { flex: 1 },
  parties: { flexDirection: 'row', gap: 32, marginTop: 28 },
  party: { flex: 1, fontSize: 8.5 },
  partyName: { fontSize: 9, fontWeight: 500, marginBottom: 1 },
  row: {
    borderBottomColor: LINE,
    borderBottomWidth: HAIRLINE,
    flexDirection: 'row',
    paddingVertical: 8,
  },
  summary: { marginTop: 14 },
  table: { marginTop: 32 },
  tableHead: {
    alignItems: 'flex-end',
    borderBottomColor: INK,
    borderBottomWidth: HAIRLINE,
    color: MUTED,
    flexDirection: 'row',
    fontSize: 7.5,
    paddingBottom: 6,
  },
  title: { fontSize: 20, fontWeight: 500, lineHeight: 1, textAlign: 'right' },
  totalLabel: { color: MUTED, fontSize: 8.5 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totals: { width: 236 },
  totalValue: { fontFamily: FIGURES },
});

function MinimalInvoice({ data, view }: { data: InvoicePDFData; view: InvoiceView }) {
  const { stack, t } = view;
  return (
    <Page size="A4" style={s.page}>
      <View style={s.body}>
        <View style={data.company.logo ? [m.header, m.headerWithLogo] : m.header}>
          <Brand company={data.company} nameStyle={m.brandName} t={t} />
          <Text style={m.title}>{t.invoice}</Text>
        </View>

        <View style={m.meta}>
          {view.meta.map(({ label, value }) => (
            <View key={label}>
              <Text style={m.label}>{label}</Text>
              <Text style={m.metaValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={m.parties}>
          <View style={m.party}>
            <Text style={m.label}>{t.from}</Text>
            <Text style={m.partyName}>{data.company.name || t.companyNameFallback}</Text>
            {view.sender.map((line, index) => (
              <PartyText key={index} line={line} />
            ))}
          </View>
          <View style={m.party}>
            <Text style={m.label}>{t.billedTo}</Text>
            <Text style={m.partyName}>{data.recipient.title}</Text>
            {view.recipient.map((line, index) => (
              <PartyText key={index} line={line} />
            ))}
          </View>
        </View>

        <View style={m.table}>
          <View fixed style={m.tableHead}>
            <Text style={COLUMNS.description}>{stack(t.description)}</Text>
            <Text style={COLUMNS.quantity}>{stack(t.quantity)}</Text>
            <Text style={COLUMNS.unitPrice}>{stack(t.unitPrice)}</Text>
            <Text style={COLUMNS.vat}>{stack(t.vat)}</Text>
            <Text style={COLUMNS.amount}>{stack(t.amount)}</Text>
          </View>
          {view.rows.map((row) => (
            <View key={row.id} style={m.row} wrap={false}>
              <View style={COLUMNS.description}>
                <Text>{row.name}</Text>
                {row.discount ? <Text style={m.cellSub}>{row.discount}</Text> : null}
              </View>
              <Text style={[COLUMNS.quantity, s.figures]}>{row.quantity}</Text>
              <Text style={[COLUMNS.unitPrice, s.figures]}>{row.unitPrice}</Text>
              <Text style={[COLUMNS.vat, s.figures]}>{row.vat}</Text>
              <Text style={m.amountCell}>{row.amount}</Text>
            </View>
          ))}
        </View>

        <View style={[s.summary, m.summary]} wrap={false}>
          <EArchive data={data} view={view} />
          <View style={m.totals}>
            {view.totals.map(({ label, value }) => (
              <View key={label} style={m.totalRow}>
                <Text style={m.totalLabel}>{label}</Text>
                <Text style={m.totalValue}>{value}</Text>
              </View>
            ))}
            <View style={m.grandRow}>
              <Text style={m.grandLabel}>{stack(t.total)}</Text>
              <Text style={m.grandValue}>{view.total}</Text>
            </View>
            {view.exchange.map(({ label, value }) => (
              <View key={label} style={m.exchangeRow}>
                <Text style={m.exchange}>{label}</Text>
                <Text style={[m.exchange, s.figures]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {view.bank.length > 0 || data.note ? (
          <View style={m.details} wrap={false}>
            {view.bank.length > 0 ? (
              <View style={m.bankColumn}>
                <Text style={m.label}>{t.bankDetails}</Text>
                {view.bank.map(({ figures, label, value }) => (
                  <View key={label} style={m.bankRow}>
                    <Text style={m.bankLabel}>{stack(label)}</Text>
                    <Text style={[m.bankValue, figures ? s.figures : {}]}>{value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {data.note ? (
              <View style={m.noteColumn}>
                <Text style={m.label}>{t.note}</Text>
                <Text style={m.note}>{data.note}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <PageNumber />
    </Page>
  );
}

// ── Classic: a bordered header table, a shaded table header, boxed totals ──

const BOX = { borderColor: INK, borderWidth: HAIRLINE };

const c = StyleSheet.create({
  amountCell: { ...COLUMNS.amount, fontFamily: FIGURES },
  bankColumn: { ...BOX, width: 300 },
  bankLabel: { color: MUTED, paddingRight: 8, width: 92 },
  bankRow: { flexDirection: 'row', marginBottom: 2 },
  bankValue: { flex: 1 },
  boxBody: { fontSize: 8.5, paddingHorizontal: 10, paddingVertical: 8 },
  boxTitle: {
    backgroundColor: SHADE,
    borderBottomColor: INK,
    borderBottomWidth: HAIRLINE,
    fontSize: 7,
    fontWeight: 500,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  brandName: { fontSize: 14, fontWeight: 500, lineHeight: 1 },
  cell: { paddingHorizontal: 6 },
  cellSub: { color: MUTED, fontSize: 7.5, marginTop: 2 },
  details: { flexDirection: 'row', gap: 12, marginTop: 14 },
  exchange: { color: MUTED, fontSize: 7.5 },
  exchangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  grandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  grandLabel: { fontSize: 8.5 },
  grandValue: { fontFamily: FIGURES, fontSize: 14, lineHeight: 1.2 },
  header: { ...BOX, flexDirection: 'row' },
  headerBrand: { flex: 1, fontSize: 8.5, padding: 10 },
  headerBrandName: { fontSize: 9, fontWeight: 500, marginTop: 8 },
  headerMeta: { borderLeftColor: INK, borderLeftWidth: HAIRLINE, width: 290 },
  metaLabel: {
    borderRightColor: LINE,
    borderRightWidth: HAIRLINE,
    color: MUTED,
    fontSize: 7.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 100,
  },
  metaRow: { borderTopColor: LINE, borderTopWidth: HAIRLINE, flexDirection: 'row' },
  metaValue: {
    flex: 1,
    fontFamily: FIGURES,
    fontSize: 7.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  note: { fontSize: 8.5 },
  noteColumn: { ...BOX, flex: 1 },
  partyName: { fontSize: 9, fontWeight: 500, marginBottom: 1 },
  recipient: { ...BOX, marginTop: 10 },
  // The table has no outer box, so a page break never leaves it open:
  // the header and each row carry their own edges.
  row: {
    borderBottomColor: LINE,
    borderBottomWidth: HAIRLINE,
    borderLeftColor: INK,
    borderLeftWidth: HAIRLINE,
    borderRightColor: INK,
    borderRightWidth: HAIRLINE,
    flexDirection: 'row',
    paddingVertical: 6,
  },
  rowLast: { borderBottomColor: INK },
  senderLines: { marginTop: 6 },
  summary: { marginTop: 10 },
  table: { marginTop: 12 },
  tableHead: {
    ...BOX,
    alignItems: 'flex-end',
    backgroundColor: SHADE,
    flexDirection: 'row',
    fontSize: 7,
    fontWeight: 500,
    paddingVertical: 5,
  },
  title: {
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: 0.6,
    paddingVertical: 8,
    textAlign: 'center',
  },
  totalLabel: { color: MUTED },
  totalRow: {
    borderBottomColor: LINE,
    borderBottomWidth: HAIRLINE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
  },
  totals: { width: 250 },
  totalsBox: { ...BOX },
  totalValue: { fontFamily: FIGURES },
});

function ClassicInvoice({ data, view }: { data: InvoicePDFData; view: InvoiceView }) {
  const { stack, t, upper } = view;
  return (
    <Page size="A4" style={s.page}>
      <View style={s.body}>
        <View style={c.header}>
          <View style={c.headerBrand}>
            <Brand company={data.company} nameStyle={c.brandName} t={t} />
            {data.company.logo ? (
              <Text style={c.headerBrandName}>{data.company.name || t.companyNameFallback}</Text>
            ) : null}
            <View style={data.company.logo ? undefined : c.senderLines}>
              {view.sender.map((line, index) => (
                <PartyText key={index} line={line} />
              ))}
            </View>
          </View>
          <View style={c.headerMeta}>
            <Text style={c.title}>{upper(t.invoice)}</Text>
            {view.meta.map(({ label, value }) => (
              <View key={label} style={c.metaRow}>
                <Text style={c.metaLabel}>{stack(label)}</Text>
                <Text style={c.metaValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={c.recipient} wrap={false}>
          <Text style={c.boxTitle}>{upper(t.billedTo)}</Text>
          <View style={c.boxBody}>
            <Text style={c.partyName}>{data.recipient.title}</Text>
            {view.recipient.map((line, index) => (
              <PartyText key={index} line={line} />
            ))}
          </View>
        </View>

        <View style={c.table}>
          <View fixed style={c.tableHead}>
            <Text style={[COLUMNS.description, c.cell]}>{stack(upper(t.description))}</Text>
            <Text style={[COLUMNS.quantity, c.cell]}>{stack(upper(t.quantity))}</Text>
            <Text style={[COLUMNS.unitPrice, c.cell]}>{stack(upper(t.unitPrice))}</Text>
            <Text style={[COLUMNS.vat, c.cell]}>{stack(upper(t.vat))}</Text>
            <Text style={[COLUMNS.amount, c.cell]}>{stack(upper(t.amount))}</Text>
          </View>
          {view.rows.map((row, index) => (
            <View
              key={row.id}
              style={index === view.rows.length - 1 ? [c.row, c.rowLast] : c.row}
              wrap={false}
            >
              <View style={[COLUMNS.description, c.cell]}>
                <Text>{row.name}</Text>
                {row.discount ? <Text style={c.cellSub}>{row.discount}</Text> : null}
              </View>
              <Text style={[COLUMNS.quantity, c.cell, s.figures]}>{row.quantity}</Text>
              <Text style={[COLUMNS.unitPrice, c.cell, s.figures]}>{row.unitPrice}</Text>
              <Text style={[COLUMNS.vat, c.cell, s.figures]}>{row.vat}</Text>
              <Text style={[c.amountCell, c.cell]}>{row.amount}</Text>
            </View>
          ))}
        </View>

        <View style={[s.summary, c.summary]} wrap={false}>
          <EArchive data={data} view={view} />
          <View style={c.totals}>
            <View style={c.totalsBox}>
              {view.totals.map(({ label, value }) => (
                <View key={label} style={c.totalRow}>
                  <Text style={c.totalLabel}>{label}</Text>
                  <Text style={c.totalValue}>{value}</Text>
                </View>
              ))}
              <View style={c.grandRow}>
                <Text style={c.grandLabel}>{stack(upper(t.total))}</Text>
                <Text style={c.grandValue}>{view.total}</Text>
              </View>
            </View>
            {view.exchange.map(({ label, value }) => (
              <View key={label} style={c.exchangeRow}>
                <Text style={c.exchange}>{label}</Text>
                <Text style={[c.exchange, s.figures]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {view.bank.length > 0 || data.note ? (
          <View style={c.details} wrap={false}>
            {view.bank.length > 0 ? (
              <View style={c.bankColumn}>
                <Text style={c.boxTitle}>{upper(t.bankDetails)}</Text>
                <View style={c.boxBody}>
                  {view.bank.map(({ figures, label, value }) => (
                    <View key={label} style={c.bankRow}>
                      <Text style={c.bankLabel}>{stack(label)}</Text>
                      <Text style={[c.bankValue, figures ? s.figures : {}]}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {data.note ? (
              <View style={c.noteColumn}>
                <Text style={c.boxTitle}>{upper(t.note)}</Text>
                <View style={c.boxBody}>
                  <Text style={c.note}>{data.note}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <PageNumber />
    </Page>
  );
}

// ── Document ──

function InvoicePDFDocument({ data }: { data: InvoicePDFData }) {
  const view = invoiceView(data);
  const style = resolvePDFStyle(data.style, data.company.pdfStyle);
  return (
    <Document
      author={data.company.name || undefined}
      language={data.language === 'en' ? 'en' : 'tr'}
      title={[view.t.invoice, data.gibNumber].filter(Boolean).join(' ')}
    >
      {style === 'classic' ? (
        <ClassicInvoice data={data} view={view} />
      ) : (
        <MinimalInvoice data={data} view={view} />
      )}
    </Document>
  );
}

// ── Export ──

/** fontkit's options for FIGURES: tabular figures on top of the defaults */
const TABULAR = ['tnum'];

/**
 * fontkit caches glyphs per loaded font, and subsetting a finished PDF caches
 * the parts of composite glyphs ("ı" in "i", "G" in "Ğ") without their
 * characters. A later PDF on the same font then drops those characters from
 * its text layer (copy, search). So every PDF loads the fonts fresh, and
 * renders run one at a time so a reload never lands mid-render.
 *
 * react-pdf lays text out without OpenType features, so FIGURES's layout
 * turns on tabular figures.
 *
 * react-pdf embeds one font per PostScript name, and Suisse Intl names both
 * weights "Font": every weight would print with the glyphs of the first one
 * used, laid out with its own widths. So each weight gets a name of its own.
 */
async function loadFonts() {
  const families = Font.getRegisteredFonts();
  const figures = families[FIGURES]?.sources ?? [];
  const sources = [...(families[TEXT]?.sources ?? []), ...figures];
  for (const source of sources) {
    source.data = null;
    source.loadResultPromise = null;
  }
  await Promise.all(
    sources.map(async (source) => {
      await source.load();
      const font = source.data;
      if (!font) {
        return;
      }
      Object.defineProperty(font, 'postscriptName', {
        value: `${font.postscriptName}-${source.fontWeight}`,
      });
      if (figures.includes(source)) {
        const layout = font.layout.bind(font);
        font.layout = (text, features, ...rest) => layout(text, features ?? TABULAR, ...rest);
      }
    }),
  );
}

let lastRender: Promise<unknown> = Promise.resolve();

export function renderInvoicePDF(data: InvoicePDFData): Promise<Blob> {
  const render = lastRender.then(async () => {
    await loadFonts();
    return pdf(<InvoicePDFDocument data={data} />).toBlob();
  });
  lastRender = render.catch(() => {});
  return render;
}

export async function downloadInvoicePDF(data: InvoicePDFData, filename?: string) {
  return saveFile(
    await renderInvoicePDF(data),
    filename ??
      buildInvoicePDFFilename({
        companyName: data.company.name,
        date: data.date,
        entityName: data.entityName,
        language: data.language,
        recipientTitle: data.recipient.title,
      }),
  );
}
