import { roundKurus } from 'angaria-earsiv-sdk';
import { addDays, differenceInCalendarDays } from 'date-fns';
import type { InvoicePDFData } from '@/components/invoice-pdf.tsx';
import type { InvoiceDetails } from './angaria.ts';
import {
  countryError,
  customerDefaults,
  nameError,
  recipientDetails,
  taxIDError,
  type CustomerDefaults,
} from './customer.ts';
import { GIB_CURRENCIES } from './gib-constants.ts';
import { INVOICE_WINDOW_DAYS, ISTISNA_REASONS, SUPPORTED_INVOICE_TYPES } from './regulated.ts';
import type {
  CompanyInfo,
  InvoiceFormValues,
  InvoiceItem,
  PDFLanguage,
  Recipient,
  Service,
} from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

// The invoice form's arithmetic, checks and GİB payload, kept free of React so
// the rules can be tested on their own.

const pad = (n: number) => String(n).padStart(2, '0');

/** Thousands groups: 1 to 3 digits without a leading 0, then groups of 3. */
const GROUPED = {
  ',': /^[1-9]\d{0,2}(?:,\d{3})+$/,
  '.': /^[1-9]\d{0,2}(?:\.\d{3})+$/,
};

/**
 * A typed amount: "1.250,50", "1,234.56", "5.000", "₺1.234,56", "1250.5".
 * Currency signs and spaces are ignored. With both "," and ".", the last one is
 * the decimal separator and the other groups thousands. A comma alone is the
 * decimal separator. Dots alone group thousands when every group after the
 * first has 3 digits ("5.000", "1.250.000"), else a single dot is the decimal
 * point ("5.5", "0.125", "12.50"). Empty is 0; negative or unparsable is null.
 */
export function parseDecimal(text: string): number | null {
  const trimmed = text.replaceAll(/[\s₺$€£]|TL/gi, '');
  if (!trimmed) {
    return 0;
  }
  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');
  let integer = trimmed;
  let fraction = '';
  const at = Math.max(lastComma, lastDot);
  if (lastComma !== -1 && lastDot !== -1) {
    const group = lastComma > lastDot ? '.' : ',';
    integer = trimmed.slice(0, at);
    fraction = trimmed.slice(at + 1);
    if (!GROUPED[group].test(integer)) {
      return null;
    }
    integer = integer.replaceAll(group, '');
  } else if (lastComma === -1 && GROUPED['.'].test(trimmed)) {
    integer = trimmed.replaceAll('.', '');
  } else if (at !== -1) {
    integer = trimmed.slice(0, at);
    fraction = trimmed.slice(at + 1);
  }
  if (!/^\d*$/.test(integer) || !/^\d*$/.test(fraction) || !(integer + fraction)) {
    return null;
  }
  const value = Number(`${integer || '0'}.${fraction || '0'}`);
  return Number.isFinite(value) ? value : null;
}

const decimalFormats = new Map<number, Intl.NumberFormat>();

/**
 * A number as the text an input edits: 1250.5 is "1250,5", without thousands
 * dots, so the caret never jumps while typing. parseDecimal reads it back, as
 * it reads formatAmount's grouped text.
 */
export function formatDecimal(value: number, maximumFractionDigits = 4) {
  let format = decimalFormats.get(maximumFractionDigits);
  if (!format) {
    format = new Intl.NumberFormat('tr-TR', { maximumFractionDigits, useGrouping: false });
    decimalFormats.set(maximumFractionDigits, format);
  }
  return format.format(value);
}

const amountFormat = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 8,
  minimumFractionDigits: 2,
});

/** An amount as a field shows it after editing: 1250.5 is "1.250,50", 33.3333 "33,3333". */
export const formatAmount = (value: number) => amountFormat.format(value);

const rateFormat = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 4,
  minimumFractionDigits: 4,
  useGrouping: false,
});

