import { expect, test, vi } from 'vitest';
import { renderInvoicePDF } from '../src/components/invoice-pdf.tsx';
import { data, pdfRuns } from './invoice-pdf-helpers.ts';

// Two weights under one PostScript name: Suisse Intl as `pnpm fonts` derives
// it (both weights are "Font"), or without it Inter Regular as both weights.
vi.mock('@/components/invoice-pdf-fonts.ts', async () => {
  const { existsSync } = await import('node:fs');
  const suisse = `${import.meta.dirname}/../../../packages/ui/fonts/SuisseIntl`;
  const inter = `${import.meta.dirname}/../src/assets/fonts/Inter-Regular.ttf`;
  const fetched = existsSync(`${suisse}-Regular.ttf`) && existsSync(`${suisse}-Medium.ttf`);
  return {
    PDF_FONT_FILES: fetched
      ? { medium: `${suisse}-Medium.ttf`, regular: `${suisse}-Regular.ttf` }
      : { medium: inter, regular: inter },
  };
});

test('embeds each weight and prints Turkish text', async () => {
  const blob = await renderInvoicePDF({ ...data, language: 'tr' });
  const pdf = Buffer.from(await blob.arrayBuffer());
  expect(pdf.toString('latin1').match(/\/FontFile2/g)).toHaveLength(2);
  const text = pdfRuns(pdf).join('');
  for (const part of ['Örnek Yazılım Şirketi', 'ÇAĞDAŞ TEKNOLOJİ A.Ş.', 'ğüşıöç İĞÜŞÖÇ']) {
    expect(text).toContain(part);
  }
});
