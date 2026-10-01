// @vitest-environment jsdom
import { type RunningEmulator, startEmulator } from '@angaria/gib-emulator';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { fetchTCMBRateTable } from '../src';

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

test('requests /kurlar under the base URL, with or without a trailing slash', async () => {
  for (const baseUrl of [emulator.url, `${emulator.url}/`]) {
    const { fetch, urls } = recordingFetch();
    const table = await fetchTCMBRateTable(new Date(2026, 8, 29), { baseUrl, fetch });
    expect(urls).toEqual([`${emulator.url}/kurlar/202609/29092026.xml`]);
    expect(table.rates.get('USD')).toBeGreaterThan(0);
  }
});

test('walks back from a weekend to the last bulletin and returns its date', async () => {
  const { fetch, urls } = recordingFetch();
  const table = await fetchTCMBRateTable(new Date(2026, 8, 27), { baseUrl: emulator.url, fetch });
  expect(urls.map((url) => url.slice(-12))).toEqual([
    '27092026.xml',
    '26092026.xml',
    '25092026.xml',
  ]);
  expect(table.date).toEqual(new Date(2026, 8, 25));
});

test('quotes JPY per unit, not per 100 units', async () => {
  const xml = await (await fetch(`${emulator.url}/kurlar/202609/29092026.xml`)).text();
  const per100 = Number(
    /CurrencyCode="JPY">[\s\S]*?<ForexBuying>([\d.]+)<\/ForexBuying>/.exec(xml)?.[1],
  );
  const { rates } = await fetchTCMBRateTable(new Date(2026, 8, 29), { baseUrl: emulator.url });
  expect(per100).toBeGreaterThan(0);
  expect(rates.get('JPY')).toBeCloseTo(per100 / 100, 8);
});
