import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type {
  ApprovalStatus,
  Cancellation,
  EmulatorConfig,
  EmulatorUser,
  InvoiceFixture,
} from './config.ts';
import { addDays, dashDate, type Day, istanbulDay, parseGIBDate, slashDate } from './dates.ts';

export interface StoredInvoice {
  aliciUnvanAdSoyad: string;
  aliciVknTckn: string;
  /** GIB + year + nine digits, counted per user and year. */
  belgeNumarasi: string;
  /** dd-MM-yyyy */
  belgeTarihi: string;
  /** A cancellation request on the signed document; `accepted` cancels it. */
  cancellation?: Cancellation;
  /** Epoch milliseconds. */
  createdAt: number;
  ettn: string;
  onayDurumu: ApprovalStatus;
  /** The draft as sent to EARSIV_PORTAL_FATURA_OLUSTUR, with the ETTN and number filled in. */
  payload: Record<string, unknown>;
  /** Why it was deleted (EARSIV_PORTAL_FATURA_SIL `aciklama`). */
  silmeNedeni?: string;
  userid: string;
}

export interface Session {
  cookie: string;
  createdAt: number;
  /** Epoch milliseconds; renewed by every request on the session. */
  expiresAt: number;
  /** Opened "elsewhere" (lockedUsers, POST /__emulator/lock): it only holds the lock. */
  foreign: boolean;
  token: string;
  userid: string;
}

export interface SmsOperation {
  code: string;
  expiresAt: number;
  oid: string;
  phone: string;
  sentAt: number;
  used: boolean;
  userid: string;
}

/**
 * A login refused by the single-session rule hands out a cookie; a logout
 * carrying it ends the user's open session (the SDK's forceLogout).
 */
export interface ForceLogoutHandle {
  expiresAt: number;
  userid: string;
}

export interface State {
  /** Last document number per `${userid}:${year}`. */
  counters: Record<string, number>;
  forceLogouts: Map<string, ForceLogoutHandle>;
  invoices: Map<string, StoredInvoice>;
  sessions: Map<string, Session>;
  sms: Array<SmsOperation>;
  users: Map<string, EmulatorUser>;
}

interface Snapshot {
  counters: Record<string, number>;
  invoices: Array<StoredInvoice>;
  users: Array<EmulatorUser>;
  version: 1;
}

export const randomHex = (bytes: number) => randomBytes(bytes).toString('hex');

/**
 * A time-based (version 1) UUID, the kind GİB assigns as ETTN
 * (e.g. c4e9e0a2-4788-11ed-bbd4-4ccc6ae28384).
 */
export function timeUUID(now: number): string {
  // 100 ns intervals since 1582-10-15.
  const time = BigInt(now) * 10_000n + 122_192_928_000_000_000n + BigInt(randomBytes(1)[0]);
  const hex = time.toString(16).padStart(15, '0');
  const clock = (0x80_00 | (randomBytes(2).readUInt16BE() & 0x3f_ff)).toString(16);
  return `${hex.slice(7)}-${hex.slice(3, 7)}-1${hex.slice(0, 3)}-${clock}-${randomHex(6)}`;
}

export function nextDocumentNumber(state: State, userid: string, year: number): string {
  const key = `${userid}:${year}`;
  const next = (state.counters[key] ?? 0) + 1;
  state.counters[key] = next;
  return `GIB${year}${String(next).padStart(9, '0')}`;
}

/** The list's name column: the title, else first and last name. */
export const recipientName = (payload: Record<string, unknown>) => {
  const text = (key: string) => (typeof payload[key] === 'string' ? payload[key].trim() : '');
  return text('aliciUnvan') || `${text('aliciAdi')} ${text('aliciSoyadi')}`.trim();
};

const money = (value: number) => value.toFixed(2);

