// The built-in MCP server's tools (docs/adr/0009-built-in-mcp-server.md). The
// Rust server (src-tauri/src/mcp) lists mcpToolList() and hands each
// tools/call to callMcpTool through src/shell/mcp-host.tsx, so a call runs on
// the app's GİB session queue with the active company's login and under the
// app's invoice rules. No tool signs: the user signs a draft by SMS in the
// app. No Tauri or React imports, so tests inject the GİB client and the store.
import {
  cancelInvoiceTool,
  draftSearchRange,
  findDraftToCancel,
  gibTime,
  invoiceItemInput,
  invoiceUUID,
  listInvoicesTool,
  pastGIBDate,
  withDiscountChecks,
} from '@angaria/mcp-server/inputs';
import { roundKurus, type EarsivClient, type SessionInfo } from 'angaria-earsiv-sdk';
import { addDays } from 'date-fns';
import { z } from 'zod';
import {
  byRecentInvoice,
  COUNTRY_OPTIONS,
  countryError,
  customerDefaults,
  customerName,
  findCustomer,
} from './customer.ts';
import { GIB_CURRENCIES, GIB_UNIT_TYPES } from './gib-constants.ts';
import { describeError } from './gib-errors.ts';
import {
  applyCustomer,
  discountForRate,
  formatRate,
  invoiceTotals,
  invoiceWarnings,
  istisnaNote,
  paymentTotal,
  toDraftDetails,
  validateInvoice,
} from './invoice-form.ts';
import { invoiceStatus, newestFirst, parseGIBInvoice } from './invoices.ts';
import { MCP_TOOL_COPY, type McpToolName } from './mcp.ts';
import { ISTISNA_REASONS } from './regulated.ts';
import type { Invoice, InvoiceFormValues, InvoiceItem, Recipient } from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

/** A CallToolResult: JSON text the model reads, isError for a failure. */
export interface McpToolResult {
  content: Array<{ text: string; type: 'text' }>;
  isError?: boolean;
}

/** The active company, as the tools see it at call time. */
export interface McpCompany {
  customers: ReadonlyArray<Recipient>;
  /** A user code and a saved password */
  hasCredentials: boolean;
  name: string;
  services: ReadonlyArray<InvoiceItem>;
}

export type McpGIBClient = Pick<
  EarsivClient,
  'cancelInvoice' | 'createDraftInvoice' | 'getDrafts' | 'getInvoiceDetail' | 'getInvoiceHTML'
>;

export interface CreatedDraft {
  /** DD/MM/YYYY */
  date: string;
  number?: string;
  /** Empty when GİB's list did not show the new draft */
  uuid: string;
}

export interface McpToolContext {
  client: McpGIBClient;
  company: () => McpCompany;
  /** TCMB's buying rate for `currency` on an invoice dated `date`, by the Kur günü setting. */
  currencyRate: (currency: string, date: Date) => Promise<number | undefined>;
  /**
   * Runs `task` on the app's GİB session queue with the active company's
   * login. `signal` drops the task while it waits; a started task runs to its
   * end, so a draft is never half made.
   */
  gib: <T>(task: (session: SessionInfo) => Promise<T>, signal?: AbortSignal) => Promise<T>;
  /** 'checking' when the license check did not settle in time. */
  license: () => Promise<'checking' | 'locked' | 'ok'>;
  newId: () => string;
  now: () => Date;
  /** The app learns the customer and services, and shows the draft. */
  onDraftCreated: (draft: CreatedDraft, values: InvoiceFormValues) => void;
  onDraftDeleted: () => void;
}

export const DRAFT_CREATED = 'Taslak oluşturuldu, Angaria’da SMS ile onayla.';
const DRAFT_CREATED_UNLISTED =
  'Taslak oluşturuldu ama GİB listesinde görünmedi. Angaria’daki Faturalar’da kontrol et, sonra SMS ile onayla.';
export const LICENSE_LOCKED =
  'Angaria kilitli: lisans doğrulanamadı ya da süresi doldu. Angaria’yı açıp lisansını kontrol et.';
const LICENSE_CHECKING = 'Angaria lisansı hâlâ doğruluyor. Birkaç saniye sonra tekrar dene.';
export const NO_LOGIN =
  'Angaria’da GİB hesabı bağlı değil. Ayarlar › GİB hesabı’ndan kullanıcı kodunu ve şifreni gir.';
