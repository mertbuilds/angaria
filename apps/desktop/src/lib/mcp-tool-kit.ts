// What every tool of the built-in MCP server is made of: the context a call
// runs with, the result shapes, and defineTool, which checks the input, the
// agent-actions switch, the rate limit and the GİB login before a tool runs
// (docs/adr/0009-built-in-mcp-server.md, docs/adr/0010-mcp-agent-actions.md).
// No Tauri or React imports, so tests inject the GİB client and the store.
import type { EarsivClient, SessionInfo } from 'angaria-earsiv-sdk';
import { z } from 'zod';
import { COUNTRY_OPTIONS } from './customer.ts';
import { describeError } from './gib-errors.ts';
import type { McpState } from './mcp-state.ts';
import { isGatedTool, MCP_TOOL_COPY, type McpToolName } from './mcp.ts';
import type { SavedFile } from './save-file.ts';
import type { SessionLease } from './session-queue.ts';
import type {
  CompanyInfo,
  Invoice,
  InvoiceFormValues,
  PDFLanguage,
  Recipient,
  Service,
} from './types.ts';

/** A CallToolResult: JSON text the model reads, isError for a failure. */
export interface McpToolResult {
  content: Array<{ text: string; type: 'text' }>;
  isError?: boolean;
}

/** A tool's result and, for the activity log, what came of it in a few words. */
export type McpToolOutput = McpToolResult & { activity?: string };

/** The company a call acts on, as the tools see it at call time. */
export interface McpCompany {
  companyInfo: CompanyInfo;
  customers: ReadonlyArray<Recipient>;
  /** A user code and a saved password */
  hasCredentials: boolean;
  id: string;
  name: string;
  services: ReadonlyArray<Service>;
}

export interface McpCompanySummary {
  /** The company selected in Angaria's sidebar */
  active: boolean;
  /** A user code and a saved password: GİB calls can log in. */
  gibLogin: 'needs-login' | 'ready';
  id: string;
  /** Firma adı ya da unvan from Ayarlar, '' when not set */
  legalName: string;
  /** The name Angaria's company switcher shows */
  name: string;
  /** VKN / TCKN from Ayarlar › Firma bilgileri, '' when not set */
  taxID: string;
}

export type McpGIBClient = Pick<
  EarsivClient,
  | 'cancelInvoice'
  | 'createDraftInvoice'
  | 'getDrafts'
  | 'getInvoiceDetail'
  | 'getInvoiceHTML'
  | 'startSMSSign'
  | 'verifyAndSign'
>;

export interface CreatedDraft {
  /** DD/MM/YYYY */
  date: string;
  number?: string;
  /** Empty when GİB's list did not show the new draft */
  uuid: string;
}

/** What an agent did that the app tells the user about. */
export type McpAction =
  | { kind: 'company-details-updated' }
  | { kind: 'customer-deleted'; name: string }
  | { kind: 'draft-deleted'; number?: string; uuid: string }
  | { kind: 'gib-session-closed' }
  | { kind: 'service-deleted'; name: string }
  | { invoices: ReadonlyArray<{ number?: string; uuid: string }>; kind: 'signed' }
  | { count: number; expiresAt: number; kind: 'signing-requested'; operationId: string };

export type McpDownloadFormat = 'angaria-pdf' | 'earsiv-pdf' | 'earsiv-zip';

export interface McpDownloadRequest {
  format: McpDownloadFormat;
  invoice: Invoice & { ettn: string };
  language: PDFLanguage;
}

