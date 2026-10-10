import { draftInvoicePayload } from 'angaria-earsiv-sdk';
import { describe, expect, test } from 'vitest';
import {
  applyCustomer,
  cleanItems,
  discountForRate,
  formatAmount,
  formatDecimal,
  formatRate,
  invoiceDefaults,
  invoiceTotals,
  invoiceWarnings,
  isBlankForm,
  istisnaNote,
  lineTotals,
  normalizeTime,
  parseDecimal,
  roundKurus,
  sameInvoice,
  toDraftDetails,
  toPDFData,
  unparsableItemFields,
  upsertSavedItems,
  validateInvoice,
  vatByRate,
} from '../src/lib/invoice-form.ts';
import { ISTISNA_REASONS } from '../src/lib/regulated.ts';
import type {
  CompanyInfo,
  InvoiceFormValues,
  InvoiceItem,
  Recipient,
  Service,
} from '../src/lib/types.ts';

const item = (fields: Partial<InvoiceItem> = {}): InvoiceItem => ({
  discountAmount: 0,
  discountRate: 0,
  discountReason: '',
  gtip: '',
  id: 'i',
  name: 'Danışmanlık',
  quantity: 1,
  unitPrice: 1000,
  unitType: 'C62',
  VATRate: 20,
  ...fields,
});

const form = (fields: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
  advancedFields: {
    dueDate: '',
    irsaliyeNumarasi: '',
    irsaliyeTarihi: '',
    manualDate: '',
    manualTime: '10:15:00',
    paymentTotal: '',
  },
  invoiceSettings: { currency: 'TRY', currencyRate: '', invoiceType: 'SATIS' },
  items: [item()],
  note: '',
  recipient: {
    city: 'İstanbul',
    country: 'Türkiye',
    district: 'Kadıköy',
    fullAddress: 'Bağdat Cad. No:1',
    id: 'r',
    name: '',
    surname: '',
    taxIDOrTRID: '1234567890',
    taxOffice: 'Kadıköy',
    title: 'Örnek A.Ş.',
  },
  ...fields,
});

const today = new Date(2026, 9, 1, 12);

describe('parseDecimal', () => {
  test.each([
    ['5.000', 5000],
    ['1.250.000', 1_250_000],
    ['1.250,50', 1250.5],
    ['1250,5', 1250.5],
    ['1250.5', 1250.5],
    ['5.5', 5.5],
    ['0.125', 0.125],
    ['12.50', 12.5],
    ['1,234.56', 1234.56],
    ['₺1.234,56', 1234.56],
    ['1.234,56 TL', 1234.56],
    ['$ 1,234.56', 1234.56],
    ['€1.234', 1234],
    ['£12,5', 12.5],
    ['1 250,50', 1250.5],
    ['1 250 000', 1_250_000],
    ['1.284', 1284],
    ['1,284', 1.284],
    ['12,', 12],
    ['33,3333', 33.3333],
    ['', 0],
    [' ', 0],
  ])('reads %j as %s', (text, value) => {
    expect(parseDecimal(text)).toBe(value);
  });

  test.each([
    '-42,5',
    '-5',
    '1,2,3',
    '1.2.3',
    '1,25.000,5',
    '1.25,5',
    'abc',
    '.',
    ',',
    '12a',
    '3*8',
  ])('refuses %j', (text) => {
    expect(parseDecimal(text)).toBeNull();
  });

  test('returns quickly on a 2,000 character paste', () => {
    expect(parseDecimal('1.'.repeat(1000))).toBeNull();
    expect(parseDecimal('9'.repeat(2000))).toBeNull();
  });
});

describe('formatDecimal', () => {
  test('writes no thousands dots', () => {
    expect(formatDecimal(5000)).toBe('5000');
    expect(formatDecimal(1234.5)).toBe('1234,5');
    expect(formatDecimal(1_000_000)).toBe('1000000');
    expect(formatDecimal(1234.5678, 2)).toBe('1234,57');
  });

  test('reads back as the same number', () => {
    for (const value of [5000, 1234.5, 0.5, 1_000_000, 0, 12.3456]) {
      expect(parseDecimal(formatDecimal(value))).toBe(value);
    }
  });
});

