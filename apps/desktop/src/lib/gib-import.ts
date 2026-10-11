// Import from past invoices: scan GİB's list a week at a time, read every
// signed invoice, and offer its customers and services to save. Customers learn
// their invoice defaults the way a new draft teaches them (learnCustomer,
// invoiceDefaults). No Tauri or React imports, so tests drive it with a fake
// client.

import { GibError, splitDateRange } from 'angaria-earsiv-sdk';
import { addDays, subMonths } from 'date-fns';
import {
  customerName,
  defaultPDFLanguage,
  findCustomer,
  findCustomerByTaxID,
  learnCustomer,
  nameKey,
  sameName,
} from './customer.ts';
import { invoiceDefaults, istisnaReasonInNote } from './invoice-form.ts';
import { invoiceStatus, parseGIBInvoice, type DateRange, type GIBInvoice } from './invoices.ts';
import { isTaxIDPlaceholder } from './tr-validators.ts';
import type { Invoice, InvoiceFormValues, Recipient, Service } from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

export type ImportPeriod = '1-yil' | '2-yil' | '3-ay' | '6-ay';

export const IMPORT_PERIODS: ReadonlyArray<{
  label: string;
  months: number;
  value: ImportPeriod;
}> = [
  { label: '3 ay', months: 3, value: '3-ay' },
  { label: '6 ay', months: 6, value: '6-ay' },
  { label: '1 yıl', months: 12, value: '1-yil' },
  { label: '2 yıl', months: 24, value: '2-yil' },
];

export const DEFAULT_IMPORT_PERIOD: ImportPeriod = '1-yil';

/** The days the period covers, ending today: GİB has no invoices dated later. */
export function importRange(period: ImportPeriod, now: Date): DateRange {
  const months = IMPORT_PERIODS.find((item) => item.value === period)?.months ?? 12;
  return { end: toGIB(now), start: toGIB(addDays(subMonths(now, months), 1)) };
}

/** The range in the seven-day windows GİB lists, oldest first: one request each. */
export const importWeeks = (range: DateRange): Array<DateRange> =>
  splitDateRange(range.start, range.end).map(({ endDate, startDate }) => ({
    end: endDate,
    start: startDate,
  }));

/** Onaylı, a cancellation still pending included; never a draft, a cancelled or deleted one. */
export const isSignedInvoice = (row: Invoice) =>
  Boolean(row.ettn) && invoiceStatus(row).filter === 'onaylandi';

/** A signed invoice read from GİB. */
export interface ScannedInvoice {
  /** dd/MM/yyyy */
  date: string;
  detail: GIBInvoice;
  ettn: string;
}

export interface ScanClient {
  /** GİB's invoice detail (EARSIV_PORTAL_FATURA_GETIR). */
  detail: (ettn: string, signal: AbortSignal) => Promise<Record<string, unknown>>;
  /** The list rows of one window of at most seven days. */
  list: (week: DateRange, signal: AbortSignal) => Promise<Array<Invoice>>;
}

export interface ScanProgress {
  done: number;
  phase: 'details' | 'weeks';
  total: number;
  /** GİB was busy: the scan waits this many seconds before the `attempt`th retry. */
  wait?: { attempt: number; seconds: number };
}

/**
 * What a scan has fetched so far, kept for its run: a scan that stopped (GİB
 * busy, the network) goes on from here instead of starting over.
 */
export interface ScanCheckpoint {
  /** Invoice details by ETTN */
  details: Map<string, Record<string, unknown>>;
  /** List rows by window ("start-end") */
  lists: Map<string, Array<Invoice>>;
}

export const newCheckpoint = (): ScanCheckpoint => ({ details: new Map(), lists: new Map() });

/**
 * GİB publishes no rate limits, so the scan stays well under any: one call at
 * a time, `gapMs` ± `jitterMs` apart, and `burstPauseMs` after every `burst`
 * calls (about 60 calls a minute with GİB's own answer time).
 */
export const IMPORT_PACE = { burst: 50, burstPauseMs: 5000, gapMs: 400, jitterMs: 100 };

/** GİB said it is busy: the same call goes again after each of these waits, then the scan stops. */
export const RATE_LIMIT_BACKOFF_MS: ReadonlyArray<number> = [30_000, 60_000, 120_000];

/** Waits `ms`; rejects with the signal's reason once it aborts. */
export const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const stop = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, ms);
    signal.addEventListener('abort', stop, { once: true });
  });

/** A call whose session ran out goes again once, on a fresh login. */
async function retryExpired<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof GibError && error.code === 'session-expired') {
      return call();
    }
    throw error;
  }
}

const isRateLimit = (error: unknown) => error instanceof GibError && error.code === 'rate-limit';

const weekKey = (week: DateRange) => `${week.start}-${week.end}`;

export interface ScanOptions {
  /** Kept between runs of one scan: what is in it is not fetched again. */
  checkpoint?: ScanCheckpoint;
  onProgress?: (progress: ScanProgress) => void;
  pace?: typeof IMPORT_PACE;
  /** 0 to 1, for the jitter */
  random?: () => number;
  signal: AbortSignal;
}

