import { describe, expect, test } from 'vitest';
import {
  conversionHint,
  convertAmount,
  convertLine,
  formatPrice,
  historyCurrency,
  priceConversion,
  withServiceCurrencies,
  type InvoiceRates,
} from '../src/lib/services.ts';
import type { InvoiceItem, Recipient, Service } from '../src/lib/types.ts';

const TODAY = new Date(2026, 9, 3);
const PUBLISHED = new Date(2026, 9, 1);

const service = (fields: Partial<Service> = {}): Service => ({
  discountAmount: 0,
  discountRate: 0,
  discountReason: '',
  gtip: '',
  id: 's',
  name: 'Danışmanlık',
  quantity: 1,
  unitPrice: 100,
  unitType: 'C62',
  VATRate: 20,
  ...fields,
});

const customer = (fields: Partial<Recipient>): Recipient => ({
  city: '',
  country: '',
  district: '',
  fullAddress: '',
  id: 'c',
  name: '',
  surname: '',
  taxIDOrTRID: '2222222222',
  taxOffice: '',
  title: 'ACME',
  ...fields,
});

const TCMB = {
  publishedOn: PUBLISHED,
  rates: new Map([
    ['EUR', 47.9876],
    ['GBP', 55.1234],
    ['USD', 41.1032],
  ]),
};

const rates = (fields: Partial<InvoiceRates> = {}): InvoiceRates => ({
  currency: 'TRY',
  rate: null,
  rateManual: false,
  tcmb: TCMB,
  tcmbFailed: false,
  ...fields,
});

const converted = (from: string, invoice: InvoiceRates) => {
  const conversion = priceConversion(from, invoice);
  if (conversion.kind !== 'converted') {
    throw new Error(`not converted: ${conversion.kind}`);
  }
  return conversion;
};

describe('legacy services', () => {
  test('historyCurrency is the one currency every invoiced customer was last invoiced in', () => {
    const invoiced = (currency: string) =>
      customer({ currency, lastInvoicedAt: '2026-09-01T10:00:00.000Z' });
    expect(historyCurrency([invoiced('USD'), invoiced('USD')])).toBe('USD');
    // Never invoiced from Angaria: the saved currency tells nothing.
    expect(historyCurrency([invoiced('USD'), customer({ currency: 'TRY' })])).toBe('USD');
    expect(historyCurrency([invoiced('USD'), invoiced('TRY')])).toBeUndefined();
    expect(historyCurrency([customer({ currency: 'EUR' })])).toBeUndefined();
    expect(historyCurrency([])).toBeUndefined();
  });

  test('a service without a currency takes the history’s, else keeps none', () => {
    const invoiced = customer({ currency: 'USD', lastInvoicedAt: '2026-09-01T10:00:00.000Z' });
    const legacy = service({ id: 'legacy' });
    const priced = service({ currency: 'TRY', id: 'priced' });
    expect(withServiceCurrencies([legacy, priced], [invoiced])).toEqual([
      { ...legacy, currency: 'USD' },
      priced,
    ]);
    const mixed = [invoiced, { ...invoiced, currency: 'EUR', id: 'other' }];
    expect(withServiceCurrencies([legacy, priced], mixed)).toEqual([legacy, priced]);
  });
});

test('formatPrice names lira TL and other currencies by code', () => {
  expect(formatPrice(4110.32, 'TRY')).toBe('4.110,32 TL');
  expect(formatPrice(100, 'USD')).toBe('100,00 USD');
  expect(formatPrice(1250.5)).toBe('1.250,50');
});

