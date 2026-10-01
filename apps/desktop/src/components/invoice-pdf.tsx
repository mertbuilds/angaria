import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import interBold from '@/assets/fonts/Inter-Bold.ttf';
import interRegular from '@/assets/fonts/Inter-Regular.ttf';
import interSemiBold from '@/assets/fonts/Inter-SemiBold.ttf';
import { GIB_UNIT_TYPES } from '@/lib/gib-constants.ts';
import {
  buildInvoicePDFFilename,
  formatPDFAmount,
  formatPDFDate,
  formatPDFQuantity,
  PDF_LABELS,
  pdfUpper,
} from '@/lib/invoice-pdf-i18n.ts';
import type {
  CompanyInfo,
  InvoiceItem,
  PDFLanguage,
  Recipient,
  InvoiceSettings,
} from '@/lib/types.ts';

Font.register({
  family: 'Inter',
  fonts: [
    { src: interRegular, fontWeight: 400 },
    { src: interSemiBold, fontWeight: 600 },
    { src: interBold, fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

// ── Design tokens ──

const PRIMARY = '#009962';
const INK = '#1C1C1E';
const SECONDARY = '#555555';
const TERTIARY = '#8E8E93';
const RULE = '#D1D5DB';

// ── Helpers ──

const unitLabel = (code: string) => GIB_UNIT_TYPES.find((u) => u.value === code)?.label ?? code;

const COUNTRY_TR_TO_EN: Record<string, string> = {
  Türkiye: 'Turkey',
  'Amerika Birleşik Dev': 'United States',
  Almanya: 'Germany',
  'Birleşik Krallik': 'United Kingdom',
  Fransa: 'France',
  Hollanda: 'Netherlands',
  İtalya: 'Italy',
  İspanya: 'Spain',
  İsviçre: 'Switzerland',
  Avusturya: 'Austria',
  Belçika: 'Belgium',
  Kanada: 'Canada',
  Japonya: 'Japan',
  Avustralya: 'Australia',
  Brezilya: 'Brazil',
  'Çin Halk Cumhuriyeti': 'China',
  Hindistan: 'India',
  'Rusya Federasyonu': 'Russia',
  'Güney Kore Cumhuriye': 'South Korea',
  Meksika: 'Mexico',
  İrlanda: 'Ireland',
  Danimarka: 'Denmark',
  İsveç: 'Sweden',
  Norveç: 'Norway',
  Finlandiya: 'Finland',
  Polonya: 'Poland',
  Portekiz: 'Portugal',
  Yunanistan: 'Greece',
  'Çek Cumhuriyeti': 'Czech Republic',
  Macaristan: 'Hungary',
  Romanya: 'Romania',
  Bulgaristan: 'Bulgaria',
  Hirvatistan: 'Croatia',
  Sirbistan: 'Serbia',
  'Birleşik Arap Emirli': 'United Arab Emirates',
  'Suudi Arabistan': 'Saudi Arabia',
  İsrail: 'Israel',
  Singapur: 'Singapore',
  'Hong Kong': 'Hong Kong',
  'Yeni Zelanda': 'New Zealand',
  'Güney Afrika Cumhuri': 'South Africa',
  Arjantin: 'Argentina',
  Şili: 'Chile',
  Kolombiya: 'Colombia',
  Misir: 'Egypt',
  Azerbaycan: 'Azerbaijan',
  Gürcistan: 'Georgia',
  Ukrayna: 'Ukraine',
  Kazakistan: 'Kazakhstan',
  'Kuzey Kibris Türk Cu': 'Northern Cyprus',
};

function countryEN(tr: string): string {
  return COUNTRY_TR_TO_EN[tr] ?? tr;
}

/** Split a multiline address string into individual lines */
function addressLines(addr: string): Array<string> {
  return addr
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// ── Styles ──

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: INK,
    paddingTop: 52,
    paddingBottom: 48,
    paddingHorizontal: 56,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 40,
  },
  senderName: {
    fontSize: 24,
    fontWeight: 700,
    color: PRIMARY,
    marginBottom: 12,
  },
  senderInfo: {
    flexDirection: 'row',
    gap: 32,
  },
  senderAddressCol: {
    flex: 1,
  },
  senderContactCol: {
    width: 130,
  },
  detailText: {
    fontSize: 8.5,
    color: SECONDARY,
    lineHeight: 1.6,
  },
  headerRight: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  dateLabel: {
    fontSize: 8.5,
    color: TERTIARY,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: 600,
    color: INK,
    marginTop: 3,
  },

  // ── Divider ──
  divider: {
    height: 1.5,
    backgroundColor: PRIMARY,
    marginTop: 20,
    marginBottom: 20,
  },

  // ── Billed To ──
  sectionLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: TERTIARY,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  billedToName: {
    fontSize: 13,
    fontWeight: 700,
    color: INK,
    marginBottom: 5,
  },
  billedToLine: {
    fontSize: 9,
    color: SECONDARY,
    lineHeight: 1.6,
  },

  // ── Invoice body ──
  invoiceBody: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  invoiceLeft: {
    width: 110,
    paddingTop: 2,
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: TERTIARY,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 9,
    color: INK,
    lineHeight: 1.4,
  },
  invoiceRight: {
    flex: 1,
  },

  // ── Table ──
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 2,
  },
  thText: {
    fontSize: 7,
    fontWeight: 700,
    color: '#ffffff',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  colDesc: { flex: 1, paddingRight: 8 },
  colUnitCost: { width: 78, textAlign: 'right' },
  colQty: { width: 36, textAlign: 'center' },
  // "MİKTAR" needs more room than "QTY" beside "BİRİM FİYAT EUR".
  colQtyTR: { width: 48 },
  colAmount: { width: 88, textAlign: 'right' },
  cellText: { fontSize: 9 },
  cellSub: { fontSize: 7.5, color: TERTIARY, marginTop: 2 },

  // ── Subtotals ──
  subtotalArea: {
    alignItems: 'flex-end',
    marginTop: 12,
    paddingRight: 10,
  },
  subtotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  subtotalLabel: {
    width: 80,
    textAlign: 'right',
    paddingRight: 14,
    fontSize: 7.5,
    fontWeight: 700,
    color: TERTIARY,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  subtotalValue: {
    width: 88,
    textAlign: 'right',
    fontSize: 9.5,
    color: INK,
  },

  // ── Invoice Total ──
  totalLabel: {
    textAlign: 'right',
    fontSize: 7.5,
    fontWeight: 700,
    color: PRIMARY,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 4,
    paddingRight: 10,
  },
  totalValue: {
    textAlign: 'right',
    fontSize: 26,
    fontWeight: 700,
    color: INK,
    paddingRight: 10,
  },

  // ── Bank details ──
  bankSection: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
  },
  bankTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: INK,
    marginBottom: 10,
  },
  bankColumns: {
    flexDirection: 'row',
    gap: 40,
  },
  bankCol: {
    flex: 1,
  },
  bankRow: {
    marginBottom: 6,
  },
  bankLabel: {
    fontSize: 7.5,
    fontWeight: 600,
    color: TERTIARY,
    marginBottom: 1,
  },
  bankValue: {
    fontSize: 8.5,
    color: INK,
    lineHeight: 1.5,
  },

  // ── Note ──
  noteSection: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
  },
  noteLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: TERTIARY,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 8.5,
    color: SECONDARY,
    lineHeight: 1.6,
  },
});