/** A TCMB rate as the rate field shows it: 41.5 is "41,5000". */
export const formatRate = (rate: number) => rateFormat.format(rate);

/** NaN (an unparsable number field) counts as 0 in totals. */
const finite = (value: number | undefined) => (Number.isFinite(value) ? (value as number) : 0);

export { roundKurus };

/**
 * One row, each amount rounded to kuruş as GİB and the MCP server round it:
 * discounts come off before VAT.
 */
export function lineTotals(item: InvoiceItem) {
  const gross = roundKurus(finite(item.quantity) * finite(item.unitPrice));
  const discount = roundKurus(finite(item.discountAmount));
  const net = roundKurus(gross - discount);
  const vat = roundKurus((net * finite(item.VATRate)) / 100);
  return { discount, gross, net, vat };
}

/** The sums of the rounded rows, so the totals always add up to what GİB prints per row. */
export function invoiceTotals(items: ReadonlyArray<InvoiceItem>) {
  let gross = 0;
  let discount = 0;
  let net = 0;
  let vat = 0;
  for (const item of items) {
    const line = lineTotals(item);
    gross += line.gross;
    discount += line.discount;
    net += line.net;
    vat += line.vat;
  }
  return {
    discount: roundKurus(discount),
    gross: roundKurus(gross),
    net: roundKurus(net),
    total: roundKurus(net + vat),
    vat: roundKurus(vat),
  };
}

/** VAT per rate (0% included when a row has it), highest rate first. */
export function vatByRate(items: ReadonlyArray<InvoiceItem>) {
  const byRate = new Map<number, number>();
  for (const item of items) {
    const rate = finite(item.VATRate);
    byRate.set(rate, (byRate.get(rate) ?? 0) + lineTotals(item).vat);
  }
  return [...byRate]
    .map(([rate, vat]) => ({ rate, vat: roundKurus(vat) }))
    .toSorted((a, b) => b.rate - a.rate);
}

/** Ödenecek tutar: the typed amount, or the invoice total when it is empty. */
export function paymentTotal(values: InvoiceFormValues, total: number) {
  const typed = values.advancedFields.paymentTotal.trim();
  return typed ? (parseDecimal(typed) ?? total) : total;
}

/** The discount for a rate, rounded to kuruş. */
export const discountForRate = (item: InvoiceItem, rate: number) =>
  roundKurus((lineTotals(item).gross * rate) / 100);

/** "HH:mm:ss" for GİB; a time input drops the seconds when they are zero. */
export function normalizeTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
}

const formatTime = (date: Date) =>
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