/**
 * Every signed invoice dated within `weeks`: the lists first (progress counts
 * weeks), then each invoice's detail (progress counts invoices). One GİB call
 * at a time, paced (IMPORT_PACE); a busy GİB is retried after
 * RATE_LIMIT_BACKOFF_MS. Only reads, so a retry never repeats a change.
 */
export async function scanInvoices(
  client: ScanClient,
  weeks: ReadonlyArray<DateRange>,
  {
    checkpoint = newCheckpoint(),
    onProgress,
    pace = IMPORT_PACE,
    random = Math.random,
    signal,
  }: ScanOptions,
): Promise<Array<ScannedInvoice>> {
  let calls = 0;
  let progress: ScanProgress = { done: 0, phase: 'weeks', total: weeks.length };
  const report = (next: ScanProgress) => {
    progress = next;
    onProgress?.(next);
  };

  /** One GİB call, after the pause the pace asks for, retried while GİB is busy. */
  async function call<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      // A retry comes after its own, longer wait.
      const gap =
        calls === 0 || attempt > 0
          ? 0
          : calls % pace.burst === 0
            ? pace.burstPauseMs
            : pace.gapMs + Math.round((random() * 2 - 1) * pace.jitterMs);
      if (gap > 0) {
        await pause(gap, signal);
      }
      calls++;
      try {
        return await retryExpired(run);
      } catch (error) {
        const wait = RATE_LIMIT_BACKOFF_MS[attempt];
        if (!isRateLimit(error) || wait === undefined || signal.aborted) {
          throw error;
        }
        const { done, phase, total } = progress;
        report({ done, phase, total, wait: { attempt: attempt + 1, seconds: wait / 1000 } });
        await pause(wait, signal);
        report({ done, phase, total });
      }
    }
  }

  report(progress);
  const lists: Array<Array<Invoice>> = [];
  for (const week of weeks) {
    signal.throwIfAborted();
    let rows = checkpoint.lists.get(weekKey(week));
    if (!rows) {
      rows = await call(() => client.list(week, signal));
      checkpoint.lists.set(weekKey(week), rows);
    }
    lists.push(rows);
    report({ done: lists.length, phase: 'weeks', total: weeks.length });
  }

  const signed = new Map<string, Invoice>();
  for (const row of lists.flat()) {
    if (row.ettn && isSignedInvoice(row)) {
      signed.set(row.ettn, row);
    }
  }
  const rows = [...signed.values()];
  const details: Array<Record<string, unknown>> = [];
  report({ done: 0, phase: 'details', total: rows.length });
  for (const row of rows) {
    signal.throwIfAborted();
    const ettn = row.ettn ?? '';
    let detail = checkpoint.details.get(ettn);
    if (!detail) {
      detail = await call(() => client.detail(ettn, signal));
      checkpoint.details.set(ettn, detail);
    }
    details.push(detail);
    report({ done: details.length, phase: 'details', total: rows.length });
  }
  return rows.map((row, index) => ({
    date: toGIB(parseGIB(row.belgeTarihi ?? '')),
    detail: parseGIBInvoice(details[index]),
    ettn: row.ettn ?? '',
  }));
}

export interface CustomerCandidate {
  /** Saved already: shown, never added or changed. */
  existing: boolean;
  invoiceCount: number;
  key: string;
  /** The newest invoice to the customer: its details and defaults are saved. */
  latest: ScannedInvoice;
  name: string;
  taxID: string;
}

export interface ServiceCandidate {
  /** Saved already (a service of the same name): shown, never added or changed. */
  existing: boolean;
  key: string;
  /** The line of the newest invoice that has it, priced in that invoice's currency. */
  service: Omit<Service, 'id'> & { currency: string };
}

export interface ImportCandidates {
  customers: Array<CustomerCandidate>;
  services: Array<ServiceCandidate>;
}

const newFirst = (a: { existing: boolean }, b: { existing: boolean }) =>
  Number(a.existing) - Number(b.existing);

const time = (invoice: ScannedInvoice) => parseGIB(invoice.date)?.getTime() ?? 0;

/**
 * Keys for names in groups (a VKN and country, a unit and currency): one name,
 * by sameName, gets one key in its group, made by `format` from the first
 * spelling's nameKey ("PLASTIC" and "Plastic" are one; "Kır" and "Kir" two).
 */
function nameKeys() {
  const seen: Array<{ group: string; key: string; name: string }> = [];
  return (group: string, name: string, format: (nameKey: string) => string) => {
    const known = seen.find((entry) => entry.group === group && sameName(entry.name, name));
    if (known) {
      return known.key;
    }
    const key = format(nameKey(name));
    seen.push({ group, key, name });
    return key;
  };
}

