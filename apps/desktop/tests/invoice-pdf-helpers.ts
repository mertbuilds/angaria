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

const object = (raw: string, id: string) => {
  const at = raw.indexOf(`\n${id} 0 obj`);
  return raw.slice(at, raw.indexOf('endobj', at));
};

interface PDFFont {
  cmap: Map<string, string>;
  /** Advance widths by glyph id, in thousandths of the font size */
  widths: Array<number>;
}

/** Every embedded font by its resource name: its ToUnicode CMap and its glyph widths */
function pdfFonts(pdf: Buffer, raw: string) {
  const fonts = new Map<string, PDFFont>();
  for (const [, name, id] of raw.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
    const font = object(raw, id);
    const toUnicode = font.match(/\/ToUnicode (\d+) 0 R/)?.[1];
    const descendant = font.match(/\/DescendantFonts \[(\d+) 0 R\]/)?.[1];
    if (toUnicode && descendant) {
      const cmap = inflate(pdf, raw, raw.indexOf(`\n${toUnicode} 0 obj`));
      const widths = object(raw, descendant).match(/\/W \[0 \[([^\]]*)\]\]/)?.[1] ?? '';
      fonts.set(name, {
        cmap: new Map(
          Array.from(cmap.matchAll(/<([\da-f]{4})><([\da-f]*)>/g), ([, glyph, text]) => [
            glyph,
            fromHex(text),
          ]),
        ),
        widths: widths.trim().split(/\s+/).map(Number),
      });
    }
  }
  return fonts;
}

export interface PDFTextBox {
  /** Points from the page's left edge */
  left: number;
  right: number;
  text: string;
}

/**
 * The PDF's text as react-pdf draws it, one box per run: the glyphs of every TJ
 * through the ToUnicode CMap of the font it is set in, placed by the transforms
 * around it and measured with the font's glyph widths. Nothing on an invoice
 * rotates or skews, so only scale and translation are tracked. react-pdf splits
 * a line where the script changes ("13" and "cc1102-..." of an ETTN); a run
 * that starts where the one before it ends, on its baseline, joins it.
 */
export function pdfTextBoxes(pdf: Buffer) {
  const raw = pdf.toString('latin1');
  const fonts = pdfFonts(pdf, raw);
  const boxes: Array<PDFTextBox & { baseline: number }> = [];
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    let content: string;
    try {
      content = inflate(pdf, raw, match.index);
    } catch {
      continue;
    }
    let ctm = { x: 0, xScale: 1, y: 0, yScale: 1 };
    const saved: Array<typeof ctm> = [];
    let font: PDFFont | undefined;
    let size = 0;
    let textX = 0;
    let textY = 0;
    let textScale = 1;
    for (const [, state, a, d, e, f, matrix, name, fontSize, glyphs] of content.matchAll(
      /^(q|Q)$|^(-?[\d.]+) -?[\d.]+ -?[\d.]+ (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (cm|Tm)$|^\/(F\d+) ([\d.]+) Tf$|^\[(.*)\] TJ$/gm,
    )) {
      if (state === 'q') {
        saved.push(ctm);
      } else if (state === 'Q') {
        ctm = saved.pop() ?? ctm;
      } else if (matrix === 'cm') {
        ctm = {
          x: Number(e) * ctm.xScale + ctm.x,
          xScale: Number(a) * ctm.xScale,
          y: Number(f) * ctm.yScale + ctm.y,
          yScale: Number(d) * ctm.yScale,
        };
      } else if (matrix === 'Tm') {
        textScale = Number(a);
        textX = Number(e);
        textY = Number(f);
      } else if (name) {
        font = fonts.get(name);
        size = Number(fontSize);
      } else if (glyphs !== undefined && font) {
        const { cmap, widths } = font;
        let text = '';
        let advance = 0;
        for (const [, hex, adjustment] of glyphs.matchAll(/<([\da-f]+)>|(-?[\d.]+)/g)) {
          if (hex) {
            for (const glyph of hex.match(/.{4}/g) ?? []) {
              text += cmap.get(glyph) ?? '';
              advance += widths[Number.parseInt(glyph, 16)];
            }
          } else {
            advance -= Number(adjustment);
          }
        }
        const left = textX * ctm.xScale + ctm.x;
        const width = ((advance * size) / 1000) * textScale;
        const baseline = textY * ctm.yScale + ctm.y;
        const right = left + width * ctm.xScale;
        textX += width;
        const last = boxes.at(-1);
        if (
          last &&
          Math.abs(last.baseline - baseline) < 0.01 &&
          Math.abs(last.right - left) < 0.01
        ) {
          last.right = right;
          last.text += text;
        } else {
          boxes.push({ baseline, left, right, text });
        }
      }
    }
  }
  return boxes.map(({ left, right, text }): PDFTextBox => ({ left, right, text }));
}

export const pdfRuns = (pdf: Buffer) => pdfTextBoxes(pdf).map(({ text }) => text);
