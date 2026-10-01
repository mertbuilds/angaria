export type PDFLanguage = 'en' | 'tr';

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
  irsaliyeNumarasi: string;
  irsaliyeTarihi: string;
  manualDate: string;
  manualTime: string;
  paymentTotal: string;
}

export interface Credentials {
  password: string;
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
  name: string;
  phone: string;
  swiftCode: string;
  taxID: string;
  taxOffice: string;
}

export interface EntityData {
  companyInfo: CompanyInfo;
  creds: Credentials;
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