describe('formatAmount', () => {
  test.each([
    [5000, '5.000,00'],
    [1250.5, '1.250,50'],
    [33.3333, '33,3333'],
    [1_234_567.891, '1.234.567,891'],
    [0.5, '0,50'],
    [1 / 3, '0,33333333'],
  ])('shows %s as %s', (value, text) => {
    expect(formatAmount(value)).toBe(text);
  });

  test('reads back as the same number', () => {
    for (const value of [5000, 1250.5, 33.3333, 1_234_567.891, 0.5, 0, 1284]) {
      expect(parseDecimal(formatAmount(value))).toBe(value);
    }
  });
});

test('formatRate shows four Turkish decimals', () => {
  expect(formatRate(41.5)).toBe('41,5000');
  expect(formatRate(1234.56789)).toBe('1234,5679');
});

describe('invoiceTotals', () => {
  test('takes discounts off before VAT', () => {
    const totals = invoiceTotals([
      item({ discountAmount: 100, quantity: 2, unitPrice: 500 }),
      item({ unitPrice: 300, VATRate: 0 }),
    ]);
    expect(totals).toEqual({ discount: 100, gross: 1300, net: 1200, total: 1380, vat: 180 });
  });

  test('counts an unparsable number as zero', () => {
    expect(invoiceTotals([item({ unitPrice: Number.NaN })]).total).toBe(0);
  });
});

describe('vatByRate', () => {
  test('sums VAT per rate after discounts, highest rate first', () => {
    expect(
      vatByRate([
        item({ unitPrice: 300, VATRate: 0 }),
        item({ discountAmount: 100, quantity: 2, unitPrice: 500 }),
        item({ unitPrice: 200, VATRate: 10 }),
        item({ unitPrice: 600 }),
      ]),
    ).toEqual([
      { rate: 20, vat: 300 },
      { rate: 10, vat: 20 },
      { rate: 0, vat: 0 },
    ]);
  });

  test('counts an unparsable rate as zero', () => {
    expect(vatByRate([item({ VATRate: Number.NaN })])).toEqual([{ rate: 0, vat: 0 }]);
  });
});

test('discountForRate rounds to kuruş, half away from zero', () => {
  expect(discountForRate(item({ quantity: 3, unitPrice: 333.33 }), 7)).toBe(70);
  // 1.15 × 50% is 0.575, which binary floats hold as 0.57499...
  expect(discountForRate(item({ unitPrice: 1.15 }), 50)).toBe(0.58);
});

test('roundKurus is the SDK rounding', () => {
  expect(roundKurus(1.005)).toBe(1.01);
});

/**
 * Three lines whose VAT is 1.005 each before rounding: the fixture of
 * earsiv-sdk's tests/payload.test.ts and mcp-server's tests/totals.test.ts.
 */
const edgeItems = () => [
  item({ unitPrice: 10.05, VATRate: 10 }),
  item({ unitPrice: 100.5, VATRate: 1 }),
  item({ quantity: 4, unitPrice: 2.5125, VATRate: 10 }),
];

describe('rounding per line', () => {
  test('lineTotals rounds the price and the VAT to kuruş', () => {
    expect(lineTotals(item({ quantity: 3, unitPrice: 33.3333 }))).toEqual({
      discount: 0,
      gross: 100,
      net: 100,
      vat: 20,
    });
    expect(lineTotals(item({ unitPrice: 10.05, VATRate: 10 })).vat).toBe(1.01);
  });

  test('invoiceTotals and vatByRate sum the rounded lines', () => {
    // Rounded once, 3.015 would be 3.02: per line it is 3 × 1.01.
    expect(invoiceTotals(edgeItems())).toEqual({
      discount: 0,
      gross: 120.6,
      net: 120.6,
      total: 123.63,
      vat: 3.03,
    });
    expect(vatByRate(edgeItems())).toEqual([
      { rate: 10, vat: 2.02 },
      { rate: 1, vat: 1.01 },
    ]);
  });

  test('sums ten 0.1 lines to exactly 1', () => {
    const items = Array.from({ length: 10 }, () => item({ unitPrice: 0.1, VATRate: 0 }));
    expect(invoiceTotals(items).total).toBe(1);
  });
});

describe('dates and times', () => {
  test('add the seconds a time input leaves out', () => {
    expect(normalizeTime('09:05')).toBe('09:05:00');
    expect(normalizeTime('09:05:07')).toBe('09:05:07');
  });
});

