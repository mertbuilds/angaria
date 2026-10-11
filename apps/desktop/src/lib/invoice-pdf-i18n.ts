import { findCountry } from './countries.ts';
import { GIB_UNIT_TYPES } from './gib-constants.ts';
import type { PDFLanguage, PDFStyle } from './types.ts';

export const PDF_LANGUAGES: ReadonlyArray<PDFLanguage> = ['tr', 'en', 'both'];

export const DEFAULT_PDF_LANGUAGE: PDFLanguage = 'en';

export const PDF_STYLES: ReadonlyArray<PDFStyle> = ['minimal', 'classic'];

export const DEFAULT_PDF_STYLE: PDFStyle = 'minimal';

type Locale = 'en' | 'tr';

const LOCALES: Record<Locale, string> = {
  en: 'en-US',
  tr: 'tr-TR',
};

/** Numbers, dates and file names follow Turkish on a Turkish or bilingual PDF. */
const localeOf = (language: PDFLanguage): Locale => (language === 'en' ? 'en' : 'tr');

function isPDFLanguage(value: unknown): value is PDFLanguage {
  return PDF_LANGUAGES.includes(value as PDFLanguage);
}

/** First valid candidate (invoice override, customer default), else the app default */
export function resolvePDFLanguage(...candidates: Array<unknown>): PDFLanguage {
  return candidates.find(isPDFLanguage) ?? DEFAULT_PDF_LANGUAGE;
}

function isPDFStyle(value: unknown): value is PDFStyle {
  return PDF_STYLES.includes(value as PDFStyle);
}

/** First valid candidate (the PDF's own, the company's), else the default */
export function resolvePDFStyle(...candidates: Array<unknown>): PDFStyle {
  return candidates.find(isPDFStyle) ?? DEFAULT_PDF_STYLE;
}

export interface PDFLabels {
  accountHolder: string;
  amount: string;
  bankAddress: string;
  bankDetails: string;
  bankName: string;
  billedTo: string;
  companyNameFallback: string;
  date: string;
  description: string;
  discount: string;
  dueDate: string;
  eArchiveInvoice: string;
  ettn: string;
  exchangeRate: string;
  from: string;
  gibNumber: string;
  iban: string;
  invoice: string;
  invoiceNumber: string;
  note: string;
  quantity: string;
  subtotal: string;
  swiftCode: string;
  taxID: string;
  taxOffice: string;
  total: string;
  totalInTRY: string;
  unitPrice: string;
  vat: string;
}

const TR: PDFLabels = {
  accountHolder: 'Hesap sahibi',
  amount: 'Tutar',
  bankAddress: 'Banka adresi',
  bankDetails: 'Banka bilgileri',
  bankName: 'Banka',
  billedTo: 'Sayın',
  companyNameFallback: 'Firma adı',
  date: 'Tarih',
  description: 'Açıklama',
  discount: 'İndirim',
  dueDate: 'Son ödeme tarihi',
  eArchiveInvoice: 'e-Arşiv fatura',
  ettn: 'ETTN',
  exchangeRate: 'Döviz kuru',
  from: 'Düzenleyen',
  gibNumber: 'GİB no',
  iban: 'IBAN',
  invoice: 'Fatura',
  invoiceNumber: 'Fatura no',
  note: 'Not',
  quantity: 'Miktar',
  subtotal: 'Ara toplam',
  swiftCode: 'SWIFT',
  taxID: 'VKN/TCKN',
  taxOffice: 'Vergi dairesi',
  total: 'Genel toplam',
  totalInTRY: 'Türk lirası karşılığı',
  unitPrice: 'Birim fiyat',
  vat: 'KDV',
};

const EN: PDFLabels = {
  accountHolder: 'Account holder',
  amount: 'Amount',
  bankAddress: 'Bank address',
  bankDetails: 'Bank details',
  bankName: 'Bank',
  billedTo: 'Billed to',
  companyNameFallback: 'Company name',
  date: 'Date',
  description: 'Description',
  discount: 'Discount',
  dueDate: 'Due date',
  eArchiveInvoice: 'e-Archive invoice',
  ettn: 'ETTN',
  exchangeRate: 'Exchange rate',
  from: 'From',
  gibNumber: 'GİB no',
  iban: 'IBAN',
  invoice: 'Invoice',
  invoiceNumber: 'Invoice no.',
  note: 'Note',
  quantity: 'Qty',
  subtotal: 'Subtotal',
  swiftCode: 'SWIFT',
  taxID: 'Tax ID',
  taxOffice: 'Tax office',
  total: 'Total',
  totalInTRY: 'Total in Turkish lira',
  unitPrice: 'Unit price',
  vat: 'VAT',
};

