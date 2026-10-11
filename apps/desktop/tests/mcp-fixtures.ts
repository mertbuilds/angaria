// The MCP tools on a real session queue over a fake GİB, with two test
// companies, for tests/mcp-*.test.ts.
import type { DraftRow, SessionInfo } from 'angaria-earsiv-sdk';
import { vi } from 'vitest';
import { resolveCompany } from '../src/lib/company-identity.ts';
import { createImportRunner } from '../src/lib/import-run.ts';
import { createMcpState, type McpStateOptions } from '../src/lib/mcp-state.ts';
import type { McpCompany, McpGIBClient, McpToolContext } from '../src/lib/mcp-tool-kit.ts';
import { callMcpTool, type McpToolResult } from '../src/lib/mcp-tools.ts';
import { createSessionQueue } from '../src/lib/session-queue.ts';
import type { CompanyInfo, Recipient, Service } from '../src/lib/types.ts';

export const NOW = new Date(2026, 9, 2, 12, 30, 0);
export const session: SessionInfo = { baseUrl: 'https://test.invalid', cookies: [], token: 't' };

export const customer = (fields: Partial<Recipient>): Recipient => ({
  city: '',
  country: '',
  district: '',
  fullAddress: 'Hauptstraße 42, 10115 Berlin',
  id: 'acme',
  name: '',
  surname: '',
  taxIDOrTRID: '2222222222',
  taxOffice: '',
  title: 'ACME GMBH',
  ...fields,
});

export const service = (fields: Partial<Service>): Service => ({
  discountAmount: 0,
  discountRate: 0,
  discountReason: '',
  gtip: '',
  id: 'engineering',
  name: 'Engineering Services',
  quantity: 1,
  unitPrice: 100,
  unitType: 'C62',
  VATRate: 0,
  ...fields,
});

export const ACME = customer({
  country: 'Almanya',
  currency: 'USD',
  dueDays: 14,
  invoiceType: 'ISTISNA',
  istisnaCode: '302',
  lastInvoicedAt: '2026-09-01T10:00:00.000Z',
  VATRate: 0,
});

export const ORNEK = customer({
  city: 'İstanbul',
  country: 'Türkiye',
  fullAddress: 'Bağdat Cad. No:123',
  id: 'ornek',
  taxIDOrTRID: '1234567890',
  taxOffice: 'Kadıköy',
  title: 'ÖRNEK TEKNOLOJİ A.Ş.',
});

export const ROWS: Array<DraftRow> = [
  {
    aliciUnvanAdSoyad: 'ACME GMBH',
    belgeNumarasi: 'GIB2026000000001',
    belgeTarihi: '01-10-2026',
    ettn: 'ettn-old',
    onayDurumu: 'Onaylandı',
  },
  {
    aliciUnvanAdSoyad: 'ÖRNEK TEKNOLOJİ A.Ş.',
    belgeNumarasi: 'GIB2026000000002',
    belgeTarihi: '02-10-2026',
    ettn: 'ettn-draft',
    onayDurumu: 'Onaylanmadı',
  },
];

const companyInfo = (fields: Partial<CompanyInfo>): CompanyInfo => ({
  accountHolder: '',
  address: '',
  bankAddress: '',
  bankName: '',
  email: '',
  iban: '',
  name: '',
  phone: '',
  swiftCode: '',
  taxID: '',
  taxOffice: '',
  ...fields,
});

/** A mutable test company; the context's setters write to it. */
export interface TestCompany extends McpCompany {
  companyInfo: CompanyInfo;
  customers: Array<Recipient>;
  services: Array<Service>;
  username: string;
}

