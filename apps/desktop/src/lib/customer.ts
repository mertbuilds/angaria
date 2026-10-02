import { resolvePDFLanguage } from './invoice-pdf-i18n.ts';
import type { PDFLanguage, Recipient } from './types.ts';

/** GİB's VKN for every customer abroad. */
export const FOREIGN_TAX_ID = '2222222222';

/** Days to pay when a customer's Son ödeme tarihi is first switched on. */
export const DEFAULT_DUE_DAYS = 14;

/** A saved customer's invoice defaults (missing: not known yet). */
export type CustomerDefaults = Pick<
  Recipient,
  'currency' | 'dueDays' | 'invoiceType' | 'pdfLanguage' | 'VATRate'
>;

/** Unvan, else "Ad Soyad"; empty when neither is filled. */
export function customerName(customer: Pick<Recipient, 'name' | 'surname' | 'title'>) {
  return (
    customer.title.trim() ||
    [customer.name.trim(), customer.surname.trim()].filter(Boolean).join(' ')
  );
}

/** Abroad: GİB's foreign VKN, or a country other than Türkiye. */
export function isForeignCustomer(customer: Pick<Recipient, 'country' | 'taxIDOrTRID'>) {
  const country = customer.country.trim();
  return (
    customer.taxIDOrTRID.trim() === FOREIGN_TAX_ID || (country !== '' && country !== 'Türkiye')
  );
}

/** The customer's PDF language, else English abroad and Turkish at home. */
export const defaultPDFLanguage = (
  customer: Pick<Recipient, 'country' | 'pdfLanguage' | 'taxIDOrTRID'>,
): PDFLanguage =>
  resolvePDFLanguage(customer.pdfLanguage, isForeignCustomer(customer) ? 'en' : 'tr');

/**
 * What a new invoice for `customer` starts with: its saved defaults, else by
 * where it is. Abroad: İstisna, the currency it was last invoiced in (none
 * known: the form keeps its own), an English PDF. In Türkiye: Satış, lira, a
 * Turkish PDF. No VAT rate and no due date unless saved.
 */
export function customerDefaults(
  customer: Recipient,
): CustomerDefaults & { invoiceType: string; pdfLanguage: PDFLanguage } {
  const foreign = isForeignCustomer(customer);
  return {
    currency: customer.currency || (foreign ? undefined : 'TRY'),
    dueDays: customer.dueDays,
    invoiceType: customer.invoiceType || (foreign ? 'ISTISNA' : 'SATIS'),
    pdfLanguage: defaultPDFLanguage(customer),
    VATRate: customer.VATRate,
  };
}

/** The name, tax and address fields: what an invoice prints of its recipient. */
export const recipientDetails = ({
  city,
  country,
  district,
  fullAddress,
  name,
  surname,
  taxIDOrTRID,
  taxOffice,
  title,
}: Recipient) => ({
  city,
  country,
  district,
  fullAddress,
  name,
  surname,
  taxIDOrTRID: taxIDOrTRID.trim(),
  taxOffice,
  title,
});

// Turkish capitals, with İ as I: "Plastic" and "PLASTIC" are one name.
const nameKey = (name: string) =>
  name.trim().replaceAll(/\s+/g, ' ').toLocaleUpperCase('tr').replaceAll('İ', 'I');

/**
 * The saved customer with this VKN / TCKN and name (unvan, else "Ad Soyad"),
 * if any. The name counts too: every customer abroad has VKN 2222222222.
 */
export function findCustomer(customers: ReadonlyArray<Recipient>, taxID: string, name: string) {
  const id = taxID.trim();
  const key = nameKey(name);
  return id
    ? (customers.find(
        (customer) => customer.taxIDOrTRID.trim() === id && nameKey(customerName(customer)) === key,
      ) ?? null)
    : null;
}

/**
 * The saved customers after an invoice to `recipient`: the customer with its
 * VKN / TCKN and name takes the invoice's details and the defaults given
 * (an undefined one keeps the saved value), or is added (`added`).
 */
export function learnCustomer(
  customers: ReadonlyArray<Recipient>,
  recipient: Recipient,
  defaults: CustomerDefaults,
  newId: () => string,
): { added: boolean; customers: Array<Recipient> } {
  const known = Object.entries(defaults).filter(([, value]) => value !== undefined);
  const learned = { ...recipientDetails(recipient), ...Object.fromEntries(known) };
  const saved = findCustomer(customers, recipient.taxIDOrTRID, customerName(recipient));
  if (!saved) {
    return { added: true, customers: [...customers, { ...learned, id: newId() }] };
  }
  return {
    added: false,
    customers: customers.map((customer) =>
      customer.id === saved.id ? { ...customer, ...learned } : customer,
    ),
  };
}

/** VKN is 10 digits, TCKN 11. The problem with `value` in Turkish, or null. */
export function taxIDError(value: string) {
  const digits = value.trim();
  if (!digits) {
    return 'VKN ya da TCKN gerekli';
  }
  if (!/^\d+$/.test(digits)) {
    return 'Yalnızca rakam gir';
  }
  if (digits.length !== 10 && digits.length !== 11) {
    return 'VKN 10, TCKN 11 hane olmalı';
  }
  return null;
}

/** GİB needs an unvan, or a first and last name for a person. */
export function nameError(customer: Recipient) {
  return customer.title.trim() || (customer.name.trim() && customer.surname.trim())
    ? null
    : 'Unvan ya da ad ve soyad gerekli';
}