/** Between the Turkish and the English half of a bilingual label */
export const BILINGUAL_SEPARATOR = ' / ';

/** "Fatura / Invoice"; a label both languages share appears once ("IBAN"). */
function bilingual(tr: PDFLabels, en: PDFLabels): PDFLabels {
  const labels = { ...tr };
  for (const key of Object.keys(tr) as Array<keyof PDFLabels>) {
    if (tr[key] !== en[key]) {
      labels[key] = `${tr[key]}${BILINGUAL_SEPARATOR}${en[key]}`;
    }
  }
  return labels;
}

export const PDF_LABELS: Record<PDFLanguage, PDFLabels> = {
  both: bilingual(TR, EN),
  en: EN,
  tr: TR,
};

/**
 * Uppercase with each language's casing rules (Turkish "i" becomes "İ", the
 * English half of a bilingual label keeps "I"). The PDF's
 * `textTransform: 'uppercase'` is locale-blind, so labels are uppercased here.
 */
export function pdfUpper(language: PDFLanguage, text: string): string {
  if (language !== 'both') {
    return text.toLocaleUpperCase(LOCALES[language]);
  }
  const at = text.indexOf(BILINGUAL_SEPARATOR);
  if (at === -1) {
    return text.toLocaleUpperCase(LOCALES.tr);
  }
  const tr = text.slice(0, at).toLocaleUpperCase(LOCALES.tr);
  const en = text.slice(at + BILINGUAL_SEPARATOR.length).toLocaleUpperCase(LOCALES.en);
  return `${tr}${BILINGUAL_SEPARATOR}${en}`;
}

