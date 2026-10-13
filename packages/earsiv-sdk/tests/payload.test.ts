import { describe, expect, test } from 'vitest';
import {
  draftInvoicePayload,
  type InvoiceDetails,
  type InvoiceItem,
  roundKurus,
} from '../src/index.ts';

// The EARSIV_PORTAL_FATURA_OLUSTUR payload: the strings GİB stores and prints.

const details = (
  items: Array<InvoiceItem>,
  totals: Pick<InvoiceDetails, 'grandTotal' | 'grandTotalInclVAT' | 'paymentTotal' | 'totalVAT'>,
): InvoiceDetails => ({
  date: '01/10/2026',
  fullAddress: 'Bağdat Cad. No:1',
  items,
  taxIDOrTRID: '1234567890',
  time: '10:15:00',
  title: 'Örnek A.Ş.',
  ...totals,
});

type Line = Record<string, unknown>;
const lines = (payload: Record<string, unknown>) => payload.malHizmetTable as Array<Line>;

describe('draftInvoicePayload', () => {
  test('keeps a four-decimal unit price and sends the rounded line price', () => {
    const payload = draftInvoicePayload(
      details(
        [
          {
            name: 'Lisans',
            price: 100,
            quantity: 3,
            unitPrice: 33.3333,
            VATAmount: 20,
            VATRate: 20,
          },
        ],
        { grandTotal: 100, grandTotalInclVAT: 120, paymentTotal: 120, totalVAT: 20 },
      ),
    );
    expect(lines(payload)[0]).toMatchObject({
      birimFiyat: '33.3333',
      fiyat: '100.00',
      kdvOrani: '20',
      kdvTutari: '20.00',
      malHizmetTutari: '100.00',
      miktar: 3,
    });
  });

  test.each([
    [1250.5, '1250.50'],
    [12, '12.00'],
    [0.1 + 0.2, '0.30'],
    [12.505, '12.505'],
    [1 / 3, '0.33333333'],
    [1e-8, '0.00000001'],
  ])('sends unit price %s as %s', (price, text) => {
    const payload = draftInvoicePayload(
      details([{ name: 'A', price: 0, quantity: 1, unitPrice: price, VATAmount: 0, VATRate: 0 }], {
        grandTotal: 0,
        grandTotalInclVAT: 0,
        paymentTotal: 0,
        totalVAT: 0,
      }),
    );
    expect(lines(payload)[0].birimFiyat).toBe(text);
  });

  test('refuses a fractional VAT rate instead of rounding it away', () => {
    expect(() =>
      draftInvoicePayload(
        details(
          [{ name: 'A', price: 100, quantity: 1, unitPrice: 100, VATAmount: 18.5, VATRate: 18.5 }],
          { grandTotal: 100, grandTotalInclVAT: 118.5, paymentTotal: 118.5, totalVAT: 18.5 },
        ),
      ),
    ).toThrow(RangeError);
  });

  test('three lines on .005 VAT edges: the totals are the sums of the sent lines', () => {
    // Each line's VAT is x.xx5 before rounding: 1.005, 1.005 and 1.005. Rounded
    // per line they are 1.01 each, 3.03 in all (3.015 rounded once would be 3.02).
    const payload = draftInvoicePayload(
      details(
        [
          { name: 'A', price: 10.05, quantity: 1, unitPrice: 10.05, VATAmount: 1.01, VATRate: 10 },
          { name: 'B', price: 100.5, quantity: 1, unitPrice: 100.5, VATAmount: 1.01, VATRate: 1 },
          { name: 'C', price: 10.05, quantity: 4, unitPrice: 2.5125, VATAmount: 1.01, VATRate: 10 },
        ],
        { grandTotal: 120.6, grandTotalInclVAT: 123.63, paymentTotal: 123.63, totalVAT: 3.03 },
      ),
    );
    const sent = lines(payload);
    expect(sent.map((line) => line.kdvTutari)).toEqual(['1.01', '1.01', '1.01']);
    expect(sent[2].birimFiyat).toBe('2.5125');
    expect(payload).toMatchObject({
      hesaplanankdv: '3.03',
      malhizmetToplamTutari: '120.60',
      matrah: '120.60',
      odenecekTutar: '123.63',
      vergilerDahilToplamTutar: '123.63',
      vergilerToplami: '3.03',
    });
    const sum = (key: string) =>
      sent.reduce((total, line) => total + Math.round(Number(line[key]) * 100), 0);
    expect(sum('kdvTutari')).toBe(Math.round(Number(payload.hesaplanankdv) * 100));
    expect(Math.round(Number(payload.matrah) * 100) + sum('kdvTutari')).toBe(
      Math.round(Number(payload.vergilerDahilToplamTutar) * 100),
    );
  });
});

describe('roundKurus', () => {
  test.each([
    [1.005, 1.01],
    [1.0049, 1],
    [0.015, 0.02],
    [100.5 / 100, 1.01],
    [99.9999, 100],
    [0.1 + 0.2, 0.3],
    [1_234_567.125, 1_234_567.13],
    [-1.005, -1.01],
    [-0.001, 0],
    [0, 0],
  ])('rounds %s to %s, half away from zero', (value, rounded) => {
    expect(roundKurus(value)).toBe(rounded);
  });
});
