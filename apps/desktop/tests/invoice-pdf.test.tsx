import { inflateSync } from 'node:zlib';
import { expect, test, vi } from 'vitest';
import { renderInvoicePDF } from '../src/components/invoice-pdf.tsx';
import { PDF_LANGUAGES, PDF_STYLES } from '../src/lib/invoice-pdf-i18n.ts';
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
  PDF_STYLES.flatMap((style) => [
    [style, 'tr', 'Amerika Birleşik Devletleri'],
    [style, 'en', 'United States'],
    [style, 'both', 'Amerika Birleşik Devletleri / United States'],
  ]),
)('%s %s prints the full name of a country GİB cuts short', async (style, language, country) => {
  const recipient = { ...data.recipient, country: 'Amerika Birleşik Dev' };
  const runs = pdfRuns(await render(language as PDFLanguage, style as PDFStyle, { recipient }));
  expect(runs).toContain(country);
  expect(runs).not.toContain('Amerika Birleşik Dev');
});
