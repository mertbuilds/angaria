import { GibError } from 'angaria-earsiv-sdk';
import { describe, expect, test, vi } from 'vitest';
import {
  applyImport,
  IMPORT_PACE,
  importCandidates,
  importRange,
  importWeeks,
  isSignedInvoice,
  newCheckpoint,
  RATE_LIMIT_BACKOFF_MS,
  scanInvoices,
  type ScanClient,
  type ScannedInvoice,
  type ScanProgress,
} from '../src/lib/gib-import.ts';
import { parseGIBInvoice, type DateRange } from '../src/lib/invoices.ts';
import { ISTISNA_REASONS } from '../src/lib/regulated.ts';
import type { Invoice, Recipient, Service } from '../src/lib/types.ts';

const now = new Date(2026, 9, 10, 12);
const ISTISNA_302 = ISTISNA_REASONS.find((reason) => reason.code === '302')?.sentence ?? '';

/** GİB's invoice detail (EARSIV_PORTAL_FATURA_GETIR) with the fields the import reads. */
const detail = ({
  country = 'Türkiye',
  currency = 'TRY',
  lines = [{ name: 'Danışmanlık', price: 100, unit: 'HUR' }],
  name = 'ÖRNEK A.Ş.',
  note = '',
  taxID = '4820193752',
  type = 'SATIS',
  vat = 20,
}: {
  country?: string;
  currency?: string;
  lines?: Array<{ name: string; price: number; unit: string }>;
  name?: string;
  note?: string;
  taxID?: string;
  type?: string;
  vat?: number;
} = {}): Record<string, unknown> => ({
  aliciAdi: '',
  aliciSoyadi: '',
  aliciUnvan: name,
  bulvarcaddesokak: 'Adres',
  dovzTLkur: currency === 'TRY' ? '0' : '41.2',
  faturaTipi: type,
  mahalleSemtIlce: '',
  malHizmetTable: lines.map((line) => ({
    birim: line.unit,
    birimFiyat: String(line.price),
    kdvOrani: String(vat),
    malHizmet: line.name,
    miktar: 1,
  })),
  not: note,
  paraBirimi: currency,
  sehir: '',
  ulke: country,
  vergiDairesi: '',
  vknTckn: taxID,
});

const row = (ettn: string, belgeTarihi: string, fields: Partial<Invoice> = {}): Invoice => ({
  belgeTarihi,
  ettn,
  onayDurumu: 'Onaylandı',
  ...fields,
});

/** A fake GİB: rows by the first day of their week, details by ETTN. */
function fakeClient(
  rows: Record<string, Array<Invoice>>,
  details: Record<string, Record<string, unknown>>,
): ScanClient & { calls: Array<string> } {
  const calls: Array<string> = [];
  return {
    calls,
    detail: async (ettn) => {
      calls.push(`detail ${ettn}`);
      return details[ettn] ?? detail();
    },
    list: async (week: DateRange) => {
      calls.push(`list ${week.start}`);
      return rows[week.start] ?? [];
    },
  };
}

const scanned = (
  ettn: string,
  date: string,
  fields: Parameters<typeof detail>[0] = {},
): ScannedInvoice => ({ date, detail: parseGIBInvoice(detail(fields)), ettn });

const customer = (fields: Partial<Recipient>): Recipient => ({
  city: '',
  country: '',
  district: '',
  fullAddress: '',
  id: 'saved',
  name: '',
  surname: '',
  taxIDOrTRID: '',
  taxOffice: '',
  title: '',
  ...fields,
});

const service = (fields: Partial<Service>): Service => ({
  discountAmount: 0,
  discountRate: 0,
  discountReason: '',
  gtip: '',
  id: 'saved-service',
  name: '',
  quantity: 1,
  unitPrice: 0,
  unitType: 'C62',
  VATRate: 20,
  ...fields,
});

