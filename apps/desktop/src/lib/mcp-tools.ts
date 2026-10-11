// The built-in MCP server's tools (docs/adr/0009-built-in-mcp-server.md,
// docs/adr/0010-mcp-agent-actions.md). The Rust server (src-tauri/src/mcp)
// lists mcpToolList() and hands each tools/call to runMcpTool through
// src/shell/mcp-host.tsx, so a call runs on the app's GİB session queue with
// its company's login (the active one unless it names another) and under the
// app's invoice rules. This file
// holds the invoice tools and the list; signing, records and the import live
// beside it. No Tauri or React imports, so tests inject the GİB client and the
// store.
import {
  cancelInvoiceInput,
  draftSearchRange,
  findDraftToCancel,
  gibTime,
  invoiceItemInput,
  invoiceUUID,
  listInvoicesInput,
  pastGIBDate,
  withDiscountChecks,
} from '@angaria/mcp-server/inputs';
import { roundKurus, type SessionInfo } from 'angaria-earsiv-sdk';
import { TCMBRateError } from 'angaria-utils';
import { addDays } from 'date-fns';
import { z } from 'zod';
import { customerName, defaultPDFLanguage, findCustomer } from './customer.ts';
import {
  applyCustomer,
  discountForRate,
  formatRate,
  invoiceTotals,
  invoiceWarnings,
  istisnaNote,
  istisnaReasonInNote,
  parseDecimal,
  paymentTotal,
  toDraftDetails,
  validateInvoice,
} from './invoice-form.ts';
import {
  invoiceStatus,
  matchesStatus,
  newestFirst,
  parseGIBInvoice,
  statusText,
  type StatusFilter,
} from './invoices.ts';
import {
  currencyCode,
  defineTool,
  failure,
  gibCountry,
  issueFields,
  json,
  LICENSE_CHECKING,
  LICENSE_LOCKED,
  matches,
  parseInput,
  textField,
  unitCode,
  type CreatedDraft,
  type McpGIBClient,
  type McpTool,
  type McpToolContext,
  type McpToolResult,
} from './mcp-tool-kit.ts';
import { IMPORT_TOOLS } from './mcp-tools-import.ts';
import { RECORD_TOOLS } from './mcp-tools-records.ts';
import { SIGNING_TOOLS } from './mcp-tools-signing.ts';
import { MCP_TOOL_COPY, type McpToolName } from './mcp.ts';
import type { Invoice, InvoiceFormValues, InvoiceItem, Recipient } from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

export {
  ACTIONS_OFF,
  LICENSE_LOCKED,
  NO_LOGIN,
  type CreatedDraft,
  type McpAction,
  type McpCompany,
  type McpDownloadRequest,
  type McpGIBClient,
  type McpToolContext,
  type McpToolResult,
} from './mcp-tool-kit.ts';

export const DRAFT_CREATED = 'Taslak oluşturuldu, Angaria’da SMS ile onayla.';
/** What create_invoice says while agents may sign: the agent can ask for the code. */
export const DRAFT_CREATED_SIGNABLE =
  'Taslak oluşturuldu. Onaylamak için request_signing_sms ile SMS şifresi iste ya da Angaria’da SMS ile onayla.';
const DRAFT_CREATED_UNLISTED =
  'Taslak oluşturuldu ama GİB listesinde görünmedi. Angaria’daki Faturalar’da kontrol et, sonra SMS ile onayla.';

const invoiceRow = (row: Invoice) => ({
  date: row.belgeTarihi?.replaceAll('-', '/'),
  number: row.belgeNumarasi,
  onayDurumu: row.onayDurumu,
  recipient: row.aliciUnvanAdSoyad,
  status: statusText(invoiceStatus(row)),
  taxID: row.aliciVknTckn,
  uuid: row.ettn,
});

const STATUS_FILTER: Record<'cancelled' | 'deleted' | 'draft' | 'signed', StatusFilter> = {
  cancelled: 'iptal',
  deleted: 'silindi',
  draft: 'onaylanmadi',
  signed: 'onaylandi',
};

