import { toast } from '@angaria/ui';
import type { Dispatch, SetStateAction } from 'react';
import { companyKeys, gibUserOwner, taxIDOwner } from '@/lib/company-identity.ts';
import type { CompanyInfo, Credentials, Entity, Recipient } from '@/lib/types.ts';

// Dev only: sample data for testing against the GİB emulator fast. Loaded
// with a dynamic import behind import.meta.env.DEV, so it never ships. Only
// empty fields are filled: whatever was typed stays.

/** An emulator user (packages/gib-emulator) and its company's details. */
export interface EmulatorProfile {
  company: Omit<CompanyInfo, 'logo' | 'pdfStyle'>;
  login: Credentials;
}

/**
 * The emulator's freelancers, one per company: each has its own user code and
 * VKN / TCKN, as the emulator's users do, and every ID passes its check.
 */
export const EMULATOR_PROFILES: ReadonlyArray<EmulatorProfile> = [
  {
    company: {
      accountHolder: 'Mert Düzgün',
      address: 'Moda Cad. No:12 D:4\nKadıköy / İstanbul',
      bankAddress: 'Kadıköy Şubesi, İstanbul',
      bankName: 'İş Bankası',
      email: 'mert@example.com',
      iban: 'TR51 0006 4000 0012 3456 7890 12',
      name: 'Mert Düzgün',
      phone: '+90 532 123 45 67',
      swiftCode: 'ISBKTRIS',
      taxID: '10000000146',
      taxOffice: 'Kadıköy',
    },
    login: { password: 'angaria', username: '12345678' },
  },
  {
    company: {
      accountHolder: 'Ömer Faruk Oruç',
      address: 'Kordon Boyu Cad. No:7 D:3\nKonak / İzmir',
      bankAddress: 'Alsancak Şubesi, İzmir',
      bankName: 'Garanti BBVA',
      email: 'faruk@example.com',
      iban: 'TR35 0006 2000 0009 8765 4321 01',
      name: 'Ömer Faruk Oruç',
      phone: '+90 532 987 65 43',
      swiftCode: 'TGBATRIS',
      taxID: '34567890170',
      taxOffice: 'Konak',
    },
    login: { password: 'angaria', username: '87654321' },
  },
];

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
    title: 'Agent Caffeine',
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
    title: 'Vinena Studio',
    VATRate: 20,
  },
];

type SampleCompany = Partial<EmulatorProfile['company']>;

/** `info` with its empty fields set to the sample's. */
export const fillEmptyCompany =
  (sample: SampleCompany) =>
  (info: CompanyInfo): CompanyInfo => {
    const next = { ...info };
    for (const [key, value] of Object.entries(sample) as Array<[keyof SampleCompany, string]>) {
      if (!next[key]?.trim()) {
        next[key] = value;
      }
    }
    return next;
  };

/** What the seed reads and writes: a slice of the app store. */
export interface SeedStore {
  activeEntityId: string;
  companyInfo: CompanyInfo;
  creds: { username: string };
  /** Every company, to keep each user code and VKN / TCKN to one of them */
  entities: ReadonlyArray<Entity>;
  getCredentials: (entityId: string) => Promise<Credentials>;
  newId: () => string;
  savedRecipients: Array<Recipient>;
  setCompanyInfo: Dispatch<SetStateAction<CompanyInfo>>;
  setCredentials: (entityId: string, creds: Partial<Credentials>) => Promise<void>;
  setSavedRecipients: Dispatch<SetStateAction<Array<Recipient>>>;
}

/**
 * The profile for the active company: the one of its user code, else the
 * first whose user code and VKN / TCKN no other company has.
 */
export function profileFor({ activeEntityId, creds, entities }: SeedStore) {
  const companies = companyKeys(entities);
  const username = creds.username.trim();
  return (
    EMULATOR_PROFILES.find((profile) => profile.login.username === username) ??
    EMULATOR_PROFILES.find(
      ({ company, login }) =>
        !gibUserOwner(companies, activeEntityId, login.username) &&
        !taxIDOwner(companies, activeEntityId, company.taxID),
    )
  );
}

/**
 * Fills the active company's empty GİB login, company and bank fields from its
 * profile, and adds the sample customers when it has none. True when anything
 * was empty. A user code or VKN / TCKN another company has is never filled in.
 * A password the vault cannot read or write (a plain browser) is left alone.
 */
export async function seedEmulatorData(store: SeedStore): Promise<boolean> {
  const { activeEntityId, companyInfo, creds, entities, savedRecipients } = store;
  const profile = profileFor(store);
  let filled = false;
  // Without a user code the profile is one no other company uses.
  if (profile && !creds.username.trim()) {
    await store.setCredentials(activeEntityId, { username: profile.login.username });
    filled = true;
  }
  const login = await store.getCredentials(activeEntityId).catch(() => null);
  const ownLogin = profile && login?.username === profile.login.username;
  if (ownLogin && !login.password) {
    const saved = await store
      .setCredentials(activeEntityId, { password: profile.login.password })
      .then(() => true)
      .catch(() => false);
    filled ||= saved;
  }
  if (profile) {
    const { taxID, ...rest } = profile.company;
    const sample: SampleCompany = taxIDOwner(companyKeys(entities), activeEntityId, taxID)
      ? rest
      : profile.company;
    if (Object.keys(sample).some((key) => !companyInfo[key as keyof SampleCompany]?.trim())) {
      store.setCompanyInfo(fillEmptyCompany(sample));
      filled = true;
    }
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
