// The company details Ayarlar edits and the PDF prints (Firma bilgileri,
// Banka bilgileri): how each field is typed and checked. The MCP tools check
// them the same way.
import {
  isValidEmail,
  isValidSWIFT,
  isValidTCKN,
  isValidTRIBAN,
  isValidVKN,
  normalizeIBAN,
} from './tr-validators.ts';
import type { CompanyInfo } from './types.ts';

/** How a company field is typed and checked. */
export type CompanyFieldKind = 'email' | 'iban' | 'phone' | 'swift' | 'taxID' | 'text' | 'textarea';

export interface CompanyField {
  key: Exclude<keyof CompanyInfo, 'logo' | 'pdfStyle'>;
  kind?: CompanyFieldKind;
  label: string;
  placeholder: string;
}

export const companyFields: Array<CompanyField> = [
  { key: 'name', label: 'Firma adı ya da unvan', placeholder: 'Firma Adı A.Ş.' },
  { key: 'taxID', kind: 'taxID', label: 'VKN / TCKN', placeholder: '1234567890' },
  { key: 'taxOffice', label: 'Vergi dairesi', placeholder: 'Kadıköy' },
  { key: 'address', kind: 'textarea', label: 'Adres', placeholder: 'Tam adres' },
  { key: 'phone', kind: 'phone', label: 'Telefon', placeholder: '+90 532 123 45 67' },
  { key: 'email', kind: 'email', label: 'E-posta', placeholder: 'info@firma.com' },
];

export const bankFields: Array<CompanyField> = [
  { key: 'bankName', label: 'Banka adı', placeholder: 'Ziraat Bankası' },
  { key: 'accountHolder', label: 'Hesap sahibi', placeholder: 'Ad Soyad' },
  { key: 'iban', kind: 'iban', label: 'IBAN', placeholder: 'TR00 0000 0000 0000 0000 0000 00' },
  { key: 'swiftCode', kind: 'swift', label: 'SWIFT kodu', placeholder: 'TCZBTR2AXXX' },
  { key: 'bankAddress', kind: 'textarea', label: 'Banka adresi', placeholder: 'Banka şube adresi' },
];

const PHONE_SHAPE = /^\+90 \d{3} \d{3} \d{2} \d{2}$/;

/** What is wrong with a company field's value, in the user's words. Empty is fine. */
export function companyFieldError(kind: CompanyFieldKind, value: string) {
  const text = value.trim();
  if (!text) {
    return undefined;
  }
  switch (kind) {
    case 'email':
      return isValidEmail(text) ? undefined : 'E-postayı ad@firma.com biçiminde yaz';
    case 'iban':
      if (!/^TR\d{24}$/.test(normalizeIBAN(text))) {
        return 'IBAN, TR ve 24 rakamdan oluşur. Eksik ya da fazla haneyi düzelt.';
      }
      return isValidTRIBAN(text)
        ? undefined
        : 'Bu IBAN’ın kontrol haneleri tutmuyor. Numarayı kontrol et.';
    case 'phone':
      return PHONE_SHAPE.test(text) ? undefined : 'Telefonu +90 532 123 45 67 biçiminde yaz';
    case 'swift':
      return isValidSWIFT(text)
        ? undefined
        : 'SWIFT kodu 8 ya da 11 harf ve rakamdan oluşur. Örnek: TCZBTR2AXXX';
    case 'taxID': {
      const id = text.replaceAll(/\s/g, '');
      if (!/^\d{10,11}$/.test(id)) {
        return 'VKN 10, TCKN 11 haneli olur. Yalnızca rakam yaz.';
      }
      if (id.length === 10) {
        return isValidVKN(id)
          ? undefined
          : 'Bu VKN’nin kontrol hanesi tutmuyor. Numarayı kontrol et.';
      }
      return isValidTCKN(id)
        ? undefined
        : 'Bu TCKN’nin kontrol haneleri tutmuyor. Numarayı kontrol et.';
    }
    default:
      return undefined;
  }
}

/** The value a field keeps once it is left: spaces out of a tax ID, a bare +90 cleared. */
export function normalizeCompanyField(kind: CompanyFieldKind, value: string) {
  switch (kind) {
    case 'email':
      return value.trim();
    case 'phone':
      return /^\+?9?0?\s*$/.test(value) ? '' : value;
    case 'taxID':
      return value.replaceAll(/\s/g, '');
    default:
      return value;
  }
}
