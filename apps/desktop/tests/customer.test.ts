import { describe, expect, test } from 'vitest';
import { customerName, findCustomer, nameError, taxIDError } from '../src/lib/customer.ts';
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
