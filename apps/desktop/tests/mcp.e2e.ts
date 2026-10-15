// @vitest-environment jsdom
// The built-in MCP server end to end (`pnpm --filter desktop test:mcp`): the
// Rust server (src-tauri/examples/mcp_harness.rs runs it without a window),
// the app's tool code on a real session queue, the SDK and the GİB emulator.
// Real MCP clients connect over HTTP with the token and through the
// angaria-mcp bridge over stdio. Never against live GİB. jsdom: TCMB's XML
// is read with DOMParser, as in the webview.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { startEmulator, type RunningEmulator } from '@angaria/gib-emulator';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createClient } from 'angaria-earsiv-sdk';
import { fetchTCMBRateTable } from 'angaria-utils';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createImportRunner } from '../src/lib/import-run.ts';
import { createMcpState } from '../src/lib/mcp-state.ts';
import {
  callMcpTool,
  DRAFT_CREATED,
  DRAFT_CREATED_SIGNABLE,
  mcpToolList,
  type McpToolContext,
} from '../src/lib/mcp-tools.ts';
import { MCP_TOOL_COPY } from '../src/lib/mcp.ts';
import { createSessionQueue } from '../src/lib/session-queue.ts';
import type { CompanyInfo, Recipient, Service } from '../src/lib/types.ts';
import { toGIB } from '../src/lib/utils.ts';

const TAURI_DIR = join(import.meta.dirname, '../src-tauri');
const HARNESS = join(TAURI_DIR, 'target/debug/examples/mcp_harness');
const ARCH = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
const TRIPLE =
  process.platform === 'darwin'
    ? `${ARCH}-apple-darwin`
    : process.platform === 'win32'
      ? `${ARCH}-pc-windows-msvc.exe`
      : `${ARCH}-unknown-linux-gnu`;
const BRIDGE = join(TAURI_DIR, `binaries/angaria-mcp-${TRIPLE}`);

const ACME: Recipient = {
  city: 'Berlin',
  country: 'Almanya',
  currency: 'USD',
  district: '',
  fullAddress: 'Hauptstraße 42, 10115 Berlin',
  id: 'acme',
  invoiceType: 'ISTISNA',
  name: '',
  surname: '',
  taxIDOrTRID: '2222222222',
  taxOffice: '',
  title: 'ACME GMBH',
};

const TODAY = toGIB(new Date());
const TOOL_NAMES = Object.keys(MCP_TOOL_COPY);

const companyInfo = (name: string, taxID: string): CompanyInfo => ({
  accountHolder: '',
  address: '',
  bankAddress: '',
  bankName: '',
  email: '',
  iban: '',
  name,
  phone: '',
  swiftCode: '',
  taxID,
  taxOffice: '',
});

/**
 * Two companies on the emulator's two freelancers: `main` is active in the
 * app, `other` is reached only by naming it.
 */
const COMPANIES = {
  main: {
    companyInfo: companyInfo('Ana Firma', '10000000146'),
    customers: [ACME] as Array<Recipient>,
    name: 'Ana şirket',
    services: [] as Array<Service>,
    username: '12345678',
  },
  other: {
    companyInfo: companyInfo('İkinci Firma', '1234567890'),
    customers: [] as Array<Recipient>,
    name: 'Şirket 2',
    services: [] as Array<Service>,
    username: '87654321',
  },
};
type CompanyId = keyof typeof COMPANIES;

let emulator: RunningEmulator;
let harness: ChildProcessWithoutNullStreams;
let dir: string;
let port: number;
let token: string;
let actions = false;
/** While true the harness's calls go unanswered, as in a webview that is reloading. */
let away = false;
const heldCalls: Array<string> = [];
const gibLog: Array<string> = [];

