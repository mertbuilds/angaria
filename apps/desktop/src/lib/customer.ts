import { findCountry, fullCountryName } from './countries.ts';
import { resolvePDFLanguage } from './invoice-pdf-i18n.ts';
import { isTaxIDPlaceholder, isValidTCKN, isValidVKN } from './tr-validators.ts';
import type { PDFLanguage, Recipient } from './types.ts';

/** GİB's VKN for every customer abroad. */
export const FOREIGN_TAX_ID = '2222222222';

/** The TCKN GİB takes for a person who does not give theirs. */
export const UNDISCLOSED_TCKN = '11111111111';

/** Days to pay when a customer's Son ödeme tarihi is first switched on. */
export const DEFAULT_DUE_DAYS = 14;

/** A saved customer's invoice defaults (missing: not known yet). */
export type CustomerDefaults = Pick<
  Recipient,
  'currency' | 'dueDays' | 'invoiceType' | 'istisnaCode' | 'pdfLanguage' | 'VATRate'
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
export const nameKey = (name: string) =>
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
 * The saved customer with this VKN / TCKN, whatever its name; never for GİB's
 * placeholders, which many customers share.
 */
export function findCustomerByTaxID(customers: ReadonlyArray<Recipient>, taxID: string) {
  const id = taxID.trim();
  return id && !isTaxIDPlaceholder(id)
    ? (customers.find((customer) => customer.taxIDOrTRID.trim() === id) ?? null)
    : null;
}

/** The most recently invoiced customers first; the others keep their order after them. */
export const byRecentInvoice = (customers: ReadonlyArray<Recipient>) =>
  customers.toSorted((a, b) => (b.lastInvoicedAt ?? '').localeCompare(a.lastInvoicedAt ?? ''));

/**
 * The saved customers after an invoice to `recipient` at `now`: the customer
 * with its VKN / TCKN and name takes the invoice's details, the defaults given
 * (an undefined one keeps the saved value) and the invoice time
 * (`lastInvoicedAt`), or is added (`added`).
 */
export function learnCustomer(
  customers: ReadonlyArray<Recipient>,
  recipient: Recipient,
  defaults: CustomerDefaults,
  newId: () => string,
  now = new Date(),
): { added: boolean; customers: Array<Recipient> } {
  const known = Object.entries(defaults).filter(([, value]) => value !== undefined);
  const learned = {
    ...recipientDetails(recipient),
    ...Object.fromEntries(known),
    country: fullCountryName(recipient.country),
    lastInvoicedAt: now.toISOString(),
  };
  const saved = findCustomer(customers, recipient.taxIDOrTRID, customerName(recipient));
  if (!saved) {
    return { added: true, customers: [...customers, { ...learned, id: newId() }] };
  }
  return {
    added: false,
    customers: customers.map((customer) =>
      customer.id === saved.id
        ? { ...customer, ...learned, country: keptCountry(customer.country, learned.country) }
        : customer,
    ),
  };
}

/**
 * The saved country after an invoice names `country`: a name GİB cut short of
 * the saved one never replaces it, while another country in GİB's list does.
 */
const keptCountry = (saved: string, country: string) =>
  country && !findCountry(country) && saved.startsWith(country) ? saved : country;

/** A customer saved with GİB's cut country name, by the full name when one country fits. */
export function withFullCountry<Customer extends Pick<Recipient, 'country'>>(customer: Customer) {
  if (!customer.country) {
    return customer;
  }
  const country = fullCountryName(customer.country);
  return country === customer.country ? customer : { ...customer, country };
}

/** Spaces, dots and dashes removed: a pasted "123 456 78 90" is 1234567890. */
export const normalizeTaxID = (text: string) => text.replaceAll(/[\s.-]/g, '');

/**
 * What a VKN / TCKN is: GİB's number for a customer abroad, a placeholder for
 * a person who gives no TCKN, or a VKN or TCKN whose check digits hold. Null
 * while it is none of them.
 */
export type TaxIDKind = 'foreign' | 'tckn' | 'undisclosed' | 'vkn';

export function taxIDKind(value: string): TaxIDKind | null {
  const id = value.trim();
  if (id === FOREIGN_TAX_ID) {
    return 'foreign';
  }
  if (isTaxIDPlaceholder(id)) {
    return 'undisclosed';
  }
  if (isValidVKN(id)) {
    return 'vkn';
  }
  return isValidTCKN(id) ? 'tckn' : null;
}

/**
 * VKN is 10 digits, TCKN 11, each with its check digits; GİB's placeholders
 * pass as they are. The problem with `value` in Turkish, or null.
 */
export function taxIDError(value: string) {
  const id = value.trim();
  if (!id) {
    return 'VKN ya da TCKN yaz';
  }
  if (!/^\d+$/.test(id)) {
    return 'VKN ya da TCKN’yi yalnızca rakamla yaz';
  }
  if (id.length !== 10 && id.length !== 11) {
    return 'VKN 10, TCKN 11 haneli olur';
  }
  if (taxIDKind(id)) {
    return null;
  }
  if (id.length === 10) {
    return 'Bu VKN’nin kontrol hanesi tutmuyor. Numarayı kontrol et.';
  }
  return id.startsWith('0')
    ? 'TCKN 0 ile başlamaz. Numarayı kontrol et.'
    : 'Bu TCKN’nin kontrol haneleri tutmuyor. Numarayı kontrol et.';
}

/** GİB needs an unvan, or a first and last name for a person. */
export function nameError(customer: Pick<Recipient, 'name' | 'surname' | 'title'>) {
  const name = customer.name.trim();
  const surname = customer.surname.trim();
  if (customer.title.trim() || (name && surname)) {
    return null;
  }
  if (name) {
    return 'Kişiyse soyadı da yaz, şirketse unvanı yaz';
  }
  return surname ? 'Kişiyse adı da yaz, şirketse unvanı yaz' : 'Unvanı ya da adı ve soyadı yaz';
}

/** A customer abroad (GİB's foreign VKN) needs its country, and not Türkiye. */
export function countryError(customer: Pick<Recipient, 'country' | 'taxIDOrTRID'>) {
  if (customer.taxIDOrTRID.trim() !== FOREIGN_TAX_ID) {
    return null;
  }
  if (!customer.country.trim()) {
    return 'Yurt dışındaki müşterinin ülkesini seç';
  }
  return customer.country === 'Türkiye'
    ? 'Yurt dışı müşteri için Türkiye dışında bir ülke seç'
    : null;
}
