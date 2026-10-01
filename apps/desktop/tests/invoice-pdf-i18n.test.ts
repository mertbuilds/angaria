import { describe, expect, test } from 'vitest';
import {
  buildInvoicePDFFilename,
  DEFAULT_PDF_LANGUAGE,
  formatPDFAmount,
  formatPDFDate,
  formatPDFQuantity,
  PDF_LABELS,
  PDF_LANGUAGES,
  pdfUpper,
  resolvePDFLanguage,
} from '../src/lib/invoice-pdf-i18n.ts';

describe('labels', () => {
  test('every language has a dictionary', () => {
    expect(Object.keys(PDF_LABELS).toSorted()).toEqual([...PDF_LANGUAGES].toSorted());
  });

  test.each(PDF_LANGUAGES)('%s has every key with a non-empty value', (language) => {
    const labels = PDF_LABELS[language];
    expect(Object.keys(labels).toSorted()).toEqual(Object.keys(PDF_LABELS.en).toSorted());
    for (const value of Object.values(labels)) {
      expect(value.trim()).not.toBe('');
    }
  });

  test('Turkish labels use e-invoice wording', () => {
    expect(PDF_LABELS.tr).toMatchObject({
      accountHolder: 'Hesap Sahibi',
      amount: 'Tutar',
      bankAccountDetails: 'Banka Bilgileri',
      bankAddress: 'Banka Adresi',
      bankName: 'Banka Adı',
      billedTo: 'Sayın',
      description: 'Açıklama',
      discount: 'İndirim',
      iban: 'IBAN',
      invoiceDate: 'Fatura Tarihi:',
      invoiceNumber: 'Fatura No',
      invoiceTotal: 'Genel Toplam',
      note: 'Not',
      quantity: 'Miktar',
      subtotal: 'Ara Toplam',
      swiftCode: 'SWIFT Kodu',
      unitCost: 'Birim Fiyat',
      vat: 'KDV',
    });
  });
});

describe('resolvePDFLanguage', () => {
  test('falls back to the app default', () => {
    expect(DEFAULT_PDF_LANGUAGE).toBe('en');
    expect(resolvePDFLanguage()).toBe('en');
    expect(resolvePDFLanguage(undefined, undefined)).toBe('en');
  });

  test('prefers the first valid candidate', () => {
    expect(resolvePDFLanguage(undefined, 'tr')).toBe('tr');
    expect(resolvePDFLanguage('en', 'tr')).toBe('en');
    expect(resolvePDFLanguage('de', 'tr')).toBe('tr');
    expect(resolvePDFLanguage('de')).toBe('en');
  });
});

describe('formatPDFAmount', () => {
  test('Turkish uses dot grouping and comma decimals', () => {
    expect(formatPDFAmount('tr', 'USD', 1234.56)).toBe('USD 1.234,56');
    expect(formatPDFAmount('tr', 'TRY', 1_234_567.8)).toBe('TRY 1.234.567,80');
    expect(formatPDFAmount('tr', 'EUR', 0)).toBe('EUR 0,00');
  });

  test('English keeps comma grouping and dot decimals', () => {
    expect(formatPDFAmount('en', 'USD', 1234.56)).toBe('USD 1,234.56');
    expect(formatPDFAmount('en', 'TRY', 1_234_567.8)).toBe('TRY 1,234,567.80');
    expect(formatPDFAmount('en', 'EUR', 0)).toBe('EUR 0.00');
  });
});

describe('formatPDFQuantity', () => {
  test('Turkish uses comma decimals', () => {
    expect(formatPDFQuantity('tr', 1)).toBe('1');
    expect(formatPDFQuantity('tr', 1.5)).toBe('1,5');
    expect(formatPDFQuantity('tr', 1000)).toBe('1.000');
  });

  test('English prints the raw number', () => {
    expect(formatPDFQuantity('en', 1.5)).toBe('1.5');
    expect(formatPDFQuantity('en', 1000)).toBe('1000');
  });
});

describe('formatPDFDate', () => {
  test('Turkish uses dd.MM.yyyy', () => {
    expect(formatPDFDate('tr', '05/03/2026')).toBe('05.03.2026');
    expect(formatPDFDate('tr', '5-3-2026')).toBe('05.03.2026');
  });

  test('English uses dd Month yyyy', () => {
    expect(formatPDFDate('en', '05/03/2026')).toBe('05 March 2026');
    expect(formatPDFDate('en', '31-12-2026')).toBe('31 December 2026');
  });

  test('passes through empty and malformed input', () => {
    expect(formatPDFDate('tr', '')).toBe('');
    expect(formatPDFDate('en', '')).toBe('');
    expect(formatPDFDate('tr', '05/13/2026')).toBe('05/13/2026');
    expect(formatPDFDate('en', 'yarın')).toBe('yarın');
  });
});

describe('pdfUpper', () => {
  test('uses Turkish casing for Turkish labels', () => {
    expect(pdfUpper('tr', PDF_LABELS.tr.unitCost)).toBe('BİRİM FİYAT');
    expect(pdfUpper('tr', PDF_LABELS.tr.description)).toBe('AÇIKLAMA');
    expect(pdfUpper('tr', PDF_LABELS.tr.discount)).toBe('İNDİRİM');
  });

  test('matches plain uppercase for English labels', () => {
    for (const value of Object.values(PDF_LABELS.en)) {
      expect(pdfUpper('en', value)).toBe(value.toUpperCase());
    }
  });
});

describe('buildInvoicePDFFilename', () => {
  const base = {
    companyName: 'Vinena Studio',
    date: '05/03/2026',
    entityName: 'Ana Varlık',
    recipientTitle: 'ACME GmbH',
  };

  test('prefixes the localized document name', () => {
    expect(buildInvoicePDFFilename({ ...base, language: 'tr' })).toBe(
      'Fatura-2026-03-05-Ana-Varlık-ACME-GmbH.pdf',
    );
    expect(buildInvoicePDFFilename({ ...base, language: 'en' })).toBe(
      'Invoice-2026-03-05-Ana-Varlık-ACME-GmbH.pdf',
    );
  });

  test('falls back to the company name and localized placeholders', () => {
    const empty = { companyName: '', date: '', recipientTitle: '' };
    expect(buildInvoicePDFFilename({ ...empty, language: 'tr' })).toBe(
      'Fatura-tarihsiz-varlik-alici.pdf',
    );
    expect(buildInvoicePDFFilename({ ...empty, language: 'en' })).toBe(
      'Invoice-undated-entity-recipient.pdf',
    );
    expect(buildInvoicePDFFilename({ ...base, entityName: undefined, language: 'en' })).toBe(
      'Invoice-2026-03-05-Vinena-Studio-ACME-GmbH.pdf',
    );
  });
});
