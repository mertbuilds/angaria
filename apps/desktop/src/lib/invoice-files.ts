// İndir's files for a signed invoice, saved into ~/Downloads: Angaria's PDF
// and GİB's own document (the e-Arşiv PDF of GİB's page, GİB's zip). The
// invoice detail and the MCP tool download_invoice both save through here.
import { buildEArchiveFilename } from './invoice-pdf-i18n.ts';
import { readQRValue } from './invoice-preview.ts';
import type { GIBInvoice } from './invoices.ts';
import { htmlToPDF } from './native.ts';
import { saveFile, type SavedFile } from './save-file.ts';
import type { CompanyInfo, Invoice, PDFLanguage } from './types.ts';

export interface InvoiceFileSource {
  company: CompanyInfo;
  /** The due date Angaria kept for the invoice, dd/MM/yyyy */
  dueDate?: string;
  entityName: string;
  invoice: Invoice & { ettn: string };
  /** GİB's page with the QR code drawn in and no scripts (invoiceHTMLQuery). */
  readHTML: () => Promise<string>;
}

/** Angaria's PDF of the invoice in `language`. */
export async function saveAngariaPDF(
  { company, dueDate, entityName, invoice, readHTML }: InvoiceFileSource,
  { items, note, recipient, settings, subtotal, vat }: GIBInvoice,
  language: PDFLanguage,
): Promise<SavedFile> {
  // The QR code's text sits in GİB's page.
  const html = await readHTML();
  // react-pdf is large, so it loads with the first PDF.
  const { downloadInvoicePDF } = await import('../components/invoice-pdf.tsx');
  return downloadInvoicePDF({
    company,
    date: invoice.belgeTarihi ?? '',
    dueDate,
    entityName,
    ettn: invoice.ettn,
    gibNumber: invoice.belgeNumarasi,
    grandTotal: subtotal,
    items: items.map((item, index) => ({ ...item, id: String(index) })),
    language,
    note,
    qrValue: readQRValue(html),
    recipient: { ...recipient, id: '' },
    settings,
    total: subtotal + vat,
    totalVAT: vat,
  });
}

/** GİB's document: the PDF of GİB's page, or GİB's zip from `readZip`. */
export async function saveEArchive(
  { company, entityName, invoice, readHTML }: InvoiceFileSource,
  file: 'pdf' | 'zip',
  readZip: () => Promise<Uint8Array<ArrayBuffer>>,
): Promise<SavedFile> {
  const filename = buildEArchiveFilename(
    {
      companyName: company.name,
      date: invoice.belgeTarihi ?? '',
      entityName,
      gibNumber: invoice.belgeNumarasi,
      recipientTitle: invoice.aliciUnvanAdSoyad ?? '',
    },
    file,
  );
  if (file === 'zip') {
    return saveFile(new Blob([await readZip()], { type: 'application/zip' }), filename);
  }
  return saveFile(
    new Blob([await htmlToPDF(await readHTML())], { type: 'application/pdf' }),
    filename,
  );
}
