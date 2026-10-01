import { describe, expect, test } from 'vitest';
import { lastMonthInvoice, previousMonthRange } from '../src/lib/reissue.ts';

const now = new Date(2026, 9, 1, 12);

describe('previousMonthRange', () => {
  test('covers the whole previous month', () => {
    expect(previousMonthRange(now)).toEqual({ end: '30/09/2026', start: '01/09/2026' });
  });

  test('wraps into the previous year in January', () => {
    expect(previousMonthRange(new Date(2026, 0, 15))).toEqual({
      end: '31/12/2025',
      start: '01/12/2025',
    });
  });
});

describe('lastMonthInvoice', () => {
  test('picks the newest invoice of the previous month', () => {
    const invoices = [
      { belgeNumarasi: 'GIB2026000000001', belgeTarihi: '03/09/2026', ettn: 'a' },
      { belgeNumarasi: 'GIB2026000000002', belgeTarihi: '28-09-2026', ettn: 'b' },
      { belgeNumarasi: 'GIB2026000000003', belgeTarihi: '01/10/2026', ettn: 'c' },
      { belgeNumarasi: 'GIB2026000000000', belgeTarihi: '31/08/2026', ettn: 'd' },
    ];
    expect(lastMonthInvoice(invoices, now)?.ettn).toBe('b');
  });

  test('breaks a same-day tie by document number', () => {
    const invoices = [
      { belgeNumarasi: 'GIB2026000000007', belgeTarihi: '30/09/2026', ettn: 'a' },
      { belgeNumarasi: 'GIB2026000000009', belgeTarihi: '30/09/2026', ettn: 'b' },
    ];
    expect(lastMonthInvoice(invoices, now)?.ettn).toBe('b');
  });

  test('skips deleted invoices and rows without an ETTN', () => {
    const invoices = [
      { belgeTarihi: '29/09/2026', ettn: 'a', onayDurumu: 'Onaylandı' },
      { belgeTarihi: '30/09/2026', ettn: 'b', onayDurumu: 'Silinmiş' },
      { belgeTarihi: '30/09/2026' },
    ];
    expect(lastMonthInvoice(invoices, now)?.ettn).toBe('a');
  });

  test('returns null when nothing falls in the previous month', () => {
    expect(lastMonthInvoice([{ belgeTarihi: '02/10/2026', ettn: 'a' }], now)).toBeNull();
  });
});
