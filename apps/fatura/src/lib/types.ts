export interface Recipient {
  id: string;
  taxIDOrTRID: string;
  taxOffice: string;
  title: string;
  name: string;
  surname: string;
  fullAddress: string;
  country: string;
  city: string;
  district: string;
}

export interface InvoiceSettings {
  currency: string;
  currencyRate: string;
  invoiceType: string;
}

export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  VATRate: number;
  // Advanced fields
  unitType: string;
  discountRate: number;
  discountAmount: number;
  discountReason: string;
  gtip: string;
}

export interface AdvancedInvoiceFields {
  manualDate: string;
  manualTime: string;
  irsaliyeNumarasi: string;
  irsaliyeTarihi: string;
  paymentTotal: string;
}

export interface Credentials {
  username: string;
  password: string;
  testMode: boolean;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  recipient: Recipient;
  settings: InvoiceSettings;
  items: InvoiceItem[];
  note: string;
}