describe('importRange and importWeeks', () => {
  test('a year ends today and starts the day after the same date a year back', () => {
    expect(importRange('1-yil', now)).toEqual({ end: '10/10/2026', start: '11/10/2025' });
    expect(importRange('3-ay', now)).toEqual({ end: '10/10/2026', start: '11/07/2026' });
    expect(importRange('2-yil', now).start).toBe('11/10/2024');
  });

  test('splits the range into the seven days GİB lists per request', () => {
    const weeks = importWeeks(importRange('1-yil', now));
    expect(weeks).toHaveLength(53);
    expect(weeks[0]).toEqual({ end: '17/10/2025', start: '11/10/2025' });
    expect(weeks.at(-1)?.end).toBe('10/10/2026');
  });
});

describe('isSignedInvoice', () => {
  test('takes signed invoices, a pending cancellation too', () => {
    expect(isSignedInvoice(row('a', '01-10-2026'))).toBe(true);
    expect(isSignedInvoice(row('a', '01-10-2026', { iptalItiraz: 0, iptalItirazDurumu: 0 }))).toBe(
      true,
    );
  });

  test('skips drafts, cancelled and deleted documents', () => {
    expect(isSignedInvoice(row('a', '01-10-2026', { onayDurumu: 'Onaylanmadı' }))).toBe(false);
    expect(isSignedInvoice(row('a', '01-10-2026', { onayDurumu: 'Silinmiş' }))).toBe(false);
    expect(isSignedInvoice(row('a', '01-10-2026', { iptalItiraz: 0, iptalItirazDurumu: 1 }))).toBe(
      false,
    );
    expect(isSignedInvoice(row('', '01-10-2026'))).toBe(false);
  });
});

