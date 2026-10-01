import type { Invoice } from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

/** First and last day of the month before `now`, as GİB dates (dd/MM/yyyy). */
export function previousMonthRange(now: Date): { end: string; start: string } {
  return {
    end: toGIB(new Date(now.getFullYear(), now.getMonth(), 0)),
    start: toGIB(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
  };
}

/**
 * The newest invoice dated in the month before `now`: latest date first, then
 * the highest document number. Deleted invoices and rows without an ETTN are
 * skipped. Null when none of `invoices` falls in that month.
 */
export function lastMonthInvoice(invoices: Iterable<Invoice>, now: Date): Invoice | null {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  let best: { date: Date; invoice: Invoice } | null = null;
  for (const invoice of invoices) {
    const date = parseGIB(invoice.belgeTarihi ?? '');
    if (!invoice.ettn || invoice.onayDurumu === 'Silinmiş' || !date) {
      continue;
    }
    if (date < start || date >= end) {
      continue;
    }
    const newer =
      !best ||
      date > best.date ||
      (date.getTime() === best.date.getTime() &&
        (invoice.belgeNumarasi ?? '') > (best.invoice.belgeNumarasi ?? ''));
    if (newer) {
      best = { date, invoice };
    }
  }
  return best?.invoice ?? null;
}