export interface McpToolContext {
  /** Ajanlar onaylayabilir ve silebilir is on. */
  actionsAllowed: () => boolean;
  client: McpGIBClient;
  companies: () => ReadonlyArray<McpCompanySummary>;
  /** The company this context acts on: the active one unless the call named another. */
  company: () => McpCompany;
  /** TCMB's buying rate for `currency` on an invoice dated `date`, from the previous business day's bulletin. */
  currencyRate: (currency: string, date: Date) => Promise<number | undefined>;
  /** Saves the invoice's file into ~/Downloads the way İndir does. */
  download: (request: McpDownloadRequest) => Promise<SavedFile>;
  /** Ayarlar' Oturumu kapat: ends the company's open session on the portal. */
  forceLogout: () => Promise<void>;
  /**
   * The context for the company with this id or VKN / TCKN, without switching
   * the app's active company: its own GİB login, records and caches. Null
   * when none matches, 'ambiguous' when two companies share the VKN / TCKN.
   */
  forCompany: (ref: string) => McpToolContext | 'ambiguous' | null;
  /**
   * Runs `task` on the app's GİB session queue with the company's login. `signal` drops the task while it waits; a started task runs to its
   * end, so a draft is never half made. A background task waits for every
   * foreground one.
   */
  gib: <T>(
    task: (session: SessionInfo) => Promise<T>,
    signal?: AbortSignal,
    options?: { background?: boolean },
  ) => Promise<T>;
  /** Holds the company's GİB session until released (SMS signing). */
  lease: (signal?: AbortSignal) => Promise<SessionLease>;
  /** 'checking' when the license check did not settle in time. */
  license: () => Promise<'checking' | 'locked' | 'ok'>;
  newId: () => string;
  now: () => Date;
  onAction: (action: McpAction) => void;
  /** The app learns the customer and services, and shows the draft. */
  onDraftCreated: (draft: CreatedDraft, values: InvoiceFormValues) => void;
  /** These write to this context's company, whichever is active. */
  setCompanyInfo: (update: (info: CompanyInfo) => CompanyInfo) => void;
  setCustomers: (update: (customers: Array<Recipient>) => Array<Recipient>) => void;
  setServices: (update: (services: Array<Service>) => Array<Service>) => void;
  /** Kept between calls while the server runs. */
  state: McpState;
}

export const LICENSE_LOCKED =
  'Angaria kilitli: lisans etkin değil, doğrulanamadı ya da süresi doldu. Angaria’yı aç ve lisansını kontrol et.';
export const LICENSE_CHECKING = 'Angaria lisansı hâlâ doğruluyor. Birkaç saniye sonra tekrar dene.';
export const NO_LOGIN =
  'Bu şirketin GİB hesabı Angaria’da bağlı değil. Angaria’da şirketi seçip Ayarlar › GİB hesabı’ndan kullanıcı kodunu ve şifreni gir.';
export const UNKNOWN_COMPANY = 'Bu şirket Angaria’da yok. Şirketleri list_companies ile listele.';
export const AMBIGUOUS_COMPANY =
  'Bu VKN / TCKN’yle birden fazla şirket var. Şirketi list_companies’teki id’siyle ver.';
export const BUSY =
  'Angaria’da başka bir GİB işlemi sürüyor (SMS onayı gibi) ya da GİB yavaş. Biraz sonra tekrar dene.';
export const ACTIONS_OFF =
  'Bu işlem kapalı. Angaria’da MCP sayfasındaki “Ajanlar onaylayabilir ve silebilir” anahtarını aç, sonra tekrar dene.';

export const json = (value: unknown, activity?: string): McpToolOutput => ({
  activity,
  content: [{ text: JSON.stringify(value, null, 2), type: 'text' }],
});

export const failure = (message: string, extra: Record<string, unknown> = {}): McpToolOutput => ({
  content: [{ text: JSON.stringify({ error: { message, ...extra } }), type: 'text' }],
  isError: true,
});

export interface McpTool {
  annotations: {
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
  };
  /** `company`: the name of the company the call acted on, when it got that far. */
  call: (
    ctx: McpToolContext,
    args: unknown,
    signal?: AbortSignal,
  ) => Promise<{ company?: string; output: McpToolOutput; summary: string }>;
  description: string;
  inputSchema: z.ZodType;
  name: McpToolName;
}

/** The `company` argument every company-scoped tool takes. */
const companyInput = z
  .string()
  .min(1)
  .optional()
  .describe(
    "The company to act on: its id or VKN/TCKN from list_companies. Defaults to the company active in Angaria. Naming another company never switches Angaria's active company.",
  );

/** The company a result names, so the agent can tell the user. */
export const companyLabel = ({ companyInfo, id, name }: McpCompany) => ({
  id,
  name,
  taxID: companyInfo.taxID || undefined,
});

/** `output` with `company` at the top of its JSON object (or its error). */
function withCompany(output: McpToolOutput, company: McpCompany): McpToolOutput {
  const [first, ...rest] = output.content;
  let value: unknown;
  try {
    value = JSON.parse(first?.text ?? '');
  } catch {
    return output;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return output;
  }
  const label = companyLabel(company);
  const labelled =
    output.isError && 'error' in value
      ? { error: { ...(value.error as object), company: label } }
      : { company: label, ...value };
  return {
    ...output,
    content: [{ text: JSON.stringify(labelled, null, 2), type: 'text' }, ...rest],
  };
}