beforeAll(async () => {
  emulator = await startEmulator({ log: (line) => gibLog.push(line) });
  const gibClient = createClient({ baseUrl: emulator.url });
  const queue = createSessionQueue(gibClient);
  const state = createMcpState();
  const imports = createImportRunner();
  // What src/shell/mcp-host.tsx builds per company.
  const contextFor = (id: CompanyId): McpToolContext => {
    const company = COMPANIES[id];
    const account = {
      credentials: async () => ({ password: 'angaria', username: company.username }),
      key: company.username,
    };
    return {
      actionsAllowed: () => actions,
      client: gibClient,
      companies: () =>
        (Object.keys(COMPANIES) as Array<CompanyId>).map((key) => ({
          active: key === 'main',
          gibLogin: 'ready',
          id: key,
          legalName: COMPANIES[key].companyInfo.name,
          name: COMPANIES[key].name,
          taxID: COMPANIES[key].companyInfo.taxID,
        })),
      company: () => ({ ...company, hasCredentials: true, id }),
      currencyRate: async (currency, date) =>
        (await fetchTCMBRateTable(date, { baseUrl: emulator.url })).rates.get(currency),
      download: async () => ({ name: 'fatura.pdf', path: null }),
      forceLogout: () => queue.forceClose(account),
      forCompany: (ref) => {
        const found = (Object.keys(COMPANIES) as Array<CompanyId>).find(
          (key) => key === ref || COMPANIES[key].companyInfo.taxID === ref,
        );
        return found ? contextFor(found) : null;
      },
      gib: (task, signal, options) => queue.run(account, task, { ...options, signal }),
      imports,
      lease: (signal) => queue.lease(account, { signal }),
      newId: () => crypto.randomUUID(),
      now: () => new Date(),
      onAction: () => {},
      onDraftCreated: () => {},
      setCompanyInfo: (update) => {
        company.companyInfo = update(company.companyInfo);
      },
      setCustomers: (update) => {
        company.customers = update(company.customers);
      },
      setServices: (update) => {
        company.services = update(company.services);
      },
      state,
    };
  };
  const ctx = contextFor('main');

  dir = await mkdtemp(join(tmpdir(), 'angaria-mcp-e2e-'));
  await writeFile(join(dir, 'tools.json'), JSON.stringify(mcpToolList()));
  harness = spawn(HARNESS, ['--dir', dir, '--tools', join(dir, 'tools.json'), '--port', '0']);
  harness.stderr.pipe(process.stderr);
  port = await new Promise<number>((resolve, reject) => {
    harness.once('error', reject);
    createInterface({ input: harness.stdout }).on('line', (line) => {
      const message = JSON.parse(line);
      if (typeof message.port === 'number') {
        resolve(message.port);
        return;
      }
      if (typeof message.name === 'string' && away) {
        heldCalls.push(message.name);
        return;
      }
      if (typeof message.name === 'string') {
        // What src/shell/mcp-host.tsx does with an mcp:call event.
        void callMcpTool(ctx, message.name, message.arguments).then((result) =>
          harness.stdin.write(`${JSON.stringify({ id: message.id, result })}\n`),
        );
      }
    });
  });
  token = JSON.parse(await readFile(join(dir, 'mcp.json'), 'utf8')).token;
});

afterAll(async () => {
  harness?.stdin.end();
  harness?.kill();
  await emulator?.close();
  await rm(dir, { force: true, recursive: true });
});

const url = () => `http://127.0.0.1:${port}/mcp`;

/** A session opened elsewhere (a browser) holds the main company's GİB login. */
const lockMainLogin = () =>
  fetch(`${emulator.url}/__emulator/lock`, {
    body: JSON.stringify({ userid: COMPANIES.main.username }),
    method: 'POST',
  });

const INITIALIZE = JSON.stringify({
  id: 1,
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    capabilities: {},
    clientInfo: { name: 'raw', version: '1' },
    protocolVersion: '2025-06-18',
  },
});

/** A POST with exactly these headers (Host included), for the access checks. */
function rawStatus(headers: Record<string, string>) {
  return new Promise<number>((resolve, reject) => {
    const outgoing = request(
      {
        headers: { 'content-type': 'application/json', host: `127.0.0.1:${port}`, ...headers },
        host: '127.0.0.1',
        method: 'POST',
        path: '/mcp',
        port,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    outgoing.on('error', reject);
    outgoing.end(INITIALIZE);
  });
}

/** A modern (2026-07-28) request: its version and method in _meta and in headers. */
const post = (method: string, params: object, headers: Record<string, string> = {}) =>
  fetch(url(), {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/clientCapabilities': {},
          'io.modelcontextprotocol/clientInfo': { name: 'modern-e2e', version: '1' },
          'io.modelcontextprotocol/protocolVersion':
            headers['mcp-protocol-version'] ?? '2026-07-28',
        },
      },
    }),
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'mcp-method': method,
      'mcp-protocol-version': '2026-07-28',
      ...headers,
    },
    method: 'POST',
  });

const toolNames = (result: Record<string, unknown>) =>
  (result.tools as Array<{ name: string }>).map((tool) => tool.name);

const text = (result: Awaited<ReturnType<Client['callTool']>>) =>
  JSON.parse((result.content as Array<{ text: string }>)[0]?.text ?? 'null');