/** validateInvoice's errors for an irsaliye date and an invoice date (empty: today). */
const irsaliye = (irsaliyeTarihi: string, manualDate: string) =>
  invoiceWarnings(
    form({ advancedFields: { ...form().advancedFields, irsaliyeTarihi, manualDate } }),
    today,
  );

/** validateInvoice's errors for a due date (and an invoice date, empty: today). */
const due = (dueDate: string, manualDate = '') =>
  validateInvoice(
    form({ advancedFields: { ...form().advancedFields, dueDate, manualDate } }),
    today,
  )?.fields;

/** validateInvoice's errors for a customer abroad (GİB's 2222222222) in `country`. */
const abroad = (country: string) =>
  validateInvoice(
    form({ recipient: { ...form().recipient, country, taxIDOrTRID: '2222222222' } }),
    today,
  )?.fields;

describe('validateInvoice', () => {
  test('passes a complete invoice', () => {
    expect(validateInvoice(form(), today)).toBeUndefined();
  });

  test('names each missing or wrong field', () => {
    const result = validateInvoice(
      form({
        invoiceSettings: { currency: 'USD', currencyRate: '', invoiceType: 'SATIS' },
        items: [item({ name: ' ', quantity: 0, unitPrice: Number.NaN })],
        recipient: { ...form().recipient, fullAddress: '', taxIDOrTRID: '12345', title: '' },
      }),
      today,
    );
    expect(result?.fields).toEqual({
      'invoiceSettings.currencyRate': 'Döviz kurunu yaz',
      'items[0].name': 'Hizmet adını yaz',
      'items[0].quantity': 'Miktar sıfırdan büyük olmalı',
      'items[0].unitPrice': 'Birim fiyatı rakamla yaz, örneğin 1.250,50',
      'recipient.fullAddress': 'Adresi yaz',
      'recipient.taxIDOrTRID': 'VKN 10, TCKN 11 haneli olur',
      'recipient.title': 'Unvanı ya da adı ve soyadı yaz',
    });
  });

  test('accepts a person by first and last name', () => {
    const recipient = {
      ...form().recipient,
      name: 'Ayşe',
      surname: 'Yılmaz',
      taxIDOrTRID: '10000000146',
      title: '',
    };
    expect(validateInvoice(form({ recipient }), today)).toBeUndefined();
  });

  test('a customer abroad needs a country other than Türkiye', () => {
    expect(abroad('')).toEqual({
      'recipient.country': 'Yurt dışındaki müşterinin ülkesini seç',
    });
    expect(abroad('Türkiye')).toEqual({
      'recipient.country': 'Yurt dışı müşteri için Türkiye dışında bir ülke seç',
    });
    expect(abroad('Almanya')).toBeUndefined();
  });

  test('refuses a due date before the invoice date', () => {
    expect(due('15/10/2026')).toBeUndefined();
    expect(due('01/10/2026')).toBeUndefined();
    expect(due('30/09/2026')).toEqual({
      'advancedFields.dueDate': 'Son ödeme tarihi fatura tarihinden önce olamaz',
    });
    expect(due('29/09/2026', '28/09/2026')).toBeUndefined();
  });

  test('refuses future dates and a bad rate, payment or discount', () => {
    const result = validateInvoice(
      form({
        advancedFields: {
          ...form().advancedFields,
          irsaliyeTarihi: '01/10/2026',
          manualDate: '02/10/2026',
          paymentTotal: '12a',
        },
        invoiceSettings: { currency: 'EUR', currencyRate: '0', invoiceType: 'SATIS' },
        items: [item({ discountAmount: 2000 })],
      }),
      today,
    );
    expect(result?.fields).toEqual({
      'advancedFields.manualDate': 'Fatura tarihi bugünden sonra olamaz',
      'advancedFields.paymentTotal': 'Ödenecek tutarı rakamla yaz, örneğin 1.250,50',
      'invoiceSettings.currencyRate': 'Döviz kuru sıfırdan büyük olmalı',
      'items[0].discountAmount': 'İskonto satır tutarını geçemez',
    });
  });

  test('says how to write a number that did not parse', () => {
    const result = validateInvoice(
      form({
        invoiceSettings: { currency: 'EUR', currencyRate: '41,5x', invoiceType: 'SATIS' },
        items: [item({ discountAmount: Number.NaN, quantity: Number.NaN })],
      }),
      today,
    );
    expect(result?.fields).toEqual({
      'invoiceSettings.currencyRate': 'Döviz kurunu rakamla yaz, örneğin 41,5230',
      'items[0].discountAmount': 'İskonto tutarını rakamla yaz, örneğin 150,00',
      'items[0].quantity': 'Miktarı rakamla yaz, örneğin 2 ya da 1,5',
    });
  });

  test.each([18.5, -1, 101, Number.NaN])('refuses a VAT rate of %s', (VATRate) => {
    expect(validateInvoice(form({ items: [item({ VATRate })] }), today)?.fields).toEqual({
      'items[0].VATRate': 'KDV oranı 0 ile 100 arasında tam sayı olmalı',
    });
  });

  test('accepts any whole VAT rate from 0 to 100', () => {
    const items = [0, 1, 8, 18, 100].map((VATRate) => item({ VATRate }));
    expect(validateInvoice(form({ items }), today)).toBeUndefined();
  });

  test('İstisna needs 0% VAT on every line', () => {
    const settings = { currency: 'TRY', currencyRate: '', invoiceType: 'ISTISNA' };
    const result = validateInvoice(
      form({ invoiceSettings: settings, items: [item({ VATRate: 0 }), item({ VATRate: 20 })] }),
      today,
    );
    expect(result?.fields).toEqual({
      'items[1].VATRate': 'İstisna faturada KDV oranı %0 olmalı',
    });
  });

  test.each(['TEVKIFAT', 'IADE', 'OZELMATRAH', 'IHRACKAYITLI', ''])(
    'blocks the unsupported invoice type %j',
    (invoiceType) => {
      const settings = { currency: 'TRY', currencyRate: '', invoiceType };
      expect(validateInvoice(form({ invoiceSettings: settings }), today)?.fields).toEqual({
        'invoiceSettings.invoiceType':
          'Angaria bu fatura tipini henüz desteklemiyor. Bu faturayı GİB portalından kes.',
      });
    },
  );

  test('never says lütfen, geçerli or geçersiz, and uses no em dash', () => {
    const result = validateInvoice(
      form({
        advancedFields: {
          ...form().advancedFields,
          dueDate: '01/01/2020',
          irsaliyeTarihi: '05/10/2026',
          manualDate: '05/10/2026',
          paymentTotal: 'x',
        },
        invoiceSettings: { currency: 'USD', currencyRate: 'x', invoiceType: 'IADE' },
        items: [
          item({ discountAmount: Number.NaN, discountRate: 200, name: '', VATRate: 1.5 }),
          item({ quantity: Number.NaN, unitPrice: Number.NaN }),
          item({ quantity: 0, unitPrice: 0 }),
        ],
        recipient: { ...form().recipient, fullAddress: '' },
      }),
      today,
    );
    const messages = Object.values(result?.fields ?? {});
    expect(messages.length).toBeGreaterThan(10);
    for (const message of messages) {
      expect(message).not.toMatch(/lütfen|geçerli|geçersiz|\u2014/iu);
    }
  });
});

