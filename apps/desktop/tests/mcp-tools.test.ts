import { GibError, type DraftRow, type SessionInfo } from 'angaria-earsiv-sdk';
import { describe, expect, test, vi } from 'vitest';
import {
  callMcpTool,
  DRAFT_CREATED,
  LICENSE_LOCKED,
  mcpToolList,
  NO_LOGIN,
  type McpCompany,
  type McpGIBClient,
  type McpToolContext,
  type McpToolResult,
} from '../src/lib/mcp-tools.ts';
import { ISTISNA_REASONS } from '../src/lib/regulated.ts';
import { createSessionQueue } from '../src/lib/session-queue.ts';
import type { Recipient } from '../src/lib/types.ts';

const NOW = new Date(2026, 9, 2, 12, 30, 0);
const session: SessionInfo = { baseUrl: 'https://test.invalid', cookies: [], token: 't' };

const customer = (fields: Partial<Recipient>): Recipient => ({
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

const ACME = customer({
  country: 'Almanya',
  currency: 'USD',
  dueDays: 14,
  invoiceType: 'ISTISNA',
  istisnaCode: '302',
  lastInvoicedAt: '2026-09-01T10:00:00.000Z',
  VATRate: 0,
});

const ORNEK = customer({
  city: 'İstanbul',
  country: 'Türkiye',
  fullAddress: 'Bağdat Cad. No:123',
  id: 'ornek',
  taxIDOrTRID: '1234567890',
  taxOffice: 'Kadıköy',
  title: 'ÖRNEK TEKNOLOJİ A.Ş.',
});

const ROWS: Array<DraftRow> = [
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

/** The tools on a real session queue over a fake GİB, with a test company. */
function setup({
  company = {},
  license = 'ok',
}: { company?: Partial<McpCompany>; license?: 'checking' | 'locked' | 'ok' } = {}) {
  const log: Array<string> = [];
  const queue = createSessionQueue({
    login: vi.fn(async (username: string) => {
      log.push(`login ${username}`);
      return session;
    }),
    logout: vi.fn(async () => {
      log.push('logout');
    }),
  });
  const account = {
    credentials: async () => ({ password: '1', username: '33333301' }),
    key: '33333301',
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
  };
  let ids = 0;
  const ctx: McpToolContext = {
    client,
    company: () => ({
      customers: [ORNEK, ACME],
      hasCredentials: true,
      name: 'Ana şirket',
      services: [
        {
          discountAmount: 0,
          discountRate: 0,
          discountReason: '',
          gtip: '',
          id: 's1',
          name: 'Yazılım Geliştirme Hizmeti',
          quantity: 1,
          unitPrice: 5000,
          unitType: 'HUR',
          VATRate: 20,
        },
      ],
      ...company,
    }),
    currencyRate: vi.fn(async () => 41.523),
    gib: (task, signal) => queue.run(account, task, { signal }),
    license: async () => license,
    newId: () => `id-${++ids}`,
    now: () => NOW,
    onDraftCreated: vi.fn(),
    onDraftDeleted: vi.fn(),
  };
  return { account, client, ctx, log, queue };
}

const body = (result: McpToolResult) => JSON.parse(result.content[0]?.text ?? 'null');

const call = async (ctx: McpToolContext, name: string, args: unknown) => {
  const result = await callMcpTool(ctx, name, args);
  return { error: result.isError === true, json: body(result) };
};

describe('mcpToolList', () => {
  test('lists the six tools and no signing tool', () => {
    const tools = mcpToolList();
    expect(tools.map((tool) => tool.name)).toEqual([
      'list_invoices',
      'get_invoice',
      'create_invoice',
      'cancel_invoice',
      'list_customers',
      'list_services',
    ]);
    expect(tools.every((tool) => !('$schema' in tool.inputSchema))).toBe(true);
    const create = tools.find((tool) => tool.name === 'create_invoice');
    expect(create?.title).toBe('Taslak oluştur');
    expect(create?.inputSchema).toMatchObject({
      properties: { invoiceType: { enum: ['SATIS', 'ISTISNA'] } },
      required: ['items'],
      type: 'object',
    });
  });
});

describe('list_invoices', () => {
  test('waits its turn on the app’s GİB queue, then lists newest first', async () => {
    const { account, ctx, log, queue } = setup();
    // A screen's GİB call is already running when the MCP call arrives.
    const screen = queue.run(account, async () => {
      log.push('screen');
    });
    const result = call(ctx, 'list_invoices', { endDate: '02/10/2026', startDate: '01/10/2026' });
    await screen;
    const { error, json } = await result;

    expect(error).toBe(false);
    expect(log).toEqual(['login 33333301', 'screen', 'list 01/10/2026 02/10/2026', 'logout']);
    expect(json.company).toBe('Ana şirket');
    expect(json.invoices).toEqual([
      {
        date: '02/10/2026',
        number: 'GIB2026000000002',
        onayDurumu: 'Onaylanmadı',
        recipient: 'ÖRNEK TEKNOLOJİ A.Ş.',
        status: 'Taslak',
        uuid: 'ettn-draft',
      },
      {
        date: '01/10/2026',
        number: 'GIB2026000000001',
        onayDurumu: 'Onaylandı',
        recipient: 'ACME GMBH',
        status: 'Onaylı',
        uuid: 'ettn-old',
      },
    ]);
  });

  test('checks the range before logging in', async () => {
    const { ctx, log } = setup();
    const { error, json } = await call(ctx, 'list_invoices', {
      endDate: '01/12/2026',
      startDate: '01/10/2026',
    });
    expect(error).toBe(true);
    expect(json.error.code).toBe('invalid-input');
    expect(json.error.fields.endDate).toMatch(/at most 31 days/);
    expect(log).toEqual([]);
  });

  test('gives up while an SMS approval holds the session, before it is released', async () => {
    const { account, client, ctx, queue } = setup();
    const lease = await queue.lease(account);
    const controller = new AbortController();
    const result = callMcpTool(
      ctx,
      'list_invoices',
      { endDate: '02/10/2026', startDate: '01/10/2026' },
      controller.signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    const json = body(await result);
    expect(json.error.code).toBe('busy');
    expect(json.error.message).toMatch(/başka bir GİB işlemi/);
    lease.release();
    expect(client.getDrafts).not.toHaveBeenCalled();
  });

  test('a started call ignores the deadline and a real failure is not called busy', async () => {
    const { client, ctx } = setup();
    const controller = new AbortController();
    client.getDrafts.mockImplementation(async () => {
      controller.abort();
      throw new GibError('auth', 'Hatalı');
    });
    const json = body(
      await callMcpTool(
        ctx,
        'list_invoices',
        { endDate: '02/10/2026', startDate: '01/10/2026' },
        controller.signal,
      ),
    );
    expect(json.error.code).toBe('auth');
  });
});

describe('create_invoice', () => {
  test('a saved customer’s defaults fill the draft, TCMB gives the rate', async () => {
    const { client, ctx, log } = setup();
    const { error, json } = await call(ctx, 'create_invoice', {
      customerId: 'acme',
      date: '01/10/2026',
      items: [{ name: 'Consulting', quantity: 10, unitPrice: 100, unitType: 'HUR' }],
    });

    expect(error).toBe(false);
    expect(json).toEqual({
      company: 'Ana şirket',
      currency: 'USD',
      date: '01/10/2026',
      message: DRAFT_CREATED,
      number: 'GIB2026000000003',
      paymentTotal: 1000,
      recipient: 'ACME GMBH',
      uuid: 'ettn-new',
    });
    expect(ctx.currencyRate).toHaveBeenCalledWith('USD', new Date(2026, 9, 1));
    const details = client.createDraftInvoice.mock.calls[0]?.[1];
    expect(details).toMatchObject({
      country: 'Almanya',
      currency: 'USD',
      currencyRate: '41.5230',
      date: '01/10/2026',
      grandTotalInclVAT: 1000,
      invoiceType: 'ISTISNA',
      taxIDOrTRID: '2222222222',
      time: '12:30:00',
      title: 'ACME GMBH',
      totalVAT: 0,
    });
    expect(details?.items[0]).toMatchObject({ unitType: 'HUR', VATAmount: 0, VATRate: 0 });
    expect(details?.note).toContain(ISTISNA_REASONS[1]?.sentence);
    expect(log).toEqual(['login 33333301', 'create', 'list 01/10/2026 01/10/2026', 'logout']);
    expect(ctx.onDraftCreated).toHaveBeenCalledWith(
      { date: '01/10/2026', number: 'GIB2026000000003', uuid: 'ettn-new' },
      expect.objectContaining({
        advancedFields: expect.objectContaining({ dueDate: '15/10/2026' }),
      }),
    );
  });

  test('a new recipient in Türkiye is a Satış invoice in lira with 20% VAT', async () => {
    const { client, ctx } = setup();
    const { error, json } = await call(ctx, 'create_invoice', {
      items: [{ discountRate: 10, name: 'Danışmanlık', quantity: 2, unitPrice: 1000 }],
      recipient: {
        fullAddress: 'Atatürk Cad. 1, Ankara',
        name: 'Ayşe',
        surname: 'Yılmaz',
        taxIDOrTRID: '10000000146',
      },
    });

    expect(error).toBe(false);
    expect(json.paymentTotal).toBe(2160);
    expect(json.recipient).toBe('Ayşe Yılmaz');
    expect(ctx.currencyRate).not.toHaveBeenCalled();
    expect(client.createDraftInvoice.mock.calls[0]?.[1]).toMatchObject({
      currency: 'TRY',
      date: '02/10/2026',
      grandTotal: 1800,
      invoiceType: 'SATIS',
      totalDiscount: 200,
      totalVAT: 360,
    });
  });

  test('the app’s invoice rules block the draft in Turkish, before any login', async () => {
    const { ctx, log } = setup();
    const istisnaVAT = await call(ctx, 'create_invoice', {
      customerId: 'acme',
      items: [{ name: 'Consulting', quantity: 1, unitPrice: 100, VATRate: 20 }],
    });
    expect(istisnaVAT.error).toBe(true);
    expect(istisnaVAT.json.error.code).toBe('invalid-invoice');
    expect(istisnaVAT.json.error.fields).toEqual({
      'items[0].VATRate': 'İstisna faturada KDV oranı %0 olmalı',
    });

    const badVKN = await call(ctx, 'create_invoice', {
      items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
      recipient: { fullAddress: 'Adres', taxIDOrTRID: '1234567891', title: 'Firma' },
    });
    expect(badVKN.json.error.fields['recipient.taxIDOrTRID']).toMatch(/kontrol hanesi/);

    const abroadWithoutCountry = await call(ctx, 'create_invoice', {
      currency: 'TRY',
      items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
      recipient: { fullAddress: 'Main St 1', taxIDOrTRID: '2222222222', title: 'Foo LLC' },
    });
    expect(abroadWithoutCountry.json.error.fields['recipient.country']).toMatch(/ülkesini seç/);

    const unknownCountry = await call(ctx, 'create_invoice', {
      items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
      recipient: {
        country: 'Atlantis',
        fullAddress: 'Main St 1',
        taxIDOrTRID: '2222222222',
        title: 'Foo LLC',
      },
    });
    expect(unknownCountry.json.error.fields['recipient.country']).toMatch(/ülke listesinde yok/);

    const cases: Array<[Record<string, unknown>, string]> = [
      [{ currency: 'XYZ', customerId: 'acme' }, 'invalid-input'],
      [
        { customerId: 'acme', items: [{ name: 'X', quantity: 1, unitPrice: 1, unitType: 'BOX' }] },
        'invalid-input',
      ],
      [{ customerId: 'acme', invoiceType: 'IADE' }, 'invalid-input'],
      [
        { customerId: 'acme', recipient: { fullAddress: 'A', taxIDOrTRID: '2222222222' } },
        'invalid-input',
      ],
      [{}, 'invalid-input'],
      [{ customerId: 'nobody' }, 'unknown-customer'],
      [{ customerId: 'acme', date: '01/01/2099' }, 'invalid-input'],
    ];
    for (const [args, code] of cases) {
      const result = await call(ctx, 'create_invoice', {
        items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
        ...args,
      });
      expect(result.json.error.code, JSON.stringify(args)).toBe(code);
    }
    expect(log).toEqual([]);
  });

  test('without a TCMB rate a foreign currency needs currencyRate', async () => {
    const { ctx } = setup();
    vi.mocked(ctx.currencyRate).mockResolvedValue(undefined);
    const missing = await call(ctx, 'create_invoice', {
      customerId: 'acme',
      items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
    });
    expect(missing.json.error.code).toBe('currency-rate');

    const given = await call(ctx, 'create_invoice', {
      currencyRate: '40.1',
      customerId: 'acme',
      items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
    });
    expect(given.error).toBe(false);
    expect(vi.mocked(ctx.client.createDraftInvoice).mock.calls[0]?.[1].currencyRate).toBe(
      '40.1000',
    );
  });
});

test('a country in English or an alias becomes GİB’s name; Turkey stays at home', async () => {
  const { client, ctx } = setup();
  await call(ctx, 'create_invoice', {
    currency: 'TRY',
    items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
    recipient: {
      country: 'USA',
      fullAddress: 'Main St 1',
      taxIDOrTRID: '2222222222',
      title: 'Foo LLC',
    },
  });
  expect(client.createDraftInvoice.mock.calls[0]?.[1]).toMatchObject({
    country: 'Amerika Birleşik Dev',
    invoiceType: 'ISTISNA',
  });

  await call(ctx, 'create_invoice', {
    items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
    recipient: {
      country: 'Turkey',
      fullAddress: 'Adres',
      taxIDOrTRID: '1234567890',
      title: 'Firma',
    },
  });
  expect(client.createDraftInvoice.mock.calls[1]?.[1]).toMatchObject({
    country: 'Türkiye',
    invoiceType: 'SATIS',
    totalVAT: 20,
  });
});

describe('cancel_invoice', () => {
  test('deletes an unsigned draft and refuses a signed invoice', async () => {
    const { client, ctx } = setup();
    const signed = await call(ctx, 'cancel_invoice', {
      date: '01/10/2026',
      reason: 'Hatalı',
      uuid: 'ettn-old',
    });
    expect(signed.error).toBe(true);
    expect(signed.json.error.code).toBe('not-a-draft');
    expect(client.cancelInvoice).not.toHaveBeenCalled();

    const missing = await call(ctx, 'cancel_invoice', { reason: 'Hatalı', uuid: 'nope' });
    expect(missing.json.error.code).toBe('not-found');

    const draft = await call(ctx, 'cancel_invoice', {
      date: '02/10/2026',
      reason: 'Hatalı',
      uuid: 'ettn-draft',
    });
    expect(draft).toEqual({
      error: false,
      json: { message: 'Taslak silindi.', uuid: 'ettn-draft' },
    });
    expect(client.cancelInvoice).toHaveBeenCalledWith(session, 'Hatalı', ROWS[1]);
    expect(ctx.onDraftDeleted).toHaveBeenCalledTimes(1);
  });
});

describe('get_invoice', () => {
  test('summarizes GİB’s detail with the status from the list', async () => {
    const { client, ctx } = setup();
    client.getInvoiceDetail.mockResolvedValue({
      aliciUnvan: 'ACME GMBH',
      belgeNumarasi: 'GIB2026000000003',
      faturaTarihi: '02/10/2026',
      faturaTipi: 'ISTISNA',
      malHizmetTable: [
        { birim: 'HUR', birimFiyat: '100', kdvOrani: '0', malHizmet: 'Consulting', miktar: '10' },
      ],
      paraBirimi: 'USD',
      vknTckn: '2222222222',
    });
    const { json } = await call(ctx, 'get_invoice', { uuid: 'ettn-new' });
    expect(json).toMatchObject({
      currency: 'USD',
      date: '02/10/2026',
      invoiceType: 'ISTISNA',
      items: [{ name: 'Consulting', quantity: 10, unitPrice: 100, unitType: 'HUR', VATRate: 0 }],
      number: 'GIB2026000000003',
      recipientName: 'ACME GMBH',
      status: 'Taslak',
      total: 1000,
      uuid: 'ettn-new',
    });

    const html = await callMcpTool(ctx, 'get_invoice', { format: 'html', uuid: 'ettn-new' });
    expect(html.content[0]?.text).toBe('<html>fatura</html>');
    expect(client.getInvoiceHTML).toHaveBeenCalledWith(session, 'ettn-new', 'Onaylanmadı');
  });
});

describe('customers and services', () => {
  test('list the active company’s records, searched without diacritics', async () => {
    const { ctx, log } = setup();
    const all = await call(ctx, 'list_customers', {});
    expect(all.json.customers.map((row: { id: string }) => row.id)).toEqual(['acme', 'ornek']);
    expect(all.json.customers[0]).toMatchObject({
      defaults: { currency: 'USD', dueDays: 14, invoiceType: 'ISTISNA', istisnaCode: '302' },
      name: 'ACME GMBH',
    });
    const found = await call(ctx, 'list_customers', { query: 'ornek tekno' });
    expect(found.json.customers.map((row: { name: string }) => row.name)).toEqual([
      'ÖRNEK TEKNOLOJİ A.Ş.',
    ]);

    const services = await call(ctx, 'list_services', { query: 'yazilim' });
    expect(services.json.services).toEqual([
      {
        name: 'Yazılım Geliştirme Hizmeti',
        quantity: 1,
        unitPrice: 5000,
        unitType: 'HUR',
        VATRate: 20,
      },
    ]);
    expect(log).toEqual([]);
  });
});

describe('gates', () => {
  test('a locked license refuses every tool in Turkish', async () => {
    const { ctx, log } = setup({ license: 'locked' });
    for (const name of ['list_customers', 'list_invoices', 'create_invoice']) {
      const { error, json } = await call(ctx, name, {});
      expect(error).toBe(true);
      expect(json.error).toEqual({ code: 'license', message: LICENSE_LOCKED });
    }
    expect(log).toEqual([]);
  });

  test('GİB tools need a login; local ones do not', async () => {
    const { ctx, log } = setup({ company: { hasCredentials: false } });
    const list = await call(ctx, 'list_invoices', {
      endDate: '02/10/2026',
      startDate: '01/10/2026',
    });
    expect(list.json.error).toEqual({ code: 'auth', message: NO_LOGIN });
    expect((await call(ctx, 'list_customers', {})).error).toBe(false);
    expect(log).toEqual([]);
  });

  test('a GİB failure is its Turkish copy with the code', async () => {
    const { client, ctx } = setup();
    client.getDrafts.mockRejectedValue(new GibError('maintenance', 'Bakım'));
    const { error, json } = await call(ctx, 'list_invoices', {
      endDate: '02/10/2026',
      startDate: '01/10/2026',
    });
    expect(error).toBe(true);
    expect(json.error).toEqual({
      code: 'maintenance',
      message: 'GİB e-Arşiv portalı şu an bakımda. Biraz sonra tekrar dene.',
    });
  });

  test('an unknown tool is an error', async () => {
    const { ctx } = setup();
    expect((await call(ctx, 'sign_invoice', {})).json.error.code).toBe('unknown-tool');
  });
});
