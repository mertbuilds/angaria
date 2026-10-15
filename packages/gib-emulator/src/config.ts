import { readFileSync } from 'node:fs';
import { historyFixtures } from './history.ts';

export type ApprovalStatus = 'Onaylandı' | 'Onaylanmadı' | 'Silinmiş';

/**
 * A cancellation request (iptal talebi) on a signed document: waiting for the
 * buyer, accepted (the document is cancelled) or rejected. The document stays
 * Onaylandı; the portal's İptal/İtiraz Durumu column shows the request.
 */
export type Cancellation = 'accepted' | 'pending' | 'rejected';

/** A portal account. Field names follow EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR. */
export interface EmulatorUser {
  ad: string;
  /** Street address, shown as the seller's address on invoices. */
  cadde: string;
  ePostaAdresi: string;
  /** May sign with an HSM device (EARSIV_PORTAL_FATURA_HSM_CIHAZI_ILE_IMZALA). */
  hsm: boolean;
  il: string;
  ilce: string;
  password: string;
  soyad: string;
  /** Registered mobile number for SMS signing, empty for none. */
  telefon: string;
  unvan: string;
  userid: string;
  vergiDairesi: string;
  vknTckn: string;
}

/** One line of a fixture: a service, its quantity and unit price. */
export interface FixtureLine {
  name: string;
  /** Default 1. */
  quantity?: number;
  /** GİB's unit code (birim). Default C62, Adet. */
  unit?: string;
  unitPrice: number;
}

/** A document created on start and on reset, for lists that are not empty. */
export interface InvoiceFixture {
  /** The recipient's street address. Default a sample address at home or abroad. */
  address?: string;
  amount?: number;
  /** A cancellation request on a signed document. */
  cancellation?: Cancellation;
  /** The recipient's city at home. Default İstanbul. */
  city?: string;
  /** The recipient's country, GİB's name for it. Default Türkiye. */
  country?: string;
  currency?: string;
  /** dd/MM/yyyy. Wins over `daysAgo`. */
  date?: string;
  /** Days before today, in Turkish time. Default 0. */
  daysAgo?: number;
  /** The recipient's district at home. Default Kadıköy. */
  district?: string;
  ettn?: string;
  /** The one line's name when `items` is absent; its price is `amount`. */
  item?: string;
  /** The lines, in place of `item` and `amount`. */
  items?: Array<FixtureLine>;
  note?: string;
  /** TRY per unit of `currency` (dovzTLkur). */
  rate?: number;
  recipient?: string;
  status?: ApprovalStatus;
  /** A person's last name (an 11-digit `taxID`); `recipient` is then the first name. */
  surname?: string;
  taxID?: string;
  taxOffice?: string;
  userid: string;
  vatRate?: number;
}

export interface ChaosConfig {
  /** 0 to 1: chance that a portal or TCMB request fails with a 5xx HTML page. */
  errorRate: number;
  /** Random extra delay, from 0 to this many milliseconds. */
  jitterMs: number;
  /** Delay before every portal and TCMB response, in milliseconds. */
  latencyMs: number;
  /** Every portal request gets the maintenance HTML page (HTTP 200) instead of JSON. */
  maintenance: boolean;
  /**
   * 0 to 1: chance that EARSIV_PORTAL_FATURA_OLUSTUR answers HTTP 200 with an
   * error text in `data` and no draft (the failure PR #1 taught the SDK to see).
   */
  textErrorRate: number;
}

export interface EmulatorConfig {
  chaos: ChaosConfig;
  /**
   * Users whose session is already open elsewhere on start and on reset: their
   * logins fail with the single-session message until a force logout.
   */
  lockedUsers: Array<string>;
  /** Longest draft list range in days, both ends included. GİB allows 7. */
  maxRangeDays: number;
  /** Fixtures created on start and on reset. */
  seedInvoices: Array<InvoiceFixture>;
  /** Idle seconds before a session token expires and its lock is released. */
  sessionTtlSeconds: number;
  /** The code every SMS carries; 'random' draws six letters and digits per SMS, like GİB's. Always logged. */
  smsCode: string;
  /** Seconds an SMS code stays valid. */
  smsTtlSeconds: number;
  /** JSON snapshot file: read on start, written after every change. Empty keeps state in memory only. */
  stateFile: string;
  /** Extra TCMB holidays (dd/MM/yyyy) on top of the built-in calendar. */
  tcmbHolidays: Array<string>;
  users: Array<EmulatorUser>;
}

export type PartialConfig = Partial<Omit<EmulatorConfig, 'chaos'>> & {
  chaos?: Partial<ChaosConfig>;
};