const BUSY =
  'Angaria’da başka bir GİB işlemi sürüyor (SMS onayı gibi) ya da GİB yavaş. Biraz sonra tekrar dene.';

const json = (value: unknown): McpToolResult => ({
  content: [{ text: JSON.stringify(value, null, 2), type: 'text' }],
});

const failure = (message: string, extra: Record<string, unknown> = {}): McpToolResult => ({
  content: [{ text: JSON.stringify({ error: { message, ...extra } }), type: 'text' }],
  isError: true,
});

interface McpTool {
  annotations: { destructiveHint?: boolean; openWorldHint?: boolean; readOnlyHint?: boolean };
  call: (ctx: McpToolContext, args: unknown, signal?: AbortSignal) => Promise<McpToolResult>;
  description: string;
  inputSchema: z.ZodType;
  name: McpToolName;
}

/** A tool whose `run` gets valid input; GİB tools first need a login. */
function defineTool<T extends z.ZodType>({
  gib,
  run,
  ...tool
}: Omit<McpTool, 'call' | 'inputSchema'> & {
  gib: boolean;
  inputSchema: T;
  run: (ctx: McpToolContext, input: z.output<T>, signal?: AbortSignal) => Promise<McpToolResult>;
}): McpTool {
  return {
    ...tool,
    call: async (ctx, args, signal) => {
      const parsed = tool.inputSchema.safeParse(args ?? {});
      if (!parsed.success) {
        return failure('Girdi geçersiz.', {
          code: 'invalid-input',
          fields: Object.fromEntries(
            parsed.error.issues.map((issue) => [issue.path.join('.') || '(girdi)', issue.message]),
          ),
        });
      }
      if (gib && !ctx.company().hasCredentials) {
        return failure(NO_LOGIN, { code: 'auth' });
      }
      return run(ctx, parsed.data, signal);
    },
  };
}

/** Turkish text folded for search: "musteri" finds "Müşteri". */
const fold = (text: string) =>
  text.toLocaleLowerCase('tr').replaceAll('ı', 'i').normalize('NFD').replaceAll(/\p{M}/gu, '');

const matches = (query: string | undefined, ...texts: Array<string>) => {
  const haystack = fold(texts.join(' '));
  return (query ? fold(query).split(/\s+/) : []).every((word) => haystack.includes(word));
};

const textField = (value: unknown) => (typeof value === 'string' ? value : '');

const invoiceRow = (row: Invoice) => ({
  date: row.belgeTarihi?.replaceAll('-', '/'),
  number: row.belgeNumarasi,
  onayDurumu: row.onayDurumu,
  recipient: row.aliciUnvanAdSoyad,
  status: invoiceStatus(row.onayDurumu).label,
  taxID: row.aliciVknTckn,
  uuid: row.ettn,
});

const listInvoices = defineTool({
  ...listInvoicesTool,
  description:
    'List e-Arşiv invoices on the GİB portal for a date range of at most 31 days, newest first. Each row has the uuid (ETTN), document number, date, recipient, and status: Taslak (unsigned draft), Onaylı (signed) or Silindi.',
  gib: true,
  name: 'list_invoices',
  run: async (ctx, { endDate, startDate }, signal) => {
    const rows = await ctx.gib(
      (session) => ctx.client.getDrafts(session, startDate, endDate),
      signal,
    );
    return json({
      company: ctx.company().name,
      endDate,
      invoices: newestFirst(rows).map(invoiceRow),
      startDate,
    });
  },
});

