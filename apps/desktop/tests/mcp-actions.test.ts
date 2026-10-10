import { GibError } from 'angaria-earsiv-sdk';
import { describe, expect, test, vi } from 'vitest';
import { SIGNING_TTL_MS } from '../src/lib/mcp-state.ts';
import { AMBIGUOUS_COMPANY } from '../src/lib/mcp-tool-kit.ts';
import { maskPhone } from '../src/lib/mcp-tools-signing.ts';
import { ACTIONS_OFF, callMcpTool, runMcpTool } from '../src/lib/mcp-tools.ts';
import { body, call, MAIN, NOW, OTHER, setup } from './mcp-fixtures.ts';

const DRAFT_DETAIL = {
  aliciUnvan: 'ÖRNEK TEKNOLOJİ A.Ş.',
  faturaTarihi: '02/10/2026',
  malHizmetTable: [
    { birim: 'C62', birimFiyat: '100', kdvOrani: '20', malHizmet: 'Danışmanlık', miktar: '1' },
  ],
  paraBirimi: 'TRY',
  vknTckn: '1234567890',
};

/** A fake GİB whose draft ettn-new turns Onaylandı once signed. */
function signingSetup(options: Parameters<typeof setup>[0] = {}) {
  const fixture = setup({ actions: true, ...options });
  let signed = false;
  fixture.client.getInvoiceDetail.mockImplementation(async (_session, uuid) =>
    uuid === 'ettn-new' ? DRAFT_DETAIL : Promise.reject(new GibError('not-found', 'Yok')),
  );
  fixture.client.getDrafts.mockImplementation(async (_session, start, end) => {
    fixture.log.push(`list ${start} ${end}`);
    return [
      {
        aliciUnvanAdSoyad: 'ÖRNEK TEKNOLOJİ A.Ş.',
        belgeNumarasi: 'GIB2026000000003',
        ettn: 'ettn-new',
        onayDurumu: signed ? 'Onaylandı' : 'Onaylanmadı',
      },
      { belgeNumarasi: 'GIB2026000000001', ettn: 'ettn-old', onayDurumu: 'Onaylandı' },
    ];
  });
  fixture.client.verifyAndSign.mockImplementation(async (_session, code) => {
    fixture.log.push('sign');
    if (code !== '123456') {
      throw new GibError('sms-code-wrong', 'SMS şifresi hatalı');
    }
    signed = true;
    return {};
  });
  return fixture;
}