/** A user with every optional field empty. */
export const makeUser = (
  fields: Partial<EmulatorUser> & Pick<EmulatorUser, 'password' | 'userid' | 'vknTckn'>,
): EmulatorUser => ({
  ad: '',
  cadde: '',
  ePostaAdresi: '',
  hsm: false,
  il: '',
  ilce: '',
  soyad: '',
  telefon: '',
  unvan: '',
  vergiDairesi: '',
  ...fields,
});

/**
 * 33333301 and 33333302 mirror the test portal's public demo accounts,
 * 33333303 has no phone registered (SMS signing fails), 12345678 is a
 * production-like freelancer with a few documents already issued, and
 * 87654321 one with over two years of them (history.ts).
 */
export const defaultUsers: Array<EmulatorUser> = [
  makeUser({
    cadde: 'Zeytinalan Mah. Deneme Sok. No:1',
    il: 'İzmir',
    ilce: 'Urla',
    password: '1',
    telefon: '5550000001',
    unvan: 'DENEME LİSANS TİCARET A.Ş.',
    userid: '33333301',
    vergiDairesi: 'Urla',
    vknTckn: '3333333301',
  }),
  makeUser({
    cadde: 'Atatürk Cad. No:2',
    il: 'Ankara',
    ilce: 'Çankaya',
    password: '1',
    telefon: '5550000002',
    unvan: 'DENEME YAZILIM LTD. ŞTİ.',
    userid: '33333302',
    vergiDairesi: 'Çankaya',
    vknTckn: '3333333302',
  }),
  makeUser({
    cadde: 'Cumhuriyet Cad. No:3',
    il: 'İstanbul',
    ilce: 'Şişli',
    password: '1',
    unvan: 'TELEFONSUZ DENEME A.Ş.',
    userid: '33333303',
    vergiDairesi: 'Şişli',
    vknTckn: '3333333303',
  }),
  makeUser({
    ad: 'Mert',
    cadde: 'Moda Cad. No:12 D:4',
    ePostaAdresi: 'mert@example.com',
    il: 'İstanbul',
    ilce: 'Kadıköy',
    password: 'angaria',
    soyad: 'Düzgün',
    telefon: '5321234567',
    userid: '12345678',
    vergiDairesi: 'Kadıköy',
    vknTckn: '10000000146',
  }),
  makeUser({
    ad: 'Ömer Faruk',
    cadde: 'Kordon Boyu Cad. No:7 D:3',
    ePostaAdresi: 'faruk@example.com',
    il: 'İzmir',
    ilce: 'Konak',
    password: 'angaria',
    soyad: 'Oruç',
    telefon: '5329876543',
    userid: '87654321',
    vergiDairesi: 'Konak',
    vknTckn: '34567890170',
  }),
];