/** invoiceWarnings for an invoice dated `manualDate` (empty: today). */
const dated = (manualDate: string) =>
  invoiceWarnings(form({ advancedFields: { ...form().advancedFields, manualDate } }), today);

describe('invoiceWarnings', () => {
  test('has none for a fresh invoice', () => {
    expect(invoiceWarnings(form(), today)).toEqual({});
  });

  test('warns about VUK 231/5 when the date is more than 7 days back', () => {
    expect(dated('')).toEqual({});
    expect(dated('24/09/2026')).toEqual({});
    expect(dated('23/09/2026')).toEqual({
      'advancedFields.manualDate':
        "Bu tarih 7 günden eski. VUK 231/5'e göre fatura, hizmetten sonraki 7 gün içinde kesilmeli.",
    });
  });

  test('warns about an irsaliye dated after the invoice or today, never blocks it', () => {
    expect(irsaliye('28/09/2026', '28/09/2026')).toEqual({});
    expect(irsaliye('27/09/2026', '28/09/2026')).toEqual({});
    expect(irsaliye('29/09/2026', '28/09/2026')).toEqual({
      'advancedFields.irsaliyeTarihi':
        'İrsaliye tarihi fatura tarihinden sonra görünüyor. Kontrol et.',
    });
    expect(irsaliye('01/10/2026', '')).toEqual({});
    expect(irsaliye('02/10/2026', '')).toEqual({
      'advancedFields.irsaliyeTarihi': 'İrsaliye tarihi bugünden sonra görünüyor. Kontrol et.',
    });
    const blocked = validateInvoice(
      form({
        advancedFields: {
          ...form().advancedFields,
          irsaliyeTarihi: '02/10/2026',
          manualDate: '28/09/2026',
        },
      }),
      today,
    );
    expect(blocked).toBeUndefined();
  });

  test('warns about a 0% line on a Satış invoice only', () => {
    const items = [item(), item({ VATRate: 0 })];
    expect(invoiceWarnings(form({ items }), today)).toEqual({
      'items[1].VATRate': '%0 KDV için fatura tipi İstisna olmalı ya da KDV oranını seç.',
    });
    const istisna = { currency: 'TRY', currencyRate: '', invoiceType: 'ISTISNA' };
    expect(
      invoiceWarnings(form({ invoiceSettings: istisna, items: [item({ VATRate: 0 })] }), today),
    ).toEqual({});
  });
});

