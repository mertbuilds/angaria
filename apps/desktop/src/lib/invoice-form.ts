import type { InvoicePDFData } from '@/components/invoice-pdf.tsx';
import type { InvoiceDetails } from './angaria.ts';
import { nameError, taxIDError } from './customer.ts';
import { GIB_CURRENCIES } from './gib-constants.ts';
import type {
  CompanyInfo,
  InvoiceFormValues,
  InvoiceItem,
  InvoiceTemplate,
  PDFLanguage,
  Recipient,
} from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

// The invoice form's arithmetic, checks and GİB payload, kept free of React so
// the rules can be tested on their own.

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "1.250,5" (Turkish) or "1250.5": with a comma, dots group thousands; without
 * one, a dot is the decimal point. Empty is 0, anything else unparsable null.
 */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replaceAll(' ', '');
  if (!trimmed) {
    return 0;
  }
  const normalized = trimmed.includes(',')
    ? trimmed.replaceAll('.', '').replace(',', '.')
    : trimmed;
  if (!/^\d*\.?\d*$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const decimalFormats = new Map<number, Intl.NumberFormat>();

/** A number as Turkish input text: 1250.5 is "1.250,5". */
export function formatDecimal(value: number, maximumFractionDigits = 4) {
  let format = decimalFormats.get(maximumFractionDigits);
  if (!format) {
    format = new Intl.NumberFormat('tr-TR', { maximumFractionDigits });
    decimalFormats.set(maximumFractionDigits, format);
  }
  return format.format(value);
}

const rateFormat = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 4,
  minimumFractionDigits: 4,
  useGrouping: false,
});

/** A TCMB rate as the rate field shows it: 41.5 is "41,5000". */
export const formatRate = (rate: number) => rateFormat.format(rate);

/** NaN (an unparsable number field) counts as 0 in totals. */
const finite = (value: number | undefined) => (Number.isFinite(value) ? (value as number) : 0);

/** One row: discounts come off before VAT, as on GİB. */
export function lineTotals(item: InvoiceItem) {
  const gross = finite(item.quantity) * finite(item.unitPrice);
  const discount = finite(item.discountAmount);
  const net = gross - discount;
  const vat = net * (finite(item.VATRate) / 100);
  return { discount, gross, net, vat };
}

export function invoiceTotals(items: ReadonlyArray<InvoiceItem>) {
  let gross = 0;
  let discount = 0;
  let vat = 0;
  for (const item of items) {
    const line = lineTotals(item);
    gross += line.gross;
    discount += line.discount;
    vat += line.vat;
  }
  const net = gross - discount;
  return { discount, gross, net, total: net + vat, vat };
}

/** Ödenecek tutar: the typed amount, or the invoice total when it is empty. */
export function paymentTotal(values: InvoiceFormValues, total: number) {
  const typed = values.advancedFields.paymentTotal.trim();
  return typed ? (parseDecimal(typed) ?? total) : total;
}

/** The discount for a rate, rounded to kuruş. */
export const discountForRate = (item: InvoiceItem, rate: number) =>
  Math.round(lineTotals(item).gross * rate) / 100;

/** "30/09/2026" (or "30-09-2026") as a date input value, "2026-09-30". */
export function gibToInputDate(value: string) {
  const date = parseGIB(value);
  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '';
}

/** A date input value, "2026-09-30", as GİB's "30/09/2026". */
export function inputDateToGIB(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

/** "HH:mm:ss" for GİB; a time input drops the seconds when they are zero. */
export function normalizeTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
}

export const formatTime = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

function isAfterToday(gibDate: string, today: Date) {
  const date = parseGIB(gibDate);
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return date !== undefined && date >= endOfToday;
}

/** Common currencies first, then GİB's list. */
const PINNED_CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];

export const CURRENCY_OPTIONS = [
  ...PINNED_CURRENCIES.flatMap(
    (code) => GIB_CURRENCIES.find((currency) => currency.value === code) ?? [],
  ),
  ...GIB_CURRENCIES.filter((currency) => !PINNED_CURRENCIES.includes(currency.value)),
].map((currency) => ({ label: `${currency.value} · ${currency.label}`, value: currency.value }));

/**
 * Field errors in Turkish, keyed by field name (TanStack Form's form-level
 * validator shape), or undefined when the invoice can go to GİB.
 */