describe('SMS signing', () => {
  test('is off until the user allows agent actions', async () => {
    const { ctx, log } = setup();
    for (const name of ['request_signing_sms', 'sign_invoices']) {
      const { json } = await call(ctx, name, { code: '123456', operationId: 'x', uuids: ['a'] });
      expect(json.error).toEqual({ code: 'actions-off', message: ACTIONS_OFF });
    }
    expect(log).toEqual([]);
  });

  test('sends the code for drafts only, then signs them on the same session', async () => {
    const { account, client, ctx, log, queue } = signingSetup();
    const requested = await call(ctx, 'request_signing_sms', { uuids: ['ettn-new'] });
    expect(requested.error).toBe(false);
    expect(requested.json).toMatchObject({
      company: MAIN,
      expiresInSeconds: 180,
      invoices: [
        {
          date: '02/10/2026',
          number: 'GIB2026000000003',
          recipient: 'ÖRNEK TEKNOLOJİ A.Ş.',
          total: { amount: 120, currency: 'TRY' },
          uuid: 'ettn-new',
        },
      ],
      operationId: 'op-1',
      phone: '******0001',
    });
    expect(ctx.onAction).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, kind: 'signing-requested', operationId: 'op-1' }),
    );

    // The session stays leased: a screen's GİB call waits for the approval.
    let screenRan = false;
    const screen = queue.run(account, async () => {
      screenRan = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(screenRan).toBe(false);

    const signed = await call(ctx, 'sign_invoices', { code: '123 456', operationId: 'op-1' });
    expect(signed.json).toMatchObject({
      company: MAIN,
      invoices: [{ number: 'GIB2026000000003', status: 'Onaylı', uuid: 'ettn-new' }],
      message: 'Fatura onaylandı.',
    });
    expect(client.verifyAndSign).toHaveBeenCalledWith(
      expect.objectContaining({ token: '33333301' }),
      '123456',
      'oid-1',
      ['ettn-new'],
    );
    await screen;
    expect(screenRan).toBe(true);
    expect(log).toEqual([
      'login 33333301',
      'list 02/10/2026 02/10/2026',
      'sms',
      'sign',
      'list 02/10/2026 02/10/2026',
      'logout',
    ]);
    expect(ctx.onAction).toHaveBeenCalledWith({
      invoices: [
        {
          number: 'GIB2026000000003',
          recipient: 'ÖRNEK TEKNOLOJİ A.Ş.',
          status: 'Onaylı',
          uuid: 'ettn-new',
        },
      ],
      kind: 'signed',
    });

    // Single use: the operation ended with the signature.
    const again = await call(ctx, 'sign_invoices', { code: '123456', operationId: 'op-1' });
    expect(again.json.error.code).toBe('unknown-operation');
  });

  test('refuses signed and unknown invoices without sending an SMS', async () => {
    const { client, ctx } = signingSetup();
    const { json } = await call(ctx, 'request_signing_sms', { uuids: ['ettn-old', 'nope'] });
    expect(json.error).toMatchObject({
      code: 'not-a-draft',
      invoices: [
        { message: 'GİB’de bulunamadı', uuid: 'ettn-old' },
        { message: 'GİB’de bulunamadı', uuid: 'nope' },
      ],
    });
    expect(client.startSMSSign).not.toHaveBeenCalled();
    // The session went back to the queue.
    expect((await call(ctx, 'check_gib_connection', {})).error).toBe(false);
  });

  test('an operation id it never made, a malformed code, and a wrong one three times', async () => {
    const { ctx } = signingSetup();
    expect(
      (await call(ctx, 'sign_invoices', { code: '123456', operationId: 'made-up' })).json.error
        .code,
    ).toBe('unknown-operation');

    await call(ctx, 'request_signing_sms', { uuids: ['ettn-new'] });
    const short = await call(ctx, 'sign_invoices', { code: '123', operationId: 'op-1' });
    expect(short.json.error.message).toBe('SMS şifresinin 6 hanesini de gir');

    const wrong = await call(ctx, 'sign_invoices', { code: '000000', operationId: 'op-1' });
    expect(wrong.json.error).toMatchObject({ attemptsLeft: 2, code: 'sms-code-wrong' });
    await call(ctx, 'sign_invoices', { code: '000001', operationId: 'op-1' });
    const last = await call(ctx, 'sign_invoices', { code: '000002', operationId: 'op-1' });
    expect(last.json.error.message).toMatch(/üç kez kabul edilmedi/);
    expect(
      (await call(ctx, 'sign_invoices', { code: '123456', operationId: 'op-1' })).json.error.code,
    ).toBe('unknown-operation');
  });

  test('expires with GİB’s code, giving the session back; one SMS a minute', async () => {
    let now = NOW.getTime();
    const timers: Array<() => void> = [];
    const { ctx } = signingSetup({
      state: {
        clearTimer: () => {},
        now: () => now,
        setTimer: (run) => {
          timers.push(run);
          return 0 as unknown as ReturnType<typeof setTimeout>;
        },
      },
    });
    await call(ctx, 'request_signing_sms', { uuids: ['ettn-new'] });
    const tooSoon = await call(ctx, 'request_signing_sms', { uuids: ['ettn-new'] });
    expect(tooSoon.json.error).toMatchObject({ code: 'rate-limit', retryAfterSeconds: 60 });

    now += SIGNING_TTL_MS;
    for (const run of timers) {
      run();
    }
    const expired = await call(ctx, 'sign_invoices', { code: '123456', operationId: 'op-1' });
    expect(expired.json.error.code).toBe('operation-expired');
    // The lease went back with it.
    expect((await call(ctx, 'check_gib_connection', {})).error).toBe(false);
  });

  test('an operation is bound to its company', async () => {
    const { ctx } = signingSetup();
    const requested = await call(ctx, 'request_signing_sms', {
      company: 'other',
      uuids: ['ettn-new'],
    });
    expect(requested.json.company).toEqual(OTHER);
    const mismatch = await call(ctx, 'sign_invoices', { code: '123456', operationId: 'op-1' });
    expect(mismatch.json.error.code).toBe('other-company');
    const signed = await call(ctx, 'sign_invoices', {
      code: '123456',
      company: '1234567890',
      operationId: 'op-1',
    });
    expect(signed.json).toMatchObject({ company: OTHER, message: 'Fatura onaylandı.' });
  });

  test('the activity log never holds the code', async () => {
    const { ctx } = signingSetup();
    await call(ctx, 'request_signing_sms', { uuids: ['ettn-new'] });
    const { activity } = await runMcpTool(ctx, 'sign_invoices', {
      code: '123456',
      operationId: 'op-1',
    });
    expect(activity).toEqual({
      company: 'Ana şirket',
      ok: true,
      result: 'GIB2026000000003 onaylandı',
      summary: 'SMS şifresiyle onay',
    });
    expect(JSON.stringify(activity)).not.toContain('123456');

    const failed = await runMcpTool(ctx, 'sign_invoices', {
      code: '654321',
      operationId: 'op-1',
    });
    expect(JSON.stringify(failed.activity)).not.toContain('654321');
  });

  test('masks all but the last four digits of the phone', () => {
    expect(maskPhone('0 555 000 00 01')).toBe('*******0001');
    expect(maskPhone('12')).toBe('****');
  });
});