describe('toDraftDetails', () => {
  const now = new Date(2026, 9, 1, 14, 30, 5);

  test('builds the GİB payload with totals', () => {
    const details = toDraftDetails(
      form({
        invoiceSettings: { currency: 'USD', currencyRate: '41,5', invoiceType: 'ISTISNA' },
        items: [item({ discountAmount: 100, discountRate: 10, quantity: 1, unitPrice: 1000 })],
      }),
      now,
    );
    expect(details).toMatchObject({
      currency: 'USD',
      currencyRate: '41.5000',
      date: '01/10/2026',
      grandTotal: 900,
      grandTotalInclVAT: 1080,
      invoiceType: 'ISTISNA',
      paymentTotal: 1080,
      taxIDOrTRID: '1234567890',
      time: '10:15:00',
      totalDiscount: 100,
      totalVAT: 180,
    });
    expect(details.items[0]).toMatchObject({ discountAmount: 100, price: 1000, VATAmount: 180 });
  });

  test('sends the TCMB rate as the main-branch app did', () => {
    // TCMB publishes 38.1230; String() would drop the trailing zero.
    const tcmbRate = 38.123;
    const values = form({
      invoiceSettings: {
        currency: 'EUR',
        currencyRate: formatRate(tcmbRate),
        invoiceType: 'SATIS',
      },
    });
    // main's create-invoice.tsx filled the field with rate.toFixed(4) and sent it as is.
    const main = { currency: 'EUR', currencyRate: tcmbRate.toFixed(4) };
    expect(toDraftDetails(values, now)).toMatchObject(main);
    expect(main.currencyRate).toBe('38.1230');
  });

  test('the GİB payload carries the same totals as the MCP server', () => {
    const payload = draftInvoicePayload(toDraftDetails(form({ items: edgeItems() }), now));
    const lines = payload.malHizmetTable as Array<Record<string, unknown>>;
    expect(lines.map((line) => [line.birimFiyat, line.fiyat, line.kdvTutari])).toEqual([
      ['10.05', '10.05', '1.01'],
      ['100.50', '100.50', '1.01'],
      ['2.5125', '10.05', '1.01'],
    ]);
    expect(payload).toMatchObject({
      hesaplanankdv: '3.03',
      matrah: '120.60',
      odenecekTutar: '123.63',
      vergilerDahilToplamTutar: '123.63',
    });
  });

  test('3 × 33,3333 sends its four decimals and a 100.00 line', () => {
    const values = form({ items: [item({ quantity: 3, unitPrice: 33.3333 })] });
    const [line] = draftInvoicePayload(toDraftDetails(values, now)).malHizmetTable as Array<
      Record<string, unknown>
    >;
    expect(line).toMatchObject({ birimFiyat: '33.3333', fiyat: '100.00', kdvTutari: '20.00' });
  });

  test("sends GİB's country value, not the PDF's full name", () => {
    const values = form({ recipient: { ...form().recipient, country: 'Amerika Birleşik Dev' } });
    expect(toDraftDetails(values, now).country).toBe('Amerika Birleşik Dev');
  });

  test('sends no rate for lira and fills in date and time', () => {
    const values = form();
    values.advancedFields.manualTime = '';
    values.advancedFields.paymentTotal = '1.000,00';
    const details = toDraftDetails(values, now);
    expect(details.currencyRate).toBeUndefined();
    expect(details.time).toBe('14:30:05');
    expect(details.paymentTotal).toBe(1000);
  });
});

