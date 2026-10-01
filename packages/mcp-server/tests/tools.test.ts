import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { EarsivClient, SessionInfo } from 'angaria-earsiv-sdk';
import { expect, test, vi } from 'vitest';
import { createServer } from '../src/server.ts';
import { type Credentials, readCredentials } from '../src/session.ts';
import { toInvoiceDetails } from '../src/tools/create-invoice.ts';

const session: SessionInfo = { baseUrl: 'https://test.invalid', cookies: [], token: 'token' };

const unused = () => Promise.reject(new Error('not used in tests'));

function fakeClient(overrides: Partial<EarsivClient> = {}): EarsivClient {
  return {
    cancelInvoice: vi.fn(async () => ({ data: 'silindi' })),
    createDraftInvoice: vi.fn(async (_session, details) => ({
      date: details.date,
      response: {},
      uuid: 'ettn-1',
    })),
    forceLogout: vi.fn(unused),
    getDrafts: vi.fn(async () => []),
    getInvoiceDetail: vi.fn(unused),
    getInvoiceHTML: vi.fn(async () => '<html></html>'),
    getSigningPhone: vi.fn(unused),
    getUUID: vi.fn(unused),
    login: vi.fn(async () => session),
    logout: vi.fn(async () => {}),
    requestSigningSMS: vi.fn(unused),
    signInvoiceHSM: vi.fn(unused),
    startSMSSign: vi.fn(unused),
    verifyAndSign: vi.fn(unused),
    ...overrides,
  };
}

const testCredentials = (): Credentials => ({
  password: 'secret',
  testMode: true,
  username: '33333301',
});

async function connect(client: EarsivClient, credentials = testCredentials) {
  const server = createServer({ client, credentials });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);
  return mcp;
}

async function call(mcp: Client, name: string, args: Record<string, unknown>) {
  const result = await mcp.callTool({ arguments: args, name });
  const [first] = result.content as Array<{ text: string; type: string }>;
  return { isError: result.isError === true, text: first?.text ?? '' };
}

const invoiceArgs = {
  date: '20/03/2026',
  fullAddress: '1 Main St, Berlin',
  items: [{ name: 'Consulting', quantity: 10, unitPrice: 100, VATRate: 0 }],
  taxIDOrTRID: '2222222222',
  time: '10:00:00',
  title: 'Acme GmbH',
};

test('lists the four invoice tools', async () => {
  const mcp = await connect(fakeClient());
  const { tools } = await mcp.listTools();
  expect(tools.map((t) => t.name).toSorted()).toEqual([
    'cancel_invoice',
    'create_invoice',
    'get_invoice_html',
    'list_invoices',
  ]);
  const create = tools.find((t) => t.name === 'create_invoice');
  expect(create?.inputSchema.required?.toSorted()).toEqual([
    'fullAddress',
    'items',
    'taxIDOrTRID',
    'title',
  ]);
});

test('toInvoiceDetails applies defaults and computed totals', () => {
  const details = toInvoiceDetails(
    {
      currencyRate: '41.5',
      fullAddress: 'Addr',
      items: [{ name: 'Dev', quantity: 2, unitPrice: 50, VATRate: 20 }],
      taxIDOrTRID: '2222222222',
      title: 'Acme',
    },
    new Date(2026, 2, 20, 9, 5, 7),
  );
  expect(details).toMatchObject({
    currency: 'USD',
    currencyRate: '41.5',
    date: '20/03/2026',
    grandTotal: 100,
    grandTotalInclVAT: 120,
    invoiceType: 'ISTISNA',
    paymentTotal: 120,
    time: '09:05:07',
    totalVAT: 20,
  });
  expect(details.items[0]).toMatchObject({ price: 100, unitType: 'C62', VATAmount: 20 });
});

test('create_invoice passes mapped details to the SDK and returns the ETTN', async () => {
  const client = fakeClient();
  const mcp = await connect(client);
  const result = await call(mcp, 'create_invoice', { ...invoiceArgs, currency: 'TRY' });

  expect(result.isError).toBe(false);
  expect(JSON.parse(result.text)).toEqual({
    date: '20/03/2026',
    message: 'Invoice created successfully',
    uuid: 'ettn-1',
  });
  expect(client.createDraftInvoice).toHaveBeenCalledWith(
    session,
    expect.objectContaining({
      currency: 'TRY',
      date: '20/03/2026',
      grandTotal: 1000,
      invoiceType: 'ISTISNA',
      taxIDOrTRID: '2222222222',
      time: '10:00:00',
      title: 'Acme GmbH',
    }),
  );
  expect(client.logout).toHaveBeenCalledWith(session);
});