describe('companies', () => {
  test('lists every company with its GİB login state, never credentials', async () => {
    const { companies, ctx } = setup();
    companies.other.hasCredentials = false;
    const { json } = await call(ctx, 'list_companies', {});
    expect(json).toEqual({
      companies: [
        {
          active: true,
          gibLogin: 'ready',
          id: 'main',
          legalName: 'Ana Firma',
          name: 'Ana şirket',
          taxID: '10000000146',
        },
        {
          active: false,
          gibLogin: 'needs-login',
          id: 'other',
          legalName: 'İkinci Firma',
          name: 'Şirket 2',
          taxID: '1234567890',
        },
      ],
    });
    expect(JSON.stringify(json)).not.toMatch(/33333301|password/);
  });

  test('a call names another company by id or VKN and touches only its records and login', async () => {
    const { companies, ctx, log } = setup();
    const customers = await call(ctx, 'list_customers', { company: 'other' });
    expect(customers.json.company).toEqual(OTHER);
    expect(customers.json.customers.map((row: { id: string }) => row.id)).toEqual(['beta']);

    const created = await call(ctx, 'create_service', {
      company: '1234567890',
      name: 'Tasarım',
      unitPrice: 750,
    });
    expect(created.json.company).toEqual(OTHER);
    expect(companies.other.services.map((item) => item.name)).toEqual(['Tasarım']);
    expect(companies.main.services.map((item) => item.name)).toEqual([
      'Yazılım Geliştirme Hizmeti',
    ]);

    await call(ctx, 'list_invoices', {
      company: 'other',
      endDate: '02/10/2026',
      startDate: '01/10/2026',
    });
    expect(log).toEqual(['login 33333302', 'list 01/10/2026 02/10/2026', 'logout']);

    const unknown = await call(ctx, 'list_customers', { company: 'nobody' });
    expect(unknown.json.error.code).toBe('unknown-company');
  });

  test('a company without a GİB login says so, naming the company', async () => {
    const { companies, ctx } = setup();
    companies.other.hasCredentials = false;
    const { json } = await call(ctx, 'list_invoices', {
      company: 'other',
      endDate: '02/10/2026',
      startDate: '01/10/2026',
    });
    expect(json.error).toMatchObject({ code: 'auth', company: OTHER });
  });
});

