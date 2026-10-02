const TCMB_BASE = 'https://www.tcmb.gov.tr/kurlar';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Which TCMB bulletin an invoice dated D uses. 'previous': the one TCMB
 * published on the business day before D (at 15:30), which the Resmî Gazete
 * carries on D. 'same': the one published on D itself.
 */
export type TCMBRateDay = 'previous' | 'same';

/** One TCMB bulletin's forex buying rates, per one unit of each currency. */
export interface TCMBRateTable {
  /** The day TCMB published the bulletin (a holiday falls back to the day before). */
  publishedOn: Date;
  rates: Map<string, number>;
  /** The invoice date the bulletin was looked up for. */
  validFor: Date;
}

/**
 * Fetch the TCMB bulletin for an invoice dated `baseDate` (default today), by
 * `rateDay` (default 'previous'). Weekends and holidays have no bulletin, so it
 * walks back up to 7 days to the last one. The time of day plays no part: only
 * the date counts.
 */
export async function fetchTCMBRateTable(
  baseDate?: Date,
  options?: {
    /** TCMB origin, e.g. the local GİB emulator, which also serves /kurlar. */
    baseUrl?: string;
    fetch?: typeof globalThis.fetch;
    rateDay?: TCMBRateDay;
  },
): Promise<TCMBRateTable> {
  const fetchFn = options?.fetch ?? globalThis.fetch;
  const base = options?.baseUrl ? `${options.baseUrl.replace(/\/+$/, '')}/kurlar` : TCMB_BASE;
  const day = baseDate ?? new Date();
  const validFor = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const first = options?.rateDay === 'same' ? 0 : 1;
  for (let i = first; i < first + 7; i++) {
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
      const unit = Number(node.querySelector('Unit')?.textContent) || 1;
      const buying = Number(node.querySelector('ForexBuying')?.textContent);
      if (code && buying) {
        rates.set(code, buying / unit);
      }
    }
    if (rates.size > 0) {
      return { publishedOn: date, rates, validFor };
    }
  }
  throw new Error('TCMB kur verisi bulunamadı');
}

/** The rates of fetchTCMBRateTable's bulletin. */
export async function fetchTCMBRates(
  baseDate?: Date,
  options?: Parameters<typeof fetchTCMBRateTable>[1],
): Promise<Map<string, number>> {
  return (await fetchTCMBRateTable(baseDate, options)).rates;
}
