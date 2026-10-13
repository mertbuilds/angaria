import { messages, type RunningEmulator, startEmulator } from '@angaria/gib-emulator';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createClient } from 'angaria-earsiv-sdk';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createServer } from '../src/server.ts';

// The tools end to end: MCP client, server, SDK and the GİB emulator.

const lines: Array<string> = [];
let emulator: RunningEmulator;

beforeAll(async () => {
  emulator = await startEmulator({ log: (line) => lines.push(line) });
});

afterAll(() => emulator.close());

beforeEach(() => {
  emulator.reset();
  lines.length = 0;
});

async function connect() {
  const server = createServer({
    client: createClient({ baseUrl: emulator.url }),
    credentials: () => ({ password: '1', username: '33333301' }),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);
  return mcp;
}

test('parallel tool calls run one at a time on their own sessions', async () => {
  const mcp = await connect();
  const list = () =>
    mcp.callTool({
      arguments: { endDate: '30/09/2026', startDate: '24/09/2026' },
      name: 'list_invoices',
    });

  const results = await Promise.all([list(), list(), list()]);

  expect(results.map((result) => result.isError ?? false)).toEqual([false, false, false]);
  expect(lines.filter((line) => /^(?:login|logout) /.test(line))).toEqual([
    'login 33333301',
    'logout 33333301',
    'login 33333301',
    'logout 33333301',
    'login 33333301',
    'logout 33333301',
  ]);
});

test('a session open elsewhere is a tool error with its code and GİB’s Turkish text', async () => {
  await fetch(`${emulator.url}/__emulator/lock`, {
    body: JSON.stringify({ userid: '33333301' }),
    method: 'POST',
  });
  const mcp = await connect();
  const result = await mcp.callTool({
    arguments: { endDate: '30/09/2026', startDate: '24/09/2026' },
    name: 'list_invoices',
  });
  const [content] = result.content as Array<{ text: string }>;

  expect(result.isError).toBe(true);
  expect(JSON.parse(content.text)).toEqual({
    error: { code: 'session-locked', message: messages.sessionLocked },
  });
});