describe('customers', () => {
  test('are created, changed and deleted under Müşteriler’s rules', async () => {
    const { allowed, companies, ctx } = setup();
    const bad = await call(ctx, 'create_customer', { taxIDOrTRID: '1234567891', title: '' });
    expect(bad.json.error.code).toBe('invalid-customer');
    expect(bad.json.error.fields.taxIDOrTRID).toMatch(/kontrol hanesi/);
    expect(bad.json.error.fields.title).toBe('Unvanı ya da adı ve soyadı yaz');

    const abroad = await call(ctx, 'create_customer', {
      country: 'Germany',
      currency: 'EUR',
      taxIDOrTRID: '2222222222',
      title: 'HAFEN GMBH',
    });
    expect(abroad.json.customer).toMatchObject({
      country: 'Almanya',
      defaults: { currency: 'EUR', invoiceType: 'ISTISNA', pdfLanguage: 'en' },
      name: 'HAFEN GMBH',
    });
    const { id } = abroad.json.customer;

    const twice = await call(ctx, 'create_customer', {
      country: 'Almanya',
      taxIDOrTRID: '2222222222',
      title: 'Hafen GmbH',
    });
    expect(twice.json.error).toMatchObject({ code: 'exists', id });

    const updated = await call(ctx, 'update_customer', { currency: null, dueDays: 30, id });
    expect(updated.json.customer.defaults.dueDays).toBe(30);
    expect(updated.json.customer.defaults.currency).toBeUndefined();

    expect((await call(ctx, 'delete_customer', { id })).json.error.code).toBe('actions-off');
    allowed.current = true;
    expect((await call(ctx, 'delete_customer', { id })).json.message).toBe('Müşteri silindi.');
    expect(companies.main.customers.map((item) => item.id)).toEqual(['ornek', 'acme']);
    expect(ctx.onAction).toHaveBeenCalledWith({ kind: 'customer-deleted', name: 'HAFEN GMBH' });
    expect((await call(ctx, 'get_customer', { id })).json.error.code).toBe('unknown-customer');
  });

  test('keep and show the full country name', async () => {
    const { ctx } = setup();
    const created = await call(ctx, 'create_customer', {
      country: 'USA',
      taxIDOrTRID: '2222222222',
      title: 'NORTHWIND LLC',
    });
    expect(created.json.customer.country).toBe('Amerika Birleşik Devletleri');
    const { id } = created.json.customer;
    expect((await call(ctx, 'get_customer', { id })).json.country).toBe(
      'Amerika Birleşik Devletleri',
    );
    const listed = await call(ctx, 'list_customers', { query: 'northwind' });
    expect(listed.json.customers[0].country).toBe('Amerika Birleşik Devletleri');
  });
});

describe('services', () => {
  test('are created in the invoices’ currency, changed and deleted', async () => {
    const { allowed, companies, ctx } = setup();
    const created = await call(ctx, 'create_service', { name: 'Danışmanlık', unitPrice: 2500 });
    expect(created.json.service).toMatchObject({
      currency: 'USD',
      name: 'Danışmanlık',
      quantity: 1,
      unitType: 'C62',
      VATRate: 20,
    });
    const { id } = created.json.service;
    expect(
      (await call(ctx, 'create_service', { name: 'danışmanlık', unitPrice: 1 })).json.error.code,
    ).toBe('exists');
    expect(
      (await call(ctx, 'create_service', { name: 'X', unitPrice: 1.005 })).json.error.code,
    ).toBe('invalid-input');

    const updated = await call(ctx, 'update_service', { id, unitPrice: 3000, unitType: 'HUR' });
    expect(updated.json.service).toMatchObject({ unitPrice: 3000, unitType: 'HUR' });
    expect((await call(ctx, 'get_service', { id })).json.unitPrice).toBe(3000);

    allowed.current = true;
    await call(ctx, 'delete_service', { id });
    expect(companies.main.services.map((item) => item.id)).toEqual(['s1']);
  });
});

