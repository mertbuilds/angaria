import { describe, expect, test } from 'vitest';
import {
  applyCustomer,
  cleanItems,
  discountForRate,
  formatDecimal,
  formatRate,
  gibToInputDate,
  inputDateToGIB,
  invoiceDefaults,
  invoiceTotals,
  isBlankForm,
  normalizeTime,
  parseDecimal,
  sameInvoice,
  toDraftDetails,
  toPDFData,
  unparsableItemFields,
  upsertSavedItems,
  validateInvoice,
  vatByRate,
} from '../src/lib/invoice-form.ts';
import type { CompanyInfo, InvoiceFormValues, InvoiceItem, Recipient } from '../src/lib/types.ts';

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
  test('reads Turkish and plain decimals', () => {
    expect(parseDecimal('1.250,5')).toBe(1250.5);
    expect(parseDecimal('1250.5')).toBe(1250.5);
    expect(parseDecimal('12,')).toBe(12);
    expect(parseDecimal(' ')).toBe(0);
  });

  test('rejects anything else', () => {
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('-5')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('.')).toBeNull();
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

test('discountForRate rounds to kuruş', () => {
  expect(discountForRate(item({ quantity: 3, unitPrice: 333.33 }), 7)).toBe(70);
});

describe('dates and times', () => {
  test('convert between GİB and date inputs', () => {
    expect(gibToInputDate('30/09/2026')).toBe('2026-09-30');
    expect(gibToInputDate('30-09-2026')).toBe('2026-09-30');
    expect(gibToInputDate('')).toBe('');
    expect(inputDateToGIB('2026-09-30')).toBe('30/09/2026');
    expect(inputDateToGIB('')).toBe('');
  });

  test('add the seconds a time input leaves out', () => {
    expect(normalizeTime('09:05')).toBe('09:05:00');
    expect(normalizeTime('09:05:07')).toBe('09:05:07');
  });
});

/** validateInvoice's errors for a due date (and an invoice date, empty: today). */
const due = (dueDate: string, manualDate = '') =>
  validateInvoice(
    form({ advancedFields: { ...form().advancedFields, dueDate, manualDate } }),
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
      'invoiceSettings.currencyRate': 'Döviz kuru gerekli',
      'items[0].name': 'Hizmet adı gerekli',
      'items[0].quantity': 'Miktar sıfırdan büyük olmalı',
      'items[0].unitPrice': 'Geçerli bir tutar gir',
      'recipient.fullAddress': 'Adres gerekli',
      'recipient.taxIDOrTRID': 'VKN 10, TCKN 11 hane olmalı',
      'recipient.title': 'Unvan ya da ad ve soyad gerekli',
    });
  });

  test('accepts a person by first and last name', () => {
    const recipient = {
      ...form().recipient,
      name: 'Ayşe',
      surname: 'Yılmaz',
      taxIDOrTRID: '12345678901',
      title: '',
    };
    expect(validateInvoice(form({ recipient }), today)).toBeUndefined();
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
      'advancedFields.paymentTotal': 'Geçerli bir tutar gir',
      'invoiceSettings.currencyRate': 'Geçerli bir kur gir',
      'items[0].discountAmount': 'İskonto satır tutarını geçemez',
    });
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
    expect(next.advancedFields.dueDate).toBe('20/10/2026');
    expect(next.invoiceSettings).toMatchObject({ currency: 'TRY', invoiceType: 'SATIS' });
    expect(next.recipient.pdfLanguage).toBe('tr');
  });
});

describe('invoiceDefaults', () => {
  test('learns the settings, a shared VAT rate and the days to the due date', () => {
    const values = form({
      advancedFields: { ...form().advancedFields, dueDate: '31/10/2026' },
      invoiceSettings: { currency: 'USD', currencyRate: '41,5', invoiceType: 'ISTISNA' },
      items: [item({ VATRate: 0 }), item({ VATRate: 0 })],
    });
    expect(invoiceDefaults(values, { date: '01/10/2026', pdfLanguage: 'both' })).toEqual({
      currency: 'USD',
      dueDays: 30,
      invoiceType: 'ISTISNA',
      pdfLanguage: 'both',
      VATRate: 0,
    });
  });

  test('learns no VAT rate from mixed rows and no days without a due date', () => {
    const values = form({ items: [item({ VATRate: 20 }), item({ VATRate: 10 })] });
    expect(invoiceDefaults(values, { date: '01/10/2026', pdfLanguage: 'tr' })).toMatchObject({
      dueDays: undefined,
      VATRate: undefined,
    });
  });
});

test('upsertSavedItems updates by name and adds new names', () => {
  const saved = [item({ id: 'saved', unitPrice: 500 })];
  const next = upsertSavedItems(
    saved,
    [
      item({ id: 'row', unitPrice: 750 }),
      item({ id: 'new', name: ' Tasarım ' }),
      item({ name: '' }),
    ],
    () => 'generated',
  );
  expect(next).toEqual([
    item({ id: 'saved', unitPrice: 750 }),
    item({ id: 'generated', name: 'Tasarım' }),
  ]);
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
