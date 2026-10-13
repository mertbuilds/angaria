const TCMB_BASE = 'https://www.tcmb.gov.tr/kurlar';

const pad = (n: number) => String(n).padStart(2, '0');

/** Why there is no rate for the date, in Turkish, for the user and agents. */
export class TCMBRateError extends Error {
  override name = 'TCMBRateError';
}

/**
 * The first invoice date with a rate in Turkish lira. TCMB's archive starts on
 * 16 April 1996, but its bulletins are in old lira (TRL, a million times
 * more) until 31 December 2004; the first in new lira is 3 January 2005's,
 * valid on 4 January.
 */
export const TCMB_FIRST_INVOICE_DATE = new Date(2005, 0, 4);

/** The rate for one unit (TCMB quotes JPY per 100), or undefined for a missing or broken value. */
function perUnit(unitText: string | null | undefined, buyingText: string | null | undefined) {
  const unit = Number(unitText?.trim() || '1');
  const buying = Number(buyingText?.trim() || Number.NaN);
  const rate = buying / unit;
  return unit > 0 && Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

/** One TCMB bulletin's forex buying rates, per one unit of each currency. */
export interface TCMBRateTable {
  /** The day TCMB published the bulletin (a holiday falls back to the day before). */
  publishedOn: Date;
  rates: Map<string, number>;
  /** The invoice date the bulletin was looked up for. */
  validFor: Date;
}

/**
 * Fetch the TCMB bulletin for an invoice dated `baseDate` (default today): the
 * one TCMB published on the business day before it (at 15:30), which the
 * Resmî Gazete carries on that day (KDV Genel Uygulama Tebliği III/A-1.1). Weekends and holidays have no bulletin, so it
 * walks back up to 7 days to the last one. The time of day plays no part: only
 * the date counts.
 */
export async function fetchTCMBRateTable(
  baseDate?: Date,
  options?: {
    /** TCMB origin, e.g. the local GİB emulator, which also serves /kurlar. */
    baseUrl?: string;
    fetch?: typeof globalThis.fetch;
  },
): Promise<TCMBRateTable> {
  const fetchFn = options?.fetch ?? globalThis.fetch;
  const base = options?.baseUrl ? `${options.baseUrl.replace(/\/+$/, '')}/kurlar` : TCMB_BASE;
  const day = baseDate ?? new Date();
  const validFor = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (Number.isNaN(validFor.getTime()) || validFor < TCMB_FIRST_INVOICE_DATE) {
    throw new TCMBRateError(
      'TCMB’nin bu tarih için Türk lirası kuru yok: kurlar 04/01/2005 ve sonrası tarihli faturalar için var.',
    );
  }
  for (let i = 1; i < 8; i++) {
    const date = new Date(validFor.getFullYear(), validFor.getMonth(), validFor.getDate() - i);
    const d = pad(date.getDate());
    const m = pad(date.getMonth() + 1);
    const y = date.getFullYear();
    const url = `${base}/${y}${m}/${d}${m}${y}.xml`;
    const response = await fetchFn(url);
    if (!response.ok) {
      continue;
    }
    const xml = await response.text();
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const rates = new Map<string, number>();
    for (const node of doc.querySelectorAll('Currency')) {
      const code = node.getAttribute('CurrencyCode');
      const rate = perUnit(
        node.querySelector('Unit')?.textContent,
        node.querySelector('ForexBuying')?.textContent,
      );
      if (code && rate !== undefined) {
        rates.set(code, rate);
      }
    }
    if (rates.size > 0) {
      return { publishedOn: date, rates, validFor };
    }
  }
  throw new TCMBRateError(
    `${pad(validFor.getDate())}/${pad(validFor.getMonth() + 1)}/${validFor.getFullYear()} tarihli fatura için TCMB kur bülteni bulunamadı.`,
  );
}

/** The rates of fetchTCMBRateTable's bulletin. */
export async function fetchTCMBRates(
  baseDate?: Date,
  options?: Parameters<typeof fetchTCMBRateTable>[1],
): Promise<Map<string, number>> {
  return (await fetchTCMBRateTable(baseDate, options)).rates;
}