describe('company details', () => {
  test('read without the logo, changed only behind the switch and Ayarlar’s checks', async () => {
    const { allowed, companies, ctx } = setup();
    companies.main.companyInfo.logo = 'data:image/png;base64,AAAA';
    const details = await call(ctx, 'get_company_details', {});
    expect(details.json).toMatchObject({ hasLogo: true, name: 'Ana Firma', pdfStyle: 'minimal' });
    expect(JSON.stringify(details.json)).not.toContain('base64');

    expect((await call(ctx, 'update_company_details', { iban: 'x' })).json.error.code).toBe(
      'actions-off',
    );
    allowed.current = true;
    const bad = await call(ctx, 'update_company_details', {
      email: 'nope',
      iban: 'TR00 0000',
      phone: '555',
    });
    expect(Object.keys(bad.json.error.fields)).toEqual(['phone', 'email', 'iban']);
    expect(companies.main.companyInfo.iban).toBe('');

    const good = await call(ctx, 'update_company_details', {
      bankName: 'Ziraat Bankası',
      pdfStyle: 'classic',
    });
    expect(good.json.details).toMatchObject({ bankName: 'Ziraat Bankası', pdfStyle: 'classic' });
    expect(ctx.onAction).toHaveBeenCalledWith({ kind: 'company-details-updated' });
  });

  test('a VKN / TCKN another company has is refused with Ayarlar’ message', async () => {
    const { companies, ctx } = setup({ actions: true });
    const taken = await call(ctx, 'update_company_details', {
      name: 'Yeni Ad',
      taxID: '123 456 7890',
    });
    expect(taken.error).toBe(true);
    expect(taken.json.error).toMatchObject({
      code: 'duplicate-tax-id',
      fields: { taxID: 'Bu VKN zaten Şirket 2 için kayıtlı.' },
      message: 'Bu VKN zaten Şirket 2 için kayıtlı.',
      owner: { id: 'other', name: 'Şirket 2' },
    });
    expect(companies.main.companyInfo).toMatchObject({ name: 'Ana Firma', taxID: '10000000146' });

    // Its own VKN again is no conflict.
    const same = await call(ctx, 'update_company_details', { taxID: '10000000146' });
    expect(same.error).toBe(false);
  });
});

describe('companies sharing a VKN / TCKN (stored before it was refused)', () => {
  test('naming one by that VKN asks for the id, which still works', async () => {
    const { companies, ctx } = setup();
    companies.other.companyInfo.taxID = '10000000146';

    const byTaxID = await call(ctx, 'list_customers', { company: '10000000146' });
    expect(byTaxID.json.error).toEqual({
      code: 'ambiguous-company',
      message: AMBIGUOUS_COMPANY,
    });

    const byId = await call(ctx, 'list_customers', { company: 'other' });
    expect(byId.json.company).toEqual({ ...OTHER, taxID: '10000000146' });
    expect(byId.json.customers.map((row: { id: string }) => row.id)).toEqual(['beta']);
  });
});

describe('invoices', () => {
  test('download_invoice saves a signed invoice’s files in the customer’s language', async () => {
    const { client, ctx } = setup();
    client.getInvoiceDetail.mockResolvedValue({
      aliciUnvan: 'ACME GMBH',
      faturaTarihi: '01/10/2026',
      ulke: 'Almanya',
      vknTckn: '2222222222',
    });
    client.getDrafts.mockResolvedValue([
      { belgeNumarasi: 'GIB2026000000001', ettn: 'ettn-old', onayDurumu: 'Onaylandı' },
      { ettn: 'ettn-draft', onayDurumu: 'Onaylanmadı' },
    ]);
    const saved = await call(ctx, 'download_invoice', { uuid: 'ettn-old' });
    expect(saved.json).toMatchObject({ path: '/Users/test/Downloads/fatura.pdf' });
    expect(ctx.download).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'angaria-pdf', language: 'en' }),
    );

    client.getDrafts.mockResolvedValue([{ ettn: 'ettn-old', onayDurumu: 'Onaylanmadı' }]);
    const draft = await call(ctx, 'download_invoice', { format: 'earsiv-zip', uuid: 'ettn-old' });
    expect(draft.json.error.code).toBe('not-signed');
  });

  test('duplicate_invoice repeats an invoice as a new draft dated today', async () => {
    const { client, ctx } = setup();
    client.getInvoiceDetail.mockResolvedValue({
      aliciUnvan: 'ACME GMBH',
      bulvarcaddesokak: 'Hauptstraße 42',
      faturaTarihi: '01/09/2026',
      faturaTipi: 'ISTISNA',
      malHizmetTable: [
        { birim: 'HUR', birimFiyat: '100', kdvOrani: '0', malHizmet: 'Consulting', miktar: '10' },
      ],
      not: '',
      paraBirimi: 'USD',
      ulke: 'Almanya',
      vknTckn: '2222222222',
    });
    const { error, json } = await call(ctx, 'duplicate_invoice', { uuid: 'ettn-old' });
    expect(error).toBe(false);
    expect(json).toMatchObject({ currency: 'USD', date: '02/10/2026', uuid: 'ettn-new' });
    expect(client.createDraftInvoice.mock.calls[0]?.[1]).toMatchObject({
      country: 'Almanya',
      currencyRate: '41.5230',
      invoiceType: 'ISTISNA',
      title: 'ACME GMBH',
    });
  });

  test('list_invoices filters by status and recipient', async () => {
    const { ctx } = setup();
    const drafts = await call(ctx, 'list_invoices', {
      endDate: '02/10/2026',
      startDate: '01/10/2026',
      status: 'draft',
    });
    expect(drafts.json.invoices.map((row: { uuid: string }) => row.uuid)).toEqual(['ettn-draft']);
    const acme = await call(ctx, 'list_invoices', {
      endDate: '02/10/2026',
      query: 'acme',
      startDate: '01/10/2026',
    });
    expect(acme.json.invoices.map((row: { uuid: string }) => row.uuid)).toEqual(['ettn-old']);
  });
});