/**
 * A tool whose `run` gets valid input. A company-scoped tool (`scoped`, the
 * default) takes an optional `company` and runs with that company's context,
 * and its JSON result names the company. A gated tool first needs Ajanlar
 * onaylayabilir ve silebilir; `limit` caps its calls per window; a GİB tool
 * needs a login. `summarize` says in a few Turkish words what the agent asked
 * for, for the activity log: never an SMS code, a password or a token.
 */
export function defineTool<T extends z.ZodObject>({
  gib,
  limit,
  run,
  scoped = true,
  summarize,
  ...tool
}: Omit<McpTool, 'call' | 'inputSchema'> & {
  gib: boolean;
  inputSchema: T;
  limit?: { max: number; windowMs: number };
  run: (ctx: McpToolContext, input: z.output<T>, signal?: AbortSignal) => Promise<McpToolOutput>;
  scoped?: boolean;
  summarize?: (input: z.output<T>) => string;
}): McpTool {
  const title = MCP_TOOL_COPY[tool.name].title;
  const inputSchema = scoped
    ? tool.inputSchema.safeExtend({ company: companyInput })
    : tool.inputSchema;
  return {
    ...tool,
    call: async (base, args, signal) => {
      if (isGatedTool(tool.name) && !base.actionsAllowed()) {
        return { output: failure(ACTIONS_OFF, { code: 'actions-off' }), summary: title };
      }
      const parsed = inputSchema.safeParse(args ?? {});
      if (!parsed.success) {
        return {
          output: failure('Girdi aracın şemasına uymuyor.', {
            code: 'invalid-input',
            fields: Object.fromEntries(
              parsed.error.issues.map((issue) => [
                issue.path.join('.') || '(girdi)',
                issue.message,
              ]),
            ),
          }),
          summary: title,
        };
      }
      const { company: ref, ...input } = parsed.data as z.output<T> & { company?: string };
      const ctx = ref === undefined ? base : base.forCompany(ref);
      if (ctx === null || ctx === 'ambiguous') {
        return {
          output:
            ctx === null
              ? failure(UNKNOWN_COMPANY, { code: 'unknown-company' })
              : failure(AMBIGUOUS_COMPANY, { code: 'ambiguous-company' }),
          summary: title,
        };
      }
      const summary = summarize?.(input as z.output<T>) ?? title;
      const company = ctx.company();
      const label = (output: McpToolOutput) => ({
        company: company.name,
        output: scoped ? withCompany(output, company) : output,
        summary,
      });
      if (gib && !company.hasCredentials) {
        return label(failure(NO_LOGIN, { code: 'auth' }));
      }
      if (limit) {
        const allowed = ctx.state.allow(tool.name, limit.max, limit.windowMs);
        if (!allowed.ok) {
          return label(
            failure(
              `Kısa sürede çok fazla istek geldi. ${allowed.wait} saniye sonra tekrar dene.`,
              {
                code: 'rate-limit',
                retryAfterSeconds: allowed.wait,
              },
            ),
          );
        }
      }
      try {
        return label(await run(ctx, input as z.output<T>, signal));
      } catch (error) {
        return label(errorOutput(error, signal));
      }
    },
    inputSchema,
  };
}

/** A thrown failure as the agent reads it: GİB's Turkish copy with its code. */
export function errorOutput(error: unknown, signal?: AbortSignal): McpToolOutput {
  // Dropped while it waited in the GİB queue.
  if (signal?.aborted && error === signal.reason) {
    return failure(BUSY, { code: 'busy' });
  }
  const { code, detail, text } = describeError(error);
  return failure(text, { code, detail });
}

/** Turkish text folded for search: "musteri" finds "Müşteri". */
export const fold = (text: string) =>
  text.toLocaleLowerCase('tr').replaceAll('ı', 'i').normalize('NFD').replaceAll(/\p{M}/gu, '');

export const matches = (query: string | undefined, ...texts: Array<string>) => {
  const haystack = fold(texts.join(' '));
  return (query ? fold(query).split(/\s+/) : []).every((word) => haystack.includes(word));
};

export const textField = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * GİB's value for a country typed in Turkish or English, its GİB spelling or
 * an alias ("Germany", "ABD", "Türkiye"); '' stays ''. Null when GİB has none.
 */
export function gibCountry(text: string): string | null {
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
