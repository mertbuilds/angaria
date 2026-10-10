import { describe, expect, test } from 'vitest';
import {
  DATE_PRESETS,
  invoiceStatus,
  matchesStatus,
  newestFirst,
  parseGIBInvoice,
  presetRange,
  rangePreset,
  recentInvoices,
  STATUS_FILTERS,
} from '../src/lib/invoices.ts';

const now = new Date(2026, 9, 15, 12);

describe('presetRange', () => {
  test('Bu ay runs from the first of the month to today', () => {
    expect(presetRange('bu-ay', now)).toEqual({ end: '15/10/2026', start: '01/10/2026' });
  });

  test('Geçen ay is the whole previous month', () => {
    expect(presetRange('gecen-ay', now)).toEqual({ end: '30/09/2026', start: '01/09/2026' });
  });

  test('Son 3 ay ends today and starts the day after the same date three months back', () => {
    expect(presetRange('son-3-ay', now)).toEqual({ end: '15/10/2026', start: '16/07/2026' });
    expect(presetRange('son-3-ay', new Date(2026, 1, 10))).toEqual({
      end: '10/02/2026',
      start: '11/11/2025',
    });
  });

  test('Son 3 ay stops at the end of a shorter month', () => {
    expect(presetRange('son-3-ay', new Date(2026, 4, 31)).start).toBe('01/03/2026');
    expect(presetRange('son-3-ay', new Date(2026, 11, 31)).start).toBe('01/10/2026');
    expect(presetRange('son-3-ay', new Date(2028, 1, 29)).start).toBe('30/11/2027');
    expect(presetRange('son-3-ay', new Date(2028, 4, 31)).start).toBe('01/03/2028');
  });
});

