import { describe, expect, test } from 'vitest';
import {
  cleanItems,
  discountForRate,
  formatDecimal,
  formatRate,
  gibToInputDate,
  inputDateToGIB,
  invoiceTotals,
  isBlankForm,
  matchesTemplate,
  normalizeTime,
  parseDecimal,
  sameInvoice,
  toDraftDetails,
  upsertSavedItems,
  validateInvoice,
} from '../src/lib/invoice-form.ts';
import type { InvoiceFormValues, InvoiceItem } from '../src/lib/types.ts';

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
      'items[0].name': 'Kalem adı gerekli',
      'items[0].quantity': 'Miktar sıfırdan büyük olmalı',
      'items[0].unitPrice': 'Geçerli bir tutar girin',
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
      'advancedFields.paymentTotal': 'Geçerli bir tutar girin',
      'invoiceSettings.currencyRate': 'Geçerli bir kur girin',
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
      currencyRate: '41.5',
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

test('matchesTemplate notices an edited row', () => {
  const values = form();
  const template = {
    id: 't',
    items: values.items,
    name: 'Aylık',
    note: '',
    recipient: values.recipient,
    settings: values.invoiceSettings,
  };
  expect(matchesTemplate(values, template)).toBe(true);
  expect(matchesTemplate({ ...values, items: [item({ unitPrice: 1200 })] }, template)).toBe(false);
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
