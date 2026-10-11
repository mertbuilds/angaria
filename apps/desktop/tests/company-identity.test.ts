import { describe, expect, test } from 'vitest';
import {
  fillFromGIB,
  gibIdentityMismatch,
  gibUserOwner,
  resolveCompany,
  taxIDOwner,
  taxIDShared,
  taxIDTaken,
  type CompanyKey,
} from '../src/lib/company-identity.ts';

const ANA: CompanyKey = { id: 'a', name: 'Ana Varlık', taxID: '10000000146', username: '12345678' };
const IKINCI: CompanyKey = { id: 'b', name: 'Şirket 2', taxID: '1234567890', username: '87654321' };
const BOS: CompanyKey = { id: 'c', name: 'Şirket 3', taxID: '', username: '' };
const companies = [ANA, IKINCI, BOS];

describe('taxIDOwner', () => {
  test('finds another company with the same digits, spaces aside', () => {
    expect(taxIDOwner(companies, 'c', '100 000 001 46')).toBe(ANA);
    expect(taxIDOwner(companies, 'c', '1234567890')).toBe(IKINCI);
  });

  test('a company never conflicts with itself, and an empty VKN with none', () => {
    expect(taxIDOwner(companies, 'a', '10000000146')).toBeUndefined();
    expect(taxIDOwner(companies, 'a', '')).toBeUndefined();
    expect(taxIDOwner(companies, 'a', '9999999999')).toBeUndefined();
  });
});

test('gibUserOwner matches a trimmed user code, never an empty one', () => {
  expect(gibUserOwner(companies, 'c', ' 87654321 ')).toBe(IKINCI);
  expect(gibUserOwner(companies, 'b', '87654321')).toBeUndefined();
  expect(gibUserOwner(companies, 'a', '')).toBeUndefined();
});

test('messages name the company and say VKN or TCKN by length', () => {
  expect(taxIDTaken('10000000146', ANA)).toBe('Bu TCKN zaten Ana Varlık için kayıtlı.');
  expect(taxIDTaken('1234567890', IKINCI)).toBe('Bu VKN zaten Şirket 2 için kayıtlı.');
  expect(taxIDShared('1234567890')).toBe(
    'Bu VKN başka bir şirkette de kayıtlı. Birini sil ya da VKN’yi düzelt.',
  );
  for (const text of [taxIDTaken('1234567890', IKINCI), taxIDShared('10000000146')]) {
    expect(text).not.toMatch(/—|lütfen|geçerli|geçersiz|hata oluştu/i);
  }
});

describe('resolveCompany', () => {
  test('by id or by VKN / TCKN', () => {
    expect(resolveCompany(companies, 'b')).toBe(IKINCI);
    expect(resolveCompany(companies, '123 456 7890')).toBe(IKINCI);
    expect(resolveCompany(companies, 'nobody')).toBeNull();
  });

  test('a VKN on two companies is ambiguous, their ids still work', () => {
    const shared = [ANA, { ...IKINCI, taxID: '10000000146' }];
    expect(resolveCompany(shared, '10000000146')).toBe('ambiguous');
    expect(resolveCompany(shared, 'a')).toBe(ANA);
    expect(resolveCompany(shared, 'b')).toBe(shared[1]);
  });
});

describe('the GİB account’s own taxpayer', () => {
  const info = {
    accountHolder: '',
    address: '',
    bankAddress: '',
    bankName: '',
    email: '',
    iban: '',
    name: '',
    phone: '',
    swiftCode: '',
    taxID: '',
    taxOffice: '',
  };
  const gib = { name: 'DENEME LİSANS TİCARET A.Ş.', taxID: '3333333301', taxOffice: 'Urla' };

  test('differs only when both VKN / TCKN are known and their digits differ', () => {
    expect(gibIdentityMismatch({ ...info, taxID: '10000000146' }, gib)).toBe(
      'GİB hesabı DENEME LİSANS TİCARET A.Ş. (VKN 3333333301) adına. Firma bilgilerindeki TCKN farklı, bu yüzden PDF’te e-Arşiv faturasındakinden başka bir satıcı görünür.',
    );
    expect(gibIdentityMismatch({ ...info, taxID: '333 333 3301' }, gib)).toBeNull();
    expect(gibIdentityMismatch(info, gib)).toBeNull();
    expect(gibIdentityMismatch({ ...info, taxID: '10000000146' }, undefined)).toBeNull();
  });

  test('fills the VKN / TCKN, and the name and tax office only where empty', () => {
    expect(fillFromGIB(info, gib)).toMatchObject(gib);
    expect(fillFromGIB({ ...info, name: 'Deniz Yazılım', taxID: '1' }, gib)).toMatchObject({
      name: 'Deniz Yazılım',
      taxID: '3333333301',
      taxOffice: 'Urla',
    });
  });
});
