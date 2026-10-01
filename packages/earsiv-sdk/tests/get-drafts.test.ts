import { describe, expect, test } from 'vitest';
import { createClient, splitDateRange, type SessionInfo } from '../src/index.ts';

describe('splitDateRange', () => {
  test('keeps a range of seven days or less whole', () => {
    expect(splitDateRange('01/09/2026', '01/09/2026')).toEqual([
      { endDate: '01/09/2026', startDate: '01/09/2026' },
    ]);
    expect(splitDateRange('01/09/2026', '07/09/2026')).toEqual([
      { endDate: '07/09/2026', startDate: '01/09/2026' },
    ]);
  });

  test('splits a month into consecutive seven-day ranges', () => {
    expect(splitDateRange('01/09/2026', '30/09/2026')).toEqual([
      { endDate: '07/09/2026', startDate: '01/09/2026' },
      { endDate: '14/09/2026', startDate: '08/09/2026' },
      { endDate: '21/09/2026', startDate: '15/09/2026' },
      { endDate: '28/09/2026', startDate: '22/09/2026' },
      { endDate: '30/09/2026', startDate: '29/09/2026' },
    ]);
  });

  test('crosses month and year ends, and reads dashed dates', () => {
    expect(splitDateRange('28-12-2025', '05-01-2026')).toEqual([
      { endDate: '03/01/2026', startDate: '28/12/2025' },
      { endDate: '05/01/2026', startDate: '04/01/2026' },
    ]);
  });

  test('passes a range GİB would refuse through unchanged', () => {
    expect(splitDateRange('10/09/2026', '01/09/2026')).toEqual([
      { endDate: '01/09/2026', startDate: '10/09/2026' },
    ]);
    expect(splitDateRange('31/02/2026', '05/03/2026')).toEqual([
      { endDate: '05/03/2026', startDate: '31/02/2026' },
    ]);
  });
});

const session: SessionInfo = {
  baseUrl: 'https://earsiv.invalid',
  cookies: [],
  token: 'token',
};

/**
 * A fetch that answers the draft list command with `respond(start, end)` and
 * records each requested range in order.
 */
function fakePortal(respond: (start: string, end: string) => unknown) {
  const requests: Array<string> = [];
  const fetch = (async (_url: string, init?: RequestInit) => {
    const body = new URLSearchParams(String(init?.body));
    const { baslangic, bitis } = JSON.parse(body.get('jp') ?? '{}') as Record<string, string>;
    requests.push(`${baslangic}-${bitis}`);
    return new Response(JSON.stringify({ data: respond(baslangic, bitis) }));
  }) as typeof globalThis.fetch;
  return { client: createClient({ fetch }), requests };
}

describe('getDrafts', () => {
  test('fetches a long range in sequential chunks and merges them by ETTN', async () => {
    const { client, requests } = fakePortal((start) => {
      if (start === '01/09/2026') {
        return [
          { belgeTarihi: '02-09-2026', ettn: 'a' },
          { belgeTarihi: '07-09-2026', ettn: 'b' },
        ];
      }
      if (start === '08/09/2026') {
        return [
          { belgeTarihi: '07-09-2026', ettn: 'b' },
          { belgeTarihi: '09-09-2026', ettn: 'c' },
        ];
      }
      return [];
    });

    const rows = await client.getDrafts(session, '01/09/2026', '20/09/2026');

    expect(requests).toEqual([
      '01/09/2026-07/09/2026',
      '08/09/2026-14/09/2026',
      '15/09/2026-20/09/2026',
    ]);
    expect(rows).toEqual([
      { belgeTarihi: '02-09-2026', ettn: 'a' },
      { belgeTarihi: '07-09-2026', ettn: 'b' },
      { belgeTarihi: '09-09-2026', ettn: 'c' },
    ]);
  });

  test('throws the message of a refused query instead of returning it as a row', async () => {
    const { client } = fakePortal(() => [
      { error: 'Seçilen tarih aralığı 7 günden fazla olamaz!' },
    ]);

    await expect(client.getDrafts(session, '01/09/2026', '03/09/2026')).rejects.toThrow(
      'Seçilen tarih aralığı 7 günden fazla olamaz!',
    );
  });

  test('throws when data is not a list of rows', async () => {
    await expect(
      fakePortal(() => 'Kayıt bulunamadı').client.getDrafts(session, '01/09/2026', '01/09/2026'),
    ).rejects.toThrow('Kayıt bulunamadı');
    await expect(
      fakePortal(() => ({ error: 'x' })).client.getDrafts(session, '01/09/2026', '01/09/2026'),
    ).rejects.toThrow('GİB belge listesi okunamadı');
    await expect(
      fakePortal(() => undefined).client.getDrafts(session, '01/09/2026', '01/09/2026'),
    ).rejects.toThrow('GİB belge listesi okunamadı');
    await expect(
      fakePortal(() => [{ ettn: 'a' }, null]).client.getDrafts(session, '01/09/2026', '01/09/2026'),
    ).rejects.toThrow('GİB belge listesi okunamadı');
  });
});
