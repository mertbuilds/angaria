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
}

/**
 * Calls handed to the client at once. GİB's queue runs them one at a time on
 * one session; a second call waiting keeps that session open between them.
 */
export const SCAN_CONCURRENCY = 2;

/** Calls stay apart by this much on GİB's session, so a long scan does not flood the portal. */
export const IMPORT_PACE_MS = 150;

/** Waits `ms`; rejects with the signal's reason once it aborts. */
export const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
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

/**
 * `run` over `items` with at most `limit` running, results in order. The first
 * failure stops the rest; so does `signal`.
 */
async function mapLimit<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  signal: AbortSignal,
  run: (item: T, signal: AbortSignal) => Promise<R>,
  onDone: () => void,
): Promise<Array<R>> {
  const controller = new AbortController();
  const stop = () => controller.abort(signal.reason);
  signal.addEventListener('abort', stop, { once: true });
  const results: Array<R> = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      controller.signal.throwIfAborted();
      const index = next++;
      results[index] = await run(items[index], controller.signal);
      onDone();
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, () =>
        worker().catch((error: unknown) => {
          controller.abort(error);
          throw error;
        }),
      ),
    );
  } finally {
    signal.removeEventListener('abort', stop);
  }
  signal.throwIfAborted();
  return results;
}

/**
 * Every signed invoice dated within `weeks`: the lists first (progress counts
 * weeks), then each invoice's detail (progress counts invoices).
 */
export async function scanInvoices(
  client: ScanClient,
  weeks: ReadonlyArray<DateRange>,
  {
    concurrency = SCAN_CONCURRENCY,
    onProgress,
    signal,
  }: { concurrency?: number; onProgress?: (progress: ScanProgress) => void; signal: AbortSignal },
): Promise<Array<ScannedInvoice>> {
  let listed = 0;
  onProgress?.({ done: 0, phase: 'weeks', total: weeks.length });
  const lists = await mapLimit(
    weeks,
    concurrency,
    signal,
    (week, callSignal) => retryExpired(() => client.list(week, callSignal)),
    () => onProgress?.({ done: ++listed, phase: 'weeks', total: weeks.length }),
  );

  const signed = new Map<string, Invoice>();
  for (const row of lists.flat()) {
    if (row.ettn && isSignedInvoice(row)) {
      signed.set(row.ettn, row);
    }
  }
  const rows = [...signed.values()];
  let read = 0;
  onProgress?.({ done: 0, phase: 'details', total: rows.length });
  const details = await mapLimit(
    rows,
    concurrency,
    signal,
    (row, callSignal) => retryExpired(() => client.detail(row.ettn ?? '', callSignal)),
    () => onProgress?.({ done: ++read, phase: 'details', total: rows.length }),
  );
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
 * A customer by its VKN / TCKN. GİB's placeholders (2222222222 abroad,
 * 22222222222 and 11111111111 for a person) are shared, so there the name and
 * the country tell customers apart.
 */
function customerKey(recipient: GIBInvoice['recipient']) {
  const id = recipient.taxIDOrTRID.trim();
  return isTaxIDPlaceholder(id)
    ? `${id}:${nameKey(customerName(recipient))}:${recipient.country.trim()}`
    : id;
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
  const savedServices = new Set(saved.services.map((service) => nameKey(service.name)));

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
      const serviceKey = `${nameKey(name)}:${item.unitType}:${settings.currency}`;
      services.set(serviceKey, {
        candidate: {
          existing: savedServices.has(nameKey(name)),
          key: serviceKey,
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
