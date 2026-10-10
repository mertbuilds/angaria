import { expect, test } from 'vitest';
import { printableInvoice, printableText } from '../src/lib/pdf-text.ts';
import { data } from './invoice-pdf-helpers.ts';

/** Latin, Latin Extended and general punctuation, like the PDF's fonts; no emoji. */
const covers = (codePoint: number) =>
  codePoint < 0x02_50 || (codePoint >= 0x20_00 && codePoint < 0x20_70);

test('drops characters without a glyph and closes up the spaces they leave', () => {
  expect(printableText('Ünïcödé 🚀', covers)).toBe('Ünïcödé');
  expect(printableText('A 🚀 B', covers)).toBe('A B');
  expect(printableText('👨‍👩‍👧 Aile', covers)).toBe('Aile');
  expect(printableText('Ödeme 🙏🏽.', covers)).toBe('Ödeme .');
  // Decomposed marks join their letters first.
  expect(printableText('Ünal', covers)).toBe('Ünal');
});

test('keeps text it can print as it is, line breaks included', () => {
  const text = 'Işıklar Cad.  No:1\nMuratpaşa\t“Antalya” – 2026';
  expect(printableText(text, covers)).toBe(text);
});

test('cleans every printed field but leaves the logo, the QR code and the numbers alone', () => {
  const logo = 'data:image/png;base64,🚀';
  const printable = printableInvoice(
    {
      ...data,
      company: { ...data.company, logo, name: 'Şirket 🚀' },
      items: [{ ...data.items[0], name: 'Hizmet ✨' }],
      language: 'tr',
      note: 'Not 🎉',
      qrValue: '{"no":"🚀"}',
      recipient: { ...data.recipient, title: 'Ünïcödé 🚀' },
    },
    covers,
  );
  expect(printable.company).toMatchObject({ logo, name: 'Şirket' });
  expect(printable.items[0]).toMatchObject({ name: 'Hizmet', quantity: 1.5 });
  expect(printable.note).toBe('Not');
  expect(printable.qrValue).toBe('{"no":"🚀"}');
  expect(printable.recipient.title).toBe('Ünïcödé');
  expect(printable.total).toBe(data.total);
});