const sentence = (code: string) =>
  ISTISNA_REASONS.find((reason) => reason.code === code)?.sentence ?? '';

describe('istisnaNote', () => {
  test('puts the reason sentence before the note', () => {
    expect(istisnaNote('302', '')).toBe(sentence('302'));
    expect(istisnaNote('302', 'Ekim hizmeti')).toBe(`${sentence('302')}\nEkim hizmeti`);
  });

  test('adds it once, however often it runs', () => {
    const once = istisnaNote('302', 'Ekim hizmeti');
    expect(istisnaNote('302', once)).toBe(once);
    expect(istisnaNote('302', istisnaNote('301', once))).toBe(once);
  });

  test('replaces another reason in place', () => {
    expect(istisnaNote('301', `${sentence('302')}\nEkim hizmeti`)).toBe(
      `${sentence('301')}\nEkim hizmeti`,
    );
    expect(istisnaNote('350', `Ekim hizmeti\n${sentence('302')}`)).toBe(
      `Ekim hizmeti\n${sentence('350')}`,
    );
  });

  test('removes the sentence without a reason', () => {
    expect(istisnaNote(null, `${sentence('302')}\nEkim hizmeti`)).toBe('Ekim hizmeti');
    expect(istisnaNote(undefined, `Ekim hizmeti\n${sentence('302')}`)).toBe('Ekim hizmeti');
    expect(istisnaNote(null, sentence('302'))).toBe('');
    expect(istisnaNote(null, 'Ekim hizmeti')).toBe('Ekim hizmeti');
  });

  test('leaves a sentence the user edited alone', () => {
    expect(istisnaNote('302', '302 - hizmet ihracatı')).toBe(
      `${sentence('302')}\n302 - hizmet ihracatı`,
    );
  });
});

describe('applyCustomer', () => {
  const abroad: Recipient = {
    ...form().recipient,
    city: '',
    country: 'Amerika Birleşik Dev',
    fullAddress: '500 Westover Dr',
    id: 'plastic',
    taxIDOrTRID: '2222222222',
    taxOffice: '',
    title: 'PLASTIC SOFTWARE LLC',
  };

  test('fills the recipient and the defaults of a customer abroad', () => {
    const values = form({
      advancedFields: { ...form().advancedFields, currencyRateManual: true },
      invoiceSettings: { currency: 'EUR', currencyRate: '48,1', invoiceType: 'SATIS' },
    });
    const next = applyCustomer(
      values,
      { ...abroad, currency: 'USD', dueDays: 14, VATRate: 0 },
      today,
    );
    expect(next.recipient).toEqual({
      ...abroad,
      pdfLanguage: 'en',
    });
    expect(next.invoiceSettings).toEqual({
      currency: 'USD',
      currencyRate: '',
      invoiceType: 'ISTISNA',
    });
    expect(next.advancedFields).toMatchObject({ currencyRateManual: false, dueDate: '15/10/2026' });
    expect(next.items.map((row) => row.VATRate)).toEqual([0]);
  });

  test("carries the customer's İstisna reason and writes its sentence once", () => {
    const values = form({ note: 'Ekim hizmeti' });
    const next = applyCustomer(values, { ...abroad, istisnaCode: '302' }, today);
    expect(next.invoiceSettings.istisnaCode).toBe('302');
    expect(next.note).toBe(`${sentence('302')}\nEkim hizmeti`);
    expect(applyCustomer(next, { ...abroad, istisnaCode: '302' }, today).note).toBe(next.note);
  });

  test('leaves the reason and the note out of a Satış invoice', () => {
    const next = applyCustomer(
      form({ note: 'Ekim' }),
      { ...form().recipient, istisnaCode: '302' },
      today,
    );
    expect(next.invoiceSettings.istisnaCode).toBeUndefined();
    expect(next.note).toBe('Ekim');
  });

  test('keeps the currency when none is known abroad, and the rows without a VAT default', () => {
    const values = form({
      invoiceSettings: { currency: 'EUR', currencyRate: '48,1', invoiceType: 'SATIS' },
    });
    const next = applyCustomer(values, abroad, today);
    expect(next.invoiceSettings).toEqual({
      currency: 'EUR',
      currencyRate: '48,1',
      invoiceType: 'ISTISNA',
    });
    expect(next.items).toBe(values.items);
    expect(next.advancedFields.dueDate).toBe('');
  });

  test('counts the due date from the invoice date', () => {
    const values = form({ advancedFields: { ...form().advancedFields, manualDate: '20/09/2026' } });
    const next = applyCustomer(values, { ...form().recipient, dueDays: 30 }, today);
    expect(next.advancedFields).toMatchObject({ dueDate: '20/10/2026', dueDays: 30 });
    expect(next.invoiceSettings).toMatchObject({ currency: 'TRY', invoiceType: 'SATIS' });
    expect(next.recipient.pdfLanguage).toBe('tr');
  });
});

