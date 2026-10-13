import { GibError } from 'angaria-earsiv-sdk';
import { describe, expect, test, vi } from 'vitest';
import { cleanItems, upsertSavedItems } from '../src/lib/invoice-form.ts';
import {
  ACTIONS_OFF,
  callMcpTool,
  DRAFT_CREATED,
  DRAFT_CREATED_SIGNABLE,
  mcpToolList,
  NO_LOGIN,
} from '../src/lib/mcp-tools.ts';
import { MCP_TOOL_COPY } from '../src/lib/mcp.ts';
import { ISTISNA_REASONS } from '../src/lib/regulated.ts';
import { body, call, MAIN, ROWS, service, setup } from './mcp-fixtures.ts';

describe('mcpToolList', () => {
  test('lists every tool in the MCP page’s order, each scoped to a company', () => {
    const tools = mcpToolList();
    expect(tools.map((tool) => tool.name)).toEqual(Object.keys(MCP_TOOL_COPY));
    expect(tools.every((tool) => !('$schema' in tool.inputSchema))).toBe(true);
    for (const tool of tools) {
      const properties = (tool.inputSchema as { properties: Record<string, unknown> }).properties;
      expect('company' in properties, tool.name).toBe(tool.name !== 'list_companies');
    }
    const create = tools.find((tool) => tool.name === 'create_invoice');
    expect(create?.title).toBe('Taslak oluştur');
    expect(create?.inputSchema).toMatchObject({
      properties: { invoiceType: { enum: ['SATIS', 'ISTISNA'] } },
      required: ['items'],
      type: 'object',
    });
    const sign = tools.find((tool) => tool.name === 'sign_invoices');
    expect(sign?.annotations).toMatchObject({ destructiveHint: true });
  });

  test('tells the server where each write can be checked and each pattern’s message', () => {
    const tools = mcpToolList();
    for (const tool of tools) {
      const { check } = tool['x-angaria'];
      expect(check === undefined, tool.name).toBe(tool.annotations.readOnlyHint === true);
    }
    const create = tools.find((tool) => tool.name === 'create_invoice');
    expect(create?.['x-angaria'].patterns).toMatchObject({
      '^[A-Za-z]{3}$': 'Üç harfli bir para birimi kodu yaz, örneğin USD.',
      '^\\d{10,11}$': 'VKN 10, TCKN 11 haneli olur. Yalnızca rakam yaz.',
      '^\\d{2}\\/\\d{2}\\/\\d{4}$': 'Tarihi GG/AA/YYYY biçiminde yaz, örneğin 01/10/2026.',
    });
    // Every message an agent relays is Turkish: no zod default slips through.
    const text = JSON.stringify(tools.map((tool) => tool['x-angaria']));
    expect(text).not.toMatch(/Expected|Invalid|Must|lütfen|geçerli|geçersiz|hata oluştu|\u2014/);
  });
});