export function validateInvoice(values: InvoiceFormValues, today = new Date()) {
  const fields: Record<string, string> = {};
  const { advancedFields, invoiceSettings, items, recipient } = values;

  const taxID = taxIDError(recipient.taxIDOrTRID);
  if (taxID) {
    fields['recipient.taxIDOrTRID'] = taxID;
  }
  const name = nameError(recipient);
  if (name) {
    fields['recipient.title'] = name;
  }
  if (!recipient.fullAddress.trim()) {
    fields['recipient.fullAddress'] = 'Adres gerekli';
  }

  if (invoiceSettings.currency !== 'TRY') {
    const rate = parseDecimal(invoiceSettings.currencyRate);
    if (!invoiceSettings.currencyRate.trim()) {
      fields['invoiceSettings.currencyRate'] = 'Döviz kuru gerekli';
    } else if (rate === null || rate <= 0) {
      fields['invoiceSettings.currencyRate'] = 'Geçerli bir kur girin';
    }
  }

  if (isAfterToday(advancedFields.manualDate, today)) {
    fields['advancedFields.manualDate'] = 'Fatura tarihi bugünden sonra olamaz';
  }
  if (isAfterToday(advancedFields.irsaliyeTarihi, today)) {
    fields['advancedFields.irsaliyeTarihi'] = 'İrsaliye tarihi bugünden sonra olamaz';
  }
  if (parseDecimal(advancedFields.paymentTotal) === null) {
    fields['advancedFields.paymentTotal'] = 'Geçerli bir tutar girin';
  }

  items.forEach((item, index) => {
    const at = (key: keyof InvoiceItem) => `items[${index}].${key}`;
    if (!item.name.trim()) {
      fields[at('name')] = 'Kalem adı gerekli';
    }
    if (!Number.isFinite(item.quantity)) {
      fields[at('quantity')] = 'Geçerli bir sayı girin';
    } else if (item.quantity <= 0) {
      fields[at('quantity')] = 'Miktar sıfırdan büyük olmalı';
    }
    if (!Number.isFinite(item.unitPrice)) {
      fields[at('unitPrice')] = 'Geçerli bir tutar girin';
    } else if (item.unitPrice <= 0) {
      fields[at('unitPrice')] = 'Birim fiyat sıfırdan büyük olmalı';
    }
    if (!Number.isFinite(item.VATRate) || item.VATRate < 0 || item.VATRate > 100) {
      fields[at('VATRate')] = 'KDV oranı 0 ile 100 arasında olmalı';
    }
    // Rows saved before discounts existed have none.
    const discountRate = item.discountRate ?? 0;
    const discountAmount = item.discountAmount ?? 0;
    if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) {
      fields[at('discountRate')] = 'İskonto oranı 0 ile 100 arasında olmalı';
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      fields[at('discountAmount')] = 'Geçerli bir tutar girin';
    } else if (discountAmount > lineTotals(item).gross) {
      fields[at('discountAmount')] = 'İskonto satır tutarını geçemez';
    }
  });

  return Object.keys(fields).length > 0 ? { fields } : undefined;
}

/** The createDraftInvoice payload. Date and time default to `now`. */
export function toDraftDetails(values: InvoiceFormValues, now = new Date()): InvoiceDetails {
  const { advancedFields, invoiceSettings, items, note, recipient } = values;
  const totals = invoiceTotals(items);
  const rate =
    invoiceSettings.currency === 'TRY' ? null : parseDecimal(invoiceSettings.currencyRate);

  return {
    date: advancedFields.manualDate || toGIB(now),
    time: normalizeTime(advancedFields.manualTime) || formatTime(now),
    currency: invoiceSettings.currency,
    currencyRate: rate ? String(rate) : undefined,
    invoiceType: invoiceSettings.invoiceType,
    taxIDOrTRID: recipient.taxIDOrTRID.trim(),
    taxOffice: recipient.taxOffice,
    title: recipient.title,
    name: recipient.name,
    surname: recipient.surname,
    fullAddress: recipient.fullAddress,
    country: recipient.country || undefined,
    city: recipient.city || undefined,
    district: recipient.district || undefined,
    items: items.map((item) => {
      const line = lineTotals(item);
      return {
        name: item.name.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        price: line.gross,
        unitType: item.unitType || 'C62',
        VATRate: item.VATRate,
        VATAmount: line.vat,
        discountRate: item.discountRate || undefined,
        discountAmount: item.discountAmount || undefined,
        discountReason: item.discountReason || undefined,
        gtip: item.gtip || undefined,
      };
    }),
    grandTotal: totals.net,
    totalVAT: totals.vat,
    grandTotalInclVAT: totals.total,
    paymentTotal: paymentTotal(values, totals.total),
    totalDiscount: totals.discount || undefined,
    irsaliyeNumarasi: advancedFields.irsaliyeNumarasi || undefined,
    irsaliyeTarihi: advancedFields.irsaliyeTarihi || undefined,
    note,
  };
}

