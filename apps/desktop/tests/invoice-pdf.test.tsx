import { inflateSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import { renderInvoicePDF } from '../src/components/invoice-pdf.tsx';
import { gibInvoicePDFData } from '../src/lib/invoice-files.ts';
import {
  formatPDFAmount,
  PDF_LABELS,
  PDF_LANGUAGES,
  PDF_STYLES,
} from '../src/lib/invoice-pdf-i18n.ts';
import { parseGIBInvoice } from '../src/lib/invoices.ts';
import type { PDFLanguage, PDFStyle } from '../src/lib/types.ts';
import { data, pdfRuns, pdfTextBoxes } from './invoice-pdf-helpers.ts';

// Vite resolves font imports to dev-server URLs; react-pdf in Node reads files.
// Inter, so the test does not depend on the licensed Suisse Intl files.
vi.mock('@/components/invoice-pdf-fonts.ts', () => ({
  PDF_FONT_FILES: {
    medium: `${import.meta.dirname}/../src/assets/fonts/Inter-SemiBold.ttf`,
    regular: `${import.meta.dirname}/../src/assets/fonts/Inter-Regular.ttf`,
  },
}));

// A 1 by 1 pixel PNG
const logo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function render(language: PDFLanguage, style: PDFStyle = 'minimal', extra = {}) {
  const blob = await renderInvoicePDF({ ...data, language, style, ...extra });
  return Buffer.from(await blob.arrayBuffer());
}

const pageCount = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length;

/** Glyph to text entries of every ToUnicode CMap, i.e. the PDF's text layer */
function textLayer(pdf: Buffer) {
  const raw = pdf.toString('latin1');
  const entries: Array<{ glyph: string; text: string }> = [];
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    let decoded: string;
    try {
      decoded = inflateSync(pdf.subarray(start, raw.indexOf('endstream', start))).toString(
        'latin1',
      );
    } catch {
      continue;
    }
    if (decoded.includes('begincmap')) {
      for (const [, glyph, text] of decoded.matchAll(/<([\da-f]{4})><([\da-f]*)>/g)) {
        entries.push({ glyph, text });
      }
    }
  }
  return entries;
}

// One test, so the English PDF is the first render with these fonts: before
// fonts were reloaded per PDF, it left fontkit's glyph cache without
// characters for composite parts ("ı" in "i", "G" in "Ğ"), and the Turkish PDF
// rendered after it lost those characters from its text layer.
test('renders English then Turkish with every character in the text layer', async () => {
  const pdfs = { en: await render('en'), tr: await render('tr') };
  for (const pdf of Object.values(pdfs)) {
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('/FontFile2');
    expect(textLayer(pdf).filter(({ text }) => text === '')).toEqual([]);
  }
  const chars = new Set(
    textLayer(pdfs.tr).map(({ text }) => String.fromCodePoint(Number.parseInt(text, 16))),
  );
  for (const char of 'ğĞşŞıİçÇöÖüÜG') {
    expect(chars).toContain(char);
  }
});

test.each(PDF_STYLES.flatMap((style) => PDF_LANGUAGES.map((language) => [style, language])))(
  '%s %s renders with a logo, a QR code and a complete text layer',
  async (style, language) => {
    const pdf = await render(language as PDFLanguage, style as PDFStyle, {
      company: { ...data.company, logo },
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('/Subtype /Image');
    expect(pageCount(pdf)).toBe(1);
    expect(textLayer(pdf).filter(({ text }) => text === '')).toEqual([]);
  },
);

// The page's side margin in invoice-pdf.tsx
const MARGIN = 48;

test.each(PDF_STYLES.flatMap((style) => PDF_LANGUAGES.map((language) => [style, language])))(
  '%s %s prints the ETTN and every other run inside the margins',
  async (style, language) => {
    // September is the longest English month name.
    const pdf = await render(language as PDFLanguage, style as PDFStyle, {
      date: '29/09/2026',
      dueDate: '30/09/2026',
    });
    const width = Number(pdf.toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+)/)?.[1]);
    const boxes = pdfTextBoxes(pdf);
    // The header and the e-Archive mark beside the totals
    expect(boxes.filter(({ text }) => text === data.ettn)).toHaveLength(2);
    // Negated, so a box that could not be measured (NaN) fails too
    expect(
      boxes.filter(({ left, right }) => !(left >= MARGIN - 0.01 && right <= width - MARGIN + 0.01)),
    ).toEqual([]);
  },
);