describe('access', () => {
  test('needs the token, refuses browser origins and other hosts', async () => {
    const auth = `Bearer ${token}`;
    expect(await rawStatus({})).toBe(401);
    expect(await rawStatus({ authorization: 'Bearer not-the-token' })).toBe(401);
    expect(await rawStatus({ authorization: auth, origin: 'https://evil.example' })).toBe(403);
    expect(await rawStatus({ authorization: auth, host: `evil.example:${port}` })).toBe(403);
    expect(await rawStatus({ authorization: auth })).toBe(200);
  });
});

describe('Streamable HTTP', () => {
  test('a legacy client lists the tools, creates a draft and finds it', async () => {
    const client = new Client({ name: 'e2e-http', version: '0.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url()), {
        requestInit: { headers: { authorization: `Bearer ${token}` } },
      }),
    );
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);

    const created = text(
      await client.callTool({
        arguments: {
          customerId: 'acme',
          items: [{ name: 'Consulting', quantity: 10, unitPrice: 100, unitType: 'HUR' }],
        },
        name: 'create_invoice',
      }),
    );
    expect(created).toMatchObject({
      company: { id: 'main', name: 'Ana şirket' },
      currency: 'USD',
      date: TODAY,
      message: DRAFT_CREATED,
    });
    expect(created.uuid).toMatch(/^[\da-f-]{36}$/);

    const listed = text(
      await client.callTool({
        arguments: { endDate: TODAY, startDate: TODAY },
        name: 'list_invoices',
      }),
    );
    expect(listed.invoices).toContainEqual(
      expect.objectContaining({ recipient: 'ACME GMBH', status: 'Taslak', uuid: created.uuid }),
    );
    expect(gibLog).toContainEqual(expect.stringContaining(`ETTN ${created.uuid}`));
    await client.close();
  });

  test('a read refused for an open GİB session closes it and goes again once, a write never', async () => {
    const client = new Client({ name: 'e2e-locked', version: '0.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url()), {
        requestInit: { headers: { authorization: `Bearer ${token}` } },
      }),
    );
    const list = { arguments: { endDate: TODAY, startDate: TODAY }, name: 'list_invoices' };
    try {
      await lockMainLogin();
      const refused = text(await client.callTool(list));
      expect(refused.error).toMatchObject({ code: 'session-locked' });
      expect(refused.error.message).toContain('close_gib_session');

      actions = true;
      expect(text(await client.callTool(list)).invoices).toBeInstanceOf(Array);

      await lockMainLogin();
      const write = text(
        await client.callTool({
          arguments: { customerId: 'acme', items: [{ name: 'X', quantity: 1, unitPrice: 1 }] },
          name: 'create_invoice',
        }),
      );
      expect(write.error).toMatchObject({ code: 'session-locked' });
      expect(
        text(await client.callTool({ arguments: {}, name: 'close_gib_session' })).message,
      ).toBe('Oturum kapatıldı.');
    } finally {
      actions = false;
      await client.close();
    }
  });

  test('a modern request is checked against its headers', async () => {
    const discover = await post('server/discover', {});
    expect(discover.status).toBe(200);
    expect((await discover.json()).result).toMatchObject({
      resultType: 'complete',
      supportedVersions: expect.arrayContaining(['2026-07-28', '2025-11-25']),
    });

    const customers = await post(
      'tools/call',
      { arguments: {}, name: 'list_customers' },
      {
        'mcp-name': 'list_customers',
      },
    );
    const reply = await customers.json();
    expect(reply.result.resultType).toBe('complete');
    expect(JSON.parse(reply.result.content[0].text).customers[0].id).toBe('acme');

    const mismatch = await post(
      'tools/call',
      { arguments: {}, name: 'list_customers' },
      {
        'mcp-name': 'list_services',
      },
    );
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error.code).toBe(-32_020);

    const future = await post('tools/list', {}, { 'mcp-protocol-version': '2030-01-01' });
    expect(future.status).toBe(400);
    expect((await future.json()).error).toMatchObject({
      code: -32_022,
      data: { requested: '2030-01-01' },
    });
  });
});