const listInvoices = defineTool({
  annotations: { openWorldHint: true, readOnlyHint: true },
  description:
    "List e-Arşiv invoices on the GİB portal for a date range of at most 31 days, newest first. Each row has the uuid (ETTN), document number, date, recipient, and status: Taslak (unsigned draft), Onaylı (signed; Onaylı (iptal aşamasında) while a cancellation request waits), İptal edildi (signed, then cancelled) or Silindi (deleted draft). Filter by status and by words of the recipient's name or VKN/TCKN.",
  gib: true,
  inputSchema: listInvoicesInput.safeExtend({
    query: z
      .string()
      .optional()
      .describe("Words of the recipient's name or its VKN/TCKN; all of them must match"),
    status: z
      .enum(['draft', 'signed', 'cancelled', 'deleted'])
      .optional()
      .describe(
        'Only invoices with this status: draft (Taslak), signed (Onaylı), cancelled (İptal edildi), deleted (Silindi)',
      ),
  }),
  name: 'list_invoices',
  run: async (ctx, { endDate, query, startDate, status }, signal) => {
    const rows = await ctx.gib(
      (session) => ctx.client.getDrafts(session, startDate, endDate),
      signal,
    );
    const invoices = newestFirst(rows)
      .filter((row) => !status || matchesStatus(row, STATUS_FILTER[status]))
      .filter((row) => matches(query, row.aliciUnvanAdSoyad ?? '', row.aliciVknTckn ?? ''))
      .map(invoiceRow);
    return json({ endDate, invoices, startDate }, `${invoices.length} fatura`);
  },
  summarize: ({ endDate, startDate }) => `${startDate} ile ${endDate} arası`,
});

/** An invoice's detail and its list row, which has the status. */
export async function readInvoice(client: McpGIBClient, session: SessionInfo, uuid: string) {
  const detail = await client.getInvoiceDetail(session, uuid);
  const date = textField(detail.faturaTarihi);
  // The status is on the list row, not in the detail.
  const rows = date ? await client.getDrafts(session, date, date).catch(() => []) : [];
  const row = rows.find((candidate) => candidate.ettn === uuid);
  return { date, detail, row };
}

export const notFound = (uuid: string) =>
  failure(`${uuid} ETTN’li fatura GİB’de bulunamadı. ETTN’yi list_invoices ile kontrol et.`, {
    code: 'not-found',
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
      const read = await readInvoice(ctx.client, session, uuid);
      const html =
        format === 'html'
          ? await ctx.client.getInvoiceHTML(session, uuid, read.row?.onayDurumu ?? 'Onaylanmadı')
          : undefined;
      return { ...read, html };
    }, signal);
    const number = textField(found.detail.belgeNumarasi) || found.row?.belgeNumarasi;
    if (found.html !== undefined) {
      return { activity: number, content: [{ text: found.html, type: 'text' }] };
    }
    const { detail, row } = found;
    const invoice = parseGIBInvoice(detail);
    return json(
      {
        currency: invoice.settings.currency,
        currencyRate: parseDecimal(invoice.settings.currencyRate) || undefined,
        date: found.date,
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
        number,
        recipient: invoice.recipient,
        recipientName: customerName(invoice.recipient),
        status: row ? statusText(invoiceStatus(row)) : undefined,
        subtotal: roundKurus(invoice.subtotal),
        time: textField(detail.saat) || undefined,
        total: roundKurus(invoice.total),
        uuid,
        vat: roundKurus(invoice.vat),
      },
      number,
    );
  },
});