test.each(PDF_STYLES)('%s breaks a long invoice over pages', async (style) => {
  const items = Array.from({ length: 30 }, (_, index) => ({
    ...data.items[0],
    id: String(index),
  }));
  expect(pageCount(await render('both', style, { items }))).toBeGreaterThan(1);
});

test.each(
  PDF_STYLES.flatMap((style) =>
    ['Amerika Birleşik Devletleri', 'Amerika Birleşik Dev'].flatMap((stored) => [
      [style, 'tr', stored, 'Amerika Birleşik Devletleri'],
      [style, 'en', stored, 'United States'],
      [style, 'both', stored, 'Amerika Birleşik Devletleri / United States'],
    ]),
  ),
)(
  '%s %s prints the full name of a country saved as %s',
  async (style, language, stored, country) => {
    const recipient = { ...data.recipient, country: stored };
    const runs = pdfRuns(await render(language as PDFLanguage, style as PDFStyle, { recipient }));
    expect(runs).toContain(country);
    expect(runs).not.toContain('Amerika Birleşik Dev');
  },
);

test.each(PDF_STYLES.flatMap((style) => PDF_LANGUAGES.map((language) => [style, language])))(
  '%s %s prints Ödenecek tutar when it differs from the total, and its lira amount',
  async (style, language) => {
    const lang = language as PDFLanguage;
    const label = PDF_LABELS[lang].paymentTotal;
    const text = pdfRuns(await render(lang, style as PDFStyle, { paymentTotal: 1700 })).join(' ');
    for (const part of label.split(' / ')) {
      expect(text).toContain(style === 'classic' ? part.split(' ')[0] : part);
    }
    expect(text).toContain(formatPDFAmount(lang, 'USD', 1700));
    expect(text).toContain(formatPDFAmount(lang, 'USD', 1800));
    // 1.700 USD at 38,5
    expect(text).toContain(formatPDFAmount(lang, 'TRY', 65_450));

    const same = pdfRuns(await render(lang, style as PDFStyle, { paymentTotal: 1800 })).join(' ');
    expect(same).not.toContain(formatPDFAmount(lang, 'USD', 1700));
    expect(same).toContain(formatPDFAmount(lang, 'TRY', 69_300));
  },
);