describe('invoiceDefaults', () => {
  test('learns the settings, a shared VAT rate and the days to the due date', () => {
    const values = form({
      advancedFields: { ...form().advancedFields, dueDate: '31/10/2026' },
      invoiceSettings: {
        currency: 'USD',
        currencyRate: '41,5',
        invoiceType: 'ISTISNA',
        istisnaCode: '301',
      },
      items: [item({ VATRate: 0 }), item({ VATRate: 0 })],
    });
    expect(invoiceDefaults(values, { date: '01/10/2026', pdfLanguage: 'both' })).toEqual({
      currency: 'USD',
      dueDays: 30,
      invoiceType: 'ISTISNA',
      istisnaCode: '301',
      pdfLanguage: 'both',
      VATRate: 0,
    });
  });

  test('learns no İstisna reason from a Satış invoice', () => {
    const values = form({
      invoiceSettings: {
        currency: 'TRY',
        currencyRate: '',
        invoiceType: 'SATIS',
        istisnaCode: '302',
      },
    });
    expect(
      invoiceDefaults(values, { date: '01/10/2026', pdfLanguage: 'tr' }).istisnaCode,
    ).toBeUndefined();
  });

  test('learns no VAT rate from mixed rows and no days without a due date', () => {
    const values = form({ items: [item({ VATRate: 20 }), item({ VATRate: 10 })] });
    expect(invoiceDefaults(values, { date: '01/10/2026', pdfLanguage: 'tr' })).toMatchObject({
      dueDays: undefined,
      VATRate: undefined,
    });
  });
});

describe('upsertSavedItems', () => {
  const usd = { ...item({ id: 'usd', name: 'Engineering', unitPrice: 100 }), currency: 'USD' };
  const learn = (rows: Array<InvoiceItem>, currency: string, saved: Array<Service> = [usd]) =>
    upsertSavedItems(saved, rows, () => 'generated', currency);

  test('updates a service on an invoice in its currency and adds new names in it', () => {
    const saved = [
      { ...item({ id: 'saved', unitPrice: 500 }), currency: 'USD' },
      item({ id: 'old', name: 'Eski' }),
    ];
    const next = learn(
      [
        item({
          id: 'row',
          pickedFrom: { converted: false, currency: 'USD', id: 'saved' },
          unitPrice: 750,
        }),
        item({ id: 'new', name: ' Tasarım ' }),
        item({ name: '' }),
      ],
      'USD',
      saved,
    );
    expect(next).toEqual([
      { ...item({ id: 'saved', unitPrice: 750 }), currency: 'USD' },
      item({ id: 'old', name: 'Eski' }),
      { ...item({ id: 'generated', name: 'Tasarım' }), currency: 'USD' },
    ]);
    // A row typed with the service's name counts in the invoice's currency.
    expect(learn([item({ name: 'Engineering', unitPrice: 120 })], 'USD')).toEqual([
      { ...usd, unitPrice: 120 },
    ]);
  });

  test('leaves a service in another currency as it is, typed over or not', () => {
    const converted = { converted: true, currency: 'USD', id: 'usd' };
    const row = (unitPrice: number) =>
      item({ name: 'Engineering', pickedFrom: converted, unitPrice });
    expect(learn([row(4110.32)], 'TRY')).toEqual([usd]);
    expect(learn([row(4000)], 'TRY')).toEqual([usd]);
    // Converted, then the invoice moved to the service's currency.
    expect(learn([row(4110.32)], 'USD')).toEqual([usd]);
    // Picked as is, then the invoice moved to another currency.
    const asIs = { converted: false, currency: 'USD', id: 'usd' };
    expect(learn([item({ name: 'Engineering', pickedFrom: asIs })], 'EUR')).toEqual([usd]);
    // Typed with its name rather than picked.
    expect(learn([item({ name: 'Engineering', unitPrice: 4000 })], 'TRY')).toEqual([usd]);
  });

  test('a service without a currency takes the invoice’s with the price', () => {
    const legacy = item({ id: 'legacy', name: 'Eski', unitPrice: 500 });
    const picked = item({
      name: 'Eski',
      pickedFrom: { converted: false, id: 'legacy' },
      unitPrice: 750,
    });
    expect(learn([picked], 'EUR', [legacy])).toEqual([
      { ...legacy, currency: 'EUR', unitPrice: 750 },
    ]);
  });

  test('a picked row renamed to another service counts by its name', () => {
    const lira = { ...item({ id: 'lira', unitPrice: 500 }), currency: 'TRY' };
    const renamed = item({
      pickedFrom: { converted: true, currency: 'USD', id: 'usd' },
      unitPrice: 750,
    });
    expect(learn([renamed], 'TRY', [usd, lira])).toEqual([usd, { ...lira, unitPrice: 750 }]);
  });
});