/** KDV Kanunu 11/1-a: an exempt export carries no KDV. */
export const ISTISNA_VAT_ERROR = 'İstisna faturada KDV oranı %0 olmalı';

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
    fields['recipient.fullAddress'] = 'Adresi yaz';
  }
  const country = countryError(recipient);
  if (country) {
    fields['recipient.country'] = country;
  }

  // Any other type would go to GİB with its own fields empty.
  if (!SUPPORTED_INVOICE_TYPES.includes(invoiceSettings.invoiceType)) {
    fields['invoiceSettings.invoiceType'] =
      'Angaria bu fatura tipini henüz desteklemiyor. Bu faturayı GİB portalından kes.';
  }
  if (invoiceSettings.currency !== 'TRY') {
    const rate = parseDecimal(invoiceSettings.currencyRate);
    if (!invoiceSettings.currencyRate.trim()) {
      fields['invoiceSettings.currencyRate'] = 'Döviz kurunu yaz';
    } else if (rate === null) {
      fields['invoiceSettings.currencyRate'] = 'Döviz kurunu rakamla yaz, örneğin 41,5230';
    } else if (rate <= 0) {
      fields['invoiceSettings.currencyRate'] = 'Döviz kuru sıfırdan büyük olmalı';
    }
  }

  if (isAfterToday(advancedFields.manualDate, today)) {
    fields['advancedFields.manualDate'] = 'Fatura tarihi bugünden sonra olamaz';
  }
  const invoiceDate = parseGIB(advancedFields.manualDate) ?? today;
  const irsaliyeDate = parseGIB(advancedFields.irsaliyeTarihi);
  if (isAfterToday(advancedFields.irsaliyeTarihi, today)) {
    fields['advancedFields.irsaliyeTarihi'] = 'İrsaliye tarihi bugünden sonra olamaz';
  } else if (irsaliyeDate && differenceInCalendarDays(irsaliyeDate, invoiceDate) > 0) {
    fields['advancedFields.irsaliyeTarihi'] = 'İrsaliye tarihi fatura tarihinden sonra olamaz';
  }
  const dueDate = parseGIB(advancedFields.dueDate);
  if (dueDate && differenceInCalendarDays(dueDate, invoiceDate) < 0) {
    fields['advancedFields.dueDate'] = 'Son ödeme tarihi fatura tarihinden önce olamaz';
  }
  if (parseDecimal(advancedFields.paymentTotal) === null) {
    fields['advancedFields.paymentTotal'] = 'Ödenecek tutarı rakamla yaz, örneğin 1.250,50';
  }

  items.forEach((item, index) => {
    const at = (key: keyof InvoiceItem) => `items[${index}].${key}`;
    if (!item.name.trim()) {
      fields[at('name')] = 'Hizmet adını yaz';
    }
    if (!Number.isFinite(item.quantity)) {
      fields[at('quantity')] = 'Miktarı rakamla yaz, örneğin 2 ya da 1,5';
    } else if (item.quantity <= 0) {
      fields[at('quantity')] = 'Miktar sıfırdan büyük olmalı';
    }
    if (!Number.isFinite(item.unitPrice)) {
      fields[at('unitPrice')] = 'Birim fiyatı rakamla yaz, örneğin 1.250,50';
    } else if (item.unitPrice <= 0) {
      fields[at('unitPrice')] = 'Birim fiyat sıfırdan büyük olmalı';
    }
    // GİB takes a whole number: the SDK refuses a fraction.
    if (!Number.isInteger(item.VATRate) || item.VATRate < 0 || item.VATRate > 100) {
      fields[at('VATRate')] = 'KDV oranı 0 ile 100 arasında tam sayı olmalı';
    } else if (invoiceSettings.invoiceType === 'ISTISNA' && item.VATRate > 0) {
      fields[at('VATRate')] = ISTISNA_VAT_ERROR;
    }
    // Rows saved before discounts existed have none.
    const discountRate = item.discountRate ?? 0;
    const discountAmount = item.discountAmount ?? 0;
    if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) {
      fields[at('discountRate')] = 'İskonto oranı 0 ile 100 arasında olmalı';
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      fields[at('discountAmount')] = 'İskonto tutarını rakamla yaz, örneğin 150,00';
    } else if (discountAmount > lineTotals(item).gross) {
      fields[at('discountAmount')] = 'İskonto satır tutarını geçemez';
    }
  });

  return Object.keys(fields).length > 0 ? { fields } : undefined;
}

/** VUK 231/5's warning on an invoice date older than the window. */
export const INVOICE_WINDOW_WARNING = `Bu tarih ${INVOICE_WINDOW_DAYS} günden eski. VUK 231/5'e göre fatura, hizmetten sonraki ${INVOICE_WINDOW_DAYS} gün içinde kesilmeli.`;

/**
 * Rules worth a second look that never block the invoice, keyed by field name
 * like validateInvoice's errors; empty when there are none.
 */