// ── Data interface ──

export interface InvoicePDFData {
  company: CompanyInfo;
  date: string;
  entityName?: string;
  grandTotal: number;
  invoiceNumber?: string;
  items: Array<InvoiceItem>;
  language: PDFLanguage;
  note?: string;
  paymentTotal?: number;
  recipient: Recipient;
  settings: InvoiceSettings;
  time?: string;
  total: number;
  totalDiscount?: number;
  totalVAT: number;
}

// ── Document ──

function InvoicePDFDocument({ data }: { data: InvoicePDFData }) {
  const { company, recipient, settings, items, date, invoiceNumber, note, language } = data;
  const t = PDF_LABELS[language];
  const upper = (text: string) => pdfUpper(language, text);
  const fmtAmount = (currency: string, n: number) => formatPDFAmount(language, currency, n);
  const cur = settings.currency;
  const hasBank = company.bankName || company.iban;
  const displayDate = formatPDFDate(language, date);
  const addrLines = addressLines(company.address);
  const recipientAddrLines = addressLines(recipient.fullAddress);
  const qtyColumn = language === 'tr' ? { ...s.colQty, ...s.colQtyTR } : s.colQty;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.senderName}>{company.name || t.companyNameFallback}</Text>
            <View style={s.senderInfo}>
              <View style={s.senderAddressCol}>
                {addrLines.map((line, i) => (
                  <Text key={i} style={s.detailText}>
                    {line}
                  </Text>
                ))}
              </View>
              {(company.phone || company.email) && (
                <View style={s.senderContactCol}>
                  {company.phone ? <Text style={s.detailText}>{company.phone}</Text> : null}
                  {company.email ? <Text style={s.detailText}>{company.email}</Text> : null}
                </View>
              )}
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.dateLabel}>{t.invoiceDate}</Text>
            <Text style={s.dateValue}>{displayDate}</Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── Billed To ── */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionLabel}>{upper(t.billedTo)}</Text>
          <Text style={s.billedToName}>{recipient.title}</Text>
          {(recipient.name || recipient.surname) && (
            <Text style={s.billedToLine}>
              {[recipient.name, recipient.surname].filter(Boolean).join(' ')}
            </Text>
          )}
          {recipientAddrLines.map((line, i) => (
            <Text key={i} style={s.billedToLine}>
              {line}
            </Text>
          ))}
          {recipient.country ? (
            <Text style={s.billedToLine}>
              {language === 'en' ? countryEN(recipient.country) : recipient.country}
            </Text>
          ) : null}
        </View>

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── Invoice body ── */}
        <View style={s.invoiceBody}>
          {/* Left column: invoice number */}
          <View style={s.invoiceLeft}>
            {invoiceNumber && (
              <View>
                <Text style={s.metaLabel}>{upper(t.invoiceNumber)}</Text>
                <Text style={s.metaValue}>{invoiceNumber}</Text>
              </View>
            )}
          </View>

          {/* Right column: items table + totals */}
          <View style={s.invoiceRight}>
            <View style={s.tableHeader}>
              <Text style={[s.thText, s.colDesc]}>{upper(t.description)}</Text>
              <Text style={[s.thText, s.colUnitCost]}>
                {upper(t.unitCost)} {cur}
              </Text>
              <Text style={[s.thText, qtyColumn]}>{upper(t.quantity)}</Text>
              <Text style={[s.thText, s.colAmount]}>
                {upper(t.amount)} {cur}
              </Text>
            </View>

            {items.map((item) => {
              const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
              return (
                <View key={item.id} style={s.tableRow}>
                  <View style={s.colDesc}>
                    <Text style={s.cellText}>{item.name}</Text>
                    {item.unitType !== 'C62' && (
                      <Text style={s.cellSub}>{unitLabel(item.unitType)}</Text>
                    )}
                  </View>
                  <Text style={[s.cellText, s.colUnitCost]}>{fmtAmount(cur, item.unitPrice)}</Text>
                  <Text style={[s.cellText, qtyColumn]}>
                    {formatPDFQuantity(language, item.quantity)}
                  </Text>
                  <Text style={[s.cellText, s.colAmount]}>{fmtAmount(cur, lineTotal)}</Text>
                </View>
              );
            })}

            {/* Subtotals */}
            <View style={s.subtotalArea}>
              {(data.totalDiscount ?? 0) > 0 && (
                <View style={s.subtotalRow}>
                  <Text style={s.subtotalLabel}>{upper(t.discount)}</Text>
                  <Text style={s.subtotalValue}>-{fmtAmount(cur, data.totalDiscount!)}</Text>
                </View>
              )}
              <View style={s.subtotalRow}>
                <Text style={s.subtotalLabel}>{upper(t.subtotal)}</Text>
                <Text style={s.subtotalValue}>{fmtAmount(cur, data.grandTotal)}</Text>
              </View>
              {data.totalVAT > 0 && (
                <View style={s.subtotalRow}>
                  <Text style={s.subtotalLabel}>{upper(t.vat)}</Text>
                  <Text style={s.subtotalValue}>{fmtAmount(cur, data.totalVAT)}</Text>
                </View>
              )}
            </View>

            {/* Grand total */}
            <Text style={s.totalLabel}>{upper(t.invoiceTotal)}</Text>
            <Text style={s.totalValue}>{fmtAmount(cur, data.total)}</Text>
          </View>
        </View>

        {/* ── Bank Account Details ── */}
        {hasBank && (
          <View style={s.bankSection}>
            <Text style={s.bankTitle}>{t.bankAccountDetails}</Text>
            <View style={s.bankColumns}>
              <View style={s.bankCol}>
                {company.bankName ? (
                  <View style={s.bankRow}>
                    <Text style={s.bankLabel}>{t.bankName}</Text>
                    <Text style={s.bankValue}>{company.bankName}</Text>
                  </View>
                ) : null}
                {company.accountHolder ? (
                  <View style={s.bankRow}>
                    <Text style={s.bankLabel}>{t.accountHolder}</Text>
                    <Text style={s.bankValue}>{company.accountHolder}</Text>
                  </View>
                ) : null}
                {company.iban ? (
                  <View style={s.bankRow}>
                    <Text style={s.bankLabel}>{t.iban}</Text>
                    <Text style={s.bankValue}>{company.iban}</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.bankCol}>
                {company.swiftCode ? (
                  <View style={s.bankRow}>
                    <Text style={s.bankLabel}>{t.swiftCode}</Text>
                    <Text style={s.bankValue}>{company.swiftCode}</Text>
                  </View>
                ) : null}
                {company.bankAddress ? (
                  <View style={s.bankRow}>
                    <Text style={s.bankLabel}>{t.bankAddress}</Text>
                    <Text style={s.bankValue}>{company.bankAddress}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* ── Note ── */}
        {note ? (
          <View style={s.noteSection}>
            <Text style={s.noteLabel}>{upper(t.note)}</Text>
            <Text style={s.noteText}>{note}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

// ── Export ──

/**
 * fontkit caches glyphs per loaded font, and subsetting a finished PDF caches
 * the parts of composite glyphs ("ı" in "i", "G" in "Ğ") without their
 * characters. A later PDF on the same font then drops those characters from
 * its text layer (copy, search). So every PDF loads the fonts fresh, and
 * renders run one at a time so a reload never lands mid-render.
 */
function reloadFonts() {
  for (const source of Font.getRegisteredFonts().Inter?.sources ?? []) {
    source.data = null;
    source.loadResultPromise = null;
  }
}

let lastRender: Promise<unknown> = Promise.resolve();

export function renderInvoicePDF(data: InvoicePDFData): Promise<Blob> {
  const render = lastRender.then(() => {
    reloadFonts();
    return pdf(<InvoicePDFDocument data={data} />).toBlob();
  });
  lastRender = render.catch(() => {});
  return render;
}

export async function downloadInvoicePDF(data: InvoicePDFData, filename?: string) {
  const blob = await renderInvoicePDF(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename ??
    buildInvoicePDFFilename({
      companyName: data.company.name,
      date: data.date,
      entityName: data.entityName,
      language: data.language,
      recipientTitle: data.recipient.title,
    });
  document.body.append(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
