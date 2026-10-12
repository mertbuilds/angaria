import { describe, expect, test, vi } from 'vitest';
import {
  loadInvoiceWeeks,
  localWeekStore,
  weeksOf,
  type WeekStore,
} from '../src/lib/invoice-weeks.ts';
import type { Invoice } from '../src/lib/types.ts';

const memoryStore = (): WeekStore & { weeks: Map<string, Array<Invoice>> } => {
  const weeks = new Map<string, Array<Invoice>>();
  return {
    clear: () => weeks.clear(),
    forget: () => {},
    get: (monday) => weeks.get(monday),
    set: (monday, rows) => void weeks.set(monday, rows),
    weeks,
  };
};

const row = (date: string, onayDurumu = 'Onaylandı'): Invoice => ({
  belgeNumarasi: `GIB-${date}`,
  belgeTarihi: date,
  ettn: date,
  onayDurumu,
});

// Monday 12 October 2026.
const TODAY = new Date(2026, 9, 12);

describe('weeksOf', () => {
  test('covers the range with Monday-to-Sunday weeks, newest first', () => {
    const weeks = weeksOf(new Date(2026, 8, 30), new Date(2026, 9, 12));
    expect(weeks.map((week) => [week.start.getDate(), week.end.getDate()])).toEqual([
      [12, 18],
      [5, 11],
      [28, 4],
    ]);
  });

  test('a year is 53 or 54 weeks', () => {
    expect(weeksOf(new Date(2025, 9, 13), TODAY).length).toBeGreaterThanOrEqual(53);
  });
});

describe('loadInvoiceWeeks', () => {
  test('fetches newest week first, never past today, and reports each week', async () => {
    const asked: Array<string> = [];
    const partial: Array<number> = [];
    const progress: Array<string> = [];
    const rows = await loadInvoiceWeeks({
      end: '12/10/2026',
      fetchWeek: async (start, end) => {
        asked.push(`${start}-${end}`);
        return start === '12/10/2026' ? [row('12-10-2026')] : [row(`0${asked.length}-10-2026`)];
      },
      onPartial: (so) => partial.push(so.length),
      onProgress: ({ done, total }) => progress.push(`${done}/${total}`),
      start: '01/10/2026',
      store: memoryStore(),
      today: TODAY,
    });
    expect(asked).toEqual([
      '12/10/2026-12/10/2026',
      '05/10/2026-11/10/2026',
      '28/09/2026-04/10/2026',
    ]);
    expect(partial).toEqual([1, 2, 3]);
    expect(progress).toEqual(['0/3', '1/3', '2/3', '3/3']);
    expect(rows[0].belgeTarihi).toBe('12-10-2026');
  });

  test('keeps settled weeks without drafts, and reads them back with no request', async () => {
    const store = memoryStore();
    const fetchWeek = vi.fn(async (start: string) =>
      start === '03/08/2026'
        ? [row('04-08-2026', 'Onaylanmadı')]
        : [row(start.replaceAll('/', '-'))],
    );
    const range = { end: '16/08/2026', start: '03/08/2026', store, today: TODAY };
    await loadInvoiceWeeks({ ...range, fetchWeek });
    expect(fetchWeek).toHaveBeenCalledTimes(2);
    // The week with a draft is not kept; the other one is.
    expect([...store.weeks.keys()]).toEqual(['10/08/2026']);
    fetchWeek.mockClear();
    const again = await loadInvoiceWeeks({ ...range, fetchWeek });
    expect(fetchWeek).toHaveBeenCalledTimes(1);
    expect(again).toHaveLength(2);
  });

  test('never keeps a recent week, and leaves out rows outside the range', async () => {
    const store = memoryStore();
    const rows = await loadInvoiceWeeks({
      end: '07/10/2026',
      fetchWeek: async () => [row('05-10-2026'), row('06-10-2026'), row('09-10-2026')],
      start: '06/10/2026',
      store,
      today: TODAY,
    });
    expect(rows.map((invoice) => invoice.belgeTarihi)).toEqual(['06-10-2026']);
    expect(store.weeks.size).toBe(0);
  });
});

describe('localWeekStore', () => {
  test('forgets the week a date falls in, and only that week', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const store = localWeekStore('test-user');
    store.clear();
    store.set('13/07/2026', [row('14-07-2026')]);
    store.set('20/07/2026', [row('21-07-2026')]);
    // Wednesday 15 July 2026 is in the week of Monday 13 July.
    store.forget('15/07/2026');
    expect(store.get('13/07/2026')).toBeUndefined();
    expect(store.get('20/07/2026')).toHaveLength(1);
    store.clear();
    vi.unstubAllGlobals();
  });
});