test('create_invoice reports a missing server-assigned ETTN', async () => {
  const client = fakeClient({
    createDraftInvoice: vi.fn(async () => ({ date: '20/03/2026', response: {}, uuid: '' })),
  });
  const mcp = await connect(client);
  const result = await call(mcp, 'create_invoice', { ...invoiceArgs, currency: 'TRY' });

  expect(result.isError).toBe(false);
  const body = JSON.parse(result.text);
  expect(body.uuid).toBeNull();
  expect(body.message).toMatch(/list_invoices/);
});

test('create_invoice rejects invalid input before logging in', async () => {
  const client = fakeClient();
  const mcp = await connect(client);

  const badTaxId = await call(mcp, 'create_invoice', { ...invoiceArgs, taxIDOrTRID: '123' });
  expect(badTaxId.isError).toBe(true);
  expect(badTaxId.text).toMatch(/Input validation error/);

  const noItems = await call(mcp, 'create_invoice', { ...invoiceArgs, items: [] });
  expect(noItems.isError).toBe(true);

  const badDate = await call(mcp, 'create_invoice', { ...invoiceArgs, date: '2026-03-20' });
  expect(badDate.isError).toBe(true);
  expect(badDate.text).toMatch(/DD\/MM\/YYYY/);

  const noRate = await call(mcp, 'create_invoice', { ...invoiceArgs, currency: 'EUR' });
  expect(noRate.isError).toBe(true);
  expect(noRate.text).toMatch(/currencyRate is required/);

  expect(client.login).not.toHaveBeenCalled();
});

test('cancel_invoice deletes the matching unsigned draft', async () => {
  const row = { belgeTarihi: '20/03/2026', ettn: 'ettn-1', onayDurumu: 'Onaylanmadı' };
  const client = fakeClient({ getDrafts: vi.fn(async () => [{ ettn: 'other' }, row]) });
  const mcp = await connect(client);
  const result = await call(mcp, 'cancel_invoice', {
    date: '20/03/2026',
    reason: 'Hatalı düzenlendi',
    uuid: 'ettn-1',
  });

  expect(result.isError).toBe(false);
  expect(client.getDrafts).toHaveBeenCalledWith(session, '13/03/2026', '27/03/2026');
  expect(client.cancelInvoice).toHaveBeenCalledWith(session, 'Hatalı düzenlendi', row);
});

test('cancel_invoice refuses signed or unknown invoices', async () => {
  const client = fakeClient({
    getDrafts: vi.fn(async () => [{ ettn: 'signed', onayDurumu: 'Onaylandı' }]),
  });
  const mcp = await connect(client);

  const signed = await call(mcp, 'cancel_invoice', { reason: 'x', uuid: 'signed' });
  expect(signed.isError).toBe(true);
  expect(signed.text).toMatch(/not an unsigned draft/);

  const missing = await call(mcp, 'cancel_invoice', { reason: 'x', uuid: 'nope' });
  expect(missing.isError).toBe(true);
  expect(missing.text).toMatch(/not found/);

  expect(client.cancelInvoice).not.toHaveBeenCalled();
  expect(client.logout).toHaveBeenCalledTimes(2);
});

test('get_invoice_html defaults to the draft approval status', async () => {
  const client = fakeClient();
  const mcp = await connect(client);
  const result = await call(mcp, 'get_invoice_html', { uuid: 'ettn-1' });

  expect(result).toEqual({ isError: false, text: '<html></html>' });
  expect(client.getInvoiceHTML).toHaveBeenCalledWith(session, 'ettn-1', 'Onaylanmadı');

  const badStatus = await call(mcp, 'get_invoice_html', { onayDurumu: 'Silindi', uuid: 'ettn-1' });
  expect(badStatus.isError).toBe(true);
});

test('list_invoices returns drafts as JSON and validates dates', async () => {
  const client = fakeClient({ getDrafts: vi.fn(async () => [{ ettn: 'ettn-1' }]) });
  const mcp = await connect(client);

  const result = await call(mcp, 'list_invoices', {
    endDate: '31/03/2026',
    startDate: '01/03/2026',
  });
  expect(JSON.parse(result.text)).toEqual([{ ettn: 'ettn-1' }]);
  expect(client.getDrafts).toHaveBeenCalledWith(session, '01/03/2026', '31/03/2026');

  const bad = await call(mcp, 'list_invoices', { endDate: '2026-03-31', startDate: '01/03/2026' });
  expect(bad.isError).toBe(true);
});

test('missing credentials fail the call before logging in', async () => {
  const client = fakeClient();
  const mcp = await connect(client, () => readCredentials({}));
  const result = await call(mcp, 'list_invoices', {
    endDate: '31/03/2026',
    startDate: '01/03/2026',
  });

  expect(result.isError).toBe(true);
  expect(result.text).toMatch(/GIB_USERNAME/);
  expect(client.login).not.toHaveBeenCalled();
});