describe('presetRange, longer periods', () => {
  test('Son 6 ay ends today and starts the day after the same date six months back', () => {
    expect(presetRange('son-6-ay', now)).toEqual({ end: '15/10/2026', start: '16/04/2026' });
    expect(presetRange('son-6-ay', new Date(2026, 7, 31)).start).toBe('01/03/2026');
  });

  test('Bu yıl runs from 1 January to today', () => {
    expect(presetRange('bu-yil', now)).toEqual({ end: '15/10/2026', start: '01/01/2026' });
  });

  test('Geçen yıl is the whole previous year', () => {
    expect(presetRange('gecen-yil', now)).toEqual({ end: '31/12/2025', start: '01/01/2025' });
  });

  test('every preset has its own shortcut', () => {
    const keys = DATE_PRESETS.map(({ shortcut }) => shortcut.toLocaleLowerCase('tr'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('rangePreset', () => {
  test('recognizes the presets and calls anything else custom', () => {
    expect(rangePreset({ end: '15/10/2026', start: '01/10/2026' }, now)).toBe('bu-ay');
    expect(rangePreset({ end: '30/09/2026', start: '01/09/2026' }, now)).toBe('gecen-ay');
    expect(rangePreset({ end: '15/10/2026', start: '16/07/2026' }, now)).toBe('son-3-ay');
    expect(rangePreset({ end: '31/12/2025', start: '01/01/2025' }, now)).toBe('gecen-yil');
    expect(rangePreset({ end: '14/10/2026', start: '01/10/2026' }, now)).toBeNull();
  });
});

describe('invoiceStatus', () => {
  test('maps GİB statuses to filters, labels and badge variants', () => {
    expect(invoiceStatus({ onayDurumu: 'Onaylanmadı' })).toEqual({
      filter: 'onaylanmadi',
      label: 'Taslak',
      variant: 'outline',
    });
    expect(invoiceStatus({ onayDurumu: 'Onaylandı' })).toEqual({
      filter: 'onaylandi',
      label: 'Onaylı',
      variant: 'secondary',
    });
    expect(invoiceStatus({ onayDurumu: 'Silinmiş' })).toEqual({
      filter: 'silindi',
      label: 'Silindi',
      variant: 'ghost',
    });
  });

  test('a signed invoice whose cancellation GİB accepted is İptal edildi', () => {
    const cancelled = { filter: 'iptal', label: 'İptal edildi', variant: 'destructive' };
    const signed = { onayDurumu: 'Onaylandı' };
    expect(invoiceStatus({ ...signed, iptalItiraz: '0', iptalItirazDurumu: '1' })).toEqual(
      cancelled,
    );
    expect(invoiceStatus({ ...signed, iptalItiraz: 0, iptalItirazDurumu: 1 })).toEqual(cancelled);
    expect(invoiceStatus({ ...signed, iptalItirazDurumu: 'İptal Kabul Edildi' })).toEqual(
      cancelled,
    );
  });

  test('a waiting cancellation keeps Onaylı with a hint, a rejected one keeps Onaylı', () => {
    const signed = { iptalItiraz: '0', onayDurumu: 'Onaylandı' };
    expect(invoiceStatus({ ...signed, iptalItirazDurumu: '0' })).toEqual({
      filter: 'onaylandi',
      hint: 'İptal aşamasında',
      label: 'Onaylı',
      variant: 'secondary',
    });
    expect(invoiceStatus({ ...signed, iptalItirazDurumu: 'İptal Aşamasında' }).hint).toBe(
      'İptal aşamasında',
    );
    expect(invoiceStatus({ ...signed, iptalItirazDurumu: '2' })).toEqual({
      filter: 'onaylandi',
      label: 'Onaylı',
      variant: 'secondary',
    });
  });

  test('an objection or no request is not a cancellation', () => {
    const signed = { onayDurumu: 'Onaylandı' };
    expect(invoiceStatus({ ...signed, iptalItiraz: '1', iptalItirazDurumu: '1' }).label).toBe(
      'Onaylı',
    );
    expect(invoiceStatus({ ...signed, iptalItiraz: '-99', iptalItirazDurumu: '-99' }).label).toBe(
      'Onaylı',
    );
    // Only a signed invoice can be cancelled.
    expect(
      invoiceStatus({ iptalItiraz: '0', iptalItirazDurumu: '1', onayDurumu: 'Silinmiş' }).label,
    ).toBe('Silindi');
  });

  test('an unknown status keeps GİB’s text and shows only under Tümü', () => {
    expect(invoiceStatus({ onayDurumu: 'Beklemede' })).toEqual({
      filter: null,
      label: 'Beklemede',
      variant: 'outline',
    });
    expect(invoiceStatus({}).label).toBe('Bilinmiyor');
    expect(matchesStatus({ onayDurumu: 'Beklemede' }, 'tumu')).toBe(true);
    expect(matchesStatus({ onayDurumu: 'Beklemede' }, 'iptal')).toBe(false);
  });

  test('filters by status, Tümü keeps everything', () => {
    const signed = { onayDurumu: 'Onaylandı' };
    const deleted = { onayDurumu: 'Silinmiş' };
    expect(matchesStatus(signed, 'tumu')).toBe(true);
    expect(matchesStatus(signed, 'onaylandi')).toBe(true);
    expect(matchesStatus(signed, 'onaylanmadi')).toBe(false);
    expect(matchesStatus(deleted, 'silindi')).toBe(true);
    expect(matchesStatus(deleted, 'iptal')).toBe(false);
  });

  test('the filter offers every status in one vocabulary', () => {
    expect(STATUS_FILTERS.map(({ label }) => label)).toEqual([
      'Tümü',
      'Taslak',
      'Onaylı',
      'İptal edildi',
      'Silindi',
    ]);
  });
});

test('newestFirst orders by date, then by document number', () => {
  const sorted = newestFirst([
    { belgeNumarasi: 'GIB2026000000001', belgeTarihi: '01-09-2026', ettn: 'a' },
    { belgeNumarasi: 'GIB2026000000003', belgeTarihi: '30-09-2026', ettn: 'b' },
    { belgeNumarasi: 'GIB2026000000004', belgeTarihi: '30-09-2026', ettn: 'c' },
  ]);
  expect(sorted.map((invoice) => invoice.ettn)).toEqual(['c', 'b', 'a']);
});

test('recentInvoices keeps the newest of every list once, without deleted rows', () => {
  const september = { belgeNumarasi: 'GIB2026000000001', belgeTarihi: '30-09-2026', ettn: 'a' };
  const recent = recentInvoices(
    [
      september,
      { belgeNumarasi: 'GIB2026000000002', belgeTarihi: '01-10-2026', ettn: 'b' },
      { belgeNumarasi: 'GIB2026000000003', belgeTarihi: '01-10-2026', onayDurumu: 'Silinmiş' },
      { belgeTarihi: '01-10-2026', ettn: 'c', onayDurumu: 'Silinmiş' },
      { belgeNumarasi: 'GIB2026000000000', belgeTarihi: '01-08-2026', ettn: 'd' },
      september,
    ],
    2,
  );
  expect(recent.map((invoice) => invoice.ettn)).toEqual(['b', 'a']);
});

describe('parseGIBInvoice', () => {
  const detail = {
    aliciAdi: 'Ahmet',
    aliciSoyadi: 'Yılmaz',
    aliciUnvan: 'ÖRNEK TEKNOLOJİ A.Ş.',
    bulvarcaddesokak: 'Bağdat Cad. No:123',
    dovzTLkur: 0,
    faturaTipi: 'SATIS',
    mahalleSemtIlce: 'Kadıköy',
    malHizmetTable: [
      {
        birim: 'C62',
        birimFiyat: 300,
        iskontoOrani: 0,
        iskontoTutari: 100,
        kdvOrani: 20,
        malHizmet: 'Danışmanlık',
        miktar: 10,
      },
    ],
    not: 'Ekim',
    odenecekTutar: 3480,
    paraBirimi: 'USD',
    sehir: 'İstanbul ',
    ulke: 'Türkiye',
    vergiDairesi: 'Kadıköy',
    vknTckn: '1234567890',
  };

  test('reads the recipient, settings, items and totals', () => {
    const invoice = parseGIBInvoice(detail);
    expect(invoice.recipient).toEqual({
      city: 'İstanbul',
      country: 'Türkiye',
      district: 'Kadıköy',
      fullAddress: 'Bağdat Cad. No:123',
      name: 'Ahmet',
      surname: 'Yılmaz',
      taxIDOrTRID: '1234567890',
      taxOffice: 'Kadıköy',
      title: 'ÖRNEK TEKNOLOJİ A.Ş.',
    });
    expect(invoice.settings).toEqual({ currency: 'USD', currencyRate: '', invoiceType: 'SATIS' });
    expect(parseGIBInvoice({ ...detail, ulke: 'Amerika Birleşik Dev' }).recipient.country).toBe(
      'Amerika Birleşik Devletleri',
    );
    expect(invoice.items).toEqual([
      {
        discountAmount: 100,
        discountRate: 0,
        discountReason: '',
        gtip: '',
        name: 'Danışmanlık',
        quantity: 10,
        unitPrice: 300,
        unitType: 'C62',
        VATRate: 20,
      },
    ]);
    expect(invoice.subtotal).toBe(2900);
    expect(invoice.vat).toBe(580);
    expect(invoice.total).toBe(3480);
    expect(invoice.note).toBe('Ekim');
  });

  test('falls back to subtotal plus VAT without a payable amount', () => {
    const { odenecekTutar: _, ...withoutTotal } = detail;
    expect(parseGIBInvoice(withoutTotal).total).toBe(3480);
    expect(parseGIBInvoice({}).items).toEqual([]);
    expect(parseGIBInvoice({ dovzTLkur: '32,5' }).settings.currencyRate).toBe('32,5');
    // Tekrar kes loads the form through it too, so a numeric rate survives.
    expect(parseGIBInvoice({ dovzTLkur: 38.123 }).settings.currencyRate).toBe('38.123');
  });
});