/** The tools over a fake GİB with two companies, `main` active. */
export function setup({
  actions = false,
  company = {},
  license = 'ok',
  state: stateOptions = {},
}: {
  actions?: boolean;
  company?: Partial<TestCompany>;
  license?: 'checking' | 'locked' | 'ok';
  state?: McpStateOptions;
} = {}) {
  const log: Array<string> = [];
  const queue = createSessionQueue({
    login: vi.fn(async (username: string) => {
      log.push(`login ${username}`);
      return { ...session, token: username };
    }),
    logout: vi.fn(async () => {
      log.push('logout');
    }),
  });
  const companies: Record<string, TestCompany> = {
    main: {
      companyInfo: companyInfo({ name: 'Ana Firma', taxID: '10000000146' }),
      customers: [ORNEK, ACME],
      hasCredentials: true,
      id: 'main',
      name: 'Ana şirket',
      services: [
        service({
          currency: 'TRY',
          id: 's1',
          name: 'Yazılım Geliştirme Hizmeti',
          unitPrice: 5000,
          unitType: 'HUR',
          VATRate: 20,
        }),
      ],
      username: '33333301',
      ...company,
    },
    other: {
      companyInfo: companyInfo({ name: 'İkinci Firma', taxID: '1234567890' }),
      customers: [customer({ id: 'beta', title: 'BETA LTD' })],
      hasCredentials: true,
      id: 'other',
      name: 'Şirket 2',
      services: [],
      username: '33333302',
    },
  };
  const client = {
    cancelInvoice: vi.fn<McpGIBClient['cancelInvoice']>(async () => ({})),
    createDraftInvoice: vi.fn<McpGIBClient['createDraftInvoice']>(async (_session, details) => {
      log.push('create');
      return { date: details.date, response: {}, uuid: 'ettn-new' };
    }),
    getDrafts: vi.fn<McpGIBClient['getDrafts']>(async (_session, start, end) => {
      log.push(`list ${start} ${end}`);
      return start === end
        ? [{ belgeNumarasi: 'GIB2026000000003', ettn: 'ettn-new', onayDurumu: 'Onaylanmadı' }]
        : ROWS;
    }),
    getInvoiceDetail: vi.fn<McpGIBClient['getInvoiceDetail']>(async () => ({})),
    getInvoiceHTML: vi.fn<McpGIBClient['getInvoiceHTML']>(async () => '<html>fatura</html>'),
    startSMSSign: vi.fn<McpGIBClient['startSMSSign']>(async () => {
      log.push('sms');
      return { oid: 'oid-1', phone: '5550000001' };
    }),
    verifyAndSign: vi.fn<McpGIBClient['verifyAndSign']>(async () => {
      log.push('sign');
      return {};
    }),
  };
  let ids = 0;
  const state = createMcpState({ newId: () => `op-${++ids}`, ...stateOptions });
  let runs = 0;
  // The app's one import run; the dialog would share it.
  const imports = createImportRunner({ newId: () => `run-${++runs}`, now: () => NOW });
  const allowed = { current: actions };
  const shared = {
    currencyRate: vi.fn(async () => 41.523),
    download: vi.fn<McpToolContext['download']>(async ({ format }) => ({
      name: `fatura.${format === 'earsiv-zip' ? 'zip' : 'pdf'}`,
      path: `/Users/test/Downloads/fatura.${format === 'earsiv-zip' ? 'zip' : 'pdf'}`,
    })),
    forceLogout: vi.fn(async () => {}),
    onAction: vi.fn<McpToolContext['onAction']>(),
    onDraftCreated: vi.fn<McpToolContext['onDraftCreated']>(),
  };

  const contextFor = (id: string): McpToolContext => {
    const target = () => companies[id];
    const account = {
      credentials: async () => ({ password: '1', username: target().username }),
      key: target().username,
    };
    return {
      ...shared,
      actionsAllowed: () => allowed.current,
      client,
      companies: () =>
        Object.values(companies).map((entry) => ({
          active: entry.id === 'main',
          gibLogin: entry.hasCredentials ? 'ready' : 'needs-login',
          gibTaxID: entry.gibIdentity?.taxID,
          id: entry.id,
          legalName: entry.companyInfo.name,
          name: entry.name,
          taxID: entry.companyInfo.taxID,
        })),
      company: target,
      forCompany: (ref) => {
        const found = resolveCompany(
          Object.values(companies).map((entry) => ({ ...entry, taxID: entry.companyInfo.taxID })),
          ref,
        );
        return found === null || found === 'ambiguous' ? found : contextFor(found.id);
      },
      gib: (task, signal, options) => queue.run(account, task, { ...options, signal }),
      imports,
      lease: (signal) => queue.lease(account, { signal }),
      license: async () => license,
      newId: () => `id-${++ids}`,
      now: () => NOW,
      setCompanyInfo: (update) => {
        target().companyInfo = update(target().companyInfo);
      },
      setCustomers: (update) => {
        target().customers = update(target().customers);
      },
      setServices: (update) => {
        target().services = update(target().services);
      },
      state,
    };
  };
  const ctx = contextFor('main');
  const account = {
    credentials: async () => ({ password: '1', username: '33333301' }),
    key: '33333301',
  };
  return { account, allowed, client, companies, ctx, imports, log, queue, state };
}

export const body = (result: McpToolResult) => JSON.parse(result.content[0]?.text ?? 'null');

export const call = async (ctx: McpToolContext, name: string, args: unknown) => {
  const result = await callMcpTool(ctx, name, args);
  return { error: result.isError === true, json: body(result) };
};

/** The label every company-scoped result carries. */
export const MAIN = { id: 'main', name: 'Ana şirket', taxID: '10000000146' };
export const OTHER = { id: 'other', name: 'Şirket 2', taxID: '1234567890' };