/** The PDF of the form as it is; `invoiceNumber` once GİB assigned one. */
export function toPDFData(
  values: InvoiceFormValues,
  {
    company,
    entityName,
    invoiceNumber,
    language,
    now = new Date(),
  }: {
    company: CompanyInfo;
    entityName: string;
    invoiceNumber?: string;
    language: PDFLanguage;
    now?: Date;
  },
): InvoicePDFData {
  const totals = invoiceTotals(values.items);
  return {
    company,
    date: values.advancedFields.manualDate || toGIB(now),
    entityName,
    grandTotal: totals.net,
    invoiceNumber,
    items: values.items,
    language,
    note: values.note,
    paymentTotal: paymentTotal(values, totals.total),
    recipient: values.recipient,
    settings: values.invoiceSettings,
    total: totals.total,
    totalDiscount: totals.discount || undefined,
    totalVAT: totals.vat,
  };
}

/** true when the form still holds what the template filled in. */
export function matchesTemplate(values: InvoiceFormValues, template: InvoiceTemplate) {
  const { invoiceSettings, items, note, recipient } = values;
  return (
    template.recipient.taxIDOrTRID === recipient.taxIDOrTRID &&
    template.recipient.title === recipient.title &&
    template.recipient.fullAddress === recipient.fullAddress &&
    template.settings.currency === invoiceSettings.currency &&
    template.settings.invoiceType === invoiceSettings.invoiceType &&
    template.note === note &&
    template.items.length === items.length &&
    template.items.every((saved, index) => {
      const item = items[index];
      return (
        saved.name === item.name &&
        saved.quantity === item.quantity &&
        saved.unitPrice === item.unitPrice &&
        saved.VATRate === item.VATRate
      );
    })
  );
}

/**
 * Item templates after an invoice: each named row replaces the template of the
 * same name (keeping its id) or is added as a new one.
 */
export function upsertSavedItems(
  saved: ReadonlyArray<InvoiceItem>,
  items: ReadonlyArray<InvoiceItem>,
  newId: () => string,
): Array<InvoiceItem> {
  const next = [...saved];
  for (const item of items) {
    const name = item.name.trim();
    if (!name) {
      continue;
    }
    const index = next.findIndex((template) => template.name === name);
    if (index === -1) {
      next.push({ ...item, id: newId(), name });
    } else {
      next[index] = { ...item, id: next[index].id, name };
    }
  }
  return next;
}

/** true when nothing was entered yet: no recipient, no named or priced row, no note. */
export function isBlankForm(values: InvoiceFormValues) {
  const { items, note, recipient } = values;
  return (
    ![
      recipient.taxIDOrTRID,
      recipient.title,
      recipient.name,
      recipient.surname,
      recipient.fullAddress,
    ]
      .join('')
      .trim() &&
    !note.trim() &&
    items.every((item) => !item.name.trim() && !finite(item.unitPrice))
  );
}

/** Rows with every unparsable number as 0, for saving as templates. */
export const cleanItems = (items: ReadonlyArray<InvoiceItem>): Array<InvoiceItem> =>
  items.map((item) => ({
    ...item,
    discountAmount: finite(item.discountAmount),
    discountRate: finite(item.discountRate),
    quantity: finite(item.quantity),
    unitPrice: finite(item.unitPrice),
    VATRate: finite(item.VATRate),
  }));

/** true when two forms make the same invoice; the PDF language does not count. */
export function sameInvoice(a: InvoiceFormValues, b: InvoiceFormValues) {
  if (
    a.items !== b.items ||
    a.invoiceSettings !== b.invoiceSettings ||
    a.note !== b.note ||
    a.advancedFields !== b.advancedFields
  ) {
    return false;
  }
  const keys = new Set([...Object.keys(a.recipient), ...Object.keys(b.recipient)]);
  return [...keys].every(
    (key) =>
      key === 'pdfLanguage' ||
      a.recipient[key as keyof Recipient] === b.recipient[key as keyof Recipient],
  );
}
