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