describe('input checks', () => {
  test('name every problem in Turkish by the tool’s own input names', async () => {
    const { ctx, log } = setup();
    const empty = await call(ctx, 'create_invoice', {});
    expect(empty.json.error).toMatchObject({
      code: 'invalid-input',
      fields: { items: 'Bu alan gerekli.' },
      message: 'Girdi aracın şemasına uymuyor.',
    });
    const wrong = await call(ctx, 'create_invoice', {
      customerId: 'acme',
      date: '2026-10-01',
      dueDays: 1.5,
      invoiceType: 'IADE',
      items: [{ name: '', quantity: 0, unitPrice: '5' }],
    });
    expect(wrong.json.error.fields).toEqual({
      date: 'Tarihi GG/AA/YYYY biçiminde yaz, örneğin 01/10/2026.',
      dueDays: 'Tam sayı olmalı.',
      invoiceType: 'Şunlardan biri olmalı: SATIS, ISTISNA.',
      'items.0.name': 'Boş olamaz.',
      'items.0.quantity': '0 değerinden büyük olmalı.',
      'items.0.unitPrice': 'Sayı olmalı.',
    });
    const future = await call(ctx, 'list_invoices', {
      endDate: '02/10/2026',
      startDate: '03/10/2026',
    });
    expect(future.json.error.fields.startDate).toBe(
      'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
    );
    const signTwice = await call(ctx, 'request_signing_sms', { uuids: ['a', 'a'] });
    expect(signTwice.json.error.code).toBe('actions-off');
    expect(log).toEqual([]);
  });

  test('a lowercase currency code is the same code', async () => {
    const { client, ctx } = setup();
    const created = await call(ctx, 'create_invoice', {
      currency: 'eur',
      customerId: 'acme',
      items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
    });
    expect(created.json.currency).toBe('EUR');
    expect(vi.mocked(client.createDraftInvoice).mock.calls[0]?.[1].currency).toBe('EUR');
  });

  test('warnings name the tool’s inputs, never the form’s', async () => {
    const { ctx } = setup();
    const late = await call(ctx, 'create_invoice', {
      customerId: 'acme',
      date: '01/09/2026',
      items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
    });
    expect(Object.keys(late.json.warnings)).toEqual(['date']);

    const self = await call(ctx, 'create_invoice', {
      currency: 'TRY',
      items: [{ name: 'X', quantity: 1, unitPrice: 100, VATRate: 20 }],
      recipient: { fullAddress: 'Adres', taxIDOrTRID: '10000000146', title: 'Ana Firma' },
    });
    expect(self.error).toBe(false);
    expect(self.json.warnings).toEqual({
      'recipient.taxIDOrTRID':
        'Alıcının VKN / TCKN’si senin şirketininkiyle aynı. Kendine fatura kesmediğinden emin ol.',
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
    expect(json.company).toEqual(MAIN);
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
    expect(json.error.fields.endDate).toBe('Tarih aralığı iki uç dahil en çok 31 gün olabilir.');
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
      company: MAIN,
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
      'items.0.VATRate': 'İstisna faturada KDV oranı %0 olmalı (KDV Kanunu 11/1-a)',
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

    await call(ctx, 'create_invoice', {
      currency: 'JPY',
      currencyRate: '0.309677',
      customerId: 'acme',
      items: [{ name: 'X', quantity: 1, unitPrice: 100 }],
    });
    // TCMB quotes JPY per 100 units: the per-unit rate keeps its six decimals.
    expect(vi.mocked(ctx.client.createDraftInvoice).mock.calls[1]?.[1].currencyRate).toBe(
      '0.309677',
    );
  });
});

test('a country in English or an alias goes to GİB by GİB’s name; Turkey stays at home', async () => {
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
  expect(vi.mocked(ctx.onDraftCreated).mock.calls[0]?.[1].recipient.country).toBe(
    'Amerika Birleşik Devletleri',
  );

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

describe('delete_draft', () => {
  test('needs the actions switch, deletes an unsigned draft and refuses a signed invoice', async () => {
    const { allowed, client, ctx, log } = setup();
    const off = await call(ctx, 'delete_draft', { uuid: 'ettn-draft' });
    expect(off.json.error).toEqual({ code: 'actions-off', message: ACTIONS_OFF });
    expect(log).toEqual([]);

    allowed.current = true;
    const signed = await call(ctx, 'delete_draft', {
      date: '01/10/2026',
      reason: 'Hatalı',
      uuid: 'ettn-old',
    });
    expect(signed.error).toBe(true);
    expect(signed.json.error.code).toBe('not-a-draft');
    expect(client.cancelInvoice).not.toHaveBeenCalled();

    const missing = await call(ctx, 'delete_draft', { uuid: 'nope' });
    expect(missing.json.error.code).toBe('not-found');

    const draft = await call(ctx, 'delete_draft', { date: '02/10/2026', uuid: 'ettn-draft' });
    expect(draft).toEqual({
      error: false,
      json: { company: MAIN, message: 'Taslak silindi.', uuid: 'ettn-draft' },
    });
    expect(client.cancelInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ token: '33333301' }),
      'Taslak silindi',
      ROWS[1],
    );
    expect(ctx.onAction).toHaveBeenCalledWith({
      kind: 'draft-deleted',
      number: 'GIB2026000000002',
      uuid: 'ettn-draft',
    });
  });

  test('at most ten deletions a minute', async () => {
    const { ctx } = setup({ actions: true });
    for (let index = 0; index < 10; index++) {
      expect((await call(ctx, 'delete_draft', { uuid: 'nope' })).json.error.code).toBe('not-found');
    }
    const limited = await call(ctx, 'delete_draft', { uuid: 'nope' });
    expect(limited.json.error).toMatchObject({ code: 'rate-limit', retryAfterSeconds: 60 });
  });
});

describe('get_invoice', () => {
  test('summarizes GİB’s detail with the status from the list', async () => {
    const { client, ctx } = setup();
    client.getInvoiceDetail.mockResolvedValue({
      aliciUnvan: 'ACME GMBH',
      belgeNumarasi: 'GIB2026000000003',
      dovzTLkur: '41,2850',
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
      currencyRate: 41.285,
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
    expect(client.getInvoiceHTML).toHaveBeenCalledWith(
      expect.objectContaining({ token: '33333301' }),
      'ettn-new',
      'Onaylanmadı',
    );
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
        currency: 'TRY',
        id: 's1',
        name: 'Yazılım Geliştirme Hizmeti',
        quantity: 1,
        unitPrice: 5000,
        unitType: 'HUR',
        VATRate: 20,
      },
    ]);
    expect(log).toEqual([]);
  });

  test('a draft updates a saved service only in its currency', async () => {
    const usd = service({ currency: 'USD' });
    const legacy = service({ id: 'legacy', name: 'Eski hizmet', unitPrice: 500 });
    const services = [usd, legacy];
    const { ctx } = setup({ company: { services } });
    // What McpHost does with a created draft.
    const learned = async (customerId: string, unitPrice: number) => {
      vi.mocked(ctx.onDraftCreated).mockClear();
      const { error } = await call(ctx, 'create_invoice', {
        customerId,
        items: [
          { name: 'Engineering Services', quantity: 1, unitPrice },
          { name: 'Eski hizmet', quantity: 1, unitPrice: 750 },
        ],
      });
      expect(error).toBe(false);
      const values = vi.mocked(ctx.onDraftCreated).mock.calls[0]?.[1];
      if (!values) {
        throw new Error('No draft');
      }
      return upsertSavedItems(
        services,
        cleanItems(values.items),
        ctx.newId,
        values.invoiceSettings.currency,
      );
    };

    // ÖRNEK is invoiced in lira: the USD service stays as it is.
    const lira = await learned('ornek', 4110.32);
    expect(lira[0]).toBe(usd);
    expect(lira[1]).toMatchObject({ currency: 'TRY', id: 'legacy', unitPrice: 750 });

    // ACME is invoiced in USD: the service takes the new price.
    const dollars = await learned('acme', 120);
    expect(dollars[0]).toMatchObject({ currency: 'USD', id: 'engineering', unitPrice: 120 });
  });
});

describe('gates', () => {
  test('GİB tools need a login; local ones do not', async () => {
    const { ctx, log } = setup({ company: { hasCredentials: false } });
    const list = await call(ctx, 'list_invoices', {
      endDate: '02/10/2026',
      startDate: '01/10/2026',
    });
    expect(list.json.error).toEqual({ code: 'auth', company: MAIN, message: NO_LOGIN });
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
      company: MAIN,
      message: 'GİB e-Arşiv portalı şu an bakımda. Biraz sonra tekrar dene.',
    });
  });

  test('an unknown tool is an error', async () => {
    const { ctx } = setup();
    expect((await call(ctx, 'sign_invoice', {})).json.error.code).toBe('unknown-tool');
  });

  test('a draft points to SMS signing over MCP only while actions are allowed', async () => {
    const { allowed, ctx } = setup();
    const args = { customerId: 'ornek', items: [{ name: 'X', quantity: 1, unitPrice: 100 }] };
    expect((await call(ctx, 'create_invoice', args)).json.message).toBe(DRAFT_CREATED);
    allowed.current = true;
    expect((await call(ctx, 'create_invoice', args)).json.message).toBe(DRAFT_CREATED_SIGNABLE);
  });
});
