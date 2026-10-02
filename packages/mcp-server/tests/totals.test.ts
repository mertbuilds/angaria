import { draftInvoicePayload } from 'angaria-earsiv-sdk';
import { expect, test } from 'vitest';
import { computeItemFields, computeTotals } from '../src/totals.ts';

test('computeItemFields fills price, VAT, and defaults', () => {
  expect(
    computeItemFields({ name: 'Danışmanlık', quantity: 2, unitPrice: 100, VATRate: 20 }),
  ).toEqual({
    discountAmount: 0,
    discountRate: 0,
    discountReason: '',
    gtip: '',
    name: 'Danışmanlık',
    price: 200,
    quantity: 2,
    unitPrice: 100,
    unitType: 'C62',
    VATAmount: 40,
    VATRate: 20,
  });
});

test('computeItemFields derives the discount amount from the rate', () => {
  const item = computeItemFields({
    discountRate: 10,
    name: 'Lisans',
    quantity: 3,
    unitPrice: 33.33,
    VATRate: 20,
  });
  expect(item.price).toBe(99.99);
  expect(item.discountAmount).toBe(10);
  expect(item.VATAmount).toBe(18);
});

test('computeItemFields keeps an explicit discount amount', () => {
  const item = computeItemFields({
    discountAmount: 5,
    discountRate: 10,
    name: 'Lisans',
    quantity: 1,
    unitPrice: 100,
    VATRate: 0,
  });
  expect(item.discountAmount).toBe(5);
  expect(item.VATAmount).toBe(0);
});

test('computeTotals sums lines after discounts', () => {
  const items = [
    computeItemFields({ name: 'A', quantity: 1, unitPrice: 0.1, VATRate: 20 }),
    computeItemFields({ name: 'B', quantity: 1, unitPrice: 0.2, VATRate: 20 }),
    computeItemFields({ discountAmount: 10, name: 'C', quantity: 2, unitPrice: 50, VATRate: 10 }),
  ];
  expect(computeTotals(items)).toEqual({
    grandTotal: 90.3,
    grandTotalInclVAT: 99.36,
    paymentTotal: 99.36,
    totalDiscount: 10,
    totalVAT: 9.06,
  });
});

// The fixture of earsiv-sdk's tests/payload.test.ts and the desktop's
// invoice-form test: all three must send the same numbers.
test('three lines on .005 VAT edges round per line, like the desktop app', () => {
  const items = [
    computeItemFields({ name: 'A', quantity: 1, unitPrice: 10.05, VATRate: 10 }),
    computeItemFields({ name: 'B', quantity: 1, unitPrice: 100.5, VATRate: 1 }),
    computeItemFields({ name: 'C', quantity: 4, unitPrice: 2.5125, VATRate: 10 }),
  ];
  expect(items.map((item) => [item.price, item.VATAmount])).toEqual([
    [10.05, 1.01],
    [100.5, 1.01],
    [10.05, 1.01],
  ]);
  const totals = computeTotals(items);
  expect(totals).toEqual({
    grandTotal: 120.6,
    grandTotalInclVAT: 123.63,
    paymentTotal: 123.63,
    totalDiscount: 0,
    totalVAT: 3.03,
  });

  const payload = draftInvoicePayload({
    date: '01/10/2026',
    fullAddress: 'Bağdat Cad. No:1',
    items,
    taxIDOrTRID: '1234567890',
    time: '10:15:00',
    title: 'Örnek A.Ş.',
    ...totals,
  });
  expect(payload).toMatchObject({
    hesaplanankdv: '3.03',
    matrah: '120.60',
    vergilerDahilToplamTutar: '123.63',
  });
});

test('3 × 33,3333 at 20% is 100.00 and 20.00', () => {
  const item = computeItemFields({ name: 'Lisans', quantity: 3, unitPrice: 33.3333, VATRate: 20 });
  expect([item.price, item.VATAmount]).toEqual([100, 20]);
});
