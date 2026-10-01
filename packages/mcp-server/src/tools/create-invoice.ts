import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { InvoiceDetails } from 'angaria-earsiv-sdk';
import { z } from 'zod';
import { formatGIBDate, formatGIBTime, gibTime, pastGIBDate } from '../dates.ts';
import type { ToolContext } from '../session.ts';
import { computeItemFields, computeTotals } from '../totals.ts';

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_INVOICE_TYPE = 'ISTISNA';
const MAX_UNIT_PRICE = 1_000_000_000;

/** At most two decimals, the kuruş GİB amounts have. */
const hasCents = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const itemSchema = z.object({
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
    .refine(hasCents, 'At most two decimals')
    .describe('Unit price excluding VAT, at most two decimals'),
  unitType: z
    .string()
    .optional()
    .describe("Unit code: 'C62' (piece, default), 'HUR' (hour), 'DAY' (day), 'MON' (month)"),
  VATRate: z.literal([0, 1, 10, 20]).describe('VAT rate as percentage: 0, 1, 10 or 20'),
});

const checkedItem = itemSchema
  .refine((item) => (item.discountAmount ?? 0) <= computeItemFields(item).price, {
    message: 'discountAmount must not exceed quantity × unitPrice',
    path: ['discountAmount'],
  })
  .refine(
    ({ discountAmount, discountRate, ...item }) =>
      discountAmount === undefined ||
      discountRate === undefined ||
      computeItemFields({ ...item, discountRate }).discountAmount === discountAmount,
    {
      message: 'discountAmount does not match discountRate; give only one of them',
      path: ['discountAmount'],
    },
  );

export const createInvoiceInput = z
  .object({
    city: z.string().optional().describe('City'),
    country: z.string().optional().describe('Country name in Turkish'),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Expected a three-letter code such as USD')
      .optional()
      .describe(`Currency code: ${DEFAULT_CURRENCY} (default), TRY, EUR, GBP, etc.`),
    currencyRate: z
      .string()
      .regex(/^\d+(?:\.\d+)?$/, 'Expected a decimal such as 41.5')
      .refine((value) => Number(value) > 0, 'Must be positive')
      .optional()
      .describe('Exchange rate to TRY. Required when currency is not TRY.'),
    date: pastGIBDate
      .optional()
      .describe('Invoice date DD/MM/YYYY, not after today. Defaults to today.'),
    district: z.string().optional().describe('District'),
    fullAddress: z.string().min(1).describe('Recipient full address'),
    invoiceType: z
      .string()
      .optional()
      .describe(
        `Invoice type: ${DEFAULT_INVOICE_TYPE} (default, for exports), SATIS, IADE, TEVKIFAT, OZELMATRAH, IHRACKAYITLI`,
      ),
    items: z.array(checkedItem).min(1).describe('Invoice line items (at least one)'),
    name: z.string().optional().describe('Recipient first name (for individuals)'),
    note: z.string().optional().describe('Note to appear on the invoice'),
    surname: z.string().optional().describe('Recipient last name (for individuals)'),
    taxIDOrTRID: z
      .string()
      .regex(/^\d{10,11}$/, 'Expected a 10 digit VKN or an 11 digit TCKN')
      .describe('Recipient tax ID (VKN, 10 digits) or TR ID (TCKN, 11 digits)'),
    taxOffice: z.string().optional().describe('Tax office name (vergi dairesi)'),
    time: gibTime.optional().describe('Invoice time HH:MM:SS. Defaults to now.'),
    title: z.string().min(1).describe('Recipient company name or full name'),
  })
  .refine(({ currency = DEFAULT_CURRENCY, currencyRate }) => currency === 'TRY' || !!currencyRate, {
    message: 'currencyRate is required when currency is not TRY',
    path: ['currencyRate'],
  });

export type CreateInvoiceArgs = z.infer<typeof createInvoiceInput>;

export function toInvoiceDetails(args: CreateInvoiceArgs, now: Date): InvoiceDetails {
  const items = args.items.map(computeItemFields);
  return {
    ...computeTotals(items),
    city: args.city,
    country: args.country,
    currency: args.currency ?? DEFAULT_CURRENCY,
    currencyRate: args.currencyRate,
    date: args.date ?? formatGIBDate(now),
    district: args.district,
    fullAddress: args.fullAddress,
    invoiceType: args.invoiceType ?? DEFAULT_INVOICE_TYPE,
    items,
    name: args.name,
    note: args.note,
    surname: args.surname,
    taxIDOrTRID: args.taxIDOrTRID,
    taxOffice: args.taxOffice,
    time: args.time ?? formatGIBTime(now),
    title: args.title,
  };
}

export function registerCreateInvoice(server: McpServer, { client, withSession }: ToolContext) {
  server.registerTool(
    'create_invoice',
    {
      annotations: { destructiveHint: false, openWorldHint: true },
      description:
        'Create a draft e-Arşiv invoice on the GİB portal. Line totals, VAT amounts, and grand totals are calculated automatically: only provide item name, quantity, unitPrice, and VATRate. GİB assigns the invoice UUID (ETTN); it is returned when the new draft can be found in the drafts list.',
      inputSchema: createInvoiceInput,
    },
    async (args) => {
      const details = toInvoiceDetails(args, new Date());
      return withSession(async (session) => {
        const { date, uuid } = await client.createDraftInvoice(session, details);
        return {
          content: [
            {
              text: JSON.stringify({
                date,
                message: uuid
                  ? 'Invoice created successfully'
                  : 'Invoice created, but its UUID was not found in the drafts list. Use list_invoices for this date to find it.',
                uuid: uuid || null,
              }),
              type: 'text',
            },
          ],
        };
      });
    },
  );
}