describe('scanInvoices', () => {
  const weeks = importWeeks({ end: '21/09/2026', start: '01/09/2026' });
  /** No waits between calls, for the tests that are not about the pace. */
  const fast = { ...IMPORT_PACE, burstPauseMs: 0, gapMs: 0, jitterMs: 0 };

  test('lists every week, then reads each signed invoice once, and reports progress', async () => {
    const client = fakeClient(
      {
        '01/09/2026': [
          row('signed', '02-09-2026'),
          row('draft', '03-09-2026', { onayDurumu: 'Onaylanmadı' }),
        ],
        '08/09/2026': [
          row('cancelled', '09-09-2026', { iptalItiraz: 0, iptalItirazDurumu: 1 }),
          row('deleted', '10-09-2026', { onayDurumu: 'Silinmiş' }),
          row('signed', '02-09-2026'),
        ],
        '15/09/2026': [row('late', '20-09-2026')],
      },
      {},
    );
    const progress: Array<ScanProgress> = [];
    const invoices = await scanInvoices(client, weeks, {
      onProgress: (step) => progress.push(step),
      pace: fast,
      signal: new AbortController().signal,
    });

    expect(invoices.map((invoice) => [invoice.ettn, invoice.date])).toEqual([
      ['signed', '02/09/2026'],
      ['late', '20/09/2026'],
    ]);
    expect(client.calls.filter((call) => call.startsWith('list'))).toHaveLength(3);
    expect(client.calls.filter((call) => call.startsWith('detail'))).toEqual([
      'detail signed',
      'detail late',
    ]);
    expect(progress.at(0)).toEqual({ done: 0, phase: 'weeks', total: 3 });
    expect(progress).toContainEqual({ done: 3, phase: 'weeks', total: 3 });
    expect(progress.at(-1)).toEqual({ done: 2, phase: 'details', total: 2 });
  });

  test('one call at a time, 400 ms ± 100 ms apart, and 5 seconds after every 50 calls', async () => {
    vi.useFakeTimers();
    try {
      let running = 0;
      let most = 0;
      const starts: Array<number> = [];
      const call = async <T>(value: T) => {
        starts.push(Date.now());
        running++;
        most = Math.max(most, running);
        await Promise.resolve();
        running--;
        return value;
      };
      // 53 weeks, nothing signed: 53 list calls.
      const year = importWeeks({ end: '31/12/2026', start: '01/01/2026' });
      const jitter = [0, 1, 0.5];
      let draws = 0;
      const scan = scanInvoices({ detail: () => call(detail()), list: () => call([]) }, year, {
        random: () => jitter[draws++ % jitter.length],
        signal: new AbortController().signal,
      });
      await vi.runAllTimersAsync();
      await scan;

      expect(most).toBe(1);
      const gaps = starts.slice(1).map((at, index) => at - starts[index]);
      expect(gaps.slice(0, 3)).toEqual([300, 500, 400]);
      expect(gaps[49]).toBe(5000);
      expect(gaps.filter((gap) => gap === 5000)).toHaveLength(1);
      expect(gaps.every((gap) => gap === 5000 || (gap >= 300 && gap <= 500))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test('a call whose session expired goes again once', async () => {
    const list = vi
      .fn<ScanClient['list']>()
      .mockRejectedValueOnce(new GibError('session-expired', 'Oturum süresi doldu'))
      .mockResolvedValue([]);
    await expect(
      scanInvoices({ detail: async () => detail(), list }, weeks.slice(0, 1), {
        pace: fast,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual([]);
    expect(list).toHaveBeenCalledTimes(2);
  });

  test('a busy GİB is retried after 30, 60 and 120 seconds, showing the wait, then the scan stops', async () => {
    vi.useFakeTimers();
    try {
      const busy = new GibError('rate-limit', 'GİB çok fazla istek aldı', { status: 429 });
      const list = vi.fn<ScanClient['list']>().mockRejectedValue(busy);
      const progress: Array<ScanProgress> = [];
      const scan = scanInvoices({ detail: async () => detail(), list }, weeks, {
        onProgress: (step) => progress.push(step),
        pace: fast,
        signal: new AbortController().signal,
      });
      const stopped = expect(scan).rejects.toBe(busy);

      await vi.advanceTimersByTimeAsync(0);
      expect(list).toHaveBeenCalledTimes(1);
      expect(progress.at(-1)?.wait).toEqual({ attempt: 1, seconds: 30 });
      await vi.advanceTimersByTimeAsync(29_999);
      expect(list).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(list).toHaveBeenCalledTimes(2);
      expect(progress.at(-1)?.wait).toEqual({ attempt: 2, seconds: 60 });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(list).toHaveBeenCalledTimes(3);
      expect(progress.at(-1)?.wait).toEqual({ attempt: 3, seconds: 120 });
      await vi.advanceTimersByTimeAsync(120_000);
      await stopped;
      expect(list).toHaveBeenCalledTimes(1 + RATE_LIMIT_BACKOFF_MS.length);
    } finally {
      vi.useRealTimers();
    }
  });

  test('a busy GİB that answers again goes on with the same call', async () => {
    vi.useFakeTimers();
    try {
      const list = vi
        .fn<ScanClient['list']>()
        .mockRejectedValueOnce(new GibError('rate-limit', 'Çok fazla istek'))
        .mockResolvedValue([]);
      const scan = scanInvoices({ detail: async () => detail(), list }, weeks, {
        pace: fast,
        signal: new AbortController().signal,
      });
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(scan).resolves.toEqual([]);
      expect(list.mock.calls.map(([week]) => week.start)).toEqual([
        '01/09/2026',
        '01/09/2026',
        '08/09/2026',
        '15/09/2026',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  test('another failure stops the scan with GİB’s error at once', async () => {
    const error = new GibError(
      'session-locked',
      'Sisteme aynı anda birden fazla giriş yapamazsınız',
    );
    const list = vi.fn<ScanClient['list']>().mockRejectedValue(error);
    await expect(
      scanInvoices({ detail: async () => detail(), list }, weeks, {
        pace: fast,
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(error);
    expect(list).toHaveBeenCalledTimes(1);
  });

  test('a scan that stopped goes on from its checkpoint, never fetching twice', async () => {
    const client = fakeClient(
      { '01/09/2026': [row('a', '02-09-2026')], '15/09/2026': [row('b', '16-09-2026')] },
      {},
    );
    const checkpoint = newCheckpoint();
    const down = new GibError('network', 'GİB’e ulaşılamadı');
    let failOnce = true;
    const flaky: ScanClient = {
      detail: async (ettn, signal) => {
        if (ettn === 'b' && failOnce) {
          failOnce = false;
          throw down;
        }
        return client.detail(ettn, signal);
      },
      list: client.list,
    };
    const options = { checkpoint, pace: fast, signal: new AbortController().signal };

    await expect(scanInvoices(flaky, weeks, options)).rejects.toBe(down);
    expect(client.calls).toEqual([
      'list 01/09/2026',
      'list 08/09/2026',
      'list 15/09/2026',
      'detail a',
    ]);

    const invoices = await scanInvoices(flaky, weeks, options);
    expect(invoices.map((invoice) => invoice.ettn)).toEqual(['a', 'b']);
    expect(client.calls.slice(4)).toEqual(['detail b']);
  });

  test('stops when cancelled', async () => {
    const controller = new AbortController();
    const client = fakeClient({}, {});
    const scan = scanInvoices(
      {
        ...client,
        list: async (week, signal) => {
          controller.abort(new DOMException('Vazgeçildi', 'AbortError'));
          return client.list(week, signal);
        },
      },
      weeks,
      { pace: fast, signal: controller.signal },
    );
    await expect(scan).rejects.toMatchObject({ name: 'AbortError' });
    expect(client.calls).toHaveLength(1);
  });
});

const line = (name: string) => [{ name, price: 100, unit: 'HUR' }];

describe('importCandidates', () => {
  test('one customer per VKN / TCKN with its invoice count and newest invoice', () => {
    const { customers } = importCandidates(
      [
        scanned('a', '01/03/2026', { name: 'ÖRNEK A.Ş.' }),
        scanned('b', '01/06/2026', { name: 'Örnek Anonim Şirketi' }),
        scanned('c', '01/05/2026', { name: 'MAVİ LTD.', taxID: '7310045629' }),
      ],
      { customers: [], services: [] },
    );
    expect(customers.map(({ invoiceCount, name, taxID }) => [name, taxID, invoiceCount])).toEqual([
      ['Örnek Anonim Şirketi', '4820193752', 2],
      ['MAVİ LTD.', '7310045629', 1],
    ]);
    expect(customers[0].latest.ettn).toBe('b');
  });

  test('matches names by Turkish capitals: Kır and Kir are two, Plastic and PLASTIC one', () => {
    const { customers, services } = importCandidates(
      [
        scanned('a', '01/03/2026', { lines: line('Kır'), name: 'Kır', taxID: '2222222222' }),
        scanned('b', '01/04/2026', { lines: line('Kir'), name: 'Kir', taxID: '2222222222' }),
        scanned('c', '01/05/2026', {
          lines: line('Plastic'),
          name: 'Plastic',
          taxID: '2222222222',
        }),
        scanned('d', '01/06/2026', {
          lines: line('PLASTIC'),
          name: 'PLASTIC',
          taxID: '2222222222',
        }),
        scanned('e', '01/07/2026', { lines: line('Yazılım Geliştirme Hizmeti') }),
      ],
      { customers: [], services: [service({ name: 'YAZILIM GELIŞTIRME HIZMETI' })] },
    );
    expect(customers.map(({ invoiceCount, key }) => [key, invoiceCount])).toEqual([
      ['4820193752', 1],
      ['2222222222:PLASTİC:Türkiye', 2],
      ['2222222222:KİR:Türkiye', 1],
      ['2222222222:KIR:Türkiye', 1],
    ]);
    expect(services.map(({ existing, key }) => [key, existing])).toEqual([
      ['PLASTİC:HUR:TRY', false],
      ['KİR:HUR:TRY', false],
      ['KIR:HUR:TRY', false],
      ['YAZILIM GELİŞTİRME HİZMETİ:HUR:TRY', true],
    ]);
  });

  test('tells customers on GİB’s foreign VKN apart by name and country', () => {
    const abroad = { taxID: '2222222222' };
    const { customers } = importCandidates(
      [
        scanned('a', '01/03/2026', { ...abroad, country: 'Almanya', name: 'ACME GMBH' }),
        scanned('b', '01/04/2026', { ...abroad, country: 'Almanya', name: 'Acme GmbH' }),
        scanned('c', '01/05/2026', { ...abroad, country: 'İsveç', name: 'ACME GMBH' }),
        scanned('d', '01/06/2026', { ...abroad, country: 'Almanya', name: 'PLASTIC LLC' }),
      ],
      { customers: [], services: [] },
    );
    expect(customers.map(({ invoiceCount, name }) => [name, invoiceCount])).toEqual([
      ['PLASTIC LLC', 1],
      ['ACME GMBH', 1],
      ['Acme GmbH', 2],
    ]);
  });

  test('marks saved customers, by VKN alone or by name on a placeholder', () => {
    const { customers } = importCandidates(
      [
        scanned('a', '01/03/2026', { name: 'Yeni Unvan A.Ş.' }),
        scanned('b', '01/04/2026', { country: 'Almanya', name: 'ACME GMBH', taxID: '2222222222' }),
        scanned('c', '01/05/2026', { country: 'Almanya', name: 'OTHER GMBH', taxID: '2222222222' }),
      ],
      {
        customers: [
          customer({ taxIDOrTRID: '4820193752', title: 'Eski Unvan A.Ş.' }),
          customer({ country: 'Almanya', taxIDOrTRID: '2222222222', title: 'Acme GmbH' }),
        ],
        services: [],
      },
    );
    expect(customers.map(({ existing, name }) => [name, existing])).toEqual([
      ['OTHER GMBH', false],
      ['ACME GMBH', true],
      ['Yeni Unvan A.Ş.', true],
    ]);
  });

  test('one service per name, unit and currency at its newest price', () => {
    const { services } = importCandidates(
      [
        scanned('a', '01/03/2026', { lines: [{ name: 'Danışmanlık', price: 100, unit: 'HUR' }] }),
        scanned('b', '01/05/2026', { lines: [{ name: 'DANIŞMANLIK', price: 120, unit: 'HUR' }] }),
        scanned('c', '01/04/2026', {
          currency: 'EUR',
          lines: [{ name: 'Danışmanlık', price: 90, unit: 'HUR' }],
        }),
        scanned('d', '01/02/2026', {
          lines: [
            { name: 'Danışmanlık', price: 3000, unit: 'MON' },
            { name: '  ', price: 1, unit: 'C62' },
          ],
        }),
      ],
      { customers: [], services: [] },
    );
    expect(
      services.map(({ service }) => [
        service.name,
        service.unitType,
        service.currency,
        service.unitPrice,
      ]),
    ).toEqual([
      ['DANIŞMANLIK', 'HUR', 'TRY', 120],
      ['Danışmanlık', 'HUR', 'EUR', 90],
      ['Danışmanlık', 'MON', 'TRY', 3000],
    ]);
  });

  test('marks a service saved under the same name', () => {
    const { services } = importCandidates(
      [scanned('a', '01/03/2026', { lines: [{ name: 'Danışmanlık', price: 100, unit: 'HUR' }] })],
      { customers: [], services: [service({ currency: 'USD', name: 'danışmanlık ' })] },
    );
    expect(services[0].existing).toBe(true);
  });
  test('lists new ones before saved ones', () => {
    const { customers, services } = importCandidates(
      [
        scanned('a', '01/03/2026', {
          lines: [{ name: 'Kurulum', price: 1, unit: 'C62' }],
          name: 'ESKİ A.Ş.',
          taxID: '6152239089',
        }),
        scanned('b', '01/06/2026', { lines: [{ name: 'Bakım', price: 1, unit: 'MON' }] }),
      ],
      {
        customers: [customer({ taxIDOrTRID: '4820193752', title: 'ÖRNEK A.Ş.' })],
        services: [service({ name: 'Bakım' })],
      },
    );
    expect(customers.map(({ existing, name }) => [name, existing])).toEqual([
      ['ESKİ A.Ş.', false],
      ['ÖRNEK A.Ş.', true],
    ]);
    expect(services.map(({ existing, service: item }) => [item.name, existing])).toEqual([
      ['Kurulum', false],
      ['Bakım', true],
    ]);
  });
});

describe('applyImport', () => {
  let id = 0;
  const newId = () => `new-${++id}`;

  test('adds the chosen customers with the defaults their newest invoice teaches', () => {
    const invoices = [
      scanned('old', '01/03/2026', { country: 'Almanya', currency: 'TRY', taxID: '2222222222' }),
      scanned('new', '01/06/2026', {
        country: 'Almanya',
        currency: 'EUR',
        note: ISTISNA_302,
        taxID: '2222222222',
        type: 'ISTISNA',
        vat: 0,
      }),
    ];
    const chosen = importCandidates(invoices, { customers: [], services: [] });
    const result = applyImport({ customers: [], services: [] }, chosen, newId, (ettn) =>
      ettn === 'new' ? '15/06/2026' : undefined,
    );
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0]).toMatchObject({
      country: 'Almanya',
      currency: 'EUR',
      dueDays: 14,
      invoiceType: 'ISTISNA',
      istisnaCode: '302',
      pdfLanguage: 'en',
      taxIDOrTRID: '2222222222',
      title: 'ÖRNEK A.Ş.',
      VATRate: 0,
    });
    expect(new Date(result.customers[0].lastInvoicedAt ?? '').getDate()).toBe(1);
  });

  test("saves the full country name for GİB's cut one", () => {
    const chosen = importCandidates(
      [scanned('a', '01/03/2026', { country: 'Amerika Birleşik Dev', taxID: '2222222222' })],
      { customers: [], services: [] },
    );
    const [learned] = applyImport({ customers: [], services: [] }, chosen, newId).customers;
    expect(learned.country).toBe('Amerika Birleşik Devletleri');
  });

  test('a customer at home gets a Turkish PDF and no due date when none was kept', () => {
    const chosen = importCandidates([scanned('a', '01/03/2026')], { customers: [], services: [] });
    const [learned] = applyImport({ customers: [], services: [] }, chosen, newId).customers;
    expect(learned).toMatchObject({ currency: 'TRY', invoiceType: 'SATIS', pdfLanguage: 'tr' });
    expect(learned.dueDays).toBeUndefined();
  });

  test('never changes a saved customer or service, and adds only the chosen ones', () => {
    const saved = {
      customers: [customer({ currency: 'USD', taxIDOrTRID: '4820193752', title: 'Eski' })],
      services: [service({ name: 'Danışmanlık', unitPrice: 1 })],
    };
    const candidates = importCandidates(
      [
        scanned('a', '01/03/2026', {
          lines: [
            { name: 'Danışmanlık', price: 100, unit: 'HUR' },
            { name: 'Bakım', price: 50, unit: 'MON' },
            { name: 'Kurulum', price: 70, unit: 'C62' },
          ],
        }),
        scanned('b', '01/04/2026', { name: 'MAVİ', taxID: '7310045629' }),
      ],
      saved,
    );
    const result = applyImport(
      saved,
      {
        customers: candidates.customers,
        services: candidates.services.filter(({ service: item }) => item.name !== 'Kurulum'),
      },
      newId,
    );
    expect(result.customers[0]).toBe(saved.customers[0]);
    expect(result.customers.map((item) => item.title)).toEqual(['Eski', 'MAVİ']);
    expect(result.services[0]).toBe(saved.services[0]);
    expect(result.services.map((item) => [item.name, item.currency, item.unitPrice])).toEqual([
      ['Danışmanlık', undefined, 1],
      ['Bakım', 'TRY', 50],
    ]);
  });
});