function savedCustomer(customers: ReadonlyArray<Recipient>, recipient: GIBInvoice['recipient']) {
  const id = recipient.taxIDOrTRID.trim();
  return isTaxIDPlaceholder(id)
    ? findCustomer(customers, id, customerName(recipient))
    : findCustomerByTaxID(customers, id);
}

/**
 * What `invoices` offer to save: one customer per VKN / TCKN (customerKey) with
 * its invoice count and newest invoice, and one service per name, unit and
 * currency at its newest price. New ones first, then saved ones (marked
 * existing), each newest first.
 */
export function importCandidates(
  invoices: ReadonlyArray<ScannedInvoice>,
  saved: { customers: ReadonlyArray<Recipient>; services: ReadonlyArray<Service> },
): ImportCandidates {
  const oldestFirst = invoices.toSorted((a, b) => time(a) - time(b));
  const customers = new Map<string, CustomerCandidate>();
  // Each service with the time of the newest invoice that has it.
  const services = new Map<string, { candidate: ServiceCandidate; time: number }>();
  /**
   * A customer by its VKN / TCKN. GİB's placeholders (2222222222 abroad,
   * 22222222222 and 11111111111 for a person) are shared, so there the name
   * and the country tell customers apart.
   */
  const customerNames = nameKeys();
  const customerKey = (recipient: GIBInvoice['recipient']) => {
    const id = recipient.taxIDOrTRID.trim();
    const country = recipient.country.trim();
    return isTaxIDPlaceholder(id)
      ? customerNames(
          `${id}:${country}`,
          customerName(recipient),
          (name) => `${id}:${name}:${country}`,
        )
      : id;
  };
  const serviceNames = nameKeys();

  for (const invoice of oldestFirst) {
    const { items, recipient, settings } = invoice.detail;
    const key = customerKey(recipient);
    customers.set(key, {
      existing: savedCustomer(saved.customers, recipient) !== null,
      invoiceCount: (customers.get(key)?.invoiceCount ?? 0) + 1,
      key,
      latest: invoice,
      name: customerName(recipient),
      taxID: recipient.taxIDOrTRID.trim(),
    });
    for (const item of items) {
      const name = item.name.trim();
      if (!name) {
        continue;
      }
      const group = `${item.unitType}:${settings.currency}`;
      const itemKey = serviceNames(group, name, (key) => `${key}:${group}`);
      services.set(itemKey, {
        candidate: {
          existing: saved.services.some((service) => sameName(service.name, name)),
          key: itemKey,
          service: { ...item, currency: settings.currency, name },
        },
        time: time(invoice),
      });
    }
  }
  return {
    customers: [...customers.values()].toSorted(
      (a, b) => newFirst(a, b) || time(b.latest) - time(a.latest),
    ),
    services: [...services.values()]
      .toSorted((a, b) => newFirst(a.candidate, b.candidate) || b.time - a.time)
      .map(({ candidate }) => candidate),
  };
}

/** The invoice as the form a draft is made from, for invoiceDefaults. */
function asFormValues({ detail }: ScannedInvoice, dueDate: string | undefined): InvoiceFormValues {
  const istisnaCode =
    detail.settings.invoiceType === 'ISTISNA' ? istisnaReasonInNote(detail.note) : undefined;
  return {
    advancedFields: {
      dueDate: dueDate ?? '',
      irsaliyeNumarasi: '',
      irsaliyeTarihi: '',
      manualDate: '',
      manualTime: '',
      paymentTotal: '',
    },
    invoiceSettings: { ...detail.settings, istisnaCode },
    items: detail.items.map((item, index) => ({ ...item, id: String(index) })),
    note: detail.note,
    recipient: { ...detail.recipient, id: '' },
  };
}

/**
 * The saved customers and services with the chosen candidates added; saved
 * ones are never changed. A customer is learned from its newest invoice like a
 * new draft teaches it: details, currency, invoice type, VAT rate, İstisna
 * reason, the PDF language by where it is, and the days to pay when Angaria
 * kept that invoice's due date (`dueDateOf`).
 */
export function applyImport(
  saved: { customers: ReadonlyArray<Recipient>; services: ReadonlyArray<Service> },
  chosen: ImportCandidates,
  newId: () => string,
  dueDateOf: (ettn: string) => string | undefined = () => undefined,
): { customers: Array<Recipient>; services: Array<Service> } {
  let customers = [...saved.customers];
  for (const candidate of chosen.customers) {
    if (candidate.existing) {
      continue;
    }
    const { latest } = candidate;
    const values = asFormValues(latest, dueDateOf(latest.ettn));
    const defaults = invoiceDefaults(values, {
      date: latest.date,
      pdfLanguage: defaultPDFLanguage(values.recipient),
    });
    customers = learnCustomer(
      customers,
      values.recipient,
      defaults,
      newId,
      parseGIB(latest.date),
    ).customers;
  }
  const services = [
    ...saved.services,
    ...chosen.services
      .filter((candidate) => !candidate.existing)
      .map(({ service }) => ({ ...service, id: newId() })),
  ];
  return { customers, services };
}
