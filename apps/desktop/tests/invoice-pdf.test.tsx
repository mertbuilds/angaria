import { inflateSync } from 'node:zlib';
import { expect, test, vi } from 'vitest';
import { type InvoicePDFData, renderInvoicePDF } from '../src/components/invoice-pdf.tsx';
import { PDF_LANGUAGES } from '../src/lib/invoice-pdf-i18n.ts';
import type { PDFLanguage } from '../src/lib/types.ts';

// Vite resolves font imports to dev-server URLs; react-pdf in Node reads files.
vi.mock('@/assets/fonts/Inter-Regular.ttf', () => ({
  default: `${import.meta.dirname}/../src/assets/fonts/Inter-Regular.ttf`,
}));
vi.mock('@/assets/fonts/Inter-SemiBold.ttf', () => ({
  default: `${import.meta.dirname}/../src/assets/fonts/Inter-SemiBold.ttf`,
}));
vi.mock('@/assets/fonts/Inter-Bold.ttf', () => ({
  default: `${import.meta.dirname}/../src/assets/fonts/Inter-Bold.ttf`,
}));

const data: Omit<InvoicePDFData, 'language'> = {
  company: {
    accountHolder: 'Gülşen Çağlayan',
    address: 'Işıklar Cad. No:1, Muratpaşa, Antalya',
    bankAddress: 'İstiklal Cad. No:2, Beyoğlu, İstanbul',
    bankName: 'Türkiye İş Bankası',
    email: 'merhaba@ornek.com.tr',
    iban: 'TR00 0000 0000 0000 0000 0000 00',
    name: 'Örnek Yazılım Şirketi',
    phone: '+90 555 000 00 00',
    swiftCode: 'ISBKTRIS',
    taxID: '1234567890',
    taxOffice: 'Antalya Kurumlar',
  },
  date: '05/03/2026',
  grandTotal: 1500,
  invoiceNumber: 'GIB2026000000001',
  items: [
    {
      discountAmount: 100,
      discountRate: 0,
      discountReason: '',
      gtip: '',
      id: '1',
      name: 'Yazılım Geliştirme Hizmeti (ğüşıöç İĞÜŞÖÇ)',
      quantity: 1.5,
      unitPrice: 1066.67,
      unitType: 'HUR',
      VATRate: 20,
    },
  ],
  note: 'Ödeme 30 gün içinde yapılmalıdır.',
  recipient: {
    city: 'İzmir',
    country: 'Türkiye',
    district: 'Karşıyaka',
    fullAddress: 'Şehitler Bulvarı No:3',
    id: 'r1',
    name: 'Ayşe',
    surname: 'Yıldırım',
    taxIDOrTRID: '9876543210',
    taxOffice: 'Karşıyaka',
    title: 'ÇAĞDAŞ TEKNOLOJİ A.Ş.',
  },
  settings: { currency: 'USD', currencyRate: '38.5000', invoiceType: 'SATIS' },
  total: 1800,
  totalDiscount: 100,
  totalVAT: 300,
};

async function render(language: PDFLanguage) {
  const blob = await renderInvoicePDF({ ...data, language });
  return Buffer.from(await blob.arrayBuffer());
}

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
  for (const language of PDF_LANGUAGES) {
    const pdf = pdfs[language];
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