const getInvoice = defineTool({
  annotations: { openWorldHint: true, readOnlyHint: true },
  description:
    "One invoice from GİB by its uuid: recipient, lines, totals, status and note ('summary', the default), or GİB's own HTML rendering ('html').",
  gib: true,
  inputSchema: z.object({
    format: z
      .enum(['summary', 'html'])
      .optional()
      .describe("'summary' (default) or 'html', GİB's printable page"),
    uuid: invoiceUUID,
  }),
  name: 'get_invoice',
  run: async (ctx, { format = 'summary', uuid }, signal) => {
    const found = await ctx.gib(async (session) => {
      const detail = await ctx.client.getInvoiceDetail(session, uuid);
      const date = textField(detail.faturaTarihi);
      // The status is on the list row, not in the detail.
      const rows = date ? await ctx.client.getDrafts(session, date, date).catch(() => []) : [];
      const row = rows.find((candidate) => candidate.ettn === uuid);
      const html =
        format === 'html'
          ? await ctx.client.getInvoiceHTML(session, uuid, row?.onayDurumu ?? 'Onaylanmadı')
          : undefined;
      return { detail, html, row };
    }, signal);
    if (found.html !== undefined) {
      return { content: [{ text: found.html, type: 'text' }] };
    }
    const { detail, row } = found;
    const invoice = parseGIBInvoice(detail);
    return json({
      company: ctx.company().name,
      currency: invoice.settings.currency,
      currencyRate: invoice.settings.currencyRate || undefined,
      date: textField(detail.faturaTarihi),
      invoiceType: invoice.settings.invoiceType,
      items: invoice.items.map(
        ({ discountAmount, name, quantity, unitPrice, unitType, VATRate }) => ({
          discountAmount: discountAmount || undefined,
          name,
          quantity,
          unitPrice,
          unitType,
          VATRate,
        }),
      ),
      note: invoice.note || undefined,
      number: textField(detail.belgeNumarasi) || row?.belgeNumarasi,
      recipient: invoice.recipient,
      recipientName: customerName(invoice.recipient),
      status: row ? invoiceStatus(row.onayDurumu).label : undefined,
      subtotal: roundKurus(invoice.subtotal),
      time: textField(detail.saat) || undefined,
      total: roundKurus(invoice.total),
      uuid,
      vat: roundKurus(invoice.vat),
    });
  },
});

const appItemInput = withDiscountChecks(
  invoiceItemInput.extend({
    unitType: z
      .string()
      .refine(
        (code) => GIB_UNIT_TYPES.some((unit) => unit.value === code),
        'GİB does not know this unit code',
      )
      .optional()
      .describe(
        "GİB unit code: 'C62' (piece, default), 'HUR' (hour), 'DAY' (day), 'MON' (month), 'ANN' (year)",
      ),
    VATRate: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe(
        "VAT rate as a whole percentage: 20, 10, 1 or 0. Defaults to 0 on İstisna invoices, else the customer's rate, else 20.",
      ),
  }),
);

const recipientInput = z.object({
  city: z.string().optional().describe('City'),
  country: z
    .string()
    .optional()
    .describe(
      "Country in Turkish or English, e.g. 'Almanya', 'Germany', 'ABD'. Needed for customers abroad.",
    ),
  district: z.string().optional().describe('District'),
  fullAddress: z.string().min(1).describe('Full address'),
  name: z.string().optional().describe('First name, for a person'),
  surname: z.string().optional().describe('Last name, for a person'),
  taxIDOrTRID: z
    .string()
    .regex(/^\d{10,11}$/, 'Expected a 10 digit VKN or an 11 digit TCKN')
    .describe('VKN (10 digits) or TCKN (11 digits); 2222222222 for any customer abroad'),
  taxOffice: z.string().optional().describe('Tax office (vergi dairesi)'),
  title: z
    .string()
    .optional()
    .describe('Company name (unvan). For a person, give name and surname instead.'),
});

const createInvoiceInput = z
  .object({
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Expected a three-letter code such as USD')
      .refine(
        (code) => GIB_CURRENCIES.some((currency) => currency.value === code),
        'GİB does not know this currency code',
      )
      .optional()
      .describe(
        "Currency code (TRY, USD, EUR, ...). Defaults to the customer's currency, else TRY.",
      ),
    currencyRate: z
      .string()
      .regex(/^\d+(?:\.\d+)?$/, 'Expected a decimal such as 41.5230')
      .refine((value) => Number(value) > 0, 'Must be positive')
      .optional()
      .describe(
        "Exchange rate to TRY, e.g. '41.5230'. Without it, TCMB's buying rate for the invoice date is used.",
      ),
    customerId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'A saved customer id from list_customers. Its details and invoice defaults (currency, invoice type, VAT rate, due days, İstisna reason) apply.',
      ),
    date: pastGIBDate
      .optional()
      .describe('Invoice date DD/MM/YYYY, not after today. Defaults to today.'),
    dueDays: z
      .number()
      .int()
      .min(0)
      .max(365)
      .optional()
      .describe("Payment due this many days after the invoice date, printed on Angaria's PDF only"),
    invoiceType: z
      .enum(['SATIS', 'ISTISNA'])
      .optional()
      .describe(
        "SATIS (sale) or ISTISNA (VAT exempt, e.g. services exported abroad). Defaults to the customer's type: İstisna abroad, Satış in Türkiye. Angaria creates no other type.",
      ),
    istisnaCode: z
      .enum(['301', '302', '350'])
      .optional()
      .describe(
        'İstisna reason: 301 goods export, 302 service export (default), 350 other. Its sentence goes into the note.',
      ),
    items: z.array(appItemInput).min(1).describe('Invoice lines (at least one)'),
    note: z.string().optional().describe('Note printed on the invoice'),
    recipient: recipientInput
      .optional()
      .describe(
        "The recipient when it is not a saved customer. One with a saved customer's VKN/TCKN and name takes that customer's defaults.",
      ),
    time: gibTime.optional().describe('Invoice time HH:MM:SS. Defaults to now.'),
  })
  .refine(({ customerId, recipient }) => (customerId === undefined) !== (recipient === undefined), {
    message: 'Give either customerId or recipient',
    path: ['customerId'],
  });