const appItemInput = withDiscountChecks(
  invoiceItemInput.extend({
    unitType: unitCode
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
    .regex(/^\d{10,11}$/, 'VKN 10, TCKN 11 haneli olur. Yalnızca rakam yaz.')
    .describe('VKN (10 digits) or TCKN (11 digits); 2222222222 for any customer abroad'),
  taxOffice: z.string().optional().describe('Tax office (vergi dairesi)'),
  title: z
    .string()
    .optional()
    .describe('Company name (unvan). For a person, give name and surname instead.'),
});

const createInvoiceInput = z
  .object({
    currency: currencyCode
      .optional()
      .describe(
        "Currency code (TRY, USD, EUR, ...; any case). Defaults to the customer's currency, else TRY.",
      ),
    currencyRate: z
      .string()
      .regex(/^\d+(?:\.\d+)?$/, 'Kuru noktalı bir sayı olarak yaz, örneğin 41.5230.')
      .refine((value) => Number(value) > 0, 'Kur sıfırdan büyük olmalı.')
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
    message: 'customerId ya da recipient’tan yalnızca birini ver.',
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

const DEFAULT_ISTISNA_CODE = '302';

/** The form's field names where the tools take another name. */
const FORM_TO_INPUT: Record<string, string> = {
  'advancedFields.dueDate': 'dueDays',
  'advancedFields.manualDate': 'date',
  'advancedFields.manualTime': 'time',
  'invoiceSettings.currency': 'currency',
  'invoiceSettings.currencyRate': 'currencyRate',
  'invoiceSettings.invoiceType': 'invoiceType',
  'invoiceSettings.istisnaCode': 'istisnaCode',
};

/**
 * The form's errors or warnings keyed by create_invoice's inputs ("date",
 * "items.0.VATRate"), never by the form's own paths. A saved customer's
 * details go under customerId.
 */
export function byInputName(fields: Record<string, string>, recipientGiven: boolean) {
  const named: Record<string, string> = {};
  for (const [key, message] of Object.entries(fields)) {
    let name = FORM_TO_INPUT[key] ?? key.replaceAll(/\[(\d+)\]/g, '.$1');
    if (name.startsWith('recipient.') && !recipientGiven) {
      name = 'customerId';
    }
    named[name] ??= message;
  }
  return named;
}

/**
 * A draft made under Yeni fatura's rules: the customer's defaults fill what
 * the input leaves out, then the app's validation, then GİB.
 */
async function createDraft(
  ctx: McpToolContext,
  input: z.output<typeof createInvoiceInput>,
  signal?: AbortSignal,
) {
  const now = ctx.now();
  const company = ctx.company();
  let customer: Recipient;
  if (input.customerId !== undefined) {
    const saved = company.customers.find((candidate) => candidate.id === input.customerId);
    if (!saved) {
      return failure('Bu müşteri kayıtlı değil. Kayıtlı müşterileri list_customers ile listele.', {
        code: 'unknown-customer',
      });
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
        istisnaReasonInNote(applied.note) ??
        DEFAULT_ISTISNA_CODE)
      : undefined;
  const defaultVAT = invoiceType === 'ISTISNA' ? 0 : (customer.VATRate ?? 20);

  let currencyRate = '';
  if (currency !== 'TRY') {
    const rate = input.currencyRate
      ? Number(input.currencyRate)
      : await ctx
          .currencyRate(currency, invoiceDate)
          .catch((error: unknown) => (error instanceof TCMBRateError ? error : undefined));
    if (rate instanceof TCMBRateError) {
      return failure(`${rate.message} Kuru currencyRate ile ver.`, { code: 'currency-rate' });
    }
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

  const recipientGiven = input.customerId === undefined;
  const errors = validateInvoice(values, now)?.fields;
  if (errors) {
    return failure('Taslak oluşturulmadı: bazı bilgiler eksik ya da hatalı.', {
      code: 'invalid-invoice',
      fields: byInputName(errors, recipientGiven),
    });
  }
  const warnings = byInputName(
    invoiceWarnings(values, now, company.companyInfo.taxID),
    recipientGiven,
  );

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
  let message = DRAFT_CREATED_UNLISTED;
  if (draft.uuid) {
    message = ctx.actionsAllowed() ? DRAFT_CREATED_SIGNABLE : DRAFT_CREATED;
  }
  return json(
    {
      currency,
      date: draft.date,
      message,
      number: draft.number,
      paymentTotal: paymentTotal(values, totals.total),
      recipient: customerName(values.recipient),
      uuid: draft.uuid || null,
      warnings: Object.keys(warnings).length > 0 ? warnings : undefined,
    },
    [draft.number, customerName(values.recipient)].filter(Boolean).join(', '),
  );
}

const createInvoice = defineTool({
  annotations: { destructiveHint: false, openWorldHint: true },
  description:
    "Create an UNSIGNED draft e-Arşiv invoice on GİB for a saved customer (customerId) or a new recipient. Totals and VAT are computed, Angaria's rules apply (Satış or İstisna only, İstisna at 0% VAT), and the customer's defaults fill what is not given. Unit prices are in the invoice's currency and are never converted: convert a saved service's price yourself when its currency differs. The draft is not a legal invoice until it is signed: by the user in Angaria, or with request_signing_sms and sign_invoices when the user gives you the SMS code. Returns the draft's uuid and number.",
  gib: true,
  inputSchema: createInvoiceInput,
  name: 'create_invoice',
  run: createDraft,
  summarize: (input) =>
    input.customerId === undefined
      ? `${input.items.length} satır, yeni alıcı`
      : `${input.items.length} satır, kayıtlı müşteri`,
});

const duplicateInvoice = defineTool({
  annotations: { destructiveHint: false, openWorldHint: true },
  description:
    "Tekrar kes: a new UNSIGNED draft from an existing invoice (uuid), as Angaria's Tekrar kes does. The recipient, currency, invoice type, İstisna reason, note and lines carry over; the date is today unless given, and a foreign currency takes TCMB's rate for the new date. Give items to replace the lines (e.g. a new amount). Same rules and result as create_invoice.",
  gib: true,
  inputSchema: z.object({
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
    items: z
      .array(appItemInput)
      .min(1)
      .optional()
      .describe("Lines for the new draft instead of the source invoice's"),
    note: z.string().optional().describe("Note for the new draft instead of the source invoice's"),
    uuid: invoiceUUID.describe('The invoice to repeat, from list_invoices'),
  }),
  name: 'duplicate_invoice',
  run: async (ctx, { date, dueDays, items, note, uuid }, signal) => {
    const detail = await ctx.gib((session) => ctx.client.getInvoiceDetail(session, uuid), signal);
    const source = parseGIBInvoice(detail);
    const { invoiceType } = source.settings;
    if (invoiceType !== 'SATIS' && invoiceType !== 'ISTISNA') {
      return failure(
        'Angaria yalnızca Satış ve İstisna faturası keser. Bu faturayı GİB portalından tekrar kes.',
        { code: 'unsupported-type' },
      );
    }
    const { city, country, district, fullAddress, name, surname, taxIDOrTRID, taxOffice, title } =
      source.recipient;
    const input = parseInput(createInvoiceInput, {
      currency: source.settings.currency,
      date,
      dueDays,
      invoiceType,
      istisnaCode: invoiceType === 'ISTISNA' ? istisnaReasonInNote(source.note) : undefined,
      items:
        items ??
        source.items.map((item) => ({
          discountAmount: item.discountAmount || undefined,
          discountReason: item.discountReason || undefined,
          gtip: item.gtip || undefined,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitType: item.unitType,
          VATRate: item.VATRate,
        })),
      note: note ?? source.note,
      recipient: {
        city,
        country,
        district,
        fullAddress,
        name,
        surname,
        taxIDOrTRID: taxIDOrTRID.trim(),
        taxOffice,
        title,
      },
    });
    if (!input.success) {
      return failure('Taslak oluşturulmadı: kaynak faturanın bazı bilgileri eksik ya da hatalı.', {
        code: 'invalid-invoice',
        fields: issueFields(input.error.issues),
      });
    }
    return createDraft(ctx, input.data, signal);
  },
});

const downloadInvoice = defineTool({
  annotations: { destructiveHint: false, openWorldHint: true },
  description:
    "Save a signed invoice's document into the user's Downloads folder, as Angaria's İndir does, and return the file's path. 'angaria-pdf' (default): Angaria's own PDF with the company's details and bank account, in Turkish, English or both (default: the customer's language). 'earsiv-pdf': GİB's e-Arşiv page as a PDF. 'earsiv-zip': GİB's own zip. Drafts and deleted drafts have no document; a cancelled invoice has the e-Arşiv ones only. A file of the same name is never overwritten.",
  gib: true,
  inputSchema: z.object({
    format: z
      .enum(['angaria-pdf', 'earsiv-pdf', 'earsiv-zip'])
      .optional()
      .describe("'angaria-pdf' (default), 'earsiv-pdf' or 'earsiv-zip'"),
    language: z
      .enum(['tr', 'en', 'both'])
      .optional()
      .describe("Angaria PDF's language: tr, en or both. Defaults to the customer's."),
    uuid: invoiceUUID,
  }),
  name: 'download_invoice',
  run: async (ctx, { format = 'angaria-pdf', language, uuid }, signal) => {
    const { detail, row } = await ctx.gib(
      (session) => readInvoice(ctx.client, session, uuid),
      signal,
    );
    if (!row?.ettn) {
      return notFound(uuid);
    }
    const status = invoiceStatus(row);
    if (status.filter !== 'onaylandi' && status.filter !== 'iptal') {
      return failure(
        `${status.label} durumundaki faturanın indirilecek bir belgesi yok. Önizleme için get_invoice’ı html ile kullan.`,
        { code: 'not-signed' },
      );
    }
    if (status.filter === 'iptal' && format === 'angaria-pdf') {
      return failure(
        'İptal edilen faturanın Angaria PDF’i yok. earsiv-pdf ile e-Arşiv PDF’ini indir.',
        {
          code: 'cancelled',
        },
      );
    }
    const { recipient } = parseGIBInvoice(detail);
    const customer = findCustomer(
      ctx.company().customers,
      recipient.taxIDOrTRID,
      customerName(recipient),
    );
    const saved = await ctx.download({
      format,
      invoice: { ...row, ettn: row.ettn },
      language: language ?? defaultPDFLanguage(customer ?? recipient),
    });
    return json(
      { file: saved.name, message: 'İndirilenler’e kaydedildi.', path: saved.path, uuid },
      saved.name,
    );
  },
  summarize: ({ format = 'angaria-pdf' }) =>
    ({ 'angaria-pdf': 'Angaria PDF', 'earsiv-pdf': 'e-Arşiv PDF', 'earsiv-zip': 'GİB ZIP' })[
      format
    ],
});

const deleteDraft = defineTool({
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: true },
  description:
    'Delete an UNSIGNED draft on GİB by its uuid; it shows as Silindi afterwards. Signed (Onaylı) invoices are refused: a signed invoice is cancelled on the GİB portal. Needs Ajanlar onaylayabilir ve silebilir switched on in Angaria.',
  gib: true,
  inputSchema: cancelInvoiceInput.extend({
    reason: z
      .string()
      .min(1)
      .optional()
      .describe("Why it is deleted. Defaults to 'Taslak silindi'."),
  }),
  limit: { max: 10, windowMs: 60_000 },
  name: 'delete_draft',
  run: async (ctx, { date, reason = 'Taslak silindi', uuid }, signal) => {
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
        `Bu fatura imzasız bir taslak değil (${invoiceStatus({ onayDurumu: found.status }).label}). Angaria yalnızca taslakları siler; onaylı bir faturayı GİB portalından iptal et.`,
        { code: 'not-a-draft' },
      );
    }
    const number = found.invoice.belgeNumarasi;
    ctx.onAction({ kind: 'draft-deleted', number, uuid });
    return json({ message: 'Taslak silindi.', uuid }, `${number ?? uuid} silindi`);
  },
});

const INVOICE_TOOLS = [
  listInvoices,
  getInvoice,
  createInvoice,
  duplicateInvoice,
  downloadInvoice,
  deleteDraft,
];

const BY_NAME = new Map<string, McpTool>(
  [...INVOICE_TOOLS, ...SIGNING_TOOLS, ...RECORD_TOOLS, ...IMPORT_TOOLS].map((tool) => [
    tool.name,
    tool,
  ]),
);

/** Every tool, in the MCP page's order. */
const TOOLS: ReadonlyArray<McpTool> = (Object.keys(MCP_TOOL_COPY) as Array<McpToolName>).map(
  (name) => {
    const tool = BY_NAME.get(name);
    if (!tool) {
      throw new Error(`MCP tool ${name} is not defined`);
    }
    return tool;
  },
);

/**
 * Where the user sees whether a write went through, for the server's answer
 * when the wait for it ends ("tekrar denemeden önce ... kontrol et"). Every
 * tool that is not read-only has one.
 */
export const AFTER_TIMEOUT_CHECK: Partial<Record<McpToolName, string>> = {
  apply_gib_import: 'list_customers ve list_services ile',
  close_gib_session: 'check_gib_connection ile',
  create_customer: 'list_customers ile ya da Angaria’daki Müşteriler’de',
  create_invoice: 'list_invoices ile ya da Angaria’daki Faturalar’da',
  create_service: 'list_services ile ya da Angaria’daki Hizmetler’de',
  delete_customer: 'list_customers ile ya da Angaria’daki Müşteriler’de',
  delete_draft: 'list_invoices ile ya da Angaria’daki Faturalar’da',
  delete_service: 'list_services ile ya da Angaria’daki Hizmetler’de',
  download_invoice: 'İndirilenler klasöründe',
  duplicate_invoice: 'list_invoices ile ya da Angaria’daki Faturalar’da',
  request_signing_sms: 'telefonuna SMS gelip gelmediğini',
  sign_invoices: 'list_invoices ile ya da Angaria’daki Faturalar’da',
  update_company_details: 'get_company_details ile ya da Angaria’daki Ayarlar’da',
  update_customer: 'get_customer ile ya da Angaria’daki Müşteriler’de',
  update_service: 'get_service ile ya da Angaria’daki Hizmetler’de',
};

interface RegexCheck {
  _zod: { def: { error?: (issue: never) => unknown; format?: string; pattern?: RegExp } };
}

/** The message a string schema gives when `pattern` does not match. */
function patternMessage(schema: z.core.$ZodType, pattern: string) {
  const checks = (schema._zod.def as { checks?: ReadonlyArray<RegexCheck> }).checks ?? [];
  const def = checks
    .map((check) => check._zod.def)
    .find((candidate) => candidate.format === 'regex' && candidate.pattern?.source === pattern);
  const message: unknown = def?.error?.({} as never);
  if (typeof message === 'string') {
    return message;
  }
  return typeof message === 'object' && message && 'message' in message
    ? String(message.message)
    : undefined;
}

/** The input schema, and each of its patterns' Turkish messages for the server. */
function toJSONSchema(schema: z.ZodType) {
  const patterns: Record<string, string> = {};
  const result: Record<string, unknown> = z.toJSONSchema(schema, {
    io: 'input',
    override: ({ jsonSchema, zodSchema }) => {
      const { pattern } = jsonSchema;
      const message = typeof pattern === 'string' && patternMessage(zodSchema, pattern);
      if (message) {
        patterns[pattern as string] = message;
      }
    },
    unrepresentable: 'any',
  });
  // 2020-12 is the default dialect; naming it trips clients that only know draft-07.
  delete result.$schema;
  return { patterns, schema: result };
}

/**
 * The tools/list entries, in a fixed order. `x-angaria` is for the Rust
 * server only (src-tauri/src/mcp/inputs.rs), which checks input with it and
 * never lists it.
 */
export const mcpToolList = () =>
  TOOLS.map((tool) => {
    const { patterns, schema } = toJSONSchema(tool.inputSchema);
    return {
      annotations: tool.annotations,
      description: tool.description,
      inputSchema: schema,
      name: tool.name,
      title: MCP_TOOL_COPY[tool.name].title,
      'x-angaria': { check: AFTER_TIMEOUT_CHECK[tool.name], patterns },
    };
  });

/** One call for the activity log: no arguments, codes or secrets. */
export interface McpCallActivity {
  /** The company the call acted on, when it got that far */
  company?: string;
  ok: boolean;
  /** The tool's line, or the error the agent got */
  result: string;
  summary: string;
}

/**
 * Runs one tools/call and says for the activity log what came of it. Every
 * tool needs a license that is valid or in its grace period; failures are
 * Turkish tool errors the model can relay.
 */
export async function runMcpTool(
  ctx: McpToolContext,
  name: string,
  args: unknown,
  signal?: AbortSignal,
): Promise<{ activity: McpCallActivity; result: McpToolResult }> {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  const fail = (message: string, code: string) => ({
    activity: { ok: false, result: message, summary: tool ? MCP_TOOL_COPY[tool.name].title : name },
    result: failure(message, { code }),
  });
  if (!tool) {
    return fail(`Bilinmeyen araç: ${name}`, 'unknown-tool');
  }
  const license = await ctx.license();
  if (license !== 'ok') {
    return fail(license === 'checking' ? LICENSE_CHECKING : LICENSE_LOCKED, 'license');
  }
  const { company, output, summary } = await tool.call(ctx, args, signal);
  const { activity, ...result } = output;
  const ok = result.isError !== true;
  return {
    activity: { company, ok, result: ok ? (activity ?? 'Tamam') : errorText(result), summary },
    result,
  };
}

/** The message of a failure() result. */
function errorText(result: McpToolResult) {
  try {
    const message: unknown = JSON.parse(result.content[0]?.text ?? '').error?.message;
    return typeof message === 'string' ? message : 'Hata';
  } catch {
    return 'Hata';
  }
}

/** runMcpTool's result alone. */
export const callMcpTool = async (
  ctx: McpToolContext,
  name: string,
  args: unknown,
  signal?: AbortSignal,
) => (await runMcpTool(ctx, name, args, signal)).result;
