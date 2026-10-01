import { inflateSync } from 'node:zlib';
import type { InvoicePDFData } from '../src/components/invoice-pdf.tsx';

export const data: Omit<InvoicePDFData, 'language'> = {
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
  dueDate: '04/04/2026',
  ettn: '13cc1102-6e3e-45de-bcd8-4ffc9e7075f3',
  gibNumber: 'GIB2026000000001',
  grandTotal: 1500,
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
  qrValue: '{"no":"GIB2026000000001","ettn":"13cc1102-6e3e-45de-bcd8-4ffc9e7075f3"}',
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

const inflate = (pdf: Buffer, raw: string, from: number) => {
  const start = raw.indexOf('\n', raw.indexOf('stream', from)) + 1;
  return inflateSync(pdf.subarray(start, raw.indexOf('endstream', start))).toString('latin1');
};

/** UTF-16BE hex ("00470131") as text */
const fromHex = (hex: string) =>
  String.fromCharCode(...(hex.match(/.{4}/g) ?? []).map((unit) => Number.parseInt(unit, 16)));

/**
 * The PDF's text as react-pdf draws it, one entry per run: the glyphs of every
 * TJ through the ToUnicode CMap of the font it is set in.
 */
export function pdfRuns(pdf: Buffer) {
  const raw = pdf.toString('latin1');
  const cmaps = new Map<string, Map<string, string>>();
  for (const [, name, id] of raw.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
    const at = raw.indexOf(`\n${id} 0 obj`);
    const toUnicode = raw.slice(at, raw.indexOf('endobj', at)).match(/\/ToUnicode (\d+) 0 R/)?.[1];
    if (toUnicode) {
      const cmap = inflate(pdf, raw, raw.indexOf(`\n${toUnicode} 0 obj`));
      cmaps.set(
        name,
        new Map(
          Array.from(cmap.matchAll(/<([\da-f]{4})><([\da-f]*)>/g), ([, glyph, text]) => [
            glyph,
            fromHex(text),
          ]),
        ),
      );
    }
  }
  const runs: Array<string> = [];
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    let content: string;
    try {
      content = inflate(pdf, raw, match.index);
    } catch {
      continue;
    }
    let cmap: Map<string, string> | undefined;
    for (const [, font, glyphs] of content.matchAll(/\/(F\d+) [\d.]+ Tf|\[([^\]]*)\] TJ/g)) {
      if (font) {
        cmap = cmaps.get(font);
      } else if (glyphs && cmap) {
        const codes = Array.from(glyphs.matchAll(/<([\da-f]+)>/g), ([, hex]) => hex).join('');
        runs.push((codes.match(/.{4}/g) ?? []).map((glyph) => cmap?.get(glyph) ?? '').join(''));
      }
    }
  }
  return runs;
}