describe('a webview that reloads', () => {
  test('input is checked at once, a write it dropped fails at once, a read runs again', async () => {
    const client = new Client({ name: 'e2e-reload', version: '0.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url()), {
        requestInit: { headers: { authorization: `Bearer ${token}` } },
      }),
    );
    away = true;
    const read = client.callTool({ arguments: {}, name: 'list_customers' });
    const write = client.callTool({
      arguments: { country: 'Almanya', taxIDOrTRID: '2222222222', title: 'RELOAD GMBH' },
      name: 'create_customer',
    });
    await expect.poll(() => heldCalls.length).toBe(2);
    harness.stdin.write(`${JSON.stringify({ reload: true })}\n`);

    const dropped = await write;
    expect(dropped.isError).toBe(true);
    expect(text(dropped).error.message).toBe(
      'Angaria işlem sürerken yeniden yüklendi. İşlem tamamlanmış olabilir: tekrar denemeden önce list_customers ile ya da Angaria’daki Müşteriler’de kontrol et.',
    );
    // The Rust server checks the schema itself: no wait for the webview.
    const badDate = await client.callTool({
      arguments: { endDate: TODAY, startDate: '2026-10-01' },
      name: 'list_invoices',
    });
    expect(text(badDate).error).toMatchObject({
      code: 'invalid-input',
      fields: { startDate: 'Tarihi GG/AA/YYYY biçiminde yaz, örneğin 01/10/2026.' },
    });

    away = false;
    harness.stdin.write(`${JSON.stringify({ ready: true })}\n`);
    const listed = await read;
    expect(listed.isError).toBeFalsy();
    expect(text(listed).customers).toContainEqual(expect.objectContaining({ id: 'acme' }));
    expect(heldCalls.toSorted()).toEqual(['create_customer', 'list_customers']);
    await client.close();
  });
});

