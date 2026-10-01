import { describe, expect, test } from 'vitest';
import {
  customerDefaults,
  customerName,
  findCustomer,
  isForeignCustomer,
  learnCustomer,
  nameError,
  taxIDError,
} from '../src/lib/customer.ts';
import type { Recipient } from '../src/lib/types.ts';

const customer = (fields: Partial<Recipient>): Recipient => ({
  city: '',
  country: '',
  district: '',
  fullAddress: '',
  id: 'c',
  name: '',
  surname: '',
  taxIDOrTRID: '',
  taxOffice: '',
  title: '',
  ...fields,
});

describe('taxIDError', () => {
  test('accepts a 10 digit VKN and an 11 digit TCKN', () => {
    expect(taxIDError('1234567890')).toBeNull();
    expect(taxIDError(' 12345678901 ')).toBeNull();
  });

  test('rejects empty, non-digit and wrong-length values', () => {
    expect(taxIDError('  ')).toBe('VKN veya TCKN gerekli');
    expect(taxIDError('12345abcde')).toBe('Yalnızca rakam girin');
    expect(taxIDError('123456789')).toBe('VKN 10, TCKN 11 hane olmalı');
    expect(taxIDError('123456789012')).toBe('VKN 10, TCKN 11 hane olmalı');
  });
});

describe('customerName and nameError', () => {
  test('prefer the unvan', () => {
    const company = customer({ name: 'Ahmet', surname: 'Yılmaz', title: 'ÖRNEK A.Ş.' });
    expect(customerName(company)).toBe('ÖRNEK A.Ş.');
    expect(nameError(company)).toBeNull();
  });

  test('fall back to the first and last name', () => {
    const person = customer({ name: ' Ayşe ', surname: 'Kaya' });
    expect(customerName(person)).toBe('Ayşe Kaya');
    expect(nameError(person)).toBeNull();
  });

  test('need an unvan or both names', () => {
    const half = customer({ name: 'Ayşe' });
    expect(customerName(half)).toBe('Ayşe');
    expect(nameError(half)).toBe('Unvan ya da ad ve soyad gerekli');
    expect(customerName(customer({}))).toBe('');
  });
});

describe('findCustomer', () => {
  const abroad = [
    customer({ id: 'plastic', taxIDOrTRID: '2222222222', title: 'PLASTIC SOFTWARE LLC' }),
    customer({ id: 'acme', taxIDOrTRID: '2222222222', title: 'Acme GmbH' }),
    customer({ id: 'ayse', name: 'Ayşe', surname: 'Işık', taxIDOrTRID: '12345678901' }),
  ];

  test('tells customers abroad apart by name', () => {
    expect(findCustomer(abroad, '2222222222', 'ACME GMBH')?.id).toBe('acme');
    expect(findCustomer(abroad, ' 2222222222 ', 'Plastic Software LLC')?.id).toBe('plastic');
    expect(findCustomer(abroad, '2222222222', 'Initech')).toBeNull();
  });

  test('matches a person by first and last name with Turkish casing', () => {
    expect(findCustomer(abroad, '12345678901', 'AYŞE  IŞIK')?.id).toBe('ayse');
    expect(findCustomer(abroad, '12345678901', 'AYSE ISIK')).toBeNull();
  });

  test('needs a VKN / TCKN', () => {
    expect(findCustomer(abroad, ' ', 'Acme GmbH')).toBeNull();
  });
});

describe('customer defaults', () => {
  test('tell customers abroad by VKN or country', () => {
    expect(isForeignCustomer(customer({ taxIDOrTRID: '2222222222' }))).toBe(true);
    expect(isForeignCustomer(customer({ country: 'Almanya', taxIDOrTRID: '9876543210' }))).toBe(
      true,
    );
    expect(isForeignCustomer(customer({ country: 'Türkiye', taxIDOrTRID: '1234567890' }))).toBe(
      false,
    );
    expect(isForeignCustomer(customer({ taxIDOrTRID: '1234567890' }))).toBe(false);
  });

  test('follow where the customer is when none are saved', () => {
    expect(customerDefaults(customer({ taxIDOrTRID: '2222222222' }))).toEqual({
      currency: undefined,
      dueDays: undefined,
      invoiceType: 'ISTISNA',
      pdfLanguage: 'en',
      VATRate: undefined,
    });
    expect(customerDefaults(customer({ country: 'Türkiye', taxIDOrTRID: '1234567890' }))).toEqual({
      currency: 'TRY',
      dueDays: undefined,
      invoiceType: 'SATIS',
      pdfLanguage: 'tr',
      VATRate: undefined,
    });
  });

  test('prefer the saved ones', () => {
    const saved = customer({
      currency: 'USD',
      dueDays: 30,
      invoiceType: 'SATIS',
      pdfLanguage: 'both',
      taxIDOrTRID: '2222222222',
      VATRate: 0,
    });
    expect(customerDefaults(saved)).toEqual({
      currency: 'USD',
      dueDays: 30,
      invoiceType: 'SATIS',
      pdfLanguage: 'both',
      VATRate: 0,
    });
  });
});

describe('learnCustomer', () => {
  const plastic = customer({
    dueDays: 14,
    fullAddress: 'Old address',
    id: 'plastic',
    pdfLanguage: 'en',
    taxIDOrTRID: '2222222222',
    title: 'PLASTIC SOFTWARE LLC',
    VATRate: 0,
  });

  test('updates the customer with the same VKN and name', () => {
    const recipient = customer({
      fullAddress: 'New address',
      id: 'form',
      pdfLanguage: 'tr',
      taxIDOrTRID: ' 2222222222 ',
      title: 'Plastic Software LLC',
    });
    const { added, customers } = learnCustomer(
      [plastic],
      recipient,
      { currency: 'USD', dueDays: undefined, invoiceType: 'ISTISNA', pdfLanguage: 'both' },
      () => 'new',
    );
    expect(added).toBe(false);
    expect(customers).toEqual([
      {
        ...plastic,
        currency: 'USD',
        fullAddress: 'New address',
        invoiceType: 'ISTISNA',
        pdfLanguage: 'both',
        title: 'Plastic Software LLC',
      },
    ]);
  });

  test('adds a new customer without the form-only fields', () => {
    const recipient = customer({
      id: 'form',
      pdfLanguage: 'tr',
      taxIDOrTRID: '1234567890',
      title: 'ÖRNEK A.Ş.',
    });
    const { added, customers } = learnCustomer(
      [plastic],
      recipient,
      { currency: 'TRY', invoiceType: 'SATIS', pdfLanguage: 'tr', VATRate: 20 },
      () => 'new',
    );
    expect(added).toBe(true);
    expect(customers[1]).toEqual({
      ...customer({ taxIDOrTRID: '1234567890', title: 'ÖRNEK A.Ş.' }),
      currency: 'TRY',
      id: 'new',
      invoiceType: 'SATIS',
      pdfLanguage: 'tr',
      VATRate: 20,
    });
  });
});
