export interface Recipient {
  id: string;
  taxIDOrTRID: string;
  taxOffice: string;
  title: string;
  name: string;
  surname: string;
  fullAddress: string;
  country: string;
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
