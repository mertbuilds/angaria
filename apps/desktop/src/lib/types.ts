/** A PDF's language: Turkish, English, or both side by side. */
export type PDFLanguage = 'en' | 'tr' | 'both';

/** The PDF's look: 'minimal' (hairlines, no boxes) or 'classic' (bordered boxes). */
export type PDFStyle = 'minimal' | 'classic';

/**
 * An invoice's recipient, and a saved customer. The optional fields are a
 * saved customer's invoice defaults, learned from each invoice; missing ones
 * follow from where the customer is (lib/customer.ts). On the invoice form only
 * `pdfLanguage` is used, as that invoice's PDF language.
 */
export interface Recipient {
  city: string;
  country: string;
  currency?: string;
  district: string;
  /** Payment is due this many days after the invoice date (Son ödeme tarihi). */
  dueDays?: number;
  fullAddress: string;
  id: string;
  invoiceType?: string;
  /** İstisna reason code (301, 302, 350) of the customer's İstisna invoices. */
  istisnaCode?: string;
  /** When the last invoice to this customer was created, ISO 8601. */
  lastInvoicedAt?: string;
  name: string;
  pdfLanguage?: PDFLanguage;
  surname: string;
  taxIDOrTRID: string;
  taxOffice: string;
  title: string;
  VATRate?: number;
}

export interface InvoiceSettings {
  currency: string;
  currencyRate: string;
  invoiceType: string;
  /** İstisna reason code (301, 302, 350) when the type is İstisna. */
  istisnaCode?: string;
}

export interface InvoiceItem {
  discountAmount: number;
  discountRate: number;
  discountReason: string;
  gtip: string;
  id: string;
  name: string;
  /** The saved service the row was picked from on Yeni fatura; never sent to GİB. */
  pickedFrom?: PickedService;
  quantity: number;
  unitPrice: number;
  // Advanced fields
  unitType: string;
  VATRate: number;
}

/**
 * A row's saved service: its id, the currency of its price when picked (none
 * for one saved before services had a currency), and whether that price was
 * converted into the invoice's. Only a row in the service's own currency
 * updates the service (upsertSavedItems).
 */
export interface PickedService {
  converted: boolean;
  currency?: string;
  id: string;
}

/**
 * A saved service (Hizmetler): an invoice line and the currency of its price,
 * an ISO code from the invoice's currency list. One saved before services had
 * a currency has none: its price counts in the invoice's currency.
 */
export interface Service extends Omit<InvoiceItem, 'pickedFrom'> {
  currency?: string;
}

export interface AdvancedInvoiceFields {
  /** true once the rate was typed in: the TCMB rate no longer fills it */
  currencyRateManual?: boolean;
  /** Son ödeme tarihi, dd/MM/yyyy or empty. PDF only: GİB has no such field. */
  dueDate: string;
  /** Set by a due-date preset: the due date follows the invoice date by this many days. */
  dueDays?: number;
  irsaliyeNumarasi: string;
  irsaliyeTarihi: string;
  manualDate: string;
  manualTime: string;
  paymentTotal: string;
}

/** The invoice form: everything one GİB draft is made from. */
export interface InvoiceFormValues {
  advancedFields: AdvancedInvoiceFields;
  invoiceSettings: InvoiceSettings;
  items: Array<InvoiceItem>;
  note: string;
  recipient: Recipient;
}

/** What filled the invoice form; null for a blank form. */
export type InvoiceSource = { kind: 'invoice'; label: string };

export interface Credentials {
  password: string;
  username: string;
}

/**
 * Credentials as persisted with an entity in localStorage. The password lives in
 * the OS keychain; `password` is only present while moving it there failed.
 */
export interface StoredCredentials {
  password?: string;
  username: string;
}

/** Non-secret view of an entity's credentials for rendering. */
export interface CredentialsInfo {
  hasPassword: boolean;
  username: string;
}

export interface CompanyInfo {
  accountHolder: string;
  address: string;
  bankAddress: string;
  bankName: string;
  email: string;
  iban: string;
  /** PNG data URL shown at the top of the PDF; the name stands in without one */
  logo?: string;
  name: string;
  /** Missing means the default style */
  pdfStyle?: PDFStyle;
  phone: string;
  swiftCode: string;
  taxID: string;
  taxOffice: string;
}

export interface EntityData {
  companyInfo: CompanyInfo;
  creds: StoredCredentials;
  /** true once the import from past invoices was offered, after the company's first GİB login. */
  importOffered?: boolean;
  savedItems: Array<Service>;
  savedRecipients: Array<Recipient>;
}

export interface Entity extends EntityData {
  id: string;
  name: string;
}

/** A row of GİB's document list (EARSIV_PORTAL_TASLAKLARI_GETIR). */
export interface Invoice {
  aliciUnvanAdSoyad?: string;
  aliciVknTckn?: string;
  belgeNumarasi?: string;
  /** dd-MM-yyyy */
  belgeTarihi?: string;
  belgeTuru?: string;
  ettn?: string;
  /** A cancellation request's kind: 0 cancellation, 1 objection (see invoiceStatus) */
  iptalItiraz?: number | string;
  /** A cancellation request's state: 0 waiting, 1 accepted, 2 rejected */
  iptalItirazDurumu?: number | string;
  /** Onaylanmadı, Onaylandı (cancelled ones too), Silinmiş */
  onayDurumu?: string;
}
