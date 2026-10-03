import { describe, expect, test } from 'vitest';
import { GIB_COUNTRIES } from '../src/lib/gib-constants.ts';
import {
  BILINGUAL_SEPARATOR,
  buildEArchiveFilename,
  buildInvoicePDFFilename,
  DEFAULT_PDF_LANGUAGE,
  DEFAULT_PDF_STYLE,
  formatPDFAmount,
  formatPDFCountry,
  formatPDFDate,
  formatPDFNumber,
  formatPDFPercent,
  formatPDFQuantity,
  formatPDFQuantityUnit,
  PDF_LABELS,
  PDF_LANGUAGES,
  pdfUpper,
  resolvePDFLanguage,
  resolvePDFStyle,
  type PDFLabels,
} from '../src/lib/invoice-pdf-i18n.ts';

describe('labels', () => {
  test('every language has a dictionary', () => {
    expect(PDF_LANGUAGES.toSorted()).toEqual(['both', 'en', 'tr']);
    expect(Object.keys(PDF_LABELS).toSorted()).toEqual([...PDF_LANGUAGES].toSorted());
  });

  test.each(PDF_LANGUAGES)('%s has every key with a non-empty value', (language) => {
    const labels = PDF_LABELS[language];
    expect(Object.keys(labels).toSorted()).toEqual(Object.keys(PDF_LABELS.en).toSorted());
    for (const value of Object.values(labels)) {
      expect(value.trim()).not.toBe('');
    }
  });

  test('bilingual labels put Turkish first and name a shared label once', () => {
    for (const key of Object.keys(PDF_LABELS.tr) as Array<keyof PDFLabels>) {
      const tr = PDF_LABELS.tr[key];
      const en = PDF_LABELS.en[key];
      expect(PDF_LABELS.both[key]).toBe(tr === en ? tr : `${tr}${BILINGUAL_SEPARATOR}${en}`);
    }
    expect(PDF_LABELS.both).toMatchObject({
      billedTo: 'Sayın / Billed to',
      date: 'Tarih / Date',
      iban: 'IBAN',
      invoice: 'Fatura / Invoice',
      total: 'Genel toplam / Total',
    });
  });

  test('no single-language label contains the bilingual separator', () => {
    for (const language of ['tr', 'en'] as const) {
      for (const value of Object.values(PDF_LABELS[language])) {
        expect(value).not.toContain(BILINGUAL_SEPARATOR);
      }
    }
  });

  test('Turkish labels use e-invoice wording', () => {
    expect(PDF_LABELS.tr).toMatchObject({
      amount: 'Tutar',
      billedTo: 'Sayın',
      description: 'Açıklama',
      discount: 'İndirim',
      dueDate: 'Son ödeme tarihi',
      eArchiveInvoice: 'e-Arşiv fatura',
      invoice: 'Fatura',
      invoiceNumber: 'Fatura no',
      quantity: 'Miktar',
      subtotal: 'Ara toplam',
      total: 'Genel toplam',
      unitPrice: 'Birim fiyat',
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
    expect(resolvePDFLanguage('both', 'tr')).toBe('both');
    expect(resolvePDFLanguage('de', 'tr')).toBe('tr');
    expect(resolvePDFLanguage('de')).toBe('en');
  });
});

describe('resolvePDFStyle', () => {
  test('falls back to minimal', () => {
    expect(DEFAULT_PDF_STYLE).toBe('minimal');
    expect(resolvePDFStyle()).toBe('minimal');
    expect(resolvePDFStyle('fancy')).toBe('minimal');
  });

  test('prefers the first valid candidate', () => {
    expect(resolvePDFStyle(undefined, 'classic')).toBe('classic');
    expect(resolvePDFStyle('minimal', 'classic')).toBe('minimal');
  });
});

describe('formatPDFAmount', () => {
  test('Turkish and bilingual use dot grouping and comma decimals', () => {
    expect(formatPDFAmount('tr', 'USD', 1234.56)).toBe('USD 1.234,56');
    expect(formatPDFAmount('tr', 'TRY', 1_234_567.8)).toBe('TRY 1.234.567,80');
    expect(formatPDFAmount('tr', 'EUR', 0)).toBe('EUR 0,00');
    expect(formatPDFAmount('both', 'USD', 1234.56)).toBe('USD 1.234,56');
  });

  test('English keeps comma grouping and dot decimals', () => {
    expect(formatPDFAmount('en', 'USD', 1234.56)).toBe('USD 1,234.56');
    expect(formatPDFAmount('en', 'TRY', 1_234_567.8)).toBe('TRY 1,234,567.80');
    expect(formatPDFAmount('en', 'EUR', 0)).toBe('EUR 0.00');
  });
});

describe('formatPDFNumber', () => {
  test('takes the fraction digits it is given', () => {
    expect(formatPDFNumber('tr', 38.5, 4)).toBe('38,5000');
    expect(formatPDFNumber('both', 1500)).toBe('1.500,00');
    expect(formatPDFNumber('en', 38.5, 4)).toBe('38.5000');
  });
});

describe('formatPDFQuantity', () => {
  test('Turkish and bilingual use comma decimals', () => {
    expect(formatPDFQuantity('tr', 1)).toBe('1');
    expect(formatPDFQuantity('tr', 1.5)).toBe('1,5');
    expect(formatPDFQuantity('tr', 1000)).toBe('1.000');
    expect(formatPDFQuantity('both', 1.5)).toBe('1,5');
  });

  test('English prints the raw number', () => {
    expect(formatPDFQuantity('en', 1.5)).toBe('1.5');
    expect(formatPDFQuantity('en', 1000)).toBe('1000');
  });
});

describe('formatPDFQuantityUnit', () => {
  test('a piece count is the bare number', () => {
    expect(formatPDFQuantityUnit('tr', 3, 'C62')).toBe('3');
    expect(formatPDFQuantityUnit('en', 3, '')).toBe('3');
  });

  test('word units are spelled out in the language', () => {
    expect(formatPDFQuantityUnit('tr', 1.5, 'HUR')).toBe('1,5 saat');
    expect(formatPDFQuantityUnit('both', 2, 'DAY')).toBe('2 gün');
    expect(formatPDFQuantityUnit('en', 1, 'HUR')).toBe('1 hour');
    expect(formatPDFQuantityUnit('en', 1.5, 'HUR')).toBe('1.5 hours');
    expect(formatPDFQuantityUnit('en', 12, 'MON')).toBe('12 months');
  });

  test('symbols and unknown codes print as GİB writes them', () => {
    expect(formatPDFQuantityUnit('en', 5, 'KGM')).toBe('5 kg');
    expect(formatPDFQuantityUnit('tr', 5, 'XYZ')).toBe('5 XYZ');
  });
});

describe('formatPDFCountry', () => {
  test('prints the full name of a country GİB cuts short', () => {
    expect(formatPDFCountry('tr', 'Amerika Birleşik Dev')).toBe('Amerika Birleşik Devletleri');
    expect(formatPDFCountry('en', 'Amerika Birleşik Dev')).toBe('United States');
    expect(formatPDFCountry('both', 'Amerika Birleşik Dev')).toBe(
      'Amerika Birleşik Devletleri / United States',
    );
  });

  test('names a country both languages share once, and prints unknown values as given', () => {
    expect(formatPDFCountry('both', 'Andorra')).toBe('Andorra');
    expect(formatPDFCountry('both', 'Almanya')).toBe('Almanya / Germany');
    expect(formatPDFCountry('en', 'Atlantis')).toBe('Atlantis');
  });

  test('every GİB country has a Turkish and an English name', () => {
    for (const { en, label } of GIB_COUNTRIES) {
      expect(label.trim()).toBe(label);
      expect(en.trim()).toBe(en);
      expect(label).not.toBe('');
      expect(en).not.toBe('');
    }
  });

  test('every name GİB cuts at 20 characters has its full name', () => {
    // 20 characters or more, and complete as GİB has them
    const complete = new Set([
      'Çin Halk Cumhuriyeti',
      'Dağistan Cumhuriyeti',
      'Serbest Bölge (Ba-Bs)',
    ]);
    // Cut at 20 before a space, which GİB then trims
    const cutShorter = new Set(['Heard Adaları Ve Mc']);
    const cut = GIB_COUNTRIES.filter(
      ({ value }) => (value.length >= 20 && !complete.has(value)) || cutShorter.has(value),
    );
    expect(cut).toHaveLength(30);
    for (const { label, value } of cut) {
      expect(label, value).not.toBe(value);
    }
  });
});

describe('formatPDFPercent', () => {
  test('Turkish puts the sign first, English last', () => {
    expect(formatPDFPercent('tr', 20)).toBe('%20');
    expect(formatPDFPercent('both', 0)).toBe('%0');
    expect(formatPDFPercent('en', 20)).toBe('20%');
    expect(formatPDFPercent('tr', 0.5)).toBe('%0,5');
  });
});

describe('formatPDFDate', () => {
  test('Turkish and bilingual use dd.MM.yyyy', () => {
    expect(formatPDFDate('tr', '05/03/2026')).toBe('05.03.2026');
    expect(formatPDFDate('tr', '5-3-2026')).toBe('05.03.2026');
    expect(formatPDFDate('both', '05/03/2026')).toBe('05.03.2026');
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
    expect(pdfUpper('tr', PDF_LABELS.tr.unitPrice)).toBe('BİRİM FİYAT');
    expect(pdfUpper('tr', PDF_LABELS.tr.description)).toBe('AÇIKLAMA');
    expect(pdfUpper('tr', PDF_LABELS.tr.discount)).toBe('İNDİRİM');
  });

  test('matches plain uppercase for English labels', () => {
    for (const value of Object.values(PDF_LABELS.en)) {
      expect(pdfUpper('en', value)).toBe(value.toUpperCase());
    }
  });

  test('cases each half of a bilingual label in its own language', () => {
    expect(pdfUpper('both', PDF_LABELS.both.invoice)).toBe('FATURA / INVOICE');
    expect(pdfUpper('both', PDF_LABELS.both.unitPrice)).toBe('BİRİM FİYAT / UNIT PRICE');
    expect(pdfUpper('both', PDF_LABELS.both.billedTo)).toBe('SAYIN / BILLED TO');
    expect(pdfUpper('both', PDF_LABELS.both.iban)).toBe('IBAN');
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
    expect(buildInvoicePDFFilename({ ...base, language: 'both' })).toBe(
      'Fatura-2026-03-05-Ana-Varlık-ACME-GmbH.pdf',
    );
  });

  test('falls back to the company name and localized placeholders', () => {
    const empty = { companyName: '', date: '', recipientTitle: '' };
    expect(buildInvoicePDFFilename({ ...empty, language: 'tr' })).toBe(
      'Fatura-tarihsiz-sirket-alici.pdf',
    );
    expect(buildInvoicePDFFilename({ ...empty, language: 'en' })).toBe(
      'Invoice-undated-company-recipient.pdf',
    );
    expect(buildInvoicePDFFilename({ ...base, entityName: undefined, language: 'en' })).toBe(
      'Invoice-2026-03-05-Vinena-Studio-ACME-GmbH.pdf',
    );
  });
});

describe('buildEArchiveFilename', () => {
  const base = {
    companyName: 'Vinena Studio',
    date: '05/03/2026',
    entityName: 'Ana Varlık',
    gibNumber: 'GIB2026000000001',
    recipientTitle: 'ACME GmbH',
  };

  test('names GİB’s copy apart from the Angaria PDF, with GİB’s number', () => {
    expect(buildEArchiveFilename(base, 'pdf')).toBe(
      'e-Arsiv-Fatura-2026-03-05-Ana-Varlık-ACME-GmbH-GIB2026000000001.pdf',
    );
    expect(buildEArchiveFilename(base, 'zip')).toBe(
      'e-Arsiv-Fatura-2026-03-05-Ana-Varlık-ACME-GmbH-GIB2026000000001.zip',
    );
    expect(buildEArchiveFilename(base, 'pdf')).not.toBe(
      buildInvoicePDFFilename({ ...base, language: 'tr' }),
    );
  });

  test('reads GİB’s list date and leaves out a missing number', () => {
    expect(
      buildEArchiveFilename({ ...base, date: '05-03-2026', gibNumber: undefined }, 'zip'),
    ).toBe('e-Arsiv-Fatura-2026-03-05-Ana-Varlık-ACME-GmbH.zip');
    expect(
      buildEArchiveFilename(
        { companyName: '', date: '', gibNumber: ' / ', recipientTitle: 'Ünvan: A/B' },
        'pdf',
      ),
    ).toBe('e-Arsiv-Fatura-tarihsiz-sirket-Ünvan-A-B.pdf');
  });
});