const defaultSeedInvoices: Array<InvoiceFixture> = [
  {
    amount: 4500,
    country: 'Amerika Birleşik Dev',
    currency: 'USD',
    daysAgo: 3,
    item: 'Yazılım Geliştirme Hizmeti',
    note: '302 - 11/1-a Hizmet ihracatı.',
    rate: 41.285,
    recipient: 'Agent Caffeine',
    status: 'Onaylandı',
    taxID: '2222222222',
    userid: '12345678',
    vatRate: 0,
  },
  {
    amount: 2400,
    country: 'Almanya',
    currency: 'EUR',
    daysAgo: 12,
    item: 'Danışmanlık Hizmeti',
    note: '302 - 11/1-a Hizmet ihracatı.',
    rate: 48.1275,
    recipient: 'knobs.dev',
    status: 'Onaylandı',
    taxID: '2222222222',
    userid: '12345678',
    vatRate: 0,
  },
  {
    amount: 1000,
    cancellation: 'accepted',
    country: 'Amerika Birleşik Dev',
    currency: 'USD',
    daysAgo: 20,
    item: 'Yazılım Geliştirme Hizmeti',
    note: '350 - Diğerleri.',
    rate: 41.1032,
    recipient: 'Agent Caffeine',
    status: 'Onaylandı',
    taxID: '2222222222',
    userid: '12345678',
    vatRate: 0,
  },
  {
    amount: 30_000,
    currency: 'TRY',
    daysAgo: 40,
    item: 'Mühendislik Hizmetleri',
    recipient: 'Vinena Studio',
    status: 'Silinmiş',
    taxID: '1234567890',
    userid: '12345678',
    vatRate: 20,
  },
  // More of Mert Düzgün's months, so Faturalar's last three months look lived in
  // (the landing's screenshots, docs/screenshots.md).
  {
    amount: 2400,
    country: 'Almanya',
    currency: 'EUR',
    daysAgo: 1,
    item: 'Danışmanlık Hizmeti',
    note: '302 - 11/1-a Hizmet ihracatı.',
    rate: 48.3021,
    recipient: 'knobs.dev',
    status: 'Onaylanmadı',
    taxID: '2222222222',
    userid: '12345678',
    vatRate: 0,
  },
  {
    amount: 3150,
    country: 'Birleşik Krallık',
    currency: 'GBP',
    daysAgo: 2,
    item: 'Ürün Tasarımı',
    note: '302 - 11/1-a Hizmet ihracatı.',
    rate: 56.1874,
    recipient: 'attention awareness',
    status: 'Onaylanmadı',
    taxID: '2222222222',
    userid: '12345678',
    vatRate: 0,
  },
  {
    amount: 3150,
    country: 'Birleşik Krallık',
    currency: 'GBP',
    daysAgo: 26,
    item: 'Ürün Tasarımı',
    note: '302 - 11/1-a Hizmet ihracatı.',
    rate: 55.9318,
    recipient: 'attention awareness',
    status: 'Onaylandı',
    taxID: '2222222222',
    userid: '12345678',
    vatRate: 0,
  },
  {
    amount: 7640,
    country: 'Amerika Birleşik Dev',
    currency: 'USD',
    daysAgo: 33,
    item: 'Yazılım Geliştirme Hizmeti',
    note: '302 - 11/1-a Hizmet ihracatı.',
    rate: 41.0457,
    recipient: 'Agent Caffeine',
    status: 'Onaylandı',
    taxID: '2222222222',
    userid: '12345678',
    vatRate: 0,
  },
  {
    amount: 18_500,
    currency: 'TRY',
    daysAgo: 47,
    item: 'Web Sitesi Bakımı',
    recipient: 'Vinena Studio',
    status: 'Onaylandı',
    taxID: '1234567890',
    taxOffice: 'Kadıköy',
    userid: '12345678',
    vatRate: 20,
  },
  {
    amount: 8000,
    currency: 'TRY',
    daysAgo: 55,
    item: 'Logo Tasarımı',
    recipient: 'Ahmet Buğra',
    status: 'Onaylandı',
    surname: 'Yiğiter',
    taxID: '23456789060',
    userid: '12345678',
    vatRate: 20,
  },
  {
    amount: 4200,
    country: 'Almanya',
    currency: 'EUR',
    daysAgo: 61,
    item: 'Danışmanlık Hizmeti',
    note: '302 - 11/1-a Hizmet ihracatı.',
    rate: 47.6514,
    recipient: 'knobs.dev',
    status: 'Onaylandı',
    taxID: '2222222222',
    userid: '12345678',
    vatRate: 0,
  },
  ...historyFixtures('87654321'),
];

export const defaultConfig = (): EmulatorConfig => ({
  chaos: { errorRate: 0, jitterMs: 0, latencyMs: 0, maintenance: false, textErrorRate: 0 },
  lockedUsers: [],
  maxRangeDays: 7,
  seedInvoices: structuredClone(defaultSeedInvoices),
  sessionTtlSeconds: 1800,
  smsCode: '123456',
  smsTtlSeconds: 180,
  stateFile: '',
  tcmbHolidays: [],
  users: structuredClone(defaultUsers),
});

/** The entries of `value` that are not undefined. */
function defined<T extends object>(value: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

export function mergeConfig(base: EmulatorConfig, patch: PartialConfig = {}): EmulatorConfig {
  const { chaos, ...rest } = patch;
  return { ...base, ...defined(rest), chaos: { ...base.chaos, ...defined(chaos) } };
}

const number = (value: string | undefined) =>
  value === undefined || value === '' ? undefined : Number(value);
const list = (value: string | undefined) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;

/**
 * Config from GIB_EMULATOR_* environment variables. GIB_EMULATOR_CONFIG names
 * a JSON file holding a PartialConfig; the single variables win over it.
 */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): PartialConfig {
  const file: PartialConfig = env.GIB_EMULATOR_CONFIG
    ? (JSON.parse(readFileSync(env.GIB_EMULATOR_CONFIG, 'utf8')) as PartialConfig)
    : {};
  const { chaos, ...rest }: PartialConfig = {
    chaos: {
      errorRate: number(env.GIB_EMULATOR_ERROR_RATE),
      jitterMs: number(env.GIB_EMULATOR_JITTER_MS),
      latencyMs: number(env.GIB_EMULATOR_LATENCY_MS),
      maintenance: env.GIB_EMULATOR_MAINTENANCE ? env.GIB_EMULATOR_MAINTENANCE === '1' : undefined,
      textErrorRate: number(env.GIB_EMULATOR_TEXT_ERROR_RATE),
    },
    lockedUsers: list(env.GIB_EMULATOR_LOCKED),
    maxRangeDays: number(env.GIB_EMULATOR_MAX_RANGE_DAYS),
    sessionTtlSeconds: number(env.GIB_EMULATOR_SESSION_TTL),
    smsCode: env.GIB_EMULATOR_SMS_CODE || undefined,
    stateFile: env.GIB_EMULATOR_STATE || undefined,
  };
  return { ...file, ...defined(rest), chaos: { ...file.chaos, ...defined(chaos) } };
}
