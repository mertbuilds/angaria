import { toast } from '@angaria/ui';
import type { Dispatch, SetStateAction } from 'react';
import type { CompanyInfo, Credentials, Recipient } from '@/lib/types.ts';

// Dev only: sample data for testing against the GİB emulator fast. Loaded
// with a dynamic import behind import.meta.env.DEV, so it never ships. Only
// empty fields are filled: whatever was typed stays.

/** The emulator's demo user (packages/gib-emulator). */
export const EMULATOR_LOGIN: Credentials = { password: '1', username: '33333301' };

/** A freelancer's company, like the emulator's Deniz Yılmaz; every ID passes its check. */
export const SAMPLE_COMPANY: Omit<CompanyInfo, 'logo' | 'pdfStyle'> = {
  accountHolder: 'Deniz Yılmaz',
  address: 'Moda Cad. No:12 D:4\nKadıköy / İstanbul',
  bankAddress: 'Kadıköy Şubesi, İstanbul',
  bankName: 'İş Bankası',
  email: 'deniz@example.com',
  iban: 'TR51 0006 4000 0012 3456 7890 12',
  name: 'Deniz Yılmaz Yazılım',
  phone: '+90 532 123 45 67',
  swiftCode: 'ISBKTRIS',
  taxID: '10000000146',
  taxOffice: 'Kadıköy',
};

/** A foreign USD customer and a Turkish lira one, for a new invoice right away. */
export const sampleCustomers = (newId: () => string): Array<Recipient> => [
  {
    city: 'New York',
    country: 'Amerika Birleşik Devletleri',
    currency: 'USD',
    district: '',
    fullAddress: '350 Fifth Avenue\nNew York, NY 10118',
    id: newId(),
    invoiceType: 'ISTISNA',
    istisnaCode: '302',
    name: '',
    pdfLanguage: 'en',
    surname: '',
    taxIDOrTRID: '2222222222',
    taxOffice: '',
    title: 'NORTHWIND TRADERS LLC',
    VATRate: 0,
  },
  {
    city: 'İstanbul',
    country: 'Türkiye',
    currency: 'TRY',
    district: 'Kadıköy',
    fullAddress: 'Bağdat Cad. No:123',
    id: newId(),
    invoiceType: 'SATIS',
    name: '',
    pdfLanguage: 'tr',
    surname: '',
    taxIDOrTRID: '1234567890',
    taxOffice: 'Kadıköy',
    title: 'ÖRNEK TEKNOLOJİ A.Ş.',
    VATRate: 20,
  },
];

const sampleKeys = Object.keys(SAMPLE_COMPANY) as Array<keyof typeof SAMPLE_COMPANY>;

/** `info` with its empty fields set to the sample's. */
export function fillEmptyCompany(info: CompanyInfo): CompanyInfo {
  const next = { ...info };
  for (const key of sampleKeys) {
    if (!next[key]?.trim()) {
      next[key] = SAMPLE_COMPANY[key];
    }
  }
  return next;
}

/** What the seed reads and writes: a slice of the app store. */
export interface SeedStore {
  activeEntityId: string;
  companyInfo: CompanyInfo;
  creds: { username: string };
  getCredentials: (entityId: string) => Promise<Credentials>;
  newId: () => string;
  savedRecipients: Array<Recipient>;
  setCompanyInfo: Dispatch<SetStateAction<CompanyInfo>>;
  setCredentials: (entityId: string, creds: Partial<Credentials>) => Promise<void>;
  setSavedRecipients: Dispatch<SetStateAction<Array<Recipient>>>;
}

/**
 * Fills the active company's empty GİB login, company and bank fields, and
 * adds the sample customers when it has none. True when anything was empty.
 * A password the vault cannot read or write (a plain browser) is left alone.
 */
export async function seedEmulatorData(store: SeedStore): Promise<boolean> {
  const { activeEntityId, companyInfo, creds, savedRecipients } = store;
  let filled = false;
  if (!creds.username.trim()) {
    await store.setCredentials(activeEntityId, { username: EMULATOR_LOGIN.username });
    filled = true;
  }
  const login = await store.getCredentials(activeEntityId).catch(() => null);
  if (login && !login.password) {
    const saved = await store
      .setCredentials(activeEntityId, { password: EMULATOR_LOGIN.password })
      .then(() => true)
      .catch(() => false);
    filled ||= saved;
  }
  if (sampleKeys.some((key) => !companyInfo[key]?.trim())) {
    store.setCompanyInfo(fillEmptyCompany);
    filled = true;
  }
  if (savedRecipients.length === 0) {
    store.setSavedRecipients(sampleCustomers(store.newId));
    filled = true;
  }
  return filled;
}

/**
 * seedEmulatorData with a toast. `quiet` (the launch with the emulator on)
 * says nothing when every field was filled already.
 */
export async function fillEmulatorSamples(store: SeedStore, { quiet = false } = {}) {
  const filled = await seedEmulatorData(store);
  if (filled) {
    toast.success('Emülatör için örnek bilgiler dolduruldu');
  } else if (!quiet) {
    toast('Boş alan yok, örnek bilgilerin hepsi dolu');
  }
}
