// Tool inputs shared by this stdio server and the desktop app's built-in MCP
// server (apps/desktop/src/lib/mcp-tools.ts), exported as
// `@angaria/mcp-server/inputs`. No MCP SDK or Node imports: the app bundles it.
import { roundKurus } from 'angaria-earsiv-sdk';
import { z } from 'zod';
import { gibDate, rangeDays } from './dates.ts';

export { draftSearchRange, gibDate, gibTime, pastGIBDate } from './dates.ts';

const MAX_RANGE_DAYS = 31;
const MAX_UNIT_PRICE = 1_000_000_000;

/** At most two decimals, the kuruş GİB amounts have. */
const hasCents = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

export const invoiceUUID = z
  .string()
  .min(1)
  .describe('Invoice UUID (ettn) from list_invoices or create_invoice');

/** One invoice line. VATRate is the stdio server's: GİB's common rates. */
export const invoiceItemInput = z.object({
  discountAmount: z.number().nonnegative().optional().describe('Discount amount in currency units'),
  discountRate: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Discount rate as percentage. Derives the discount amount when that is omitted.'),
  discountReason: z.string().optional().describe('Reason for discount'),
  gtip: z.string().optional().describe('Customs tariff code (GTIP), for goods export invoices'),
  name: z.string().min(1).describe('Product or service name'),
  quantity: z.number().positive().describe('Quantity'),
  unitPrice: z
    .number()
    .positive()
    .max(MAX_UNIT_PRICE)
    .refine(hasCents, 'Tutarı en çok iki ondalıkla yaz, örneğin 1250.50.')
    .describe('Unit price excluding VAT, at most two decimals'),
  unitType: z
    .string()
    .optional()
    .describe("Unit code: 'C62' (piece, default), 'HUR' (hour), 'DAY' (day), 'MON' (month)"),
  VATRate: z.literal([0, 1, 10, 20]).describe('VAT rate as percentage: 0, 1, 10 or 20'),
});

interface DiscountedLine {
  discountAmount?: number | undefined;
  discountRate?: number | undefined;
  quantity: number;
  unitPrice: number;
}

const linePrice = (item: DiscountedLine) => roundKurus(item.quantity * item.unitPrice);

/**
 * The discount checks of a line: the amount stays within the line price, and
 * an amount given with a rate must be the one the rate derives.
 */
export const withDiscountChecks = <T extends z.ZodType<DiscountedLine>>(schema: T) =>
  schema
    .refine((item) => (item.discountAmount ?? 0) <= linePrice(item), {
      message: 'İskonto satır tutarını geçemez.',
      path: ['discountAmount'],
    })
    .refine(
      ({ discountAmount, discountRate, ...item }) =>
        discountAmount === undefined ||
        discountRate === undefined ||
        roundKurus((linePrice(item) * discountRate) / 100) === discountAmount,
      {
        message: 'İskonto tutarı iskonto oranına uymuyor. İkisinden yalnızca birini ver.',
        path: ['discountAmount'],
      },
    );

export const listInvoicesInput = z
  .object({
    endDate: gibDate.describe("End date in DD/MM/YYYY format (e.g. '20/03/2026')"),
    startDate: gibDate.describe("Start date in DD/MM/YYYY format (e.g. '01/03/2026')"),
  })
  .refine(({ endDate, startDate }) => rangeDays(startDate, endDate) >= 1, {
    message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
    path: ['startDate'],
  })
  .refine(({ endDate, startDate }) => rangeDays(startDate, endDate) <= MAX_RANGE_DAYS, {
    message: `Tarih aralığı iki uç dahil en çok ${MAX_RANGE_DAYS} gün olabilir.`,
    path: ['endDate'],
  });

export const cancelInvoiceInput = z.object({
  date: gibDate
    .optional()
    .describe(
      'Invoice date DD/MM/YYYY to narrow the search. If omitted, searches the last 90 days.',
    ),
  reason: z.string().min(1).describe("Cancellation reason (e.g. 'Hatalı düzenlendi')"),
  uuid: invoiceUUID,
});

/** At most this many drafts are signed with one SMS şifresi. */
const MAX_SIGN_BATCH = 20;

export const signingRequestInput = z.object({
  uuids: z
    .array(invoiceUUID)
    .min(1)
    .max(MAX_SIGN_BATCH)
    .refine((uuids) => new Set(uuids).size === uuids.length, 'Her ETTN’yi yalnızca bir kez ver.')
    .describe(`Uuids (ETTN) of the unsigned drafts to sign, at most ${MAX_SIGN_BATCH}`),
});

export const signInvoicesInput = z.object({
  code: z
    .string()
    .describe(
      'The 6 character SMS code (SMS şifresi: letters and digits) the user received and typed to you, exactly as typed',
    ),
  operationId: z.string().min(1).describe('operationId from request_signing_sms'),
});

export interface ToolDefinition<T extends z.ZodType> {
  annotations: { destructiveHint?: boolean; openWorldHint?: boolean; readOnlyHint?: boolean };
  description: string;
  inputSchema: T;
  name: string;
}

export const listInvoicesTool = {
  annotations: { openWorldHint: true, readOnlyHint: true },
  description:
    'List e-Arşiv invoices on the GİB portal for a date range of at most 31 days. Each record has the ETTN (uuid), document number, date, recipient, and approval status (Onaylanmadı = unsigned draft, Onaylandı = signed).',
  inputSchema: listInvoicesInput,
  name: 'list_invoices',
} satisfies ToolDefinition<typeof listInvoicesInput>;

export const cancelInvoiceTool = {
  annotations: { destructiveHint: true, openWorldHint: true },
  description:
    'Cancel (delete) a draft invoice on the GİB portal. Only works on unsigned draft invoices. Provide the invoice UUID from list_invoices or create_invoice.',
  inputSchema: cancelInvoiceInput,
  name: 'cancel_invoice',
} satisfies ToolDefinition<typeof cancelInvoiceInput>;

interface DraftRow {
  [key: string]: unknown;
  ettn?: string;
  faturaUuid?: unknown;
  onayDurumu?: string;
}

/**
 * The row cancel_invoice deletes: the unsigned draft with `uuid`, else why
 * there is none (not in the list, or not an unsigned draft).
 */
export function findDraftToCancel<T extends DraftRow>(
  drafts: ReadonlyArray<T>,
  uuid: string,
): { invoice: T; kind: 'draft' } | { kind: 'missing' } | { kind: 'signed'; status: string } {
  const invoice = drafts.find((d) => d.ettn === uuid || d.faturaUuid === uuid);
  if (!invoice) {
    return { kind: 'missing' };
  }
  if (invoice.onayDurumu !== 'Onaylanmadı') {
    return { kind: 'signed', status: String(invoice.onayDurumu) };
  }
  return { invoice, kind: 'draft' };
}
