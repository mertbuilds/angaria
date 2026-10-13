import type { InvoicePDFData } from '@/components/invoice-pdf.tsx';

/** What joins and styles emoji (ZWJ, keycap, variation selectors, tags): never printed on its own. */
const isEmojiGlue = (codePoint: number) =>
  codePoint === 0x20_0d ||
  codePoint === 0x20_e3 ||
  (codePoint >= 0xfe_00 && codePoint <= 0xfe_0f) ||
  (codePoint >= 0x0e_00_20 && codePoint <= 0x0e_00_7f);

/**
 * `text` without the characters the PDF's font has no glyph for (emoji and
 * other symbols): react-pdf would draw them as a box over the next letters.
 * Line breaks and tabs stay; spaces left doubled by a removed character close up,
 * and spaces it leaves at a line's start or end go.
 */
export function printableText(text: string, covers: (codePoint: number) => boolean): string {
  const normalized = text.normalize('NFC');
  let kept = '';
  let removed = false;
  for (const char of normalized) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint < 0x20 || (!isEmojiGlue(codePoint) && covers(codePoint))) {
      kept += char;
    } else {
      removed = true;
    }
  }
  return removed ? kept.replaceAll(/ {2,}/g, ' ').replaceAll(/^ +| +$/gm, '') : normalized;
}

/** Fields that never print as text: the logo's data URL and the QR code's content. */
const NOT_TEXT = new Set(['logo', 'qrValue']);

function printableFields<T extends object>(record: T, covers: (codePoint: number) => boolean): T {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === 'string' && !NOT_TEXT.has(key) ? printableText(value, covers) : value,
    ]),
  ) as T;
}

/** The invoice's text as the PDF prints it; the invoice itself keeps every character. */
export function printableInvoice(
  data: InvoicePDFData,
  covers: (codePoint: number) => boolean,
): InvoicePDFData {
  return {
    ...printableFields(data, covers),
    company: printableFields(data.company, covers),
    items: data.items.map((item) => printableFields(item, covers)),
    recipient: printableFields(data.recipient, covers),
  };
}