describe('priceConversion', () => {
  test('the same currency needs none', () => {
    expect(priceConversion('USD', rates({ currency: 'USD', rate: 41.1032 }))).toEqual({
      kind: 'same',
    });
  });

  test('a foreign price on a lira invoice takes TCMB’s rate, to kuruş', () => {
    const conversion = converted('USD', rates());
    expect(conversion).toEqual({
      fromRate: 41.1032,
      kind: 'converted',
      manualRate: false,
      publishedOn: PUBLISHED,
      toRate: 1,
    });
    expect(convertAmount(100, conversion)).toBe(4110.32);
    // 33,33 × 41,1032 = 1.369,969656: rounds up to the kuruş.
    expect(convertAmount(33.33, conversion)).toBe(1369.97);
  });

  test('a lira price on a foreign invoice takes the invoice’s rate', () => {
    const conversion = converted('TRY', rates({ currency: 'USD', rate: 41.1032 }));
    expect(conversion).toMatchObject({ fromRate: 1, manualRate: false, toRate: 41.1032 });
    // 5.000 / 41,1032 = 121,6450...
    expect(convertAmount(5000, conversion)).toBe(121.65);
  });

  test('one foreign currency to another goes through lira with the same bulletin', () => {
    const conversion = converted('EUR', rates({ currency: 'USD', rate: 41.1032 }));
    expect(conversion).toMatchObject({
      fromRate: 47.9876,
      publishedOn: PUBLISHED,
      toRate: 41.1032,
    });
    // 100 × 47,9876 / 41,1032 = 116,7491...
    expect(convertAmount(100, conversion)).toBe(116.75);
  });

  test('a typed invoice rate is used and named', () => {
    const conversion = converted('TRY', rates({ currency: 'USD', rate: 40, rateManual: true }));
    expect(conversion).toMatchObject({ manualRate: true, publishedOn: null, toRate: 40 });
    expect(convertAmount(1000, conversion)).toBe(25);
  });

  test('without a rate it waits, or says why there is none', () => {
    expect(priceConversion('USD', rates({ tcmb: null })).kind).toBe('waiting');
    expect(priceConversion('USD', rates({ tcmb: null, tcmbFailed: true })).kind).toBe('failed');
    expect(priceConversion('CHF', rates()).kind).toBe('unpublished');
    // The invoice's own rate is still empty (or 0 while it loads).
    expect(priceConversion('TRY', rates({ currency: 'USD', rate: null })).kind).toBe('waiting');
    expect(priceConversion('TRY', rates({ currency: 'USD', rate: 0 })).kind).toBe('waiting');
    expect(priceConversion('EUR', rates({ currency: 'USD', rate: null })).kind).toBe('waiting');
  });
});

const row = (fields: Partial<InvoiceItem>): InvoiceItem => ({ ...service(fields), id: 'row' });

test('convertLine converts a discount amount and keeps a discount rate', () => {
  const conversion = converted('USD', rates());
  expect(convertLine(row({ discountAmount: 10, quantity: 2 }), conversion)).toMatchObject({
    discountAmount: 411.03,
    discountRate: 0,
    unitPrice: 4110.32,
  });
  // 10% of 2 × 4.110,32
  expect(
    convertLine(row({ discountAmount: 20, discountRate: 10, quantity: 2 }), conversion),
  ).toMatchObject({ discountAmount: 822.06, discountRate: 10, unitPrice: 4110.32 });
});

describe('conversionHint', () => {
  test('shows the conversion and the rate it used', () => {
    expect(conversionHint(100, 'USD', 'TRY', converted('USD', rates()), TODAY)).toBe(
      '100,00 USD → 4.110,32 TL (TCMB 1 Eki)',
    );
    const manual = rates({ currency: 'USD', rate: 40, rateManual: true });
    expect(conversionHint(1000, 'TRY', 'USD', converted('TRY', manual), TODAY)).toBe(
      '1.000,00 TL → 25,00 USD (girdiğin kur)',
    );
    expect(conversionHint(100, 'EUR', 'USD', converted('EUR', manual), TODAY)).toBe(
      '100,00 EUR → 119,97 USD (TCMB 1 Eki ve girdiğin kur)',
    );
  });

  test('says what happens without a rate, and nothing without a conversion', () => {
    expect(conversionHint(100, 'USD', 'TRY', { kind: 'waiting' }, TODAY)).toBe(
      '100,00 USD. Kur gelince dönüştürülecek.',
    );
    expect(conversionHint(100, 'USD', 'TRY', { kind: 'failed' }, TODAY)).toBe(
      '100,00 USD. TCMB kuru alınamadı, fiyatı TL olarak yaz.',
    );
    expect(conversionHint(100, 'CHF', 'EUR', { kind: 'unpublished' }, TODAY)).toBe(
      '100,00 CHF. TCMB bu para birimi için kur yayınlamıyor, fiyatı EUR olarak yaz.',
    );
    expect(conversionHint(100, 'USD', 'USD', { kind: 'same' }, TODAY)).toBeUndefined();
  });
});