describe('rates and GİB login', () => {
  test('get_exchange_rate takes the rate create_invoice would', async () => {
    const { ctx } = setup();
    const { json } = await call(ctx, 'get_exchange_rate', { currency: 'USD', date: '01/10/2026' });
    expect(json).toMatchObject({ currency: 'USD', invoiceDate: '01/10/2026', rate: 41.523 });
    expect(ctx.currencyRate).toHaveBeenCalledWith('USD', new Date(2026, 8, 1 + 30));
  });

  test('check_gib_connection logs in and out; close_gib_session needs the switch', async () => {
    const { allowed, ctx, log } = setup();
    expect((await call(ctx, 'check_gib_connection', {})).json.message).toBe(
      'GİB bağlantısı çalışıyor.',
    );
    expect(log).toEqual(['login 33333301', 'logout']);
    expect((await call(ctx, 'close_gib_session', {})).json.error.code).toBe('actions-off');
    allowed.current = true;
    expect((await call(ctx, 'close_gib_session', {})).json.message).toBe('Oturum kapatıldı.');
    expect(ctx.forceLogout).toHaveBeenCalledTimes(1);
  });
});

describe('import from GİB', () => {
  test('scans signed invoices, then saves only the chosen new records', async () => {
    const { client, companies, ctx } = setup();
    client.getDrafts.mockImplementation(async (_session, _start, end) =>
      end === '02/10/2026'
        ? [
            {
              belgeTarihi: '30-09-2026',
              ettn: 'signed-1',
              onayDurumu: 'Onaylandı',
            },
            { belgeTarihi: '30-09-2026', ettn: 'draft-1', onayDurumu: 'Onaylanmadı' },
          ]
        : [],
    );
    client.getInvoiceDetail.mockResolvedValue({
      aliciUnvan: 'NORTHWIND LTD',
      bulvarcaddesokak: '1 Main St',
      faturaTipi: 'ISTISNA',
      malHizmetTable: [
        { birim: 'HUR', birimFiyat: '80', kdvOrani: '0', malHizmet: 'Support', miktar: '5' },
      ],
      paraBirimi: 'USD',
      ulke: 'İngiltere',
      vknTckn: '2222222222',
    });
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const scanning = callMcpTool(ctx, 'scan_gib_import', { period: '3-ay' });
    await vi.runAllTimersAsync();
    const scanned = body(await scanning);
    vi.useRealTimers();
    expect(scanned).toMatchObject({
      customers: [{ invoiceCount: 1, name: 'NORTHWIND LTD', saved: false }],
      invoices: 1,
      services: [{ currency: 'USD', name: 'Support', saved: false, unitPrice: 80 }],
      status: 'done',
    });
    expect(client.getInvoiceDetail).toHaveBeenCalledTimes(1);

    const applied = await call(ctx, 'apply_gib_import', {
      customerKeys: [scanned.customers[0].key],
      scanId: scanned.scanId,
      serviceKeys: [],
    });
    expect(applied.json).toMatchObject({ customers: 1, services: 0 });
    expect(companies.main.customers.map((item) => item.title)).toContain('NORTHWIND LTD');

    const elsewhere = await call(ctx, 'apply_gib_import', {
      company: 'other',
      scanId: scanned.scanId,
    });
    expect(elsewhere.json.error.code).toBe('other-company');
  });
});
