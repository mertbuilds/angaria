// The Faturalar screen's data rules: date presets, status filters, ordering,
// and reading GİB's invoice detail. No Tauri or React imports, so tests run
// them directly.

import { addDays, subMonths } from 'date-fns';
import { previousMonthRange } from './reissue.ts';
import type { Invoice, InvoiceItem, InvoiceSettings, Recipient } from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

export interface DateRange {
  /** dd/MM/yyyy */
  end: string;
  /** dd/MM/yyyy */
  start: string;
}

export type DatePreset = 'bu-ay' | 'gecen-ay' | 'son-3-ay';

export const DATE_PRESETS: ReadonlyArray<{ label: string; value: DatePreset }> = [
  { label: 'Bu ay', value: 'bu-ay' },
  { label: 'Geçen ay', value: 'gecen-ay' },
  { label: 'Son 3 ay', value: 'son-3-ay' },
];

/** Bu ay and Son 3 ay end today: GİB has no invoices dated later. */
export function presetRange(preset: DatePreset, now: Date): DateRange {
  const today = toGIB(now);
  switch (preset) {
    case 'bu-ay':
      return { end: today, start: toGIB(new Date(now.getFullYear(), now.getMonth(), 1)) };
    case 'gecen-ay':
      return previousMonthRange(now);
    case 'son-3-ay':
      // subMonths stops at the month's end: 31 May goes back to 28 February.
      return { end: today, start: toGIB(addDays(subMonths(now, 3), 1)) };
  }
}

/** The preset that `range` is today, or null for a custom range. */
export function rangePreset(range: DateRange, now: Date): DatePreset | null {
  return (
    DATE_PRESETS.find(({ value }) => {
      const preset = presetRange(value, now);
      return preset.start === range.start && preset.end === range.end;
    })?.value ?? null
  );
}

/** `range` grown to cover `date` (dd/MM/yyyy), so a new draft shows in the list. */
export function rangeCovering(range: DateRange, date: string): DateRange {
  const day = parseGIB(date);
  if (!day) {
    return range;
  }
  const start = parseGIB(range.start);
  const end = parseGIB(range.end);
  return {
    end: end && end >= day ? range.end : date,
    start: start && start <= day ? range.start : date,
  };
}

/** Longest custom range: each week is one GİB request. */
export const MAX_RANGE_DAYS = 366;

export type StatusFilter = 'tumu' | 'onaylanmadi' | 'onaylandi' | 'iptal';

export const STATUS_FILTERS: ReadonlyArray<{ label: string; value: StatusFilter }> = [
  { label: 'Tümü', value: 'tumu' },
  { label: 'Taslak', value: 'onaylanmadi' },
  { label: 'Onaylı', value: 'onaylandi' },
  { label: 'İptal', value: 'iptal' },
];

export interface InvoiceStatus {
  filter: Exclude<StatusFilter, 'tumu'>;
  label: string;
  variant: 'destructive' | 'outline' | 'secondary';
}

/** GİB's onayDurumu: unsigned drafts, signed invoices, and the rest (deleted, cancelled). */
export function invoiceStatus(onayDurumu: string | undefined): InvoiceStatus {
  switch (onayDurumu) {
    case 'Onaylanmadı':
      return { filter: 'onaylanmadi', label: 'Taslak', variant: 'outline' };
    case 'Onaylandı':
      return { filter: 'onaylandi', label: 'Onaylı', variant: 'secondary' };
    case 'Silinmiş':
      return { filter: 'iptal', label: 'Silindi', variant: 'destructive' };
    default:
      return { filter: 'iptal', label: onayDurumu || 'Bilinmiyor', variant: 'destructive' };
  }
}

export const matchesStatus = (invoice: Invoice, filter: StatusFilter) =>
  filter === 'tumu' || invoiceStatus(invoice.onayDurumu).filter === filter;

const invoiceTime = (invoice: Invoice) => parseGIB(invoice.belgeTarihi ?? '')?.getTime() ?? 0;

/** Newest date first, then the highest document number. */
export function newestFirst(invoices: ReadonlyArray<Invoice>): Array<Invoice> {
  return invoices.toSorted(
    (a, b) =>
      invoiceTime(b) - invoiceTime(a) ||
      (b.belgeNumarasi ?? '').localeCompare(a.belgeNumarasi ?? ''),
  );
}

/**
 * The `count` newest invoices among `invoices` (lists of several ranges may
 * repeat a row), for Yeni fatura's "Tekrar kes". Deleted ones and rows without
 * an ETTN are left out.
 */
export function recentInvoices(invoices: Iterable<Invoice>, count: number): Array<Invoice> {
  const byEttn = new Map<string, Invoice>();
  for (const invoice of invoices) {
    if (invoice.ettn && invoice.onayDurumu !== 'Silinmiş') {
      byEttn.set(invoice.ettn, invoice);
    }
  }
  return newestFirst([...byEttn.values()]).slice(0, count);
}

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export interface GIBInvoice {
  items: Array<Omit<InvoiceItem, 'id'>>;
  note: string;
  recipient: Omit<Recipient, 'id'>;
  settings: InvoiceSettings;
  /** Before VAT, after discounts */
  subtotal: number;
  /** What the customer pays */
  total: number;
  vat: number;
}

/** GİB's invoice detail (EARSIV_PORTAL_FATURA_GETIR) as the app's form data and totals. */
export function parseGIBInvoice(detail: Record<string, unknown>): GIBInvoice {
  const table = Array.isArray(detail.malHizmetTable)
    ? (detail.malHizmetTable as Array<Record<string, unknown>>)
    : [];
  const items = table.map((row) => ({
    discountAmount: num(row.iskontoTutari),
    discountRate: num(row.iskontoOrani),
    discountReason: str(row.iskontoNedeni),
    gtip: str(row.gtip),
    name: str(row.malHizmet),
    quantity: num(row.miktar) || 1,
    unitPrice: num(row.birimFiyat),
    unitType: str(row.birim, 'C62'),
    VATRate: num(row.kdvOrani),
  }));
  const lineNet = (item: (typeof items)[number]) =>
    item.quantity * item.unitPrice - item.discountAmount;
  const subtotal = items.reduce((sum, item) => sum + lineNet(item), 0);
  const vat = items.reduce((sum, item) => sum + lineNet(item) * (item.VATRate / 100), 0);
  const rate = String(detail.dovzTLkur ?? '');

  return {
    items,
    note: str(detail.not),
    recipient: {
      city: str(detail.sehir).trim(),
      country: str(detail.ulke),
      district: str(detail.mahalleSemtIlce),
      fullAddress: str(detail.bulvarcaddesokak),
      name: str(detail.aliciAdi),
      surname: str(detail.aliciSoyadi),
      taxIDOrTRID: str(detail.vknTckn),
      taxOffice: str(detail.vergiDairesi),
      title: str(detail.aliciUnvan),
    },
    settings: {
      currency: str(detail.paraBirimi, 'TRY'),
      currencyRate: rate === '0' ? '' : rate,
      invoiceType: str(detail.faturaTipi, 'SATIS'),
    },
    subtotal,
    // GİB's own payable amount when it sent one (it accounts for withholdings).
    total: detail.odenecekTutar == null ? subtotal + vat : num(detail.odenecekTutar),
    vat,
  };
}
