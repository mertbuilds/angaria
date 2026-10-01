/** 'both': Turkish and English labels side by side, Turkish first. */
export type PDFLanguage = 'en' | 'tr' | 'both';

/** The PDF's look: 'minimal' (hairlines, no boxes) or 'classic' (bordered boxes). */
export type PDFStyle = 'minimal' | 'classic';

export interface Recipient {
  city: string;
  country: string;
  district: string;
  fullAddress: string;
  id: string;
  name: string;
  /** Default PDF language for this customer; missing means the app default */
  pdfLanguage?: PDFLanguage;
  surname: string;
  taxIDOrTRID: string;
  taxOffice: string;
  title: string;
}

export interface InvoiceSettings {
  currency: string;
  currencyRate: string;
  invoiceType: string;
}

export interface InvoiceItem {
  discountAmount: number;
  discountRate: number;
  discountReason: string;
  gtip: string;
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  // Advanced fields
  unitType: string;
  VATRate: number;
}

export interface AdvancedInvoiceFields {
  /** true once the rate was typed in: the TCMB rate no longer fills it */
  currencyRateManual?: boolean;
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
export type InvoiceSource =
  | { kind: 'invoice'; label: string }
  | { kind: 'template'; name: string; templateId: string };

export interface Credentials {
  password: string;
  testMode: boolean;
  username: string;
}

/**
 * Credentials as persisted with an entity in localStorage. The password lives in
 * the OS keychain; `password` is only present while moving it there failed.
 */
export interface StoredCredentials {
  password?: string;
  testMode: boolean;
  username: string;
}

/** Non-secret view of an entity's credentials for rendering. */
export interface CredentialsInfo {
  hasPassword: boolean;
  testMode: boolean;
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
  invoiceTemplates: Array<InvoiceTemplate>;
  savedItems: Array<InvoiceItem>;
  savedRecipients: Array<Recipient>;
}

export interface Entity extends EntityData {
  id: string;
  name: string;
}

export interface InvoiceTemplate {
  id: string;
  items: Array<InvoiceItem>;
  lastUsedAt?: number;
  name: string;
  note: string;
  recipient: Recipient;
  settings: InvoiceSettings;
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
  /** Onaylanmadı, Onaylandı, Silinmiş */
  onayDurumu?: string;
}