const EMPTY_RECIPIENT = {
  city: '',
  country: '',
  district: '',
  fullAddress: '',
  name: '',
  surname: '',
  taxIDOrTRID: '',
  taxOffice: '',
  title: '',
};

/**
 * GİB's value for a country typed in Turkish or English, its GİB spelling or
 * an alias ("Germany", "ABD", "Türkiye"); '' stays ''. Null when GİB has none.
 */
function gibCountry(text: string): string | null {
  const query = fold(text.trim());
  if (!query) {
    return '';
  }
  return (
    COUNTRY_OPTIONS.find((country) =>
      [country.value, country.label, country.en, ...country.aliases].some(
        (name) => fold(name) === query,
      ),
    )?.value ?? null
  );
}

/** The İstisna reason whose sentence is in `note`, if any. */
const reasonInNote = (note: string) =>
  ISTISNA_REASONS.find((reason) => note.includes(reason.sentence))?.code;

const DEFAULT_ISTISNA_CODE = '302';

const createInvoice = defineTool({
  annotations: { destructiveHint: false, openWorldHint: true },
  description:
    "Create an UNSIGNED draft e-Arşiv invoice on GİB for a saved customer (customerId) or a new recipient. Totals and VAT are computed, Angaria's rules apply (Satış or İstisna only, İstisna at 0% VAT), and the customer's defaults fill what is not given. The draft is not a legal invoice until the user signs it by SMS in Angaria: tell them to. Returns the draft's uuid and number.",
  gib: true,
  inputSchema: createInvoiceInput,
  name: 'create_invoice',
  run: async (ctx, input, signal) => {
    const now = ctx.now();
    const company = ctx.company();
    let customer: Recipient;
    if (input.customerId !== undefined) {
      const saved = company.customers.find((candidate) => candidate.id === input.customerId);
      if (!saved) {
        return failure(
          'Bu müşteri kayıtlı değil. Kayıtlı müşterileri list_customers ile listele.',
          {
            code: 'unknown-customer',
          },
        );
      }
      customer = saved;
    } else {
      const fields = { ...input.recipient };
      if (fields.country !== undefined) {
        const country = gibCountry(fields.country);
        if (country === null) {
          return failure('Taslak oluşturulmadı: bazı bilgiler eksik ya da hatalı.', {
            code: 'invalid-invoice',
            fields: {
              'recipient.country': `${fields.country} GİB’in ülke listesinde yok. Ülkenin Türkçe ya da İngilizce adını yaz, örneğin Almanya.`,
            },
          });
        }
        fields.country = country;
      }
      const given = { ...EMPTY_RECIPIENT, ...fields, id: ctx.newId() };
      const saved = findCustomer(company.customers, given.taxIDOrTRID, customerName(given));
      customer = saved ? { ...saved, ...fields } : given;
    }

    const date = input.date ?? '';
    const invoiceDate = parseGIB(date) ?? now;
    const applied = applyCustomer(
      {
        advancedFields: {
          dueDate: '',
          irsaliyeNumarasi: '',
          irsaliyeTarihi: '',
          manualDate: date,
          manualTime: input.time ?? '',
          paymentTotal: '',
        },
        invoiceSettings: { currency: 'TRY', currencyRate: '', invoiceType: 'SATIS' },
        items: [],
        note: input.note ?? '',
        recipient: customer,
      },
      customer,
      now,
    );
    const invoiceType = input.invoiceType ?? applied.invoiceSettings.invoiceType;
    const currency = input.currency ?? applied.invoiceSettings.currency;
    const istisnaCode =
      invoiceType === 'ISTISNA'
        ? (input.istisnaCode ??
          applied.invoiceSettings.istisnaCode ??
          reasonInNote(applied.note) ??
          DEFAULT_ISTISNA_CODE)
        : undefined;
    const defaultVAT = invoiceType === 'ISTISNA' ? 0 : (customer.VATRate ?? 20);

    let currencyRate = '';
    if (currency !== 'TRY') {
      const rate = input.currencyRate
        ? Number(input.currencyRate)
        : await ctx.currencyRate(currency, invoiceDate).catch(() => undefined);
      if (rate === undefined) {
        return failure(`TCMB’nin ${currency} kuru alınamadı. Kuru currencyRate ile ver.`, {
          code: 'currency-rate',
        });
      }
      currencyRate = formatRate(rate);
    }

    const values: InvoiceFormValues = {
      ...applied,
      advancedFields: {
        ...applied.advancedFields,
        dueDate:
          input.dueDays === undefined
            ? applied.advancedFields.dueDate
            : toGIB(addDays(invoiceDate, input.dueDays)),
      },
      invoiceSettings: { currency, currencyRate, invoiceType, istisnaCode },
      items: input.items.map((item) => {
        const line: InvoiceItem = {
          discountAmount: item.discountAmount ?? 0,
          discountRate: item.discountRate ?? 0,
          discountReason: item.discountReason ?? '',
          gtip: item.gtip ?? '',
          id: ctx.newId(),
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitType: item.unitType ?? 'C62',
          VATRate: item.VATRate ?? defaultVAT,
        };
        // The form keeps the amount a rate gives, as the line's discount.
        return item.discountAmount === undefined && line.discountRate > 0
          ? { ...line, discountAmount: discountForRate(line, line.discountRate) }
          : line;
      }),
      note: istisnaNote(istisnaCode ?? null, applied.note),
    };

    // The recipient form's own check, outside validateInvoice.
    const country = countryError(values.recipient);
    const errors =
      country === null
        ? validateInvoice(values, now)?.fields
        : { ...validateInvoice(values, now)?.fields, 'recipient.country': country };
    if (errors) {
      return failure('Taslak oluşturulmadı: bazı bilgiler eksik ya da hatalı.', {
        code: 'invalid-invoice',
        fields: errors,
      });
    }
    const warnings = invoiceWarnings(values, now);

    const details = toDraftDetails(values, now);
    const draft = await ctx.gib(async (session): Promise<CreatedDraft> => {
      const created = await ctx.client.createDraftInvoice(session, details);
      if (!created.uuid) {
        return { date: created.date, uuid: '' };
      }
      // The number is an extra: the draft exists either way.
      const rows = await ctx.client.getDrafts(session, created.date, created.date).catch(() => []);
      const number = rows.find((row) => row.ettn === created.uuid)?.belgeNumarasi;
      return { date: created.date, number, uuid: created.uuid };
    }, signal);
    ctx.onDraftCreated(draft, values);

    const totals = invoiceTotals(values.items);
    return json({
      company: company.name,
      currency,
      date: draft.date,
      message: draft.uuid ? DRAFT_CREATED : DRAFT_CREATED_UNLISTED,
      number: draft.number,
      paymentTotal: paymentTotal(values, totals.total),
      recipient: customerName(values.recipient),
      uuid: draft.uuid || null,
      warnings: Object.keys(warnings).length > 0 ? warnings : undefined,
    });
  },
});