describe('stdio bridge', () => {
  test('proxies a client to the running server with the token from mcp.json', async () => {
    const client = new Client({ name: 'e2e-stdio', version: '0.0.0' });
    await client.connect(
      new StdioClientTransport({
        command: BRIDGE,
        env: { ...getDefaultEnvironment(), ANGARIA_MCP_DIR: dir },
      }),
    );
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
    const created = text(
      await client.callTool({
        arguments: {
          currencyRate: '41.5',
          customerId: 'acme',
          items: [{ name: 'Support', quantity: 1, unitPrice: 250 }],
        },
        name: 'create_invoice',
      }),
    );
    expect(created.message).toBe(DRAFT_CREATED);
    const listed = text(
      await client.callTool({
        arguments: { endDate: TODAY, startDate: TODAY },
        name: 'list_invoices',
      }),
    );
    expect(listed.invoices).toContainEqual(
      expect.objectContaining({ status: 'Taslak', uuid: created.uuid }),
    );
    await client.close();
  });

  test('an agent signs a draft with the SMS code the user got, per company', async () => {
    await fetch(`${emulator.url}/__emulator/sms-code`, {
      body: JSON.stringify({ code: 'random' }),
      method: 'POST',
    });
    const client = new Client({ name: 'e2e-sign', version: '0.0.0' });
    await client.connect(
      new StdioClientTransport({
        command: BRIDGE,
        env: { ...getDefaultEnvironment(), ANGARIA_MCP_DIR: dir },
      }),
    );
    const companies = text(await client.callTool({ arguments: {}, name: 'list_companies' }));
    expect(companies.companies.map((company: { id: string }) => company.id)).toEqual([
      'main',
      'other',
    ]);

    actions = true;
    const created = text(
      await client.callTool({
        arguments: {
          customerId: 'acme',
          items: [{ name: 'Retainer', quantity: 1, unitPrice: 900 }],
        },
        name: 'create_invoice',
      }),
    );
    expect(created.message).toBe(DRAFT_CREATED_SIGNABLE);

    const requested = text(
      await client.callTool({
        arguments: { uuids: [created.uuid] },
        name: 'request_signing_sms',
      }),
    );
    expect(requested).toMatchObject({ phone: '******4567' });

    // The user reads the code off their phone: the emulator's log of sent codes.
    const emulatorState = await (await fetch(`${emulator.url}/__emulator/state`)).json();
    const sms = emulatorState.sms.findLast(
      (item: { used: boolean; userid: string }) => item.userid === '12345678' && !item.used,
    );
    expect(sms.code).toMatch(/^[A-Z\d]{6}$/);

    const wrong = await client.callTool({
      arguments: {
        code: sms.code === '000000' ? '111111' : '000000',
        operationId: requested.operationId,
      },
      name: 'sign_invoices',
    });
    expect(text(wrong).error).toMatchObject({ attemptsLeft: 2, code: 'sms-code-wrong' });

    // Another company cannot use the operation.
    const elsewhere = await client.callTool({
      arguments: { code: sms.code, company: 'other', operationId: requested.operationId },
      name: 'sign_invoices',
    });
    expect(text(elsewhere).error.code).toBe('other-company');

    const signed = text(
      await client.callTool({
        arguments: { code: sms.code, operationId: requested.operationId },
        name: 'sign_invoices',
      }),
    );
    expect(signed).toMatchObject({
      company: { id: 'main' },
      invoices: [{ status: 'Onaylı', uuid: created.uuid }],
      message: 'Fatura onaylandı.',
    });

    const listed = text(
      await client.callTool({
        arguments: { endDate: TODAY, startDate: TODAY, status: 'signed' },
        name: 'list_invoices',
      }),
    );
    expect(listed.invoices).toContainEqual(
      expect.objectContaining({ status: 'Onaylı', uuid: created.uuid }),
    );

    // The other company's invoices, by its VKN, without the main one's.
    const theirs = text(
      await client.callTool({
        arguments: { company: '1234567890', endDate: TODAY, startDate: TODAY },
        name: 'list_invoices',
      }),
    );
    expect(theirs.company).toMatchObject({ id: 'other', name: 'Şirket 2' });
    expect(theirs.invoices).not.toContainEqual(expect.objectContaining({ uuid: created.uuid }));

    actions = false;
    const off = await client.callTool({
      arguments: { uuids: [created.uuid] },
      name: 'request_signing_sms',
    });
    expect(text(off).error.code).toBe('actions-off');
    await client.close();
  });

  test('serves every supported protocol version over stdio', async () => {
    const bridge = spawn(BRIDGE, [], { env: { ...process.env, ANGARIA_MCP_DIR: dir } });
    type Reply = { error?: { code: number }; result: Record<string, unknown> };
    const pending = new Map<number, (reply: Reply) => void>();
    createInterface({ input: bridge.stdout }).on('line', (line) => {
      const reply = JSON.parse(line);
      pending.get(reply.id)?.(reply);
    });
    let id = 0;
    const send = (method: string, params: object = {}) => {
      id += 1;
      const reply = new Promise<Reply>((resolve) => pending.set(id, resolve));
      bridge.stdin.write(`${JSON.stringify({ id, jsonrpc: '2.0', method, params })}\n`);
      return reply;
    };

    // Legacy: initialize keeps a version it speaks; 2026-07-28 has no
    // initialize, so it gets the newest legacy version.
    for (const [requested, answered] of [
      ['2024-11-05', '2024-11-05'],
      ['2025-03-26', '2025-03-26'],
      ['2025-06-18', '2025-06-18'],
      ['2025-11-25', '2025-11-25'],
      ['2026-07-28', '2025-11-25'],
      ['2099-01-01', '2025-11-25'],
    ]) {
      const init = await send('initialize', {
        capabilities: {},
        clientInfo: { name: 'raw-stdio', version: '1' },
        protocolVersion: requested,
      });
      expect(init.result.protocolVersion).toBe(answered);
      bridge.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
      );
      const legacy = (await send('tools/list')).result;
      expect(toolNames(legacy)).toEqual(TOOL_NAMES);
      // Fields older schemas do not know stay out.
      expect(legacy).not.toHaveProperty('resultType');
      expect(legacy).not.toHaveProperty('ttlMs');
    }

    // Modern (2026-07-28): stateless, version and capabilities in _meta.
    const meta = {
      _meta: {
        'io.modelcontextprotocol/clientCapabilities': {},
        'io.modelcontextprotocol/clientInfo': { name: 'raw-stdio', version: '1' },
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      },
    };
    const cacheable = {
      cacheScope: 'private',
      resultType: 'complete',
      ttlMs: expect.any(Number),
    };
    const discover = (await send('server/discover', meta)).result;
    expect(discover).toMatchObject(cacheable);
    expect((discover.supportedVersions as Array<string>)[0]).toBe('2026-07-28');
    const modern = (await send('tools/list', meta)).result;
    expect(modern).toMatchObject(cacheable);
    expect(toolNames(modern)).toEqual(TOOL_NAMES);
    const companies = (await send('tools/call', { ...meta, arguments: {}, name: 'list_companies' }))
      .result;
    expect(companies).toMatchObject({
      _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'angaria' } },
      resultType: 'complete',
    });
    expect((await send('ping', meta)).error?.code).toBe(-32_601);
    bridge.kill();
  });

  test('answers in Turkish when Angaria’s server is not running', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'angaria-mcp-off-'));
    const bridge = spawn(BRIDGE, [], { env: { ...process.env, ANGARIA_MCP_DIR: empty } });
    const reply = new Promise<{ error: { message: string }; id: number }>((resolve) =>
      createInterface({ input: bridge.stdout }).once('line', (line) => resolve(JSON.parse(line))),
    );
    bridge.stdin.write(`${INITIALIZE}\n`);
    expect(await reply).toMatchObject({
      error: { message: expect.stringContaining('Angaria’ya bağlanılamadı') },
      id: 1,
    });
    bridge.kill();
    await rm(empty, { force: true, recursive: true });
  });
});