const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Format a GİB date ("dd/MM/yyyy" or "dd-MM-yyyy"): "dd Month yyyy" in English, "dd.MM.yyyy" otherwise */
export function formatPDFDate(language: PDFLanguage, raw: string): string {
  if (!raw) {
    return '';
  }
  const sep = raw.includes('/') ? '/' : '-';
  const [dd, mm, yyyy] = raw.split(sep);
  const monthIdx = Number(mm) - 1;
  if (!dd || !yyyy || !Number.isInteger(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return raw;
  }
  if (localeOf(language) === 'tr') {
    return `${dd.padStart(2, '0')}.${mm.padStart(2, '0')}.${yyyy}`;
  }
  return `${dd} ${EN_MONTHS[monthIdx]} ${yyyy}`;
}

/** Two decimals with the language's grouping: "1,234.56" or "1.234,56" */
export function formatPDFNumber(language: PDFLanguage, n: number, fractionDigits = 2): string {
  return n.toLocaleString(LOCALES[localeOf(language)], {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}

/** An exchange rate with four to six decimals, as GİB's page prints it: "41.2850", "0.309677" */
export function formatPDFRate(language: PDFLanguage, n: number): string {
  return n.toLocaleString(LOCALES[localeOf(language)], {
    maximumFractionDigits: 6,
    minimumFractionDigits: 4,
  });
}

/** Currency code, then the amount with two decimals: "USD 1,234.56" or "USD 1.234,56" */
export function formatPDFAmount(language: PDFLanguage, currency: string, n: number): string {
  return `${currency} ${formatPDFNumber(language, n)}`;
}

export function formatPDFQuantity(language: PDFLanguage, n: number): string {
  return localeOf(language) === 'tr'
    ? n.toLocaleString(LOCALES.tr, { maximumFractionDigits: 20 })
    : String(n);
}

/** A VAT rate: "%20" in Turkish, "20%" in English */
export function formatPDFPercent(language: PDFLanguage, rate: number): string {
  const locale = localeOf(language);
  const value = rate.toLocaleString(LOCALES[locale], { maximumFractionDigits: 2 });
  return locale === 'tr' ? `%${value}` : `${value}%`;
}

/** Spelled-out names for GİB's word units; symbols (kg, m2) print as GİB writes them. */
const UNIT_NAMES: Partial<Record<string, { en: readonly [string, string]; tr: string }>> = {
  ANN: { en: ['year', 'years'], tr: 'yıl' },
  BX: { en: ['box', 'boxes'], tr: 'kutu' },
  D61: { en: ['minute', 'minutes'], tr: 'dakika' },
  D62: { en: ['second', 'seconds'], tr: 'saniye' },
  DAY: { en: ['day', 'days'], tr: 'gün' },
  HUR: { en: ['hour', 'hours'], tr: 'saat' },
  MON: { en: ['month', 'months'], tr: 'ay' },
  PA: { en: ['package', 'packages'], tr: 'paket' },
  PR: { en: ['pair', 'pairs'], tr: 'çift' },
  SET: { en: ['set', 'sets'], tr: 'set' },
};

/** "1,5 saat", "2 hours"; a piece count (C62, Adet) is the bare number. */
export function formatPDFQuantityUnit(
  language: PDFLanguage,
  quantity: number,
  unitType: string,
): string {
  const amount = formatPDFQuantity(language, quantity);
  if (!unitType || unitType === 'C62') {
    return amount;
  }
  const names = UNIT_NAMES[unitType];
  let unit: string;
  if (!names) {
    unit = GIB_UNIT_TYPES.find((type) => type.value === unitType)?.label ?? unitType;
  } else if (localeOf(language) === 'tr') {
    unit = names.tr;
  } else {
    unit = quantity === 1 ? names.en[0] : names.en[1];
  }
  return `${amount} ${unit}`;
}

/**
 * A country by its full name: "Amerika Birleşik Devletleri" (also for GİB's
 * "Amerika Birleşik Dev"), "United States" in English, both on a bilingual PDF
 * (once when they match). A name outside GİB's list prints as it is.
 */
export function formatPDFCountry(language: PDFLanguage, country: string): string {
  const names = findCountry(country);
  if (!names) {
    return country;
  }
  if (language !== 'both') {
    return language === 'en' ? names.en : names.label;
  }
  return names.label === names.en ? names.label : `${names.label}${BILINGUAL_SEPARATOR}${names.en}`;
}

const FILENAME_WORDS: Record<
  Locale,
  { entityFallback: string; prefix: string; recipientFallback: string; undated: string }
> = {
  en: {
    entityFallback: 'company',
    prefix: 'Invoice',
    recipientFallback: 'recipient',
    undated: 'undated',
  },
  tr: {
    entityFallback: 'sirket',
    prefix: 'Fatura',
    recipientFallback: 'alici',
    undated: 'tarihsiz',
  },
};

function sanitizeFilenamePart(value: string | undefined, fallback: string) {
  const withoutControlChars = Array.from(value ?? '')
    .filter((char) => char >= ' ')
    .join('');
  const cleaned = withoutControlChars
    .replaceAll(/[^\p{L}\p{N}]+/gu, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .trim();
  return cleaned || fallback;
}

function formatFilenameDate(date: string, fallback: string) {
  if (!date) {
    return fallback;
  }
  const sep = date.includes('/') ? '/' : date.includes('-') ? '-' : null;
  if (!sep) {
    return sanitizeFilenamePart(date, fallback);
  }
  const [dd, mm, yyyy] = date.split(sep);
  if (!dd || !mm || !yyyy) {
    return sanitizeFilenamePart(date, fallback);
  }
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Angaria's PDF, carrying GİB's number once GİB assigned one, so two invoices
 * to one customer on one day get names of their own:
 * Fatura-2026-03-05-Ana-Varlık-ACME-GmbH-GIB2026000000001.pdf
 */
export function buildInvoicePDFFilename({
  companyName,
  date,
  entityName,
  gibNumber,
  language,
  recipientTitle,
}: {
  companyName: string;
  date: string;
  entityName?: string;
  gibNumber?: string;
  language: PDFLanguage;
  recipientTitle: string;
}) {
  const words = FILENAME_WORDS[localeOf(language)];
  return `${[
    words.prefix,
    formatFilenameDate(date, words.undated),
    sanitizeFilenamePart(entityName || companyName, words.entityFallback),
    sanitizeFilenamePart(recipientTitle, words.recipientFallback),
    gibNumber && sanitizeFilenamePart(gibNumber, ''),
  ]
    .filter(Boolean)
    .join('-')}.pdf`;
}

/**
 * GİB's own copy of an invoice (the e-Arşiv PDF or GİB's zip), named apart
 * from the Angaria PDF and carrying GİB's number:
 * e-Arsiv-Fatura-2026-03-05-Ana-Varlık-ACME-GmbH-GIB2026000000001.pdf
 */
export function buildEArchiveFilename(
  {
    companyName,
    date,
    entityName,
    gibNumber,
    recipientTitle,
  }: {
    companyName: string;
    date: string;
    entityName?: string;
    gibNumber?: string;
    recipientTitle: string;
  },
  extension: 'pdf' | 'zip',
) {
  const words = FILENAME_WORDS.tr;
  return `${[
    'e-Arsiv',
    words.prefix,
    formatFilenameDate(date, words.undated),
    sanitizeFilenamePart(entityName || companyName, words.entityFallback),
    sanitizeFilenamePart(recipientTitle, words.recipientFallback),
    gibNumber && sanitizeFilenamePart(gibNumber, ''),
  ]
    .filter(Boolean)
    .join('-')}.${extension}`;
}
