import { describe, expect, test } from 'vitest';
import {
  byRecentInvoice,
  COUNTRY_OPTIONS,
  countryError,
  customerDefaults,
  customerName,
  findCustomer,
  findCustomerByTaxID,
  isForeignCustomer,
  learnCustomer,
  matchesCountry,
  nameError,
  normalizeTaxID,
  taxIDError,
  taxIDKind,
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

// Check digits that hold (VKN 1234567890, TCKN 10000000146) and the same
// numbers with the last digit changed.
const VKN = '1234567890';
const TCKN = '10000000146';

describe('taxIDError', () => {
  test('accepts a VKN and a TCKN whose check digits hold', () => {
    expect(taxIDError(VKN)).toBeNull();
    expect(taxIDError(` ${TCKN} `)).toBeNull();
    expect(taxIDError('12345678950')).toBeNull();
  });

  test("accepts GİB's placeholders without a checksum", () => {
    expect(taxIDError('2222222222')).toBeNull();
    expect(taxIDError('22222222222')).toBeNull();
    expect(taxIDError('11111111111')).toBeNull();
  });

  test('says what is wrong and how to fix it', () => {
    expect(taxIDError('  ')).toBe('VKN ya da TCKN yaz');
    expect(taxIDError('12345abcde')).toBe('VKN ya da TCKN’yi yalnızca rakamla yaz');
    expect(taxIDError('123456789')).toBe('VKN 10, TCKN 11 haneli olur');
    expect(taxIDError('123456789012')).toBe('VKN 10, TCKN 11 haneli olur');
    expect(taxIDError('1234567891')).toBe(
      'Bu VKN’nin kontrol hanesi tutmuyor. Numarayı kontrol et.',
    );
    expect(taxIDError('10000000147')).toBe(
      'Bu TCKN’nin kontrol haneleri tutmuyor. Numarayı kontrol et.',
    );
    expect(taxIDError('01234567890')).toBe('TCKN 0 ile başlamaz. Numarayı kontrol et.');
  });

  test('never uses the words GOV.UK rules out', () => {
    const messages = ['', 'abc', '123', '1234567891', '10000000147', '01234567890'].map(taxIDError);
    for (const message of messages) {
      expect(message).not.toMatch(/lütfen|geçerli|geçersiz|hata oluştu/i);
    }
  });
});

describe('taxIDKind and normalizeTaxID', () => {
  test('name what a complete number is', () => {
    expect(taxIDKind(VKN)).toBe('vkn');
    expect(taxIDKind(TCKN)).toBe('tckn');
    expect(taxIDKind('2222222222')).toBe('foreign');
    expect(taxIDKind('11111111111')).toBe('undisclosed');
    expect(taxIDKind('22222222222')).toBe('undisclosed');
    expect(taxIDKind('1234567891')).toBeNull();
    expect(taxIDKind('12345')).toBeNull();
  });

  test('drop spaces, dots and dashes from a pasted number', () => {
    expect(normalizeTaxID(' 123 456 78 90 ')).toBe(VKN);
    expect(normalizeTaxID('123.456.789-0')).toBe(VKN);
    expect(normalizeTaxID('12a')).toBe('12a');
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

  test('need an unvan or both names, and say which is missing', () => {
    const half = customer({ name: 'Ayşe' });
    expect(customerName(half)).toBe('Ayşe');
    expect(nameError(half)).toBe('Kişiyse soyadı da yaz, şirketse unvanı yaz');
    expect(nameError(customer({ surname: 'Kaya' }))).toBe(
      'Kişiyse adı da yaz, şirketse unvanı yaz',
    );
    expect(nameError(customer({}))).toBe('Unvanı ya da adı ve soyadı yaz');
    expect(customerName(customer({}))).toBe('');
  });
});

describe('countryError', () => {
  test('asks a customer abroad for a country other than Türkiye', () => {
    expect(countryError(customer({ taxIDOrTRID: '2222222222' }))).toBe(
      'Yurt dışındaki müşterinin ülkesini seç',
    );
    expect(countryError(customer({ country: 'Türkiye', taxIDOrTRID: '2222222222' }))).toBe(
      'Yurt dışı müşteri için Türkiye dışında bir ülke seç',
    );
    expect(countryError(customer({ country: 'Almanya', taxIDOrTRID: '2222222222' }))).toBeNull();
  });

  test('leaves a customer at home alone', () => {
    expect(countryError(customer({ taxIDOrTRID: VKN }))).toBeNull();
    expect(countryError(customer({ country: 'Türkiye', taxIDOrTRID: VKN }))).toBeNull();
  });
});

/** The GİB values of the countries a typed query finds. */
const findCountries = (query: string) =>
  COUNTRY_OPTIONS.filter((country) => matchesCountry(country, query)).map(
    (country) => country.value,
  );

describe('countries', () => {
  test('pin Türkiye and keep one option per GİB value', () => {
    expect(COUNTRY_OPTIONS[0]?.value).toBe('Türkiye');
    const values = COUNTRY_OPTIONS.map((country) => country.value);
    expect(new Set(values).size).toBe(values.length);
  });

  test("match the Turkish name, the English name and aliases, and keep GİB's value", () => {
    expect(findCountries('usa')).toEqual(['Amerika Birleşik Dev']);
    expect(findCountries('United States')).toContain('Amerika Birleşik Dev');
    expect(findCountries('abd')).toContain('Amerika Birleşik Dev');
    expect(findCountries('uk')).toEqual(['Birleşik Krallik', 'Ukrayna']);
    expect(findCountries('ingiltere')).toEqual(['Birleşik Krallik']);
    expect(findCountries('birleşik krallık')).toEqual(['Birleşik Krallik']);
    expect(findCountries('germany')).toEqual(['Almanya']);
    expect(findCountries('ALMANYA')).toEqual(['Almanya']);
  });

  test('match the start of a word, not any letters inside it', () => {
    expect(findCountries('us')).not.toContain('Avustralya');
    expect(findCountries('kore')).toEqual(
      expect.arrayContaining(['Güney Kore Cumhuriye', 'Kuzey Kore Demokrati']),
    );
  });
});

describe('findCustomerByTaxID', () => {
  const saved = [
    customer({ id: 'plastic', taxIDOrTRID: '2222222222', title: 'PLASTIC SOFTWARE LLC' }),
    customer({ id: 'ornek', taxIDOrTRID: VKN, title: 'ÖRNEK A.Ş.' }),
  ];

  test('finds a customer by VKN whatever the name', () => {
    expect(findCustomerByTaxID(saved, ` ${VKN} `)?.id).toBe('ornek');
    expect(findCustomerByTaxID(saved, '4840847211')).toBeNull();
  });

  test("never for GİB's placeholders, which many customers share", () => {
    expect(findCustomerByTaxID(saved, '2222222222')).toBeNull();
    expect(findCustomerByTaxID(saved, '')).toBeNull();
  });
});

describe('byRecentInvoice', () => {
  test('puts the most recently invoiced customers first and keeps the rest in order', () => {
    const order = byRecentInvoice([
      customer({ id: 'never-a' }),
      customer({ id: 'old', lastInvoicedAt: '2026-08-01T10:00:00.000Z' }),
      customer({ id: 'never-b' }),
      customer({ id: 'new', lastInvoicedAt: '2026-10-01T09:30:00.000Z' }),
    ]).map((saved) => saved.id);
    expect(order).toEqual(['new', 'old', 'never-a', 'never-b']);
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
  const now = new Date('2026-10-02T12:00:00.000Z');
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
      now,
    );
    expect(added).toBe(false);
    expect(customers).toEqual([
      {
        ...plastic,
        currency: 'USD',
        fullAddress: 'New address',
        invoiceType: 'ISTISNA',
        lastInvoicedAt: '2026-10-02T12:00:00.000Z',
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
      now,
    );
    expect(added).toBe(true);
    expect(customers[1]).toEqual({
      ...customer({ taxIDOrTRID: '1234567890', title: 'ÖRNEK A.Ş.' }),
      currency: 'TRY',
      id: 'new',
      invoiceType: 'SATIS',
      lastInvoicedAt: '2026-10-02T12:00:00.000Z',
      pdfLanguage: 'tr',
      VATRate: 20,
    });
  });

  test('makes the invoiced customer the most recent one', () => {
    const ornek = customer({ id: 'ornek', taxIDOrTRID: VKN, title: 'ÖRNEK A.Ş.' });
    const { customers } = learnCustomer(
      [ornek, plastic],
      { ...plastic, id: 'form' },
      {},
      () => 'new',
      now,
    );
    expect(byRecentInvoice(customers).map((saved) => saved.id)).toEqual(['plastic', 'ornek']);
  });
});