export function invoiceWarnings(values: InvoiceFormValues, today = new Date()) {
  const fields: Record<string, string> = {};
  const invoiceDate = parseGIB(values.advancedFields.manualDate);
  // Angaria does not know the service date, so the rule counts from today.
  if (invoiceDate && differenceInCalendarDays(today, invoiceDate) > INVOICE_WINDOW_DAYS) {
    fields['advancedFields.manualDate'] = INVOICE_WINDOW_WARNING;
  }
  if (values.invoiceSettings.invoiceType === 'SATIS') {
    values.items.forEach((item, index) => {
      if (item.VATRate === 0) {
        fields[`items[${index}].VATRate`] =
          '%0 KDV için fatura tipi İstisna olmalı ya da KDV oranını seç.';
      }
    });
  }
  return fields;
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
    // GİB prints dovzTLkur as sent: four decimals, like TCMB's rate.
    currencyRate: rate ? rate.toFixed(4) : undefined,
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
        discountAmount: line.discount || undefined,
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

const ITEM_NUMBERS = [
  'quantity',
  'unitPrice',
  'VATRate',
  'discountRate',
  'discountAmount',
] as const;

/** Item fields whose text did not parse (NaN), as form field names: "items[0].unitPrice". */
export function unparsableItemFields(items: ReadonlyArray<InvoiceItem>) {
  return items.flatMap((item, index) =>
    // Rows saved before discounts existed have none.
    ITEM_NUMBERS.filter((key) => !Number.isFinite(item[key] ?? 0)).map(
      (key) => `items[${index}].${key}` as const,
    ),
  );
}

/**
 * The PDF of the form as it is; `gibNumber`, `ettn` and `date` once GİB
 * assigned them, `qrValue` once the invoice is signed. Unparsable numbers print
 * as 0: check unparsableItemFields first.
 */
export function toPDFData(
  values: InvoiceFormValues,
  {
    company,
    date,
    entityName,
    ettn,
    gibNumber,
    language,
    now = new Date(),
    qrValue,
  }: {
    company: CompanyInfo;
    date?: string;
    entityName: string;
    ettn?: string;
    gibNumber?: string;
    language: PDFLanguage;
    now?: Date;
    qrValue?: string;
  },
): InvoicePDFData {
  const totals = invoiceTotals(values.items);
  return {
    company,
    date: date || values.advancedFields.manualDate || toGIB(now),
    dueDate: values.advancedFields.dueDate || undefined,
    entityName,
    ettn,
    gibNumber,
    grandTotal: totals.net,
    items: cleanItems(values.items),
    language,
    note: values.note,
    paymentTotal: paymentTotal(values, totals.total),
    qrValue,
    recipient: values.recipient,
    settings: values.invoiceSettings,
    total: totals.total,
    totalDiscount: totals.discount || undefined,
    totalVAT: totals.vat,
  };
}

/**
 * The note with the sentence of the İstisna reason `code` (regulated.ts): it
 * replaces any reason's sentence already in the note, found by its exact text,
 * or goes before the note. Without a known code the sentence is taken out. A
 * sentence the user edited is no longer recognized and stays as typed.
 */
export function istisnaNote(code: string | null | undefined, note: string): string {
  const next = ISTISNA_REASONS.find((reason) => reason.code === code)?.sentence;
  const current = ISTISNA_REASONS.find((reason) => note.includes(reason.sentence))?.sentence;
  if (current) {
    if (next) {
      return note.replace(current, next);
    }
    const at = note.indexOf(current);
    return (note.slice(0, at) + note.slice(at + current.length).trimStart()).trimEnd();
  }
  if (!next) {
    return note;
  }
  return note ? `${next}\n${note}` : next;
}

/**
 * The form for an invoice to `customer`: its details as the recipient, and its
 * defaults (lib/customer.ts customerDefaults) for the currency, invoice type,
 * every row's VAT rate, the PDF language and the due date, counted from the
 * invoice date (empty: `today`) and following it when that date changes
 * (`dueDays`). A new currency starts from its TCMB rate. An
 * İstisna invoice takes the customer's İstisna reason and writes its sentence
 * into the note.
 */
export function applyCustomer(
  values: InvoiceFormValues,
  customer: Recipient,
  today = new Date(),
): InvoiceFormValues {
  const defaults = customerDefaults(customer);
  const { advancedFields, invoiceSettings, items } = values;
  const currency = defaults.currency ?? invoiceSettings.currency;
  const newCurrency = currency !== invoiceSettings.currency;
  const { dueDays, VATRate } = defaults;
  const invoiceDate = parseGIB(advancedFields.manualDate) ?? today;
  const istisnaCode = defaults.invoiceType === 'ISTISNA' ? customer.istisnaCode : undefined;

  return {
    ...values,
    advancedFields: {
      ...advancedFields,
      currencyRateManual: newCurrency ? false : advancedFields.currencyRateManual,
      dueDate:
        dueDays === undefined ? advancedFields.dueDate : toGIB(addDays(invoiceDate, dueDays)),
      dueDays: dueDays ?? advancedFields.dueDays,
    },
    invoiceSettings: {
      currency,
      currencyRate: newCurrency ? '' : invoiceSettings.currencyRate,
      invoiceType: defaults.invoiceType,
      istisnaCode,
    },
    items: VATRate === undefined ? items : items.map((item) => ({ ...item, VATRate })),
    note: istisnaCode ? istisnaNote(istisnaCode, values.note) : values.note,
    recipient: {
      ...recipientDetails(customer),
      id: customer.id,
      pdfLanguage: defaults.pdfLanguage,
    },
  };
}

/**
 * What an invoice dated `date` teaches its customer: currency, invoice type,
 * PDF language, the VAT rate when every row has the same one, the days to its
 * due date when it has one, and the İstisna reason of an İstisna invoice.
 */
export function invoiceDefaults(
  values: InvoiceFormValues,
  { date, pdfLanguage }: { date: string; pdfLanguage: PDFLanguage },
): CustomerDefaults {
  const rates = new Set(values.items.map((item) => item.VATRate));
  const [rate] = rates;
  const invoiceDate = parseGIB(date);
  const dueDate = parseGIB(values.advancedFields.dueDate);
  const dueDays = invoiceDate && dueDate ? differenceInCalendarDays(dueDate, invoiceDate) : -1;
  return {
    currency: values.invoiceSettings.currency,
    dueDays: dueDays >= 0 ? dueDays : undefined,
    invoiceType: values.invoiceSettings.invoiceType,
    istisnaCode:
      values.invoiceSettings.invoiceType === 'ISTISNA'
        ? values.invoiceSettings.istisnaCode
        : undefined,
    pdfLanguage,
    VATRate: rates.size === 1 && Number.isFinite(rate) ? rate : undefined,
  };
}

/**
 * Saved services after an invoice in `currency`. A named row of a new name is
 * added as a service priced in the invoice's currency. A row named like a
 * saved service replaces it (keeping its id) only when its price is in the
 * service's currency, or the service has none yet and takes the invoice's.
 * A row converted from the service's currency, typed over or not, or on an
 * invoice in another currency leaves the service as it is: a picked row says
 * so (pickedFrom), any other counts in the invoice's currency.
 */
export function upsertSavedItems(
  saved: ReadonlyArray<Service>,
  items: ReadonlyArray<InvoiceItem>,
  newId: () => string,
  currency: string,
): Array<Service> {
  const inInvoiceCurrency = (from: string | undefined) => from === undefined || from === currency;
  const next = [...saved];
  for (const { pickedFrom, ...item } of items) {
    const name = item.name.trim();
    if (!name) {
      continue;
    }
    const index = next.findIndex((service) => service.name === name);
    if (index === -1) {
      next.push({ ...item, currency, id: newId(), name });
      continue;
    }
    const service = next[index];
    const picked = pickedFrom?.id === service.id ? pickedFrom : undefined;
    if (
      !picked?.converted &&
      inInvoiceCurrency(picked?.currency) &&
      inInvoiceCurrency(service.currency)
    ) {
      next[index] = { ...item, currency, id: service.id, name };
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

/** Rows with every unparsable number as 0, for saving as services. */
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
