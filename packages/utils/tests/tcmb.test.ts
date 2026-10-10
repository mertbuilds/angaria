// @vitest-environment jsdom
import { type RunningEmulator, startEmulator } from '@angaria/gib-emulator';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { fetchTCMBRateTable, TCMBRateError } from '../src';

// fetchTCMBRateTable against the TCMB feed of the GİB emulator. jsdom gives
// the DOMParser the app has in the webview.

let emulator: RunningEmulator;

beforeAll(async () => {
  // Wednesday 30 September 2026, 16:00 in Istanbul: that day's bulletin is out.
  emulator = await startEmulator({ now: () => Date.UTC(2026, 8, 30, 13) });
});

afterAll(() => emulator.close());

function recordingFetch() {
  const urls: Array<string> = [];
  const fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    return globalThis.fetch(input, init);
  }) as typeof globalThis.fetch;
  return { fetch, urls };
}

const files = (urls: Array<string>) => urls.map((url) => url.slice(-12));

test('requests /kurlar under the base URL, with or without a trailing slash', async () => {
  for (const baseUrl of [emulator.url, `${emulator.url}/`]) {
    const { fetch, urls } = recordingFetch();
    const table = await fetchTCMBRateTable(new Date(2026, 8, 29), { baseUrl, fetch });
    expect(urls).toEqual([`${emulator.url}/kurlar/202609/28092026.xml`]);
    expect(table.rates.get('USD')).toBeGreaterThan(0);
  }
});

test('by default takes the bulletin of the day before, which is valid on the invoice date', async () => {
  const { fetch, urls } = recordingFetch();
  const table = await fetchTCMBRateTable(new Date(2026, 8, 30, 9, 45), {
    baseUrl: emulator.url,
    fetch,
  });
  expect(files(urls)).toEqual(['29092026.xml']);
  expect(table.publishedOn).toEqual(new Date(2026, 8, 29));
  expect(table.validFor).toEqual(new Date(2026, 8, 30));
});

test('walks back over a weekend to the last bulletin', async () => {
  // Monday 28 September: Friday's bulletin is the one valid on Monday.
  const previous = recordingFetch();
  const table = await fetchTCMBRateTable(new Date(2026, 8, 28), {
    baseUrl: emulator.url,
    fetch: previous.fetch,
  });
  expect(files(previous.urls)).toEqual(['27092026.xml', '26092026.xml', '25092026.xml']);
  expect(table.publishedOn).toEqual(new Date(2026, 8, 25));
  expect(table.validFor).toEqual(new Date(2026, 8, 28));
});

describe('the time of day', () => {
  // Friday 2 October 2026 in Istanbul (UTC+3): before and after TCMB's 15:30 bulletin.
  const clocks = { afternoon: Date.UTC(2026, 9, 2, 13), morning: Date.UTC(2026, 9, 2, 7) };
  const emulators: Partial<Record<keyof typeof clocks, RunningEmulator>> = {};

  beforeAll(async () => {
    emulators.morning = await startEmulator({ now: () => clocks.morning });
    emulators.afternoon = await startEmulator({ now: () => clocks.afternoon });
  });

  afterAll(async () => {
    await emulators.morning?.close();
    await emulators.afternoon?.close();
  });

  /** The table asked for at `time` of day, the app's clock set to the same time. */
  async function tableAt(time: keyof typeof clocks, date: Date | undefined) {
    vi.useFakeTimers({ now: clocks[time], toFake: ['Date'] });
    try {
      const { publishedOn, rates, validFor } = await fetchTCMBRateTable(date, {
        baseUrl: emulators[time]?.url,
      });
      return { publishedOn, rates: Object.fromEntries(rates), validFor };
    } finally {
      vi.useRealTimers();
    }
  }

  test('does not change the rate for today’s invoice', async () => {
    for (const date of [undefined, new Date(2026, 9, 2), new Date(2026, 9, 2, 17, 5)]) {
      const morning = await tableAt('morning', date);
      expect(morning.publishedOn).toEqual(new Date(2026, 9, 1));
      expect(morning.validFor).toEqual(new Date(2026, 9, 2));
      expect(await tableAt('afternoon', date)).toEqual(morning);
    }
  });

  test('does not change the rate for a back-dated invoice', async () => {
    const date = new Date(2026, 8, 30);
    expect(await tableAt('afternoon', date)).toEqual(await tableAt('morning', date));
  });
});

test('quotes JPY per unit, not per 100 units', async () => {
  const xml = await (await fetch(`${emulator.url}/kurlar/202609/29092026.xml`)).text();
  const per100 = Number(
    /CurrencyCode="JPY">[\s\S]*?<ForexBuying>([\d.]+)<\/ForexBuying>/.exec(xml)?.[1],
  );
  const { rates } = await fetchTCMBRateTable(new Date(2026, 8, 30), {
    baseUrl: emulator.url,
  });
  expect(per100).toBeGreaterThan(0);
  expect(rates.get('JPY')).toBeCloseTo(per100 / 100, 8);
});

describe('dates without a lira rate', () => {
  test('refuses an invoice date before 4 January 2005 without asking TCMB', async () => {
    const { fetch, urls } = recordingFetch();
    for (const date of [new Date(1990, 0, 1), new Date(2004, 11, 31), new Date(2005, 0, 3)]) {
      const error = await fetchTCMBRateTable(date, { baseUrl: emulator.url, fetch }).catch(
        (error: unknown) => error,
      );
      expect(error).toBeInstanceOf(TCMBRateError);
      expect((error as Error).message).toContain('04/01/2005');
    }
    expect(urls).toEqual([]);
  });

  test('names the date when no bulletin was published in the week before it', async () => {
    const fetch = (() =>
      Promise.resolve(new Response('', { status: 404 }))) as typeof globalThis.fetch;
    await expect(fetchTCMBRateTable(new Date(2026, 8, 30), { fetch })).rejects.toThrow(
      new TCMBRateError('30/09/2026 tarihli fatura için TCMB kur bülteni bulunamadı.'),
    );
  });
});

const currency = (code: string, unit: string, buying: string) =>
  `<Currency CurrencyCode="${code}"><Unit>${unit}</Unit><ForexBuying>${buying}</ForexBuying></Currency>`;

test('skips a currency whose rate is missing, zero, negative or has a broken unit', async () => {
  const xml = `<Tarih_Date>${[
    currency('USD', '1', '41.2850'),
    currency('JPY', '100', '27.6543'),
    currency('EUR', '1', '-0.9949'),
    currency('GBP', '1', '0'),
    currency('CHF', '1', ''),
    currency('SEK', '0', '4.38'),
    currency('NOK', 'x', '4.12'),
  ].join('')}</Tarih_Date>`;
  const fetch = (() => Promise.resolve(new Response(xml))) as typeof globalThis.fetch;
  const { rates } = await fetchTCMBRateTable(new Date(2026, 8, 30), { fetch });
  expect([...rates.keys()]).toEqual(['USD', 'JPY']);
  expect(rates.get('USD')).toBe(41.285);
  expect(rates.get('JPY')).toBeCloseTo(0.276543, 10);
});