const cancelInvoice = defineTool({
  ...cancelInvoiceTool,
  description:
    'Delete an UNSIGNED draft on GİB by its uuid. Signed (Onaylı) invoices are refused: they are cancelled on the GİB portal.',
  gib: true,
  name: 'cancel_invoice',
  run: async (ctx, { date, reason, uuid }, signal) => {
    const { endDate, startDate } = draftSearchRange(date, ctx.now());
    const found = await ctx.gib(async (session) => {
      const drafts = await ctx.client.getDrafts(session, startDate, endDate);
      const match = findDraftToCancel(drafts, uuid);
      if (match.kind === 'draft') {
        await ctx.client.cancelInvoice(session, reason, match.invoice);
      }
      return match;
    }, signal);
    if (found.kind === 'missing') {
      return failure(
        `${uuid} ETTN’li fatura ${startDate} ile ${endDate} arasında bulunamadı. ETTN’yi ve tarihi list_invoices ile kontrol et.`,
        { code: 'not-found' },
      );
    }
    if (found.kind === 'signed') {
      return failure(
        `Bu fatura imzasız bir taslak değil (${found.status}). Angaria yalnızca taslakları siler; onaylı bir faturayı GİB portalından iptal et.`,
        { code: 'not-a-draft' },
      );
    }
    ctx.onDraftDeleted();
    return json({ message: 'Taslak silindi.', uuid });
  },
});

