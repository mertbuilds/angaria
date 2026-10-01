const TCMB_BASE = 'https://www.tcmb.gov.tr/kurlar';

const pad = (n: number) => String(n).padStart(2, '0');

/** One day's TCMB forex buying rates, per one unit of each currency. */
export interface TCMBRateTable {
  /** The day the table was published for (a holiday falls back to the day before). */
  date: Date;
  rates: Map<string, number>;
}

/**
 * Fetch the TCMB daily exchange rate table for a given date (or today).
 * Tries going back up to 7 days to find the most recent available data (holidays/weekends have no data).
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
  const base = options?.baseUrl ? `${options.baseUrl}/kurlar` : TCMB_BASE;
  const start = baseDate ?? new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() - i);
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
      return { date, rates };
    }
  }
  throw new Error('TCMB kur verisi bulunamadı');
}

/**
 * Fetch TCMB daily exchange rates for a given date (or today).
 * Tries going back up to 7 days to find the most recent available data (holidays/weekends have no data).
 */
export async function fetchTCMBRates(
  baseDate?: Date,
  options?: Parameters<typeof fetchTCMBRateTable>[1],
): Promise<Map<string, number>> {
  return (await fetchTCMBRateTable(baseDate, options)).rates;
}