describe('an invoice read from GİB', () => {
  const source = {
    company: data.company,
    entityName: 'Ana Varlık',
    invoice: {
      belgeNumarasi: 'GIB2026000000001',
      belgeTarihi: '01-09-2026',
      ettn: data.ettn ?? '',
    },
  };

  const renderGIB = async (detail: Record<string, unknown>) => {
    const blob = await renderInvoicePDF(gibInvoicePDFData(source, parseGIBInvoice(detail), 'tr'));
    return pdfRuns(Buffer.from(await blob.arrayBuffer())).join('\n');
  };

  test.each(['41.285', '41.2850', '41,2850', 41.285])(
    'prints the rate GİB stored as %s and the lira total GİB prints',
    async (dovzTLkur) => {
      const text = await renderGIB({
        aliciUnvan: 'ÖRNEK TEKNOLOJİ A.Ş.',
        dovzTLkur,
        faturaTipi: 'ISTISNA',
        hesaplanankdv: '0.00',
        malHizmetTable: [
          { birimFiyat: '4500.00', kdvOrani: '0', malHizmet: 'Yazılım Geliştirme', miktar: 1 },
        ],
        matrah: '4500.00',
        odenecekTutar: '4500.00',
        paraBirimi: 'USD',
      });
      expect(text).toContain('1 USD = 41,2850 TRY');
      // GİB's page: Ödenecek Tutar(TL) 185.782,50
      expect(text).toContain('TRY 185.782,50');
      expect(text).not.toContain('41.285,0000');
    },
  );

  test('prints the lira total GİB prints: the total in kuruş times the rate', async () => {
    const text = await renderGIB({
      aliciUnvan: 'ÖRNEK TEKNOLOJİ A.Ş.',
      dovzTLkur: '45.3952',
      faturaTipi: 'ISTISNA',
      malHizmetTable: [
        {
          birimFiyat: '1000.01',
          iskontoOrani: 33.33,
          iskontoTutari: '110.99',
          kdvOrani: '0',
          malHizmet: 'Danışmanlık',
          miktar: 0.333,
        },
        { birimFiyat: '0.01', kdvOrani: '0', malHizmet: 'Destek', miktar: 3 },
      ],
      paraBirimi: 'USD',
    });
    expect(text).toContain('USD 222,04');
    // GİB's page: Ödenecek Tutar(TL) 10.079,55
    expect(text).toContain('TRY 10.079,55');
  });

  test("prints the rows' total and GİB's payable amount, after a withholding", async () => {
    const text = await renderGIB({
      aliciUnvan: 'ÖRNEK TEKNOLOJİ A.Ş.',
      faturaTipi: 'TEVKIFAT',
      hesaplanankdv: '200.00',
      malHizmetTable: [
        { birimFiyat: '1000.00', kdvOrani: '20', malHizmet: 'Danışmanlık', miktar: 1 },
      ],
      matrah: '1000.00',
      odenecekTutar: '1100.00',
      paraBirimi: 'TRY',
    });
    expect(text).toContain('GENEL TOPLAM\nTRY 1.200,00');
    expect(text).toContain('Ödenecek tutar\nTRY 1.100,00');
  });

  test('prints the Ödenecek tutar typed on Yeni fatura, as Yeni fatura’s PDF does', async () => {
    const text = await renderGIB({
      aliciUnvan: 'ÖRNEK TEKNOLOJİ A.Ş.',
      faturaTipi: 'SATIS',
      hesaplanankdv: '200.00',
      malHizmetTable: [
        { birimFiyat: '1000.00', kdvOrani: '20', malHizmet: 'Danışmanlık', miktar: 1 },
      ],
      matrah: '1000.00',
      odenecekTutar: '1150.00',
      paraBirimi: 'TRY',
    });
    expect(text).toContain('GENEL TOPLAM\nTRY 1.200,00');
    expect(text).toContain('Ödenecek tutar\nTRY 1.150,00');
  });

  test('prints no Ödenecek tutar when it is the total', async () => {
    const text = await renderGIB({
      aliciUnvan: 'ÖRNEK TEKNOLOJİ A.Ş.',
      faturaTipi: 'SATIS',
      hesaplanankdv: '200.00',
      malHizmetTable: [
        { birimFiyat: '1000.00', kdvOrani: '20', malHizmet: 'Danışmanlık', miktar: 1 },
      ],
      matrah: '1000.00',
      odenecekTutar: '1200.00',
      paraBirimi: 'TRY',
    });
    expect(text).toContain('TRY 1.200,00');
    expect(text).not.toContain('Ödenecek tutar');
  });
});

test.each(PDF_STYLES)('%s leaves out characters the font has no glyph for', async (style) => {
  const pdf = await render('tr', style, {
    note: 'Teşekkürler 🙏🏽 👨‍👩‍👧',
    recipient: { ...data.recipient, title: 'Ünïcödé 🚀' },
  });
  const runs = pdfRuns(pdf);
  expect(runs.join('\n')).toContain('Ünïcödé');
  expect(runs.join('\n')).toContain('Teşekkürler');
  expect(runs.join('\n')).not.toMatch(/\p{Extended_Pictographic}|‍|️/u);
  expect(textLayer(pdf).filter(({ text }) => text === '')).toEqual([]);
});
