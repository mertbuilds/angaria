import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createClient, type EarsivClient } from 'angaria-earsiv-sdk';
import { type Credentials, createSessionRunner, readCredentials } from './session.ts';
import { registerCancelInvoice } from './tools/cancel-invoice.ts';
import { registerCreateInvoice } from './tools/create-invoice.ts';
import { registerGetInvoiceHtml } from './tools/get-invoice-html.ts';
import { registerListInvoices } from './tools/list-invoices.ts';

export interface ServerOptions {
  client?: EarsivClient;
  credentials?: () => Credentials;
}

export function createServer({
  client = createClient(),
  credentials = readCredentials,
}: ServerOptions = {}): McpServer {
  const server = new McpServer({ name: 'angaria-mcp', version: '0.0.0' });
  const context = { client, withSession: createSessionRunner(client, credentials) };

  registerListInvoices(server, context);
  registerCreateInvoice(server, context);
  registerCancelInvoice(server, context);
  registerGetInvoiceHtml(server, context);

  return server;
}