test('isBlankForm ignores the default row and settings', () => {
  const blank = form({
    items: [item({ name: '', unitPrice: 0 })],
    recipient: { ...form().recipient, fullAddress: '', taxIDOrTRID: '', title: '' },
  });
  expect(isBlankForm(blank)).toBe(true);
  expect(isBlankForm({ ...blank, note: 'Ekim' })).toBe(false);
  expect(isBlankForm(form())).toBe(false);
});

test('cleanItems turns unparsable numbers into 0', () => {
  expect(cleanItems([item({ quantity: Number.NaN })])[0].quantity).toBe(0);
});

test('sameInvoice ignores the PDF language only', () => {
  const values = form();
  expect(
    sameInvoice({ ...values, recipient: { ...values.recipient, pdfLanguage: 'tr' } }, values),
  ).toBe(true);
  expect(sameInvoice({ ...values, recipient: { ...values.recipient, title: 'B' } }, values)).toBe(
    false,
  );
  expect(sameInvoice({ ...values, note: 'Ekim' }, values)).toBe(false);
});

describe('PDF data', () => {
  const company = { name: 'Örnek Yazılım' } as CompanyInfo;
  const now = new Date(2026, 9, 1, 14, 30);

  test('unparsableItemFields names every number that did not parse', () => {
    expect(unparsableItemFields([item()])).toEqual([]);
    expect(
      unparsableItemFields([
        item(),
        item({ discountAmount: Number.NaN, unitPrice: Number.POSITIVE_INFINITY }),
      ]),
    ).toEqual(['items[1].unitPrice', 'items[1].discountAmount']);
  });

  test('toPDFData prints no NaN and takes the date GİB gave the draft', () => {
    const values = form({ items: [item({ quantity: Number.NaN })] });
    const base = { company, entityName: 'Örnek', language: 'tr' as const, now };

    const data = toPDFData(values, base);
    expect(data.items[0].quantity).toBe(0);
    expect(data.date).toBe('01/10/2026');

    expect(toPDFData(values, { ...base, date: '30/09/2026' }).date).toBe('30/09/2026');
  });

  test('toPDFData carries the GİB number, ETTN and QR code text', () => {
    const base = { company, entityName: 'Örnek', language: 'both' as const, now };
    expect(toPDFData(form(), base)).toMatchObject({ ettn: undefined, gibNumber: undefined });
    expect(toPDFData(form(), base)).toMatchObject({ qrValue: undefined });
    expect(
      toPDFData(form(), {
        ...base,
        ettn: 'e-t-t-n',
        gibNumber: 'GIB2026000000001',
        qrValue: '{"no":"GIB2026000000001"}',
      }),
    ).toMatchObject({
      ettn: 'e-t-t-n',
      gibNumber: 'GIB2026000000001',
      language: 'both',
      qrValue: '{"no":"GIB2026000000001"}',
    });
  });

  test('toPDFData carries the due date when there is one', () => {
    const base = { company, entityName: 'Örnek', language: 'tr' as const, now };
    expect(toPDFData(form(), base).dueDate).toBeUndefined();
    const values = form({ advancedFields: { ...form().advancedFields, dueDate: '15/10/2026' } });
    expect(toPDFData(values, base).dueDate).toBe('15/10/2026');
  });
});