const searchInput = z.object({
  query: z.string().optional().describe('Words to look for; all of them must match'),
});

const listCustomers = defineTool({
  annotations: { openWorldHint: false, readOnlyHint: true },
  description:
    "The active company's saved customers in Angaria, most recently invoiced first, with their invoice defaults. Use a customer's id as create_invoice's customerId.",
  gib: false,
  inputSchema: searchInput,
  name: 'list_customers',
  run: async (ctx, { query }) => {
    const { customers, name } = ctx.company();
    return json({
      company: name,
      customers: byRecentInvoice(customers)
        .filter((customer) => matches(query, customerName(customer), customer.taxIDOrTRID))
        .map((customer) => ({
          address: customer.fullAddress,
          city: customer.city || undefined,
          country: customer.country || undefined,
          defaults: { ...customerDefaults(customer), istisnaCode: customer.istisnaCode },
          district: customer.district || undefined,
          id: customer.id,
          lastInvoicedAt: customer.lastInvoicedAt,
          name: customerName(customer),
          taxIDOrTRID: customer.taxIDOrTRID,
          taxOffice: customer.taxOffice || undefined,
        })),
    });
  },
});

const listServices = defineTool({
  annotations: { openWorldHint: false, readOnlyHint: true },
  description:
    "The active company's saved services (invoice lines) in Angaria with their prices, units and VAT rates, for create_invoice's items.",
  gib: false,
  inputSchema: searchInput,
  name: 'list_services',
  run: async (ctx, { query }) => {
    const { name, services } = ctx.company();
    return json({
      company: name,
      services: services
        .filter((service) => matches(query, service.name))
        .map((service) => ({
          discountRate: service.discountRate || undefined,
          name: service.name,
          quantity: service.quantity,
          unitPrice: service.unitPrice,
          unitType: service.unitType,
          VATRate: service.VATRate,
        })),
    });
  },
});

const TOOLS: ReadonlyArray<McpTool> = [
  listInvoices,
  getInvoice,
  createInvoice,
  cancelInvoice,
  listCustomers,
  listServices,
];

function toJSONSchema(schema: z.ZodType) {
  const result: Record<string, unknown> = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'any',
  });
  // 2020-12 is the default dialect; naming it trips clients that only know draft-07.
  delete result.$schema;
  return result;
}

/** The tools/list entries, in a fixed order. */
export const mcpToolList = () =>
  TOOLS.map((tool) => ({
    annotations: tool.annotations,
    description: tool.description,
    inputSchema: toJSONSchema(tool.inputSchema),
    name: tool.name,
    title: MCP_TOOL_COPY[tool.name].title,
  }));

/**
 * Runs one tools/call. Every tool needs a license that is valid or in its
 * grace period; failures are Turkish tool errors the model can relay.
 */
export async function callMcpTool(
  ctx: McpToolContext,
  name: string,
  args: unknown,
  signal?: AbortSignal,
): Promise<McpToolResult> {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool) {
    return failure(`Bilinmeyen araç: ${name}`, { code: 'unknown-tool' });
  }
  const license = await ctx.license();
  if (license !== 'ok') {
    return failure(license === 'checking' ? LICENSE_CHECKING : LICENSE_LOCKED, {
      code: 'license',
    });
  }
  try {
    return await tool.call(ctx, args, signal);
  } catch (error) {
    // Dropped while it waited in the GİB queue.
    if (signal?.aborted && error === signal.reason) {
      return failure(BUSY, { code: 'busy' });
    }
    const { code, detail, text } = describeError(error);
    return failure(text, { code, detail });
  }
}
