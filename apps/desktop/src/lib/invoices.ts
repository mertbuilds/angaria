// The Faturalar screen's data rules: date presets, status filters, ordering,
// and reading GİB's invoice detail. No Tauri or React imports, so tests run
// them directly.

import { addDays, subMonths } from 'date-fns';
import { fullCountryName } from './countries.ts';
import { previousMonthRange } from './reissue.ts';
import type { Invoice, InvoiceItem, InvoiceSettings, Recipient } from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

export interface DateRange {
  /** dd/MM/yyyy */
  end: string;
  /** dd/MM/yyyy */
  start: string;
}

export type DatePreset = 'bu-ay' | 'gecen-ay' | 'son-3-ay' | 'son-6-ay' | 'bu-yil' | 'gecen-yil';

interface DatePresetItem {
  label: string;
  /** The key that picks it while the period menu is open. */
  shortcut: string;
  value: DatePreset;
}

/** The period menu's presets, in its sections. */
export const DATE_PRESET_GROUPS: ReadonlyArray<ReadonlyArray<DatePresetItem>> = [
  [
    { label: 'Bu ay', shortcut: 'A', value: 'bu-ay' },
    { label: 'Geçen ay', shortcut: 'G', value: 'gecen-ay' },
  ],
  [
    { label: 'Son 3 ay', shortcut: '3', value: 'son-3-ay' },
    { label: 'Son 6 ay', shortcut: '6', value: 'son-6-ay' },
  ],
  [
    { label: 'Bu yıl', shortcut: 'Y', value: 'bu-yil' },
    { label: 'Geçen yıl', shortcut: 'E', value: 'gecen-yil' },
  ],
];

export const DATE_PRESETS: ReadonlyArray<DatePresetItem> = DATE_PRESET_GROUPS.flat();

// subMonths stops at the month's end: 31 May goes back to 28 February.
const lastMonths = (months: number, now: Date) => ({
  end: toGIB(now),
  start: toGIB(addDays(subMonths(now, months), 1)),
});

/** Ranges that include this month end today: GİB has no invoices dated later. */
export function presetRange(preset: DatePreset, now: Date): DateRange {
  const today = toGIB(now);
  const year = now.getFullYear();
  switch (preset) {
    case 'bu-ay':
      return { end: today, start: toGIB(new Date(year, now.getMonth(), 1)) };
    case 'gecen-ay':
      return previousMonthRange(now);
    case 'son-3-ay':
      return lastMonths(3, now);
    case 'son-6-ay':
      return lastMonths(6, now);
    case 'bu-yil':
      return { end: today, start: toGIB(new Date(year, 0, 1)) };
    case 'gecen-yil':
      return { end: toGIB(new Date(year - 1, 11, 31)), start: toGIB(new Date(year - 1, 0, 1)) };
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

export type StatusFilter = 'tumu' | 'onaylanmadi' | 'onaylandi' | 'iptal' | 'silindi';

/**
 * One word per GİB end state, the same on the filter, the badges, the detail
 * header and the MCP tools: a deleted draft never was an invoice (Silindi), a
 * cancelled one was signed first (İptal edildi).
 */
export const STATUS_FILTERS: ReadonlyArray<{ label: string; value: StatusFilter }> = [
  { label: 'Tümü', value: 'tumu' },
  { label: 'Taslak', value: 'onaylanmadi' },
  { label: 'Onaylı', value: 'onaylandi' },
  { label: 'İptal edildi', value: 'iptal' },
  { label: 'Silindi', value: 'silindi' },
];

export interface InvoiceStatus {
  /** Null for a status GİB has not been seen to send: only Tümü lists it. */
  filter: Exclude<StatusFilter, 'tumu'> | null;
  /** A signed invoice with a cancellation request still waiting for the buyer. */
  hint?: 'İptal aşamasında';
  label: string;
  variant: 'destructive' | 'ghost' | 'outline' | 'secondary';
}

const code = (value: unknown) =>
  typeof value === 'number' || typeof value === 'string' ? String(value).trim() : '';

/**
 * A cancellation request on a signed invoice. A cancelled invoice stays
 * Onaylandı; GİB puts the request on the list row as `iptalItiraz` (0 a
 * cancellation, 1 an objection) and `iptalItirazDurumu` (0 İptal Aşamasında,
 * 1 İptal Kabul Edildi, 2 İptal Reddedildi). The names come from GİB's list
 * of incoming requests and are not verified on this list, so numbers, strings
 * and GİB's words all count.
 */
function cancellation(invoice: Invoice): 'accepted' | 'pending' | null {
  const kind = code(invoice.iptalItiraz);
  if (kind !== '' && kind !== '0') {
    return null;
  }
  const state = code(invoice.iptalItirazDurumu).toLocaleLowerCase('tr');
  if (state === '1' || state.includes('kabul')) {
    return 'accepted';
  }
  if (state === '0' || state.includes('aşama')) {
    return 'pending';
  }
  return null;
}

/**
 * GİB's status of a list row: Taslak, Onaylı, İptal edildi (signed, then
 * cancelled) or Silindi (a deleted draft).
 */
export function invoiceStatus(invoice: Invoice): InvoiceStatus {
  switch (invoice.onayDurumu) {
    case 'Onaylanmadı':
      return { filter: 'onaylanmadi', label: 'Taslak', variant: 'outline' };
    case 'Onaylandı': {
      const request = cancellation(invoice);
      if (request === 'accepted') {
        return { filter: 'iptal', label: 'İptal edildi', variant: 'destructive' };
      }
      return request === 'pending'
        ? { filter: 'onaylandi', hint: 'İptal aşamasında', label: 'Onaylı', variant: 'secondary' }
        : { filter: 'onaylandi', label: 'Onaylı', variant: 'secondary' };
    }
    case 'Silinmiş':
      return { filter: 'silindi', label: 'Silindi', variant: 'ghost' };
    default:
      return { filter: null, label: invoice.onayDurumu || 'Bilinmiyor', variant: 'outline' };
  }
}

/** The status in words, with its hint: "Onaylı (iptal aşamasında)". */
export const statusText = ({ hint, label }: InvoiceStatus) =>
  hint ? `${label} (${hint.toLocaleLowerCase('tr')})` : label;

export const matchesStatus = (invoice: Invoice, filter: StatusFilter) =>
  filter === 'tumu' || invoiceStatus(invoice).filter === filter;

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
      country: fullCountryName(str(detail.ulke)),
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