/** A complete draft payload, shaped like the SDK's createDraftInvoice. */
function fixturePayload(fixture: InvoiceFixture, day: Day): Record<string, unknown> {
  const amount = fixture.amount ?? 1000;
  const vatRate = fixture.vatRate ?? 20;
  const vat = (amount * vatRate) / 100;
  const isPerson = (fixture.taxID ?? '').length === 11;
  const country = fixture.country ?? 'Türkiye';
  const abroad = country !== 'Türkiye';
  return {
    aliciAdi: isPerson ? (fixture.recipient ?? '') : '',
    aliciSoyadi: '',
    aliciUnvan: isPerson ? '' : (fixture.recipient ?? 'ÖRNEK ALICI A.Ş.'),
    bulvarcaddesokak: abroad
      ? '350 Fifth Avenue, New York, NY 10118'
      : 'Örnek Mah. Deneme Cad. No:1',
    dovzTLkur: String(fixture.rate ?? 0),
    faturaTarihi: slashDate(day),
    faturaTipi: vatRate === 0 ? 'ISTISNA' : 'SATIS',
    hangiTip: '5000/30000',
    hesaplanankdv: money(vat),
    mahalleSemtIlce: abroad ? '' : 'Kadıköy',
    malHizmetTable: [
      {
        birim: 'C62',
        birimFiyat: money(amount),
        fiyat: money(amount),
        iskontoOrani: 0,
        iskontoTutari: '0.00',
        kdvOrani: String(vatRate),
        kdvTutari: money(vat),
        malHizmet: fixture.item ?? 'Hizmet Bedeli',
        malHizmetTutari: money(amount),
        miktar: 1,
      },
    ],
    malhizmetToplamTutari: money(amount),
    matrah: money(amount),
    not: fixture.note ?? '',
    odenecekTutar: money(amount + vat),
    paraBirimi: fixture.currency ?? 'TRY',
    saat: '10:00:00',
    sehir: abroad ? ' ' : 'İstanbul',
    toplamIskonto: '0.00',
    ulke: country,
    vergiDairesi: '',
    vergilerDahilToplamTutar: money(amount + vat),
    vergilerToplami: money(vat),
    vknTckn: fixture.taxID ?? '1111111111',
  };
}

export function addFixture(state: State, fixture: InvoiceFixture, now: number): StoredInvoice {
  const day =
    parseGIBDate(fixture.date) ?? addDays(istanbulDay(new Date(now)), -(fixture.daysAgo ?? 0));
  const ettn = fixture.ettn ?? timeUUID(now);
  const belgeNumarasi = nextDocumentNumber(state, fixture.userid, day.year);
  const payload: Record<string, unknown> = {
    ...fixturePayload(fixture, day),
    belgeNumarasi,
    faturaUuid: ettn,
  };
  const invoice: StoredInvoice = {
    aliciUnvanAdSoyad: recipientName(payload),
    aliciVknTckn: String(payload.vknTckn),
    belgeNumarasi,
    belgeTarihi: dashDate(day),
    cancellation: fixture.cancellation,
    createdAt: now,
    ettn,
    onayDurumu: fixture.status ?? (fixture.cancellation ? 'Onaylandı' : 'Onaylanmadı'),
    payload,
    userid: fixture.userid,
  };
  state.invoices.set(ettn, invoice);
  return invoice;
}

export function lockUser(state: State, userid: string, now: number, ttlSeconds: number) {
  const token = randomHex(32);
  state.sessions.set(token, {
    cookie: randomHex(16),
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
    foreign: true,
    token,
    userid,
  });
}

/** The state a fresh start or a reset begins with. */
export function initialState(config: EmulatorConfig, now: number): State {
  const state: State = {
    counters: {},
    forceLogouts: new Map(),
    invoices: new Map(),
    sessions: new Map(),
    sms: [],
    users: new Map(config.users.map((item) => [item.userid, structuredClone(item)])),
  };
  for (const fixture of config.seedInvoices) {
    if (state.users.has(fixture.userid)) {
      addFixture(state, fixture, now);
    }
  }
  for (const userid of config.lockedUsers) {
    lockUser(state, userid, now, config.sessionTtlSeconds);
  }
  return state;
}

/**
 * Restores documents, counters and edited users from a snapshot file over a
 * fresh state. Sessions and SMS codes are never saved.
 */
export function loadSnapshot(state: State, file: string): boolean {
  if (!file || !existsSync(file)) {
    return false;
  }
  const snapshot = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
  state.counters = snapshot.counters;
  state.invoices = new Map(snapshot.invoices.map((invoice) => [invoice.ettn, invoice]));
  for (const item of snapshot.users) {
    state.users.set(item.userid, item);
  }
  return true;
}

export function saveSnapshot(state: State, file: string) {
  if (!file) {
    return;
  }
  const snapshot: Snapshot = {
    counters: state.counters,
    invoices: [...state.invoices.values()],
    users: [...state.users.values()],
    version: 1,
  };
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
}
