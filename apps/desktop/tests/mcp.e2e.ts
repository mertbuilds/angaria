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
import {
  callMcpTool,
  DRAFT_CREATED,
  LICENSE_LOCKED,
  mcpToolList,
  type McpToolContext,
} from '../src/lib/mcp-tools.ts';
import { createSessionQueue } from '../src/lib/session-queue.ts';
import type { Recipient } from '../src/lib/types.ts';
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
const TOOL_NAMES = [
  'list_invoices',
  'get_invoice',
  'create_invoice',
  'cancel_invoice',
  'list_customers',
  'list_services',
];

let emulator: RunningEmulator;
let harness: ChildProcessWithoutNullStreams;
let dir: string;
let port: number;
let token: string;
let license: 'locked' | 'ok' = 'ok';
const gibLog: Array<string> = [];

beforeAll(async () => {
  emulator = await startEmulator({ log: (line) => gibLog.push(line) });
  const gibClient = createClient({ baseUrl: emulator.url });
  const queue = createSessionQueue(gibClient);
  const account = {
    credentials: async () => ({ password: '1', username: '33333301' }),
    key: '33333301',
  };
  const ctx: McpToolContext = {
    client: gibClient,
    company: () => ({ customers: [ACME], hasCredentials: true, name: 'Ana şirket', services: [] }),
    currencyRate: async (currency, date) =>
      (await fetchTCMBRateTable(date, { baseUrl: emulator.url })).rates.get(currency),
    gib: (task, signal) => queue.run(account, task, { signal }),
    license: async () => license,
    newId: () => crypto.randomUUID(),
    now: () => new Date(),
    onDraftCreated: () => {},
    onDraftDeleted: () => {},
  };

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
    expect(created).toMatchObject({ currency: 'USD', date: TODAY, message: DRAFT_CREATED });
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

    license = 'locked';
    const locked = await client.callTool({ arguments: {}, name: 'list_customers' });
    license = 'ok';
    expect(locked.isError).toBe(true);
    expect(text(locked).error.message).toBe(LICENSE_LOCKED);
    await client.close();
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
