import type { PDFLanguage } from './types.ts';

export const PDF_LANGUAGES: ReadonlyArray<Exclude<PDFLanguage, 'both'>> = ['tr', 'en'];

export const DEFAULT_PDF_LANGUAGE: PDFLanguage = 'en';

const LOCALES: Record<PDFLanguage, string> = {
  // Until the bilingual layout lands, 'both' prints the English labels and formats.
  both: 'en-US',
  en: 'en-US',
  tr: 'tr-TR',
};

export function isPDFLanguage(value: unknown): value is PDFLanguage {
  return value === 'en' || value === 'tr' || value === 'both';
}

/** First valid candidate (invoice override, customer default), else the app default */
export function resolvePDFLanguage(...candidates: Array<unknown>): PDFLanguage {
  return candidates.find(isPDFLanguage) ?? DEFAULT_PDF_LANGUAGE;
}

export interface PDFLabels {
  accountHolder: string;
  amount: string;
  bankAccountDetails: string;
  bankAddress: string;
  bankName: string;
  billedTo: string;
  companyNameFallback: string;
  description: string;
  discount: string;
  entityFallback: string;
  filenamePrefix: string;
  iban: string;
  invoiceDate: string;
  invoiceNumber: string;
  invoiceTotal: string;
  note: string;
  quantity: string;
  recipientFallback: string;
  subtotal: string;
  swiftCode: string;
  undated: string;
  unitCost: string;
  vat: string;
}

export const PDF_LABELS: Record<Exclude<PDFLanguage, 'both'>, PDFLabels> = {
  en: {
    accountHolder: 'Account Holder',
    amount: 'Amount',
    bankAccountDetails: 'Bank Account Details',
    bankAddress: 'Bank Address',
    bankName: 'Bank Name',
    billedTo: 'Billed To',
    companyNameFallback: 'Company Name',
    description: 'Description',
    discount: 'Discount',
    entityFallback: 'company',
    filenamePrefix: 'Invoice',
    iban: 'IBAN',
    invoiceDate: 'Invoice Date:',
    invoiceNumber: 'Invoice Number',
    invoiceTotal: 'Invoice Total',
    note: 'Note',
    quantity: 'Qty',
    recipientFallback: 'recipient',
    subtotal: 'Subtotal',
    swiftCode: 'Swift Code',
    undated: 'undated',
    unitCost: 'Unit Cost',
    vat: 'VAT',
  },
  tr: {
    accountHolder: 'Hesap Sahibi',
    amount: 'Tutar',
    bankAccountDetails: 'Banka Bilgileri',
    bankAddress: 'Banka Adresi',
    bankName: 'Banka Adı',
    billedTo: 'Sayın',
    companyNameFallback: 'Firma Adı',
    description: 'Açıklama',
    discount: 'İndirim',
    entityFallback: 'sirket',
    filenamePrefix: 'Fatura',
    iban: 'IBAN',
    invoiceDate: 'Fatura Tarihi:',
    invoiceNumber: 'Fatura No',
    invoiceTotal: 'Genel Toplam',
    note: 'Not',
    quantity: 'Miktar',
    recipientFallback: 'alici',
    subtotal: 'Ara Toplam',
    swiftCode: 'SWIFT Kodu',
    undated: 'tarihsiz',
    unitCost: 'Birim Fiyat',
    vat: 'KDV',
  },
};

/**
 * Uppercase with the language's casing rules (Turkish "i" becomes "İ"). The
 * PDF's `textTransform: 'uppercase'` is locale-blind, so Turkish labels under
 * it are uppercased here first.
 */
export function pdfUpper(language: PDFLanguage, text: string): string {
  return text.toLocaleUpperCase(LOCALES[language]);
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

/** Format a GİB date ("dd/MM/yyyy" or "dd-MM-yyyy"): "dd Month yyyy" in English, "dd.MM.yyyy" in Turkish */
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
  if (language === 'tr') {
    return `${dd.padStart(2, '0')}.${mm.padStart(2, '0')}.${yyyy}`;
  }
  return `${dd} ${EN_MONTHS[monthIdx]} ${yyyy}`;
}

/** Currency code, then the amount with two decimals: "USD 1,234.56" or "USD 1.234,56" */
export function formatPDFAmount(language: PDFLanguage, currency: string, n: number): string {
  return `${currency} ${n.toLocaleString(LOCALES[language], {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

export function formatPDFQuantity(language: PDFLanguage, n: number): string {
  return language === 'tr'
    ? n.toLocaleString(LOCALES.tr, { maximumFractionDigits: 20 })
    : String(n);
}

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

export function buildInvoicePDFFilename({
  companyName,
  date,
  entityName,
  language,
  recipientTitle,
}: {
  companyName: string;
  date: string;
  entityName?: string;
  language: PDFLanguage;
  recipientTitle: string;
}) {
  const t = PDF_LABELS[language === 'both' ? 'en' : language];
  const recipientName = sanitizeFilenamePart(recipientTitle, t.recipientFallback);
  const entity = sanitizeFilenamePart(entityName || companyName, t.entityFallback);
  return `${t.filenamePrefix}-${formatFilenameDate(date, t.undated)}-${entity}-${recipientName}.pdf`;
}
